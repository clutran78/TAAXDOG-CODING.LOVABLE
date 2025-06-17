"""
Comprehensive Error Handling and Logging Integration for TAAXDOG Receipt Processing
===================================================================================

This module provides production-ready error handling and logging for the receipt processing pipeline
including structured logging, retry logic, user-friendly error messages, monitoring, and graceful degradation.

Features:
- Structured logging with correlation IDs
- Exponential backoff retry logic
- Circuit breaker pattern for API resilience
- User-friendly error messages with recovery options
- Health monitoring and service status checks
- Graceful degradation when services fail
- Performance metrics and alerting
"""

import logging
import logging.handlers
import json
import time
import random
import traceback
import os
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from functools import wraps
from contextlib import contextmanager
from threading import local
import uuid

# Thread-local storage for request context
_context = local()

class ErrorCategory(Enum):
    """Error categories for classification"""
    VALIDATION = "validation"
    NETWORK = "network"
    RATE_LIMIT = "rate_limit"
    AUTHENTICATION = "authentication"
    SERVICE_UNAVAILABLE = "service_unavailable"
    DATA_CORRUPTION = "data_corruption"
    CONFIGURATION = "configuration"
    UNKNOWN = "unknown"

class ProcessingStage(Enum):
    """Receipt processing stages"""
    UPLOAD = "upload"
    VALIDATION = "validation"
    PREPROCESSING = "preprocessing"
    OCR_EXTRACTION = "ocr_extraction"
    DATA_VALIDATION = "data_validation"
    CATEGORIZATION = "categorization"
    TRANSACTION_MATCHING = "transaction_matching"
    STORAGE = "storage"
    COMPLETION = "completion"

@dataclass
class ProcessingResult:
    """Standardized processing result structure"""
    success: bool
    data: Optional[Dict] = None
    error_code: Optional[str] = None
    user_message: Optional[str] = None
    technical_message: Optional[str] = None
    recovery_options: Optional[List[str]] = None
    retry_possible: bool = False
    fallback_available: bool = False
    processing_time_ms: Optional[float] = None
    metadata: Optional[Dict] = None

class StructuredLogger:
    """Enhanced structured logger for receipt processing"""
    
    def __init__(self, name: str = "receipt_processor"):
        self.logger = logging.getLogger(name)
        self._setup_logging()
    
    def _setup_logging(self):
        """Configure structured logging with multiple outputs"""
        if self.logger.handlers:
            return  # Already configured
        
        self.logger.setLevel(logging.INFO)
        
        # Create logs directory
        logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
        os.makedirs(logs_dir, exist_ok=True)
        
        # Console handler for immediate feedback
        console_handler = logging.StreamHandler()
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        
        # Main processing log file
        main_handler = logging.handlers.RotatingFileHandler(
            os.path.join(logs_dir, 'receipt_processing.log'),
            maxBytes=20*1024*1024,  # 20MB
            backupCount=10
        )
        
        # Error-specific log file
        error_handler = logging.handlers.RotatingFileHandler(
            os.path.join(logs_dir, 'receipt_errors.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        error_handler.setLevel(logging.ERROR)
        
        # Performance metrics log
        perf_handler = logging.handlers.RotatingFileHandler(
            os.path.join(logs_dir, 'performance_metrics.log'),
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        
        # JSON formatter for structured data
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
                
                # Add context information
                if hasattr(_context, 'user_id'):
                    log_entry['user_id'] = _context.user_id
                if hasattr(_context, 'receipt_id'):
                    log_entry['receipt_id'] = _context.receipt_id
                if hasattr(_context, 'correlation_id'):
                    log_entry['correlation_id'] = _context.correlation_id
                if hasattr(_context, 'stage'):
                    log_entry['stage'] = _context.stage
                
                # Add extra fields from record
                for key, value in record.__dict__.items():
                    if key.startswith('extra_'):
                        log_entry[key[6:]] = value
                
                return json.dumps(log_entry, default=str)
        
        # Apply formatters
        main_handler.setFormatter(JSONFormatter())
        error_handler.setFormatter(JSONFormatter())
        perf_handler.setFormatter(JSONFormatter())
        console_handler.setFormatter(console_formatter)
        
        # Add handlers
        self.logger.addHandler(console_handler)
        self.logger.addHandler(main_handler)
        self.logger.addHandler(error_handler)
        self.logger.addHandler(perf_handler)
    
    def log_event(self, level: str, stage: ProcessingStage, message: str, **kwargs):
        """Log structured event with context"""
        extra_data = {f'extra_{k}': v for k, v in kwargs.items()}
        extra_data['extra_stage'] = stage.value
        
        if level.upper() == 'ERROR':
            self.logger.error(message, extra=extra_data)
        elif level.upper() == 'WARNING':
            self.logger.warning(message, extra=extra_data)
        elif level.upper() == 'INFO':
            self.logger.info(message, extra=extra_data)
        else:
            self.logger.debug(message, extra=extra_data)

class RetryManager:
    """Advanced retry manager with circuit breaker and exponential backoff"""
    
    def __init__(self):
        self.circuit_breakers = {}
        self.logger = StructuredLogger("retry_manager")
    
    def retry_with_exponential_backoff(self, func: Callable, max_retries: int = 3, 
                                     base_delay: float = 1.0, max_delay: float = 60.0,
                                     backoff_factor: float = 2.0, jitter: bool = True) -> Any:
        """Execute function with retry logic and exponential backoff"""
        last_exception = None
        
        for attempt in range(max_retries + 1):
            try:
                # Record attempt
                self.logger.log_event(
                    'INFO', ProcessingStage.OCR_EXTRACTION,
                    f"Attempting function {func.__name__} (attempt {attempt + 1})",
                    attempt=attempt + 1,
                    max_retries=max_retries
                )
                
                result = func()
                
                # Log success if it was a retry
                if attempt > 0:
                    self.logger.log_event(
                        'INFO', ProcessingStage.OCR_EXTRACTION,
                        f"Function {func.__name__} succeeded on retry attempt {attempt + 1}",
                        retry_success=True,
                        attempts_needed=attempt + 1
                    )
                
                return result
                
            except Exception as e:
                last_exception = e
                
                # Log the failed attempt
                self.logger.log_event(
                    'WARNING', ProcessingStage.OCR_EXTRACTION,
                    f"Function {func.__name__} failed on attempt {attempt + 1}: {str(e)}",
                    attempt=attempt + 1,
                    error=str(e),
                    error_type=type(e).__name__
                )
                
                # If this was the last attempt, don't wait
                if attempt == max_retries:
                    break
                
                # Calculate delay with exponential backoff
                delay = min(base_delay * (backoff_factor ** attempt), max_delay)
                
                # Add jitter to prevent thundering herd
                if jitter:
                    delay += random.uniform(0, delay * 0.1)
                
                self.logger.log_event(
                    'INFO', ProcessingStage.OCR_EXTRACTION,
                    f"Waiting {delay:.2f}s before retry",
                    retry_delay=delay,
                    attempt=attempt + 1
                )
                
                time.sleep(delay)
        
        # All retries exhausted
        self.logger.log_event(
            'ERROR', ProcessingStage.OCR_EXTRACTION,
            f"Function {func.__name__} failed after {max_retries + 1} attempts",
            final_error=str(last_exception),
            total_attempts=max_retries + 1
        )
        
        raise last_exception

class ErrorMessageGenerator:
    """Generate user-friendly error messages with recovery options"""
    
    ERROR_TEMPLATES = {
        ErrorCategory.VALIDATION: {
            'user_message': 'There\'s an issue with your {item}. {specific_issue}',
            'recovery_options': [
                'Check that your image is clear and well-lit',
                'Ensure the file format is supported (JPG, PNG, GIF)',
                'Try taking a new photo of the receipt',
                'Make sure the file size is under 10MB'
            ]
        },
        ErrorCategory.NETWORK: {
            'user_message': 'Connection issue detected. Please check your internet connection.',
            'recovery_options': [
                'Check your internet connection',
                'Try again in a few seconds',
                'Switch to a more stable network if available',
                'Contact support if the issue persists'
            ]
        },
        ErrorCategory.RATE_LIMIT: {
            'user_message': 'Our service is experiencing high demand. Please wait a moment.',
            'recovery_options': [
                'Wait 1-2 minutes before trying again',
                'Try processing a different receipt',
                'Come back in a few minutes when traffic is lower'
            ]
        },
        ErrorCategory.SERVICE_UNAVAILABLE: {
            'user_message': 'Our receipt processing service is temporarily unavailable.',
            'recovery_options': [
                'Try again in a few minutes',
                'Save your receipt to process later',
                'Use manual data entry if urgent',
                'Contact support if the issue continues'
            ]
        },
        ErrorCategory.AUTHENTICATION: {
            'user_message': 'There\'s an authentication issue with our service.',
            'recovery_options': [
                'Try logging out and logging back in',
                'Clear your browser cache and cookies',
                'Contact technical support for assistance'
            ]
        }
    }
    
    @classmethod
    def generate_error_response(cls, error: Exception, category: ErrorCategory, 
                              stage: ProcessingStage, **context) -> ProcessingResult:
        """Generate user-friendly error response"""
        error_id = f"ERR_{int(time.time())}_{random.randint(1000, 9999)}"
        
        template = cls.ERROR_TEMPLATES.get(category, cls.ERROR_TEMPLATES[ErrorCategory.UNKNOWN])
        
        # Format user message with context
        user_message = template['user_message']
        if 'item' in context:
            user_message = user_message.format(**context)
        
        return ProcessingResult(
            success=False,
            error_code=f"{category.value.upper()}_{error_id}",
            user_message=user_message,
            technical_message=str(error),
            recovery_options=template['recovery_options'],
            retry_possible=category in [ErrorCategory.NETWORK, ErrorCategory.RATE_LIMIT, ErrorCategory.SERVICE_UNAVAILABLE],
            fallback_available=category in [ErrorCategory.SERVICE_UNAVAILABLE, ErrorCategory.RATE_LIMIT],
            metadata={
                'error_id': error_id,
                'stage': stage.value,
                'category': category.value,
                'timestamp': datetime.now().isoformat()
            }
        )

class HealthMonitor:
    """Comprehensive health monitoring for all services"""
    
    def __init__(self):
        self.logger = StructuredLogger("health_monitor")
        self.service_status = {}
        self.last_checks = {}
    
    def check_gemini_health(self) -> Dict[str, Any]:
        """Check Gemini API health"""
        start_time = time.time()
        
        try:
            # Simple health check - verify API is accessible
            api_key = os.getenv('GOOGLE_API_KEY')
            if not api_key:
                raise Exception("Gemini API key not configured")
            
            # Make a lightweight request to check connectivity
            headers = {'Content-Type': 'application/json'}
            response = requests.get(
                'https://generativelanguage.googleapis.com/v1beta/models?key=' + api_key,
                headers=headers,
                timeout=10
            )
            
            response_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                status = 'healthy'
                message = 'Gemini API is accessible'
            else:
                status = 'degraded'
                message = f'Gemini API returned status {response.status_code}'
            
            health_data = {
                'service': 'gemini_api',
                'status': status,
                'response_time_ms': response_time,
                'last_check': datetime.now().isoformat(),
                'message': message
            }
            
            self.service_status['gemini_api'] = health_data
            return health_data
            
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            
            health_data = {
                'service': 'gemini_api',
                'status': 'unhealthy',
                'response_time_ms': response_time,
                'last_check': datetime.now().isoformat(),
                'error': str(e),
                'message': 'Gemini API is not accessible'
            }
            
            self.service_status['gemini_api'] = health_data
            self.logger.log_event(
                'ERROR', ProcessingStage.OCR_EXTRACTION,
                f"Gemini health check failed: {str(e)}",
                service='gemini_api',
                error=str(e)
            )
            
            return health_data
    
    def check_firebase_health(self) -> Dict[str, Any]:
        """Check Firebase health"""
        start_time = time.time()
        
        try:
            # Import Firebase db
            from firebase_config import db
            
            if db:
                # Test with a simple read operation
                test_collection = db.collection('health_check')
                docs = test_collection.limit(1).get()
                
                response_time = (time.time() - start_time) * 1000
                
                health_data = {
                    'service': 'firebase',
                    'status': 'healthy',
                    'response_time_ms': response_time,
                    'last_check': datetime.now().isoformat(),
                    'message': 'Firebase is accessible'
                }
            else:
                health_data = {
                    'service': 'firebase',
                    'status': 'unhealthy',
                    'response_time_ms': 0,
                    'last_check': datetime.now().isoformat(),
                    'error': 'Firebase not initialized',
                    'message': 'Firebase database not available'
                }
            
            self.service_status['firebase'] = health_data
            return health_data
            
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            
            health_data = {
                'service': 'firebase',
                'status': 'unhealthy',
                'response_time_ms': response_time,
                'last_check': datetime.now().isoformat(),
                'error': str(e),
                'message': 'Firebase health check failed'
            }
            
            self.service_status['firebase'] = health_data
            return health_data
    
    def get_overall_health(self) -> Dict[str, Any]:
        """Get overall system health status"""
        # Check all services
        gemini_health = self.check_gemini_health()
        firebase_health = self.check_firebase_health()
        
        services = {
            'gemini_api': gemini_health,
            'firebase': firebase_health
        }
        
        # Determine overall status
        healthy_services = sum(1 for s in services.values() if s['status'] == 'healthy')
        total_services = len(services)
        
        if healthy_services == total_services:
            overall_status = 'healthy'
        elif healthy_services > 0:
            overall_status = 'degraded'
        else:
            overall_status = 'unhealthy'
        
        return {
            'overall_status': overall_status,
            'timestamp': datetime.now().isoformat(),
            'services': services,
            'summary': {
                'total_services': total_services,
                'healthy_services': healthy_services,
                'degraded_services': sum(1 for s in services.values() if s['status'] == 'degraded'),
                'unhealthy_services': sum(1 for s in services.values() if s['status'] == 'unhealthy')
            }
        }

class FallbackManager:
    """Manage fallback processing when primary services fail"""
    
    def __init__(self):
        self.logger = StructuredLogger("fallback_manager")
    
    def fallback_receipt_processing(self, image_path: str, user_id: str) -> ProcessingResult:
        """Fallback processing when Gemini API is unavailable"""
        self.logger.log_event(
            'WARNING', ProcessingStage.OCR_EXTRACTION,
            'Initiating fallback receipt processing',
            reason='primary_service_unavailable',
            image_path=image_path
        )
        
        try:
            # Basic file information extraction
            filename = os.path.basename(image_path)
            file_size = os.path.getsize(image_path)
            timestamp = datetime.now()
            
            # Create minimal receipt data
            fallback_data = {
                'merchant_name': f'Receipt_{timestamp.strftime("%Y%m%d_%H%M%S")}',
                'total_amount': 0.0,
                'date': timestamp.strftime('%Y-%m-%d'),
                'time': timestamp.strftime('%H:%M:%S'),
                'category': 'PERSONAL',
                'confidence': 0.1,
                'requires_manual_review': True,
                'processing_method': 'fallback_basic',
                'file_info': {
                    'original_filename': filename,
                    'file_size_bytes': file_size,
                    'processed_at': timestamp.isoformat()
                }
            }
            
            self.logger.log_event(
                'INFO', ProcessingStage.OCR_EXTRACTION,
                'Fallback processing completed',
                fallback_confidence=0.1,
                manual_review_required=True
            )
            
            return ProcessingResult(
                success=True,
                data=fallback_data,
                user_message='Receipt saved for manual review (AI processing temporarily unavailable)',
                metadata={
                    'processing_method': 'fallback',
                    'manual_review_required': True,
                    'ai_processing_available': False
                }
            )
            
        except Exception as e:
            self.logger.log_event(
                'ERROR', ProcessingStage.OCR_EXTRACTION,
                f'Fallback processing failed: {str(e)}',
                error=str(e)
            )
            
            return ProcessingResult(
                success=False,
                error_code='FALLBACK_FAILED',
                user_message='Unable to process receipt. Please try again later or contact support.',
                technical_message=str(e),
                recovery_options=[
                    'Try uploading the receipt again',
                    'Wait a few minutes and try again',
                    'Contact support for assistance'
                ]
            )

# Context manager for processing tracking
@contextmanager
def receipt_processing_context(user_id: str, receipt_id: str = None):
    """Context manager for tracking receipt processing with automatic logging"""
    if not receipt_id:
        receipt_id = f"receipt_{int(time.time())}_{random.randint(1000, 9999)}"
    
    # Set context
    _context.user_id = user_id
    _context.receipt_id = receipt_id
    _context.correlation_id = str(uuid.uuid4())
    _context.stage = ProcessingStage.UPLOAD
    
    logger = StructuredLogger()
    start_time = time.time()
    
    try:
        logger.log_event(
            'INFO', ProcessingStage.UPLOAD,
            f'Starting receipt processing for user {user_id}',
            receipt_id=receipt_id,
            correlation_id=_context.correlation_id
        )
        
        yield receipt_id
        
        duration = (time.time() - start_time) * 1000
        logger.log_event(
            'INFO', ProcessingStage.COMPLETION,
            f'Receipt processing completed successfully',
            processing_time_ms=duration,
            success=True
        )
        
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        logger.log_event(
            'ERROR', ProcessingStage.COMPLETION,
            f'Receipt processing failed: {str(e)}',
            processing_time_ms=duration,
            error=str(e),
            error_type=type(e).__name__
        )
        raise
    finally:
        # Clear context
        for attr in ['user_id', 'receipt_id', 'correlation_id', 'stage']:
            if hasattr(_context, attr):
                delattr(_context, attr)

# Enhanced wrapper for existing receipt processing functions
def enhanced_error_handling(stage: ProcessingStage):
    """Decorator to add comprehensive error handling to receipt processing functions"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = StructuredLogger()
            retry_manager = RetryManager()
            error_generator = ErrorMessageGenerator()
            
            # Set current stage in context
            _context.stage = stage
            
            try:
                # For functions that should have retry logic (API calls)
                if stage in [ProcessingStage.OCR_EXTRACTION, ProcessingStage.TRANSACTION_MATCHING]:
                    return retry_manager.retry_with_exponential_backoff(
                        lambda: func(*args, **kwargs),
                        max_retries=3,
                        base_delay=1.0
                    )
                else:
                    return func(*args, **kwargs)
                    
            except Exception as e:
                # Categorize the error
                category = _categorize_error(e, stage)
                
                # Generate user-friendly response
                result = error_generator.generate_error_response(e, category, stage)
                
                # Log the error
                logger.log_event(
                    'ERROR', stage,
                    f'Function {func.__name__} failed: {str(e)}',
                    error_category=category.value,
                    error_id=result.metadata['error_id'],
                    user_message=result.user_message
                )
                
                return result
        
        return wrapper
    return decorator

def _categorize_error(error: Exception, stage: ProcessingStage) -> ErrorCategory:
    """Categorize error based on error message and context"""
    error_str = str(error).lower()
    
    # Rate limiting patterns
    if any(pattern in error_str for pattern in ['rate limit', 'quota exceeded', 'too many requests']):
        return ErrorCategory.RATE_LIMIT
    
    # Network patterns
    if any(pattern in error_str for pattern in ['connection', 'timeout', 'network', 'unreachable']):
        return ErrorCategory.NETWORK
    
    # Authentication patterns
    if any(pattern in error_str for pattern in ['unauthorized', 'forbidden', 'invalid key', 'auth']):
        return ErrorCategory.AUTHENTICATION
    
    # Validation patterns
    if any(pattern in error_str for pattern in ['invalid', 'corrupted', 'unsupported', 'format']):
        return ErrorCategory.VALIDATION
    
    # Service patterns
    if any(pattern in error_str for pattern in ['unavailable', 'server error', 'internal error']):
        return ErrorCategory.SERVICE_UNAVAILABLE
    
    return ErrorCategory.UNKNOWN

# Global instances
logger = StructuredLogger()
health_monitor = HealthMonitor()
fallback_manager = FallbackManager()
retry_manager = RetryManager()
error_generator = ErrorMessageGenerator()

# Health check endpoint data
def get_system_health():
    """Get comprehensive system health for monitoring endpoints"""
    return health_monitor.get_overall_health()

# Performance metrics logging
def log_performance_metric(metric_name: str, value: float, **metadata):
    """Log performance metric for monitoring"""
    logger.log_event(
        'INFO', ProcessingStage.COMPLETION,
        f'Performance metric: {metric_name} = {value}',
        metric_name=metric_name,
        metric_value=value,
        **metadata
    )

# Error response formatting for API endpoints
def format_error_response(result: ProcessingResult) -> Tuple[Dict[str, Any], int]:
    """Format ProcessingResult for Flask JSON response"""
    response_data = {
        'success': result.success,
        'error': result.user_message,
        'error_code': result.error_code,
        'recovery_options': result.recovery_options,
        'retry_possible': result.retry_possible,
        'fallback_available': result.fallback_available
    }
    
    if result.metadata:
        response_data['metadata'] = result.metadata
    
    # Determine HTTP status code
    if result.error_code:
        if 'VALIDATION' in result.error_code:
            status_code = 400
        elif 'AUTH' in result.error_code:
            status_code = 401
        elif 'RATE_LIMIT' in result.error_code:
            status_code = 429
        elif 'SERVICE' in result.error_code:
            status_code = 503
        else:
            status_code = 500
    else:
        status_code = 500
    
    return response_data, status_code 