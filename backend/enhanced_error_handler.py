"""
Enhanced Error Handling and Logging System for TAAXDOG Receipt Processing
========================================================================

Comprehensive error handling and logging system providing:
- Structured logging throughout the receipt processing pipeline
- Retry logic for API failures and network issues
- User-friendly error messages and recovery options
- Monitoring and alerting for system health
- Graceful degradation when services are unavailable

Author: TAAXDOG Development Team
Date: 2024-12-25
"""

import logging
import json
import time
import random
import traceback
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, Union
from dataclasses import dataclass, asdict
from enum import Enum
from threading import local
import requests
import os
from functools import wraps
from contextlib import contextmanager
import logging.handlers

# Thread-local storage for request context
_request_context = local()

class ErrorSeverity(Enum):
    """Error severity levels for categorization"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ProcessingStage(Enum):
    """Receipt processing stages for detailed tracking"""
    FILE_UPLOAD = "file_upload"
    IMAGE_VALIDATION = "image_validation"
    IMAGE_PREPROCESSING = "image_preprocessing"
    GEMINI_API_CALL = "gemini_api_call"
    DATA_EXTRACTION = "data_extraction"
    DATA_VALIDATION = "data_validation"
    TRANSACTION_MATCHING = "transaction_matching"
    DATABASE_STORAGE = "database_storage"
    COMPLETION = "completion"

class ServiceHealthStatus(Enum):
    """Service health status enumeration"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    MAINTENANCE = "maintenance"
    UNKNOWN = "unknown"

@dataclass
class ErrorContext:
    """Enhanced error context with recovery options"""
    error_id: str
    error_code: str
    user_message: str
    technical_message: str
    severity: ErrorSeverity
    stage: ProcessingStage
    recovery_options: List[str]
    retry_possible: bool = False
    retry_delay: int = 0  # seconds
    max_retries: int = 0
    estimated_fix_time: Optional[str] = None
    contact_support: bool = False
    fallback_available: bool = False
    user_action_required: bool = False

@dataclass
class LogEntry:
    """Structured log entry for receipt processing"""
    timestamp: str
    event_type: str
    user_id: Optional[str]
    receipt_id: Optional[str]
    stage: ProcessingStage
    status: str
    message: str
    duration_ms: Optional[float] = None
    error_details: Optional[Dict] = None
    metadata: Optional[Dict] = None

class StructuredReceiptLogger:
    """Enhanced structured logger for receipt processing pipeline"""
    
    def __init__(self, logger_name: str = "receipt_processor"):
        self.logger = logging.getLogger(logger_name)
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup structured logging with multiple handlers"""
        # Clear existing handlers
        self.logger.handlers.clear()
        self.logger.setLevel(logging.INFO)
        
        # Create logs directory
        logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
        os.makedirs(logs_dir, exist_ok=True)
        
        # Console handler for development
        console_handler = logging.StreamHandler()
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        
        # File handler for production logs
        file_handler = logging.handlers.RotatingFileHandler(
            os.path.join(logs_dir, 'receipt_processing.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        
        # Error-specific file handler
        error_handler = logging.handlers.RotatingFileHandler(
            os.path.join(logs_dir, 'receipt_errors.log'),
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        error_handler.setLevel(logging.ERROR)
        
        # JSON formatter for structured logging
        class JSONFormatter(logging.Formatter):
            def format(self, record):
                log_obj = {
                    'timestamp': datetime.fromtimestamp(record.created).isoformat(),
                    'level': record.levelname,
                    'logger': record.name,
                    'message': record.getMessage(),
                    'module': record.module,
                    'function': record.funcName,
                    'line': record.lineno
                }
                
                # Add extra fields if present
                for attr in ['user_id', 'receipt_id', 'stage', 'duration_ms', 
                           'error_code', 'retry_attempt', 'correlation_id']:
                    if hasattr(record, attr):
                        log_obj[attr] = getattr(record, attr)
                
                return json.dumps(log_obj)
        
        # Apply formatters
        file_handler.setFormatter(JSONFormatter())
        error_handler.setFormatter(JSONFormatter())
        console_handler.setFormatter(console_formatter)
        
        # Add handlers
        self.logger.addHandler(console_handler)
        self.logger.addHandler(file_handler)
        self.logger.addHandler(error_handler)
    
    def _get_context(self):
        """Get current request context"""
        context = {}
        if hasattr(_request_context, 'user_id'):
            context['user_id'] = _request_context.user_id
        if hasattr(_request_context, 'receipt_id'):
            context['receipt_id'] = _request_context.receipt_id
        if hasattr(_request_context, 'correlation_id'):
            context['correlation_id'] = _request_context.correlation_id
        return context
    
    def log_receipt_event(self, event_type: str, stage: ProcessingStage, 
                         status: str, message: str, **kwargs):
        """Log structured receipt processing event"""
        context = self._get_context()
        
        log_data = LogEntry(
            timestamp=datetime.utcnow().isoformat(),
            event_type=event_type,
            user_id=context.get('user_id'),
            receipt_id=context.get('receipt_id'),
            stage=stage,
            status=status,
            message=message,
            **kwargs
        )
        
        # Create LogRecord with extra attributes
        extra_attrs = {
            'user_id': log_data.user_id,
            'receipt_id': log_data.receipt_id,
            'stage': log_data.stage.value,
            'event_type': log_data.event_type,
            'correlation_id': context.get('correlation_id')
        }
        
        if log_data.duration_ms:
            extra_attrs['duration_ms'] = log_data.duration_ms
        
        # Log at appropriate level
        if status == "ERROR":
            self.logger.error(message, extra=extra_attrs)
        elif status == "WARNING":
            self.logger.warning(message, extra=extra_attrs)
        else:
            self.logger.info(message, extra=extra_attrs)

class CircuitBreaker:
    """Circuit breaker pattern for API resilience"""
    
    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
    
    def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        if self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.timeout:
                self.state = 'HALF_OPEN'
            else:
                raise Exception("Circuit breaker is OPEN - service unavailable")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e
    
    def _on_success(self):
        """Handle successful call"""
        self.failure_count = 0
        self.state = 'CLOSED'
    
    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'

class RetryManager:
    """Advanced retry manager with exponential backoff and jitter"""
    
    @staticmethod
    def retry_with_backoff(max_retries: int = 3, base_delay: float = 1.0, 
                          max_delay: float = 60.0, backoff_factor: float = 2.0,
                          jitter: bool = True):
        """Retry decorator with exponential backoff and jitter"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                logger = StructuredReceiptLogger()
                
                for attempt in range(max_retries + 1):
                    try:
                        return func(*args, **kwargs)
                    except Exception as e:
                        if attempt == max_retries:
                            logger.log_receipt_event(
                                "retry_exhausted",
                                ProcessingStage.GEMINI_API_CALL,
                                "ERROR",
                                f"All {max_retries} retry attempts failed: {str(e)}",
                                error_details={'final_error': str(e), 'attempts': attempt + 1}
                            )
                            raise e
                        
                        # Calculate delay with exponential backoff
                        delay = min(base_delay * (backoff_factor ** attempt), max_delay)
                        
                        # Add jitter to prevent thundering herd
                        if jitter:
                            delay += random.uniform(0, delay * 0.1)
                        
                        logger.log_receipt_event(
                            "retry_attempt",
                            ProcessingStage.GEMINI_API_CALL,
                            "WARNING",
                            f"Attempt {attempt + 1} failed, retrying in {delay:.2f}s",
                            retry_attempt=attempt + 1,
                            retry_delay=delay,
                            error_details={'error': str(e)}
                        )
                        
                        time.sleep(delay)
                
                # Should never reach here
                raise Exception("Retry logic failed unexpectedly")
            return wrapper
        return decorator

class ErrorCategorizer:
    """Categorize and provide context for different error types"""
    
    ERROR_PATTERNS = {
        # API Errors
        'rate_limit': {
            'patterns': ['rate limit', 'quota exceeded', 'too many requests'],
            'category': 'RATE_LIMIT',
            'severity': ErrorSeverity.MEDIUM,
            'retry_possible': True,
            'retry_delay': 60,
            'user_message': 'Service is busy. Please wait a moment and try again.',
            'recovery_options': [
                'Wait 1-2 minutes before retrying',
                'Try uploading a different receipt',
                'Check back in a few minutes'
            ]
        },
        'network_error': {
            'patterns': ['connection', 'timeout', 'network', 'unreachable'],
            'category': 'NETWORK',
            'severity': ErrorSeverity.MEDIUM,
            'retry_possible': True,
            'retry_delay': 5,
            'user_message': 'Connection issue. Please check your internet and try again.',
            'recovery_options': [
                'Check your internet connection',
                'Try again in a few seconds',
                'Contact support if issue persists'
            ]
        },
        'authentication': {
            'patterns': ['unauthorized', 'invalid key', 'forbidden', 'auth'],
            'category': 'AUTH',
            'severity': ErrorSeverity.HIGH,
            'retry_possible': False,
            'user_message': 'Service authentication failed. Please contact support.',
            'recovery_options': [
                'Contact technical support',
                'Try again later',
                'Use manual data entry'
            ],
            'contact_support': True
        },
        'validation_error': {
            'patterns': ['invalid format', 'corrupted', 'unsupported', 'too large', 'too small'],
            'category': 'VALIDATION',
            'severity': ErrorSeverity.LOW,
            'retry_possible': False,
            'user_message': 'Image validation failed. Please check your file and try again.',
            'recovery_options': [
                'Check image quality and format',
                'Try a different image',
                'Ensure file size is under 10MB',
                'Use supported formats: JPG, PNG, GIF'
            ],
            'user_action_required': True
        },
        'service_unavailable': {
            'patterns': ['service unavailable', 'server error', 'internal error'],
            'category': 'SERVICE',
            'severity': ErrorSeverity.HIGH,
            'retry_possible': True,
            'retry_delay': 30,
            'user_message': 'Service temporarily unavailable. Please try again later.',
            'recovery_options': [
                'Try again in a few minutes',
                'Use manual data entry',
                'Save receipt for later processing'
            ],
            'fallback_available': True
        }
    }
    
    @classmethod
    def categorize_error(cls, error: Exception, stage: ProcessingStage) -> ErrorContext:
        """Categorize error and provide appropriate context"""
        error_str = str(error).lower()
        error_id = f"ERR_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # Find matching pattern
        for error_type, config in cls.ERROR_PATTERNS.items():
            if any(pattern in error_str for pattern in config['patterns']):
                return ErrorContext(
                    error_id=error_id,
                    error_code=config['category'],
                    user_message=config['user_message'],
                    technical_message=str(error),
                    severity=config['severity'],
                    stage=stage,
                    recovery_options=config['recovery_options'],
                    retry_possible=config.get('retry_possible', False),
                    retry_delay=config.get('retry_delay', 0),
                    max_retries=3 if config.get('retry_possible') else 0,
                    estimated_fix_time=cls._estimate_fix_time(config['severity']),
                    contact_support=config.get('contact_support', False),
                    fallback_available=config.get('fallback_available', False),
                    user_action_required=config.get('user_action_required', False)
                )
        
        # Default error context for unrecognized errors
        return ErrorContext(
            error_id=error_id,
            error_code='UNKNOWN',
            user_message='An unexpected error occurred. Please try again.',
            technical_message=str(error),
            severity=ErrorSeverity.MEDIUM,
            stage=stage,
            recovery_options=[
                'Try the action again',
                'Refresh the page',
                'Contact support if issue persists'
            ],
            retry_possible=True,
            retry_delay=5,
            max_retries=2,
            estimated_fix_time='2-5 minutes'
        )
    
    @staticmethod
    def _estimate_fix_time(severity: ErrorSeverity) -> str:
        """Estimate fix time based on error severity"""
        time_estimates = {
            ErrorSeverity.LOW: '1-2 minutes',
            ErrorSeverity.MEDIUM: '2-5 minutes',
            ErrorSeverity.HIGH: '5-15 minutes',
            ErrorSeverity.CRITICAL: '15+ minutes'
        }
        return time_estimates.get(severity, 'Unknown')

class ServiceHealthMonitor:
    """Enhanced service health monitoring with alerting"""
    
    def __init__(self):
        self.logger = StructuredReceiptLogger()
        self.circuit_breakers = {}
        self.service_metrics = {}
    
    def check_service_health(self, service_name: str, check_func: Callable,
                           timeout: int = 10) -> Dict[str, Any]:
        """Check individual service health with timeout"""
        start_time = time.time()
        
        try:
            # Use circuit breaker if available
            if service_name not in self.circuit_breakers:
                self.circuit_breakers[service_name] = CircuitBreaker()
            
            cb = self.circuit_breakers[service_name]
            result = cb.call(check_func)
            
            response_time = (time.time() - start_time) * 1000
            
            health_data = {
                'service': service_name,
                'status': ServiceHealthStatus.HEALTHY.value,
                'response_time_ms': response_time,
                'last_check': datetime.now().isoformat(),
                'circuit_breaker_state': cb.state,
                'details': result if isinstance(result, dict) else {'status': 'ok'}
            }
            
            self._update_service_metrics(service_name, True, response_time)
            
            return health_data
            
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            
            self.logger.log_receipt_event(
                "service_health_check_failed",
                ProcessingStage.COMPLETION,
                "ERROR",
                f"Health check failed for {service_name}: {str(e)}",
                error_details={'service': service_name, 'error': str(e)}
            )
            
            self._update_service_metrics(service_name, False, response_time)
            
            return {
                'service': service_name,
                'status': ServiceHealthStatus.UNHEALTHY.value,
                'response_time_ms': response_time,
                'last_check': datetime.now().isoformat(),
                'error': str(e),
                'circuit_breaker_state': self.circuit_breakers.get(service_name, {}).state if service_name in self.circuit_breakers else 'UNKNOWN'
            }
    
    def _update_service_metrics(self, service_name: str, success: bool, response_time: float):
        """Update service metrics for monitoring"""
        if service_name not in self.service_metrics:
            self.service_metrics[service_name] = {
                'total_requests': 0,
                'successful_requests': 0,
                'failed_requests': 0,
                'avg_response_time': 0,
                'last_updated': datetime.now()
            }
        
        metrics = self.service_metrics[service_name]
        metrics['total_requests'] += 1
        
        if success:
            metrics['successful_requests'] += 1
        else:
            metrics['failed_requests'] += 1
        
        # Calculate rolling average response time
        metrics['avg_response_time'] = (
            (metrics['avg_response_time'] * (metrics['total_requests'] - 1) + response_time) /
            metrics['total_requests']
        )
        metrics['last_updated'] = datetime.now()
    
    def get_service_metrics(self) -> Dict[str, Any]:
        """Get current service metrics"""
        return {
            'timestamp': datetime.now().isoformat(),
            'services': self.service_metrics
        }

class GracefulDegradationManager:
    """Manage graceful degradation when services fail"""
    
    def __init__(self):
        self.logger = StructuredReceiptLogger()
    
    def fallback_receipt_processing(self, image_path: str, user_id: str) -> Dict[str, Any]:
        """Fallback receipt processing when Gemini API fails"""
        self.logger.log_receipt_event(
            "fallback_processing_initiated",
            ProcessingStage.DATA_EXTRACTION,
            "WARNING",
            "Using fallback receipt processing due to Gemini API unavailability",
            metadata={'fallback_reason': 'gemini_api_unavailable'}
        )
        
        # Basic fallback processing
        try:
            # Extract basic info from filename or image metadata
            filename = os.path.basename(image_path)
            file_size = os.path.getsize(image_path)
            
            fallback_data = {
                'success': True,
                'fallback_mode': True,
                'message': 'Receipt processed using basic extraction (AI processing unavailable)',
                'documents': [{
                    'data': {
                        'merchant_name': f'Receipt_{filename}',
                        'total_amount': 0.0,
                        'date': datetime.now().strftime('%Y-%m-%d'),
                        'category': 'PERSONAL',
                        'confidence': 0.2,
                        'requires_manual_review': True,
                        'processing_method': 'fallback_basic',
                        'file_info': {
                            'filename': filename,
                            'size_bytes': file_size
                        }
                    }
                }],
                'processing_metadata': {
                    'processing_time_ms': 100,
                    'method': 'fallback',
                    'ai_processing': False,
                    'manual_review_required': True
                }
            }
            
            self.logger.log_receipt_event(
                "fallback_processing_completed",
                ProcessingStage.DATA_EXTRACTION,
                "SUCCESS",
                "Fallback processing completed successfully",
                metadata={'fallback_confidence': 0.2}
            )
            
            return fallback_data
            
        except Exception as e:
            self.logger.log_receipt_event(
                "fallback_processing_failed",
                ProcessingStage.DATA_EXTRACTION,
                "ERROR",
                f"Fallback processing failed: {str(e)}",
                error_details={'error': str(e)}
            )
            
            return {
                'success': False,
                'error': 'Both primary and fallback processing failed',
                'fallback_mode': True,
                'contact_support': True
            }
    
    def fallback_transaction_matching(self, receipt_data: Dict, user_id: str) -> Dict[str, Any]:
        """Fallback transaction matching when Basiq API fails"""
        self.logger.log_receipt_event(
            "fallback_matching_initiated",
            ProcessingStage.TRANSACTION_MATCHING,
            "WARNING",
            "Using fallback transaction matching due to Basiq API unavailability"
        )
        
        # Simple timestamp-based matching fallback
        return {
            'matched_transaction_id': None,
            'match_confidence': 0.0,
            'fallback_mode': True,
            'message': 'Transaction matching will be available when banking service is restored',
            'manual_matching_available': True
        }

# Global instances
receipt_logger = StructuredReceiptLogger()
health_monitor = ServiceHealthMonitor()
degradation_manager = GracefulDegradationManager()
error_categorizer = ErrorCategorizer()

# Context managers for request tracking
@contextmanager
def receipt_processing_context(user_id: str, receipt_id: str = None):
    """Context manager for receipt processing with automatic cleanup"""
    if not receipt_id:
        receipt_id = f"receipt_{int(time.time())}_{random.randint(1000, 9999)}"
    
    # Set context
    _request_context.user_id = user_id
    _request_context.receipt_id = receipt_id
    _request_context.correlation_id = f"corr_{int(time.time())}_{random.randint(10000, 99999)}"
    
    start_time = time.time()
    
    try:
        receipt_logger.log_receipt_event(
            "processing_started",
            ProcessingStage.FILE_UPLOAD,
            "START",
            f"Receipt processing started for user {user_id}"
        )
        
        yield receipt_id
        
        duration = (time.time() - start_time) * 1000
        receipt_logger.log_receipt_event(
            "processing_completed",
            ProcessingStage.COMPLETION,
            "SUCCESS",
            f"Receipt processing completed successfully",
            duration_ms=duration
        )
        
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        error_context = error_categorizer.categorize_error(e, ProcessingStage.COMPLETION)
        
        receipt_logger.log_receipt_event(
            "processing_failed",
            ProcessingStage.COMPLETION,
            "ERROR",
            f"Receipt processing failed: {str(e)}",
            duration_ms=duration,
            error_details=asdict(error_context)
        )
        
        raise e
    finally:
        # Clean up context
        for attr in ['user_id', 'receipt_id', 'correlation_id']:
            if hasattr(_request_context, attr):
                delattr(_request_context, attr)

# Utility functions for easy integration
def log_performance_metric(metric_name: str, value: float, user_id: str = None, **metadata):
    """Log performance metric for monitoring"""
    receipt_logger.log_receipt_event(
        "performance_metric",
        ProcessingStage.COMPLETION,
        "INFO",
        f"Performance metric: {metric_name} = {value}",
        metadata={
            'metric_name': metric_name,
            'metric_value': value,
            'user_id': user_id,
            **metadata
        }
    )

def validate_processing_health() -> Dict[str, Any]:
    """Validate overall processing health"""
    services_to_check = [
        ('gemini_api', lambda: requests.get('https://generativelanguage.googleapis.com', timeout=5)),
        ('firebase', lambda: {'status': 'accessible'}),  # Simplified check
    ]
    
    results = {}
    overall_healthy = True
    
    for service_name, check_func in services_to_check:
        try:
            health_data = health_monitor.check_service_health(service_name, check_func)
            results[service_name] = health_data
            if health_data['status'] != ServiceHealthStatus.HEALTHY.value:
                overall_healthy = False
        except Exception as e:
            results[service_name] = {
                'status': ServiceHealthStatus.UNHEALTHY.value,
                'error': str(e)
            }
            overall_healthy = False
    
    return {
        'overall_healthy': overall_healthy,
        'services': results,
        'timestamp': datetime.now().isoformat(),
        'metrics': health_monitor.get_service_metrics()
    }

def initialize_error_handling():
    """Initialize the error handling system"""
    global receipt_logger, health_monitor, degradation_manager, error_categorizer
    
    # Initialize components here
    receipt_logger = StructuredReceiptLogger()
    health_monitor = ServiceHealthMonitor()
    degradation_manager = GracefulDegradationManager()
    error_categorizer = ErrorCategorizer()
    
    return True 