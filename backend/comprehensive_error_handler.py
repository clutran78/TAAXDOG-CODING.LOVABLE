"""
Comprehensive Error Handling and Logging System for TAAXDOG Receipt Processing
==============================================================================

This module implements a production-ready error handling and logging system for the 
TAAXDOG receipt processing pipeline with the following features:

1. Structured logging with correlation IDs and context tracking
2. Exponential backoff retry logic with circuit breaker pattern
3. User-friendly error messages with recovery options
4. Health monitoring and service status checks
5. Graceful degradation when services are unavailable
6. Performance metrics and alerting
7. Request context management

Author: TAAXDOG Development Team
Date: 2024-12-25
Version: 1.0.0
"""

import logging
import logging.handlers
import json
import time
import random
import traceback
import os
import requests
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from functools import wraps
from contextlib import contextmanager
from threading import local
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Thread-local storage for request context
_request_context = local()

class ErrorSeverity(Enum):
    """Error severity levels for categorization and alerting"""
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

class ServiceStatus(Enum):
    """Service health status enumeration"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    MAINTENANCE = "maintenance"
    UNKNOWN = "unknown"

class ErrorCategory(Enum):
    """Error categories for classification and handling"""
    VALIDATION = "validation"
    NETWORK = "network"
    RATE_LIMIT = "rate_limit"
    AUTHENTICATION = "authentication"
    SERVICE_UNAVAILABLE = "service_unavailable"
    DATA_CORRUPTION = "data_corruption"
    CONFIGURATION = "configuration"
    TIMEOUT = "timeout"
    UNKNOWN = "unknown"

@dataclass
class ErrorContext:
    """Enhanced error context with recovery information"""
    error_id: str
    error_code: str
    user_message: str
    technical_message: str
    severity: ErrorSeverity
    category: ErrorCategory
    stage: ProcessingStage
    recovery_options: List[str]
    retry_possible: bool = False
    retry_delay: int = 0
    max_retries: int = 0
    estimated_fix_time: Optional[str] = None
    contact_support: bool = False
    fallback_available: bool = False
    user_action_required: bool = False
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class ProcessingResult:
    """Standardized processing result structure"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error_context: Optional[ErrorContext] = None
    processing_time_ms: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None

class StructuredLogger:
    """Enhanced structured logger for receipt processing pipeline"""
    
    def __init__(self, logger_name: str = "receipt_processor"):
        self.logger_name = logger_name
        self.logger = logging.getLogger(logger_name)
        self._setup_logging()
    
    def _setup_logging(self):
        """Configure comprehensive logging with multiple handlers"""
        if self.logger.handlers:
            return  # Already configured
        
        self.logger.setLevel(logging.INFO)
        
        # Create logs directory structure
        logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
        os.makedirs(logs_dir, exist_ok=True)
        
        # Console handler for immediate feedback
        console_handler = logging.StreamHandler()
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        
        # Main processing log (rotating)
        main_handler = logging.handlers.RotatingFileHandler(
            os.path.join(logs_dir, 'receipt_processing.log'),
            maxBytes=50*1024*1024,  # 50MB
            backupCount=10
        )
        
        # Error-specific log (rotating)
        error_handler = logging.handlers.RotatingFileHandler(
            os.path.join(logs_dir, 'receipt_errors.log'),
            maxBytes=20*1024*1024,  # 20MB
            backupCount=5
        )
        error_handler.setLevel(logging.ERROR)
        
        # Performance metrics log (rotating)
        perf_handler = logging.handlers.RotatingFileHandler(
            os.path.join(logs_dir, 'performance_metrics.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=3
        )
        
        # Health monitoring log (rotating)
        health_handler = logging.handlers.RotatingFileHandler(
            os.path.join(logs_dir, 'health_monitoring.log'),
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        
        # JSON formatter for structured logging
        class JSONFormatter(logging.Formatter):
            def format(self, record):
                log_entry = {
                    'timestamp': datetime.fromtimestamp(record.created).isoformat(),
                    'level': record.levelname,
                    'logger': record.name,
                    'message': record.getMessage(),
                    'module': record.module,
                    'function': record.funcName,
                    'line': record.lineno
                }
                
                # Add request context if available
                if hasattr(_request_context, 'user_id'):
                    log_entry['user_id'] = _request_context.user_id
                if hasattr(_request_context, 'receipt_id'):
                    log_entry['receipt_id'] = _request_context.receipt_id
                if hasattr(_request_context, 'correlation_id'):
                    log_entry['correlation_id'] = _request_context.correlation_id
                if hasattr(_request_context, 'session_id'):
                    log_entry['session_id'] = _request_context.session_id
                
                # Add extra fields from the record
                for key, value in record.__dict__.items():
                    if key.startswith('log_'):
                        log_entry[key[4:]] = value
                
                return json.dumps(log_entry, default=str)
        
        # Apply formatters
        main_handler.setFormatter(JSONFormatter())
        error_handler.setFormatter(JSONFormatter())
        perf_handler.setFormatter(JSONFormatter())
        health_handler.setFormatter(JSONFormatter())
        console_handler.setFormatter(console_formatter)
        
        # Add handlers to logger
        self.logger.addHandler(console_handler)
        self.logger.addHandler(main_handler)
        self.logger.addHandler(error_handler)
        self.logger.addHandler(perf_handler)
        self.logger.addHandler(health_handler)
    
    def log_receipt_event(self, event_type: str, stage: ProcessingStage, status: str, 
                         message: str, **kwargs):
        """Log structured receipt processing event"""
        extra_data = {
            'log_event_type': event_type,
            'log_stage': stage.value,
            'log_status': status,
            **{f'log_{k}': v for k, v in kwargs.items()}
        }
        
        # Log at appropriate level based on status
        if status.upper() == "ERROR":
            self.logger.error(message, extra=extra_data)
        elif status.upper() == "WARNING":
            self.logger.warning(message, extra=extra_data)
        elif status.upper() == "SUCCESS":
            self.logger.info(message, extra=extra_data)
        else:
            self.logger.info(message, extra=extra_data)

class CircuitBreaker:
    """Circuit breaker pattern implementation for API resilience"""
    
    def __init__(self, service_name: str, failure_threshold: int = 5, 
                 timeout_seconds: int = 60, recovery_timeout: int = 30):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
        self.logger = StructuredLogger(f"circuit_breaker_{service_name}")
    
    def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""
        current_time = time.time()
        
        if self.state == 'OPEN':
            if current_time - self.last_failure_time > self.timeout_seconds:
                self.state = 'HALF_OPEN'
                self.logger.log_receipt_event(
                    'circuit_breaker_half_open', ProcessingStage.GEMINI_API_CALL,
                    'INFO', f'Circuit breaker for {self.service_name} moving to HALF_OPEN state'
                )
            else:
                raise Exception(f"Circuit breaker OPEN for {self.service_name} - service unavailable")
        
        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure(e)
            raise e
    
    def _on_success(self):
        """Handle successful call"""
        if self.state == 'HALF_OPEN':
            self.logger.log_receipt_event(
                'circuit_breaker_recovered', ProcessingStage.GEMINI_API_CALL,
                'INFO', f'Circuit breaker for {self.service_name} recovered - moving to CLOSED'
            )
        
        self.failure_count = 0
        self.state = 'CLOSED'
    
    def _on_failure(self, error: Exception):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        self.logger.log_receipt_event(
            'circuit_breaker_failure', ProcessingStage.GEMINI_API_CALL,
            'WARNING', f'Circuit breaker failure {self.failure_count}/{self.failure_threshold} for {self.service_name}',
            error=str(error), failure_count=self.failure_count
        )
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'
            self.logger.log_receipt_event(
                'circuit_breaker_opened', ProcessingStage.GEMINI_API_CALL,
                'ERROR', f'Circuit breaker OPENED for {self.service_name} - service marked as unavailable',
                failure_threshold=self.failure_threshold
            )

class RetryManager:
    """Advanced retry manager with exponential backoff and jitter"""
    
    def __init__(self):
        self.logger = StructuredLogger("retry_manager")
    
    def retry_with_exponential_backoff(self, func: Callable, max_retries: int = 3,
                                     base_delay: float = 1.0, max_delay: float = 60.0,
                                     backoff_factor: float = 2.0, jitter: bool = True,
                                     retry_on_exceptions: Tuple = (Exception,)) -> Any:
        """Execute function with sophisticated retry logic"""
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                self.logger.log_receipt_event(
                    'retry_attempt', ProcessingStage.GEMINI_API_CALL,
                    'INFO', f'Executing {func.__name__} (attempt {attempt + 1}/{max_retries + 1})',
                    attempt=attempt + 1, max_attempts=max_retries + 1
                )
                
                result = func()
                
                if attempt > 0:
                    self.logger.log_receipt_event(
                        'retry_success', ProcessingStage.GEMINI_API_CALL,
                        'SUCCESS', f'{func.__name__} succeeded on retry attempt {attempt + 1}',
                        successful_attempt=attempt + 1
                    )
                
                return result
                
            except retry_on_exceptions as e:
                last_exception = e
                
                self.logger.log_receipt_event(
                    'retry_failure', ProcessingStage.GEMINI_API_CALL,
                    'WARNING', f'{func.__name__} failed on attempt {attempt + 1}: {str(e)}',
                    attempt=attempt + 1, error=str(e), error_type=type(e).__name__
                )
                
                if attempt == max_retries:
                    break
                
                # Calculate delay with exponential backoff
                delay = min(base_delay * (backoff_factor ** attempt), max_delay)
                
                # Add jitter to prevent thundering herd problem
                if jitter:
                    jitter_amount = random.uniform(0, delay * 0.1)
                    delay += jitter_amount
                
                self.logger.log_receipt_event(
                    'retry_delay', ProcessingStage.GEMINI_API_CALL,
                    'INFO', f'Waiting {delay:.2f}s before retry',
                    retry_delay=delay, next_attempt=attempt + 2
                )
                
                time.sleep(delay)
        
        # All retries exhausted
        self.logger.log_receipt_event(
            'retry_exhausted', ProcessingStage.GEMINI_API_CALL,
            'ERROR', f'{func.__name__} failed after {max_retries + 1} attempts',
            total_attempts=max_retries + 1, final_error=str(last_exception)
        )
        
        raise last_exception

class ErrorCategorizer:
    """Intelligent error categorization and user message generation"""
    
    ERROR_PATTERNS = {
        ErrorCategory.RATE_LIMIT: {
            'patterns': ['rate limit', 'quota exceeded', 'too many requests', '429'],
            'severity': ErrorSeverity.MEDIUM,
            'retry_possible': True,
            'retry_delay': 60,
            'user_message': 'Our service is experiencing high demand. Please wait a moment and try again.',
            'recovery_options': [
                'Wait 1-2 minutes before retrying',
                'Try processing a different receipt',
                'Come back in a few minutes when traffic is lower'
            ],
            'estimated_fix_time': '1-3 minutes'
        },
        ErrorCategory.NETWORK: {
            'patterns': ['connection', 'timeout', 'network', 'unreachable', 'dns', 'connection reset'],
            'severity': ErrorSeverity.MEDIUM,
            'retry_possible': True,
            'retry_delay': 5,
            'user_message': 'Connection issue detected. Please check your internet connection and try again.',
            'recovery_options': [
                'Check your internet connection',
                'Try again in a few seconds',
                'Switch to a more stable network if available',
                'Contact support if the issue persists'
            ],
            'estimated_fix_time': '30 seconds - 2 minutes'
        },
        ErrorCategory.AUTHENTICATION: {
            'patterns': ['unauthorized', 'invalid key', 'forbidden', 'auth', '401', '403'],
            'severity': ErrorSeverity.HIGH,
            'retry_possible': False,
            'user_message': 'Authentication issue with our service. Please contact support.',
            'recovery_options': [
                'Try logging out and logging back in',
                'Clear your browser cache and cookies',
                'Contact technical support for assistance'
            ],
            'contact_support': True,
            'estimated_fix_time': '5-15 minutes'
        },
        ErrorCategory.VALIDATION: {
            'patterns': ['invalid format', 'corrupted', 'unsupported', 'too large', 'too small', 'malformed'],
            'severity': ErrorSeverity.LOW,
            'retry_possible': False,
            'user_message': 'There\'s an issue with your file. Please check the image and try again.',
            'recovery_options': [
                'Ensure your image is clear and well-lit',
                'Check that the file format is supported (JPG, PNG, GIF)',
                'Make sure the file size is under 10MB',
                'Try taking a new photo of the receipt'
            ],
            'user_action_required': True,
            'estimated_fix_time': 'Immediate (user action required)'
        },
        ErrorCategory.SERVICE_UNAVAILABLE: {
            'patterns': ['service unavailable', 'server error', 'internal error', '500', '502', '503', '504'],
            'severity': ErrorSeverity.HIGH,
            'retry_possible': True,
            'retry_delay': 30,
            'user_message': 'Our receipt processing service is temporarily unavailable. Please try again in a few minutes.',
            'recovery_options': [
                'Try again in a few minutes',
                'Save your receipt to process later',
                'Use manual data entry if urgent',
                'Contact support if the issue continues'
            ],
            'fallback_available': True,
            'estimated_fix_time': '2-10 minutes'
        },
        ErrorCategory.TIMEOUT: {
            'patterns': ['timeout', 'timed out', 'deadline exceeded'],
            'severity': ErrorSeverity.MEDIUM,
            'retry_possible': True,
            'retry_delay': 10,
            'user_message': 'Processing is taking longer than expected. Please try again.',
            'recovery_options': [
                'Try uploading the receipt again',
                'Ensure your internet connection is stable',
                'Try again in a few minutes'
            ],
            'estimated_fix_time': '1-5 minutes'
        }
    }
    
    @classmethod
    def categorize_error(cls, error: Exception, stage: ProcessingStage) -> ErrorContext:
        """Categorize error and generate appropriate context"""
        error_str = str(error).lower()
        error_id = f"ERR_{int(time.time())}_{random.randint(1000, 9999)}"
        
        # Find matching error pattern
        for category, config in cls.ERROR_PATTERNS.items():
            if any(pattern in error_str for pattern in config['patterns']):
                return ErrorContext(
                    error_id=error_id,
                    error_code=f"{category.value.upper()}_{error_id}",
                    user_message=config['user_message'],
                    technical_message=str(error),
                    severity=config['severity'],
                    category=category,
                    stage=stage,
                    recovery_options=config['recovery_options'],
                    retry_possible=config.get('retry_possible', False),
                    retry_delay=config.get('retry_delay', 0),
                    max_retries=3 if config.get('retry_possible') else 0,
                    estimated_fix_time=config.get('estimated_fix_time'),
                    contact_support=config.get('contact_support', False),
                    fallback_available=config.get('fallback_available', False),
                    user_action_required=config.get('user_action_required', False),
                    metadata={
                        'error_category': category.value,
                        'processing_stage': stage.value,
                        'timestamp': datetime.now().isoformat(),
                        'original_error_type': type(error).__name__
                    }
                )
        
        # Default error context for unrecognized errors
        return ErrorContext(
            error_id=error_id,
            error_code=f"UNKNOWN_{error_id}",
            user_message='An unexpected error occurred. Please try again or contact support.',
            technical_message=str(error),
            severity=ErrorSeverity.MEDIUM,
            category=ErrorCategory.UNKNOWN,
            stage=stage,
            recovery_options=[
                'Try the action again',
                'Refresh the page and try again',
                'Wait a few minutes and retry',
                'Contact support if the issue persists'
            ],
            retry_possible=True,
            retry_delay=5,
            max_retries=2,
            estimated_fix_time='2-5 minutes',
            metadata={
                'error_category': ErrorCategory.UNKNOWN.value,
                'processing_stage': stage.value,
                'timestamp': datetime.now().isoformat(),
                'original_error_type': type(error).__name__
            }
        )

class HealthMonitor:
    """Comprehensive health monitoring for all system services"""
    
    def __init__(self):
        self.logger = StructuredLogger("health_monitor")
        self.service_status = {}
        self.circuit_breakers = {}
        self.health_cache = {}
        self.cache_ttl = 30  # seconds
    
    def check_gemini_health(self) -> Dict[str, Any]:
        """Check Gemini API health with caching"""
        service_name = 'gemini_api'
        
        # Check cache first
        if self._is_cache_valid(service_name):
            return self.health_cache[service_name]
        
        start_time = time.time()
        
        try:
            api_key = os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
            if not api_key:
                raise Exception("Gemini API key not configured")
            
            # Lightweight health check
            url = f'https://generativelanguage.googleapis.com/v1beta/models?key={api_key}'
            response = requests.get(url, timeout=10)
            
            response_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                status = ServiceStatus.HEALTHY
                message = 'Gemini API is accessible and responding'
            elif response.status_code == 429:
                status = ServiceStatus.DEGRADED
                message = 'Gemini API is accessible but rate limited'
            else:
                status = ServiceStatus.DEGRADED
                message = f'Gemini API returned status {response.status_code}'
            
            health_data = {
                'service': service_name,
                'status': status.value,
                'response_time_ms': response_time,
                'last_check': datetime.now().isoformat(),
                'message': message,
                'version': 'v1beta',
                'endpoint': 'generativelanguage.googleapis.com'
            }
            
            self._cache_health_result(service_name, health_data)
            self.service_status[service_name] = health_data
            
            self.logger.log_receipt_event(
                'health_check_success', ProcessingStage.COMPLETION,
                'SUCCESS', f'Gemini health check completed: {status.value}',
                service=service_name, response_time_ms=response_time, status=status.value
            )
            
            return health_data
            
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            
            health_data = {
                'service': service_name,
                'status': ServiceStatus.UNHEALTHY.value,
                'response_time_ms': response_time,
                'last_check': datetime.now().isoformat(),
                'error': str(e),
                'message': f'Gemini API health check failed: {str(e)}'
            }
            
            self._cache_health_result(service_name, health_data)
            self.service_status[service_name] = health_data
            
            self.logger.log_receipt_event(
                'health_check_failed', ProcessingStage.COMPLETION,
                'ERROR', f'Gemini health check failed: {str(e)}',
                service=service_name, error=str(e), response_time_ms=response_time
            )
            
            return health_data
    
    def check_firebase_health(self) -> Dict[str, Any]:
        """Check Firebase health with enhanced testing"""
        service_name = 'firebase'
        
        if self._is_cache_valid(service_name):
            return self.health_cache[service_name]
        
        start_time = time.time()
        
        try:
            from firebase_config import db
            
            if db:
                # Test with a lightweight read operation
                health_collection = db.collection('health_check')
                test_doc = health_collection.document('test')
                
                # Try to read the document (lightweight operation)
                doc = test_doc.get()
                
                response_time = (time.time() - start_time) * 1000
                
                health_data = {
                    'service': service_name,
                    'status': ServiceStatus.HEALTHY.value,
                    'response_time_ms': response_time,
                    'last_check': datetime.now().isoformat(),
                    'message': 'Firebase Firestore is accessible and responding',
                    'database': 'Firestore'
                }
            else:
                health_data = {
                    'service': service_name,
                    'status': ServiceStatus.UNHEALTHY.value,
                    'response_time_ms': 0,
                    'last_check': datetime.now().isoformat(),
                    'error': 'Firebase database not initialized',
                    'message': 'Firebase connection not available'
                }
            
            self._cache_health_result(service_name, health_data)
            self.service_status[service_name] = health_data
            
            return health_data
            
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            
            health_data = {
                'service': service_name,
                'status': ServiceStatus.UNHEALTHY.value,
                'response_time_ms': response_time,
                'last_check': datetime.now().isoformat(),
                'error': str(e),
                'message': f'Firebase health check failed: {str(e)}'
            }
            
            self._cache_health_result(service_name, health_data)
            self.service_status[service_name] = health_data
            
            self.logger.log_receipt_event(
                'health_check_failed', ProcessingStage.COMPLETION,
                'ERROR', f'Firebase health check failed: {str(e)}',
                service=service_name, error=str(e)
            )
            
            return health_data
    
    def _is_cache_valid(self, service_name: str) -> bool:
        """Check if cached health result is still valid"""
        if service_name not in self.health_cache:
            return False
        
        cache_entry = self.health_cache[service_name]
        cache_time = datetime.fromisoformat(cache_entry['cached_at'])
        return (datetime.now() - cache_time).total_seconds() < self.cache_ttl
    
    def _cache_health_result(self, service_name: str, health_data: Dict[str, Any]):
        """Cache health check result with timestamp"""
        health_data['cached_at'] = datetime.now().isoformat()
        self.health_cache[service_name] = health_data
    
    def get_overall_health(self) -> Dict[str, Any]:
        """Get comprehensive system health status"""
        services = {
            'gemini_api': self.check_gemini_health(),
            'firebase': self.check_firebase_health()
        }
        
        # Calculate overall status
        statuses = [s['status'] for s in services.values()]
        healthy_count = sum(1 for s in statuses if s == ServiceStatus.HEALTHY.value)
        degraded_count = sum(1 for s in statuses if s == ServiceStatus.DEGRADED.value)
        unhealthy_count = sum(1 for s in statuses if s == ServiceStatus.UNHEALTHY.value)
        
        if unhealthy_count == 0 and degraded_count == 0:
            overall_status = ServiceStatus.HEALTHY.value
        elif unhealthy_count == 0:
            overall_status = ServiceStatus.DEGRADED.value
        elif healthy_count > 0:
            overall_status = ServiceStatus.DEGRADED.value
        else:
            overall_status = ServiceStatus.UNHEALTHY.value
        
        health_summary = {
            'overall_status': overall_status,
            'timestamp': datetime.now().isoformat(),
            'services': services,
            'summary': {
                'total_services': len(services),
                'healthy_services': healthy_count,
                'degraded_services': degraded_count,
                'unhealthy_services': unhealthy_count
            },
            'system_info': {
                'python_version': f"{os.sys.version_info.major}.{os.sys.version_info.minor}",
                'environment': os.getenv('FLASK_ENV', 'unknown'),
                'uptime_check': datetime.now().isoformat()
            }
        }
        
        self.logger.log_receipt_event(
            'overall_health_check', ProcessingStage.COMPLETION,
            'INFO', f'Overall system health: {overall_status}',
            overall_status=overall_status,
            healthy_services=healthy_count,
            total_services=len(services)
        )
        
        return health_summary

class FallbackManager:
    """Graceful degradation manager for service failures"""
    
    def __init__(self):
        self.logger = StructuredLogger("fallback_manager")
        self.fallback_metrics = {}
    
    def fallback_receipt_processing(self, image_path: str, user_id: str) -> ProcessingResult:
        """Fallback processing when primary OCR service fails"""
        start_time = time.time()
        
        self.logger.log_receipt_event(
            'fallback_processing_start', ProcessingStage.DATA_EXTRACTION,
            'WARNING', 'Initiating fallback receipt processing due to primary service failure',
            user_id=user_id, image_path=os.path.basename(image_path)
        )
        
        try:
            # Extract basic metadata from the file
            filename = os.path.basename(image_path)
            file_stats = os.stat(image_path)
            file_size = file_stats.st_size
            modification_time = datetime.fromtimestamp(file_stats.st_mtime)
            
            # Generate fallback receipt data
            receipt_id = f"fallback_{int(time.time())}_{random.randint(1000, 9999)}"
            current_time = datetime.now()
            
            fallback_data = {
                'receipt_id': receipt_id,
                'merchant_name': f'Receipt_{current_time.strftime("%Y%m%d_%H%M%S")}',
                'total_amount': 0.0,
                'subtotal': 0.0,
                'gst_amount': 0.0,
                'date': current_time.strftime('%Y-%m-%d'),
                'time': current_time.strftime('%H:%M:%S'),
                'category': 'PERSONAL',
                'confidence': 0.1,
                'processing_method': 'fallback_basic',
                'requires_manual_review': True,
                'ai_processing_available': False,
                'file_metadata': {
                    'original_filename': filename,
                    'file_size_bytes': file_size,
                    'file_modified': modification_time.isoformat(),
                    'processed_at': current_time.isoformat()
                },
                'fallback_info': {
                    'reason': 'primary_ocr_service_unavailable',
                    'fallback_version': '1.0.0',
                    'manual_entry_recommended': True
                }
            }
            
            processing_time = (time.time() - start_time) * 1000
            
            # Track fallback usage metrics
            self._track_fallback_usage('receipt_processing', user_id)
            
            self.logger.log_receipt_event(
                'fallback_processing_success', ProcessingStage.DATA_EXTRACTION,
                'SUCCESS', 'Fallback processing completed successfully',
                processing_time_ms=processing_time,
                fallback_confidence=0.1,
                manual_review_required=True
            )
            
            return ProcessingResult(
                success=True,
                data=fallback_data,
                processing_time_ms=processing_time,
                metadata={
                    'processing_method': 'fallback',
                    'ai_processing': False,
                    'manual_review_required': True,
                    'service_degradation': True,
                    'fallback_reason': 'primary_service_unavailable'
                }
            )
            
        except Exception as e:
            processing_time = (time.time() - start_time) * 1000
            
            self.logger.log_receipt_event(
                'fallback_processing_failed', ProcessingStage.DATA_EXTRACTION,
                'ERROR', f'Fallback processing failed: {str(e)}',
                error=str(e), processing_time_ms=processing_time
            )
            
            error_context = ErrorCategorizer.categorize_error(e, ProcessingStage.DATA_EXTRACTION)
            error_context.user_message = 'Both primary and backup processing failed. Please try again later or contact support.'
            error_context.contact_support = True
            error_context.fallback_available = False
            
            return ProcessingResult(
                success=False,
                error_context=error_context,
                processing_time_ms=processing_time
            )
    
    def fallback_transaction_matching(self, receipt_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Fallback transaction matching when banking API fails"""
        self.logger.log_receipt_event(
            'fallback_matching_start', ProcessingStage.TRANSACTION_MATCHING,
            'WARNING', 'Using fallback transaction matching due to banking API unavailability',
            user_id=user_id
        )
        
        # Track fallback usage
        self._track_fallback_usage('transaction_matching', user_id)
        
        return {
            'matched_transaction_id': None,
            'match_confidence': 0.0,
            'fallback_mode': True,
            'message': 'Transaction matching will be available when banking service is restored',
            'manual_matching_available': True,
            'estimated_restoration': '5-15 minutes'
        }
    
    def _track_fallback_usage(self, service_type: str, user_id: str):
        """Track fallback service usage for monitoring"""
        if service_type not in self.fallback_metrics:
            self.fallback_metrics[service_type] = {
                'usage_count': 0,
                'unique_users': set(),
                'first_used': datetime.now(),
                'last_used': datetime.now()
            }
        
        metrics = self.fallback_metrics[service_type]
        metrics['usage_count'] += 1
        metrics['unique_users'].add(user_id)
        metrics['last_used'] = datetime.now()

# Context manager for request tracking
@contextmanager
def receipt_processing_context(user_id: str, receipt_id: str = None, session_id: str = None):
    """Context manager for tracking receipt processing with automatic cleanup"""
    if not receipt_id:
        receipt_id = f"receipt_{int(time.time())}_{random.randint(1000, 9999)}"
    
    if not session_id:
        session_id = str(uuid.uuid4())
    
    # Set request context
    _request_context.user_id = user_id
    _request_context.receipt_id = receipt_id
    _request_context.session_id = session_id
    _request_context.correlation_id = str(uuid.uuid4())
    _request_context.start_time = time.time()
    
    logger = StructuredLogger()
    
    try:
        logger.log_receipt_event(
            'processing_context_start', ProcessingStage.FILE_UPLOAD,
            'START', f'Receipt processing context initialized for user {user_id}',
            receipt_id=receipt_id, session_id=session_id, correlation_id=_request_context.correlation_id
        )
        
        yield receipt_id
        
        duration = (time.time() - _request_context.start_time) * 1000
        logger.log_receipt_event(
            'processing_context_complete', ProcessingStage.COMPLETION,
            'SUCCESS', f'Receipt processing context completed successfully',
            total_processing_time_ms=duration
        )
        
    except Exception as e:
        duration = (time.time() - _request_context.start_time) * 1000
        logger.log_receipt_event(
            'processing_context_error', ProcessingStage.COMPLETION,
            'ERROR', f'Receipt processing context failed: {str(e)}',
            error=str(e), total_processing_time_ms=duration, error_type=type(e).__name__
        )
        raise
    finally:
        # Clean up request context
        for attr in ['user_id', 'receipt_id', 'session_id', 'correlation_id', 'start_time']:
            if hasattr(_request_context, attr):
                delattr(_request_context, attr)

# Performance monitoring decorator
def monitor_performance(stage: ProcessingStage):
    """Decorator to monitor function performance"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = StructuredLogger("performance_monitor")
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                duration = (time.time() - start_time) * 1000
                
                logger.log_receipt_event(
                    'performance_metric', stage,
                    'SUCCESS', f'Function {func.__name__} completed in {duration:.2f}ms',
                    function=func.__name__, duration_ms=duration, stage=stage.value
                )
                
                return result
            except Exception as e:
                duration = (time.time() - start_time) * 1000
                
                logger.log_receipt_event(
                    'performance_metric', stage,
                    'ERROR', f'Function {func.__name__} failed after {duration:.2f}ms: {str(e)}',
                    function=func.__name__, duration_ms=duration, error=str(e), stage=stage.value
                )
                
                raise
        return wrapper
    return decorator

# Enhanced error handling decorator
def enhanced_error_handling(stage: ProcessingStage, retry_on_failure: bool = False):
    """Comprehensive error handling decorator for receipt processing functions"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = StructuredLogger("error_handler")
            
            try:
                if retry_on_failure and stage in [ProcessingStage.GEMINI_API_CALL, ProcessingStage.TRANSACTION_MATCHING]:
                    retry_manager = RetryManager()
                    return retry_manager.retry_with_exponential_backoff(
                        lambda: func(*args, **kwargs),
                        max_retries=3,
                        base_delay=1.0
                    )
                else:
                    return func(*args, **kwargs)
                    
            except Exception as e:
                error_context = ErrorCategorizer.categorize_error(e, stage)
                
                logger.log_receipt_event(
                    'function_error', stage,
                    'ERROR', f'Function {func.__name__} failed: {error_context.user_message}',
                    function=func.__name__,
                    error_id=error_context.error_id,
                    error_category=error_context.category.value,
                    user_message=error_context.user_message,
                    technical_message=error_context.technical_message
                )
                
                return ProcessingResult(
                    success=False,
                    error_context=error_context
                )
        
        return wrapper
    return decorator

# Global instances
structured_logger = StructuredLogger()
health_monitor = HealthMonitor()
fallback_manager = FallbackManager()
retry_manager = RetryManager()

# Utility functions for easy integration
def log_performance_metric(metric_name: str, value: float, **metadata):
    """Log performance metric for monitoring and alerting"""
    structured_logger.log_receipt_event(
        'performance_metric', ProcessingStage.COMPLETION,
        'INFO', f'Performance metric: {metric_name} = {value}',
        metric_name=metric_name, metric_value=value, **metadata
    )

def get_system_health() -> Dict[str, Any]:
    """Get current system health status"""
    return health_monitor.get_overall_health()

def format_api_error_response(result: ProcessingResult) -> Tuple[Dict[str, Any], int]:
    """Format ProcessingResult as Flask API response"""
    if result.success:
        return {
            'success': True,
            'data': result.data,
            'processing_time_ms': result.processing_time_ms,
            'metadata': result.metadata
        }, 200
    
    error_context = result.error_context
    response_data = {
        'success': False,
        'error': error_context.user_message,
        'error_code': error_context.error_code,
        'error_id': error_context.error_id,
        'recovery_options': error_context.recovery_options,
        'retry_possible': error_context.retry_possible,
        'fallback_available': error_context.fallback_available,
        'user_action_required': error_context.user_action_required,
        'estimated_fix_time': error_context.estimated_fix_time
    }
    
    if error_context.contact_support:
        response_data['contact_support'] = True
    
    if error_context.retry_possible and error_context.retry_delay > 0:
        response_data['retry_after_seconds'] = error_context.retry_delay
    
    if result.processing_time_ms:
        response_data['processing_time_ms'] = result.processing_time_ms
    
    # Determine HTTP status code
    status_code = 500  # default
    if error_context.category == ErrorCategory.VALIDATION:
        status_code = 400
    elif error_context.category == ErrorCategory.AUTHENTICATION:
        status_code = 401
    elif error_context.category == ErrorCategory.RATE_LIMIT:
        status_code = 429
    elif error_context.category == ErrorCategory.SERVICE_UNAVAILABLE:
        status_code = 503
    elif error_context.category == ErrorCategory.TIMEOUT:
        status_code = 408
    
    return response_data, status_code

# Initialize system
def initialize_error_handling_system():
    """Initialize the comprehensive error handling system"""
    try:
        # Test logging setup
        structured_logger.log_receipt_event(
            'system_initialization', ProcessingStage.COMPLETION,
            'SUCCESS', 'Enhanced error handling system initialized successfully'
        )
        
        # Test health monitoring
        health_status = health_monitor.get_overall_health()
        
        structured_logger.log_receipt_event(
            'health_check_initialization', ProcessingStage.COMPLETION,
            'SUCCESS', f'Health monitoring initialized - overall status: {health_status["overall_status"]}'
        )
        
        return True
    except Exception as e:
        print(f"Failed to initialize error handling system: {e}")
        return False

# Auto-initialize when module is imported
if __name__ != "__main__":
    initialize_error_handling_system() 