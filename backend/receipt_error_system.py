"""
Comprehensive Error Handling and Logging System for TAAXDOG Receipt Processing
=============================================================================

This module provides a robust error handling system with structured logging,
retry logic, user-friendly error messages, health monitoring, graceful degradation,
and performance metrics tracking.

Features:
- Structured logging with JSON format and correlation IDs
- Retry logic with exponential backoff and jitter
- User-friendly error categorization and messages
- Health monitoring with circuit breaker pattern
- Graceful degradation when services fail
- Performance metrics and alerting
- Request context management

Author: TAAXDOG Development Team
Created: 2025-01-26
"""

import logging
import json
import time
import uuid
import random
import traceback
import threading
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable, List, Tuple, Union
from dataclasses import dataclass, asdict
from enum import Enum
from functools import wraps
from logging.handlers import RotatingFileHandler
import os
import requests
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import asyncio

# Thread-local storage for request context
_request_context = threading.local()

class LogLevel(Enum):
    """Enhanced log levels for structured logging"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"
    PERFORMANCE = "PERFORMANCE"
    SECURITY = "SECURITY"

class ErrorCategory(Enum):
    """Categorization of different error types for better handling"""
    VALIDATION = "validation"
    NETWORK = "network"
    RATE_LIMIT = "rate_limit"
    AUTHENTICATION = "authentication"
    SERVICE_UNAVAILABLE = "service_unavailable"
    TIMEOUT = "timeout"
    DATA_CORRUPTION = "data_corruption"
    CONFIGURATION = "configuration"
    BUSINESS_LOGIC = "business_logic"
    UNKNOWN = "unknown"

class ServiceStatus(Enum):
    """Service health status levels"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    MAINTENANCE = "maintenance"
    UNKNOWN = "unknown"

@dataclass
class ErrorContext:
    """Enhanced error context with recovery options"""
    error_code: str
    error_category: ErrorCategory
    user_message: str
    technical_message: str
    recovery_options: List[str]
    retry_possible: bool = False
    retry_delay_seconds: Optional[int] = None
    estimated_fix_time: Optional[str] = None
    contact_support: bool = False
    severity: str = "medium"
    correlation_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'error_code': self.error_code,
            'error_category': self.error_category.value,
            'user_message': self.user_message,
            'technical_message': self.technical_message,
            'recovery_options': self.recovery_options,
            'retry_possible': self.retry_possible,
            'retry_delay_seconds': self.retry_delay_seconds,
            'estimated_fix_time': self.estimated_fix_time,
            'contact_support': self.contact_support,
            'severity': self.severity,
            'correlation_id': self.correlation_id,
            'timestamp': datetime.now().isoformat()
        }

@dataclass
class ServiceHealth:
    """Enhanced service health information"""
    service_name: str
    status: ServiceStatus
    response_time_ms: Optional[float]
    last_check: datetime
    error_message: Optional[str] = None
    version: Optional[str] = None
    availability_percentage: Optional[float] = None
    error_rate: Optional[float] = None
    dependencies: Optional[Dict[str, 'ServiceHealth']] = None
    metrics: Optional[Dict[str, Any]] = None

class StructuredLogger:
    """Enhanced structured logger with multiple handlers and correlation IDs"""
    
    def __init__(self, logger_name: str = "taaxdog", log_dir: str = "logs"):
        self.logger_name = logger_name
        self.log_dir = log_dir
        self.logger = logging.getLogger(logger_name)
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup structured logging with multiple rotating file handlers"""
        if self.logger.handlers:
            # Still need to setup performance logger even if main logger is configured
            if not hasattr(self, 'performance_logger'):
                performance_handler = RotatingFileHandler(
                    os.path.join(self.log_dir, 'taaxdog_performance.log'),
                    maxBytes=5*1024*1024,  # 5MB
                    backupCount=3
                )
                performance_handler.setLevel(logging.INFO)
                performance_handler.setFormatter(self._get_json_formatter())
                self.performance_handler = performance_handler
                self.performance_logger = logging.getLogger(f"{self.logger_name}.performance")
                self.performance_logger.addHandler(performance_handler)
                self.performance_logger.setLevel(logging.INFO)
            return  # Already configured
            
        # Create log directory if it doesn't exist
        os.makedirs(self.log_dir, exist_ok=True)
        
        # Set base level
        self.logger.setLevel(logging.DEBUG)
        
        # Main application logs (INFO and above)
        main_handler = RotatingFileHandler(
            os.path.join(self.log_dir, 'taaxdog_main.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        main_handler.setLevel(logging.INFO)
        main_handler.setFormatter(self._get_json_formatter())
        
        # Error logs (WARNING and above)
        error_handler = RotatingFileHandler(
            os.path.join(self.log_dir, 'taaxdog_errors.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=10
        )
        error_handler.setLevel(logging.WARNING)
        error_handler.setFormatter(self._get_json_formatter())
        
        # Performance logs (custom level)
        performance_handler = RotatingFileHandler(
            os.path.join(self.log_dir, 'taaxdog_performance.log'),
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        performance_handler.setLevel(logging.INFO)
        performance_handler.setFormatter(self._get_json_formatter())
        
        # Console handler for development
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        
        # Add handlers
        self.logger.addHandler(main_handler)
        self.logger.addHandler(error_handler)
        self.logger.addHandler(console_handler)
        
        # Store performance handler separately and add to performance logger
        self.performance_handler = performance_handler
        self.performance_logger = logging.getLogger(f"{self.logger_name}.performance")
        self.performance_logger.addHandler(performance_handler)
        self.performance_logger.setLevel(logging.INFO)
        
    def _get_json_formatter(self):
        """Get JSON formatter for structured logging"""
        class JSONFormatter(logging.Formatter):
            def format(self, record):
                log_data = {
                    'timestamp': datetime.fromtimestamp(record.created).isoformat(),
                    'level': record.levelname,
                    'logger': record.name,
                    'message': record.getMessage(),
                    'module': record.module,
                    'function': record.funcName,
                    'line': record.lineno
                }
                
                # Add correlation ID if available
                if hasattr(_request_context, 'correlation_id'):
                    log_data['correlation_id'] = _request_context.correlation_id
                
                # Add user context if available
                if hasattr(_request_context, 'user_id'):
                    log_data['user_id'] = _request_context.user_id
                
                if hasattr(_request_context, 'request_id'):
                    log_data['request_id'] = _request_context.request_id
                
                # Add exception info if present
                if record.exc_info:
                    log_data['exception'] = self.formatException(record.exc_info)
                
                # Add any extra data
                for key, value in record.__dict__.items():
                    if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                                 'filename', 'module', 'exc_info', 'exc_text', 'stack_info',
                                 'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                                 'thread', 'threadName', 'processName', 'process', 'getMessage']:
                        log_data[key] = value
                
                return json.dumps(log_data, default=str)
        
        return JSONFormatter()
    
    def _get_correlation_id(self) -> str:
        """Get or create correlation ID for request tracking"""
        if not hasattr(_request_context, 'correlation_id'):
            _request_context.correlation_id = str(uuid.uuid4())
        return _request_context.correlation_id
    
    def info(self, message: str, **kwargs):
        """Log info level message with context"""
        self.logger.info(message, extra=kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning level message with context"""
        self.logger.warning(message, extra=kwargs)
    
    def error(self, message: str, **kwargs):
        """Log error level message with context"""
        self.logger.error(message, extra=kwargs)
    
    def critical(self, message: str, **kwargs):
        """Log critical level message with context"""
        self.logger.critical(message, extra=kwargs)
    
    def debug(self, message: str, **kwargs):
        """Log debug level message with context"""
        self.logger.debug(message, extra=kwargs)
    
    def performance(self, message: str, **kwargs):
        """Log performance metrics"""
        # Use the pre-configured performance logger
        self.performance_logger.info(message, extra=kwargs)

class RetryManager:
    """Enhanced retry manager with circuit breaker pattern and jitter"""
    
    def __init__(self, 
                 max_attempts: int = 3,
                 base_delay: float = 1.0,
                 max_delay: float = 60.0,
                 backoff_factor: float = 2.0,
                 jitter: bool = True):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor
        self.jitter = jitter
        self.circuit_breaker = {}  # Per-function circuit breaker state
    
    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff and optional jitter"""
        delay = min(self.base_delay * (self.backoff_factor ** attempt), self.max_delay)
        
        if self.jitter:
            # Add ±25% jitter to prevent thundering herd
            jitter_amount = delay * 0.25
            delay += random.uniform(-jitter_amount, jitter_amount)
        
        return max(0, delay)
    
    def _check_circuit_breaker(self, func_name: str) -> bool:
        """Check if circuit breaker allows execution"""
        if func_name not in self.circuit_breaker:
            return True
        
        state = self.circuit_breaker[func_name]
        
        # If circuit is open, check if we should try to close it
        if state['open']:
            time_since_last_failure = time.time() - state['last_failure']
            if time_since_last_failure > state.get('timeout', 60):
                # Try to close circuit (half-open state)
                state['half_open'] = True
                return True
            return False
        
        return True
    
    def _update_circuit_breaker(self, func_name: str, success: bool):
        """Update circuit breaker state based on operation result"""
        if func_name not in self.circuit_breaker:
            self.circuit_breaker[func_name] = {
                'failure_count': 0,
                'last_failure': 0,
                'open': False,
                'half_open': False
            }
        
        state = self.circuit_breaker[func_name]
        
        if success:
            # Reset failure count on success
            state['failure_count'] = 0
            state['open'] = False
            state['half_open'] = False
        else:
            # Increment failure count
            state['failure_count'] += 1
            state['last_failure'] = time.time()
            
            # Open circuit if too many failures
            if state['failure_count'] >= 5:
                state['open'] = True
                state['timeout'] = min(60 * (2 ** (state['failure_count'] - 5)), 600)  # Max 10 minutes
    
    def retry_with_backoff(self, 
                          exceptions: Tuple = (Exception,),
                          circuit_breaker: bool = True):
        """Decorator for retry logic with exponential backoff and circuit breaker"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                func_name = f"{func.__module__}.{func.__name__}"
                logger = StructuredLogger()
                
                # Check circuit breaker
                if circuit_breaker and not self._check_circuit_breaker(func_name):
                    error_msg = f"Circuit breaker open for {func_name}"
                    logger.warning(error_msg, function=func_name, circuit_breaker_state="open")
                    raise RuntimeError(error_msg)
                
                last_exception = None
                
                for attempt in range(self.max_attempts):
                    try:
                        start_time = time.time()
                        result = func(*args, **kwargs)
                        duration = time.time() - start_time
                        
                        # Update circuit breaker on success
                        if circuit_breaker:
                            self._update_circuit_breaker(func_name, True)
                        
                        # Log successful retry if not first attempt
                        if attempt > 0:
                            logger.info(
                                f"Function {func_name} succeeded on attempt {attempt + 1}",
                                function=func_name,
                                attempt=attempt + 1,
                                max_attempts=self.max_attempts,
                                duration_ms=duration * 1000
                            )
                        
                        return result
                        
                    except exceptions as e:
                        last_exception = e
                        duration = time.time() - start_time
                        
                        # Update circuit breaker on failure
                        if circuit_breaker:
                            self._update_circuit_breaker(func_name, False)
                        
                        if attempt == self.max_attempts - 1:
                            # Last attempt failed
                            logger.error(
                                f"Function {func_name} failed after {self.max_attempts} attempts",
                                function=func_name,
                                error=str(e),
                                error_type=type(e).__name__,
                                total_attempts=self.max_attempts,
                                total_duration_ms=duration * 1000,
                                stack_trace=traceback.format_exc()
                            )
                            raise e
                        
                        # Calculate delay for next retry
                        delay = self._calculate_delay(attempt)
                        
                        logger.warning(
                            f"Function {func_name} failed on attempt {attempt + 1}, retrying in {delay:.2f}s",
                            function=func_name,
                            attempt=attempt + 1,
                            max_attempts=self.max_attempts,
                            error=str(e),
                            error_type=type(e).__name__,
                            retry_delay_seconds=delay,
                            duration_ms=duration * 1000
                        )
                        
                        time.sleep(delay)
                
                return None  # Should never reach here
            
            return wrapper
        return decorator

class ErrorCategorizer:
    """Intelligent error categorization with user-friendly messages"""
    
    ERROR_PATTERNS = {
        ErrorCategory.VALIDATION: [
            'validation', 'invalid', 'missing', 'required', 'format', 'size', 'dimension'
        ],
        ErrorCategory.NETWORK: [
            'connection', 'network', 'timeout', 'dns', 'unreachable', 'connection refused'
        ],
        ErrorCategory.RATE_LIMIT: [
            'rate limit', 'quota', 'throttle', 'too many requests', '429'
        ],
        ErrorCategory.AUTHENTICATION: [
            'authentication', 'unauthorized', 'forbidden', 'api key', 'token', '401', '403'
        ],
        ErrorCategory.SERVICE_UNAVAILABLE: [
            'service unavailable', 'server error', '500', '502', '503', '504', 'maintenance'
        ],
        ErrorCategory.TIMEOUT: [
            'timeout', 'deadline', 'took too long'
        ],
        ErrorCategory.DATA_CORRUPTION: [
            'corrupt', 'malformed', 'invalid json', 'parse error'
        ]
    }
    
    USER_MESSAGES = {
        ErrorCategory.VALIDATION: {
            'message': "There's an issue with the file or data you provided.",
            'recovery_options': [
                "Check that your file is a valid image (JPG, PNG, etc.)",
                "Ensure the file size is under 10MB",
                "Make sure the image is clear and readable",
                "Try uploading a different image"
            ]
        },
        ErrorCategory.NETWORK: {
            'message': "We're having trouble connecting to our services.",
            'recovery_options': [
                "Check your internet connection",
                "Try again in a few moments",
                "If the problem persists, contact support"
            ]
        },
        ErrorCategory.RATE_LIMIT: {
            'message': "Too many requests have been made. Please wait before trying again.",
            'recovery_options': [
                "Wait a minute before uploading another receipt",
                "Try spacing out your uploads",
                "Contact support if you need higher limits"
            ]
        },
        ErrorCategory.AUTHENTICATION: {
            'message': "There's an authentication issue with the service.",
            'recovery_options': [
                "Try logging out and logging back in",
                "Clear your browser cache and cookies",
                "Contact support if the issue persists"
            ]
        },
        ErrorCategory.SERVICE_UNAVAILABLE: {
            'message': "Our receipt processing service is temporarily unavailable.",
            'recovery_options': [
                "Try again in a few minutes",
                "Check our status page for updates",
                "Contact support if the issue persists"
            ]
        },
        ErrorCategory.TIMEOUT: {
            'message': "The request took too long to process.",
            'recovery_options': [
                "Try uploading a smaller or clearer image",
                "Check your internet connection",
                "Try again in a few moments"
            ]
        },
        ErrorCategory.DATA_CORRUPTION: {
            'message': "The data appears to be corrupted or in an unexpected format.",
            'recovery_options': [
                "Try uploading a different image",
                "Ensure the file isn't corrupted",
                "Take a new photo of the receipt"
            ]
        },
        ErrorCategory.UNKNOWN: {
            'message': "An unexpected error occurred.",
            'recovery_options': [
                "Try the operation again",
                "If the problem persists, contact support with the error details"
            ]
        }
    }
    
    @classmethod
    def categorize_error(cls, error: Exception, context: str = "") -> ErrorCategory:
        """Categorize error based on type and message"""
        error_text = f"{str(error)} {context}".lower()
        
        for category, patterns in cls.ERROR_PATTERNS.items():
            if any(pattern in error_text for pattern in patterns):
                return category
        
        # Check exception type
        if isinstance(error, (requests.ConnectionError, requests.Timeout)):
            return ErrorCategory.NETWORK
        elif isinstance(error, requests.HTTPError):
            if error.response.status_code == 429:
                return ErrorCategory.RATE_LIMIT
            elif error.response.status_code in [401, 403]:
                return ErrorCategory.AUTHENTICATION
            elif error.response.status_code >= 500:
                return ErrorCategory.SERVICE_UNAVAILABLE
        elif isinstance(error, (ValueError, TypeError)):
            return ErrorCategory.VALIDATION
        elif isinstance(error, TimeoutError):
            return ErrorCategory.TIMEOUT
        
        return ErrorCategory.UNKNOWN
    
    @classmethod
    def create_error_context(cls, 
                           error: Exception, 
                           context: str = "",
                           correlation_id: Optional[str] = None) -> ErrorContext:
        """Create comprehensive error context with user-friendly messages"""
        category = cls.categorize_error(error, context)
        message_info = cls.USER_MESSAGES[category]
        
        # Determine retry possibility
        retry_possible = category in [
            ErrorCategory.NETWORK, 
            ErrorCategory.TIMEOUT, 
            ErrorCategory.SERVICE_UNAVAILABLE,
            ErrorCategory.RATE_LIMIT
        ]
        
        # Estimate retry delay
        retry_delay = None
        if category == ErrorCategory.RATE_LIMIT:
            retry_delay = 60
        elif category in [ErrorCategory.NETWORK, ErrorCategory.TIMEOUT]:
            retry_delay = 5
        elif category == ErrorCategory.SERVICE_UNAVAILABLE:
            retry_delay = 30
        
        # Determine if support contact is needed
        contact_support = category in [
            ErrorCategory.AUTHENTICATION,
            ErrorCategory.DATA_CORRUPTION,
            ErrorCategory.CONFIGURATION
        ]
        
        # Generate error code
        error_code = f"{category.value.upper()}_{int(time.time())}"
        
        return ErrorContext(
            error_code=error_code,
            error_category=category,
            user_message=message_info['message'],
            technical_message=f"{type(error).__name__}: {str(error)}",
            recovery_options=message_info['recovery_options'],
            retry_possible=retry_possible,
            retry_delay_seconds=retry_delay,
            contact_support=contact_support,
            correlation_id=correlation_id or getattr(_request_context, 'correlation_id', None)
        )

class HealthMonitor:
    """Enhanced health monitoring with caching and detailed diagnostics"""
    
    def __init__(self, cache_duration: int = 30):
        self.cache_duration = cache_duration
        self.health_cache = {}
        self.logger = StructuredLogger()
    
    def _is_cache_valid(self, service_name: str) -> bool:
        """Check if cached health data is still valid"""
        if service_name not in self.health_cache:
            return False
        
        cache_entry = self.health_cache[service_name]
        age = time.time() - cache_entry['timestamp']
        return age < self.cache_duration
    
    def _cache_health_result(self, service_name: str, health: ServiceHealth):
        """Cache health check result"""
        self.health_cache[service_name] = {
            'health': health,
            'timestamp': time.time()
        }
    
    def check_service_health(self, service_name: str, check_func: Callable) -> ServiceHealth:
        """Check health of a service with caching"""
        # Return cached result if available and valid
        if self._is_cache_valid(service_name):
            return self.health_cache[service_name]['health']
        
        start_time = time.time()
        
        try:
            # Run health check with timeout
            with ThreadPoolExecutor() as executor:
                future = executor.submit(check_func)
                result = future.result(timeout=10)  # 10 second timeout
            
            response_time = (time.time() - start_time) * 1000
            
            health = ServiceHealth(
                service_name=service_name,
                status=ServiceStatus.HEALTHY,
                response_time_ms=response_time,
                last_check=datetime.now()
            )
            
            self._cache_health_result(service_name, health)
            return health
            
        except TimeoutError:
            health = ServiceHealth(
                service_name=service_name,
                status=ServiceStatus.UNHEALTHY,
                response_time_ms=None,
                last_check=datetime.now(),
                error_message="Health check timed out"
            )
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            health = ServiceHealth(
                service_name=service_name,
                status=ServiceStatus.UNHEALTHY,
                response_time_ms=response_time,
                last_check=datetime.now(),
                error_message=str(e)
            )
        
        self._cache_health_result(service_name, health)
        return health
    
    def check_gemini_health(self) -> ServiceHealth:
        """Check Gemini API health"""
        def gemini_check():
            # Simple ping to check if API is responding
            api_key = os.getenv('GOOGLE_API_KEY')
            if not api_key:
                raise ValueError("Gemini API key not configured")
            
            # Try a minimal API call
            headers = {'Content-Type': 'application/json'}
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            
            response = requests.get(url, headers=headers, timeout=5)
            response.raise_for_status()
            return True
        
        return self.check_service_health("gemini_api", gemini_check)
    
    def check_firebase_health(self) -> ServiceHealth:
        """Check Firebase health"""
        def firebase_check():
            try:
                from ..firebase_config import db
                if not db:
                    raise ValueError("Firebase not configured")
                
                # Try a simple read operation
                test_ref = db.collection('health_check').limit(1)
                list(test_ref.get())
                return True
            except ImportError:
                raise ValueError("Firebase SDK not available")
        
        return self.check_service_health("firebase", firebase_check)
    
    def get_overall_health(self) -> Dict[str, Any]:
        """Get overall system health status"""
        services = {
            'gemini_api': self.check_gemini_health,
            'firebase': self.check_firebase_health
        }
        
        health_results = {}
        healthy_count = 0
        degraded_count = 0
        
        for service_name, check_func in services.items():
            health = check_func()
            health_results[service_name] = {
                'status': health.status.value,
                'response_time_ms': health.response_time_ms,
                'last_check': health.last_check.isoformat(),
                'error_message': health.error_message
            }
            
            if health.status == ServiceStatus.HEALTHY:
                healthy_count += 1
            elif health.status == ServiceStatus.DEGRADED:
                degraded_count += 1
        
        # Determine overall status
        total_services = len(services)
        if healthy_count == total_services:
            overall_status = ServiceStatus.HEALTHY
        elif healthy_count + degraded_count >= total_services * 0.7:  # 70% threshold
            overall_status = ServiceStatus.DEGRADED
        else:
            overall_status = ServiceStatus.UNHEALTHY
        
        return {
            'overall_status': overall_status.value,
            'services': health_results,
            'summary': {
                'total_services': total_services,
                'healthy': healthy_count,
                'degraded': degraded_count,
                'unhealthy': total_services - healthy_count - degraded_count
            },
            'timestamp': datetime.now().isoformat()
        }

class FallbackManager:
    """Graceful degradation and fallback processing"""
    
    @staticmethod
    def fallback_receipt_processing(image_data: bytes, filename: str) -> Dict[str, Any]:
        """Fallback receipt processing when primary OCR service fails"""
        logger = StructuredLogger()
        
        logger.info(
            "Using fallback receipt processing",
            receipt_filename=filename,
            fallback_method="basic_extraction"
        )
        
        # Basic fallback: extract minimal information
        fallback_data = {
            'success': True,
            'data': {
                'merchant_name': 'Unknown Merchant',
                'total_amount': 0.00,
                'date': datetime.now().strftime('%Y-%m-%d'),
                'confidence_score': 0.1,  # Low confidence for fallback
                'processing_method': 'fallback',
                'requires_manual_review': True
            },
            'processing_metadata': {
                'fallback_used': True,
                'manual_review_required': True,
                'processing_time_ms': 100
            }
        }
        
        return fallback_data
    
    @staticmethod
    def fallback_health_check() -> Dict[str, Any]:
        """Fallback health status when monitoring fails"""
        return {
            'status': ServiceStatus.UNKNOWN.value,
            'message': 'Health monitoring temporarily unavailable',
            'timestamp': datetime.now().isoformat(),
            'fallback': True
        }

# Enhanced error handling decorator
def handle_errors(fallback_func: Optional[Callable] = None, 
                 log_errors: bool = True,
                 return_error_context: bool = False):
    """
    Enhanced error handling decorator with fallback support
    
    Args:
        fallback_func: Function to call when error occurs
        log_errors: Whether to log errors
        return_error_context: Whether to return ErrorContext instead of raising
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = StructuredLogger()
            correlation_id = getattr(_request_context, 'correlation_id', str(uuid.uuid4()))
            
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if log_errors:
                    logger.error(
                        f"Error in {func.__name__}",
                        function=func.__name__,
                        error=str(e),
                        error_type=type(e).__name__,
                        correlation_id=correlation_id,
                        stack_trace=traceback.format_exc()
                    )
                
                # Create error context
                error_context = ErrorCategorizer.create_error_context(
                    e, f"Function: {func.__name__}", correlation_id
                )
                
                # Try fallback if provided
                if fallback_func:
                    try:
                        logger.info(
                            f"Attempting fallback for {func.__name__}",
                            function=func.__name__,
                            fallback_function=fallback_func.__name__,
                            correlation_id=correlation_id
                        )
                        return fallback_func(*args, **kwargs)
                    except Exception as fallback_error:
                        logger.error(
                            f"Fallback failed for {func.__name__}",
                            function=func.__name__,
                            fallback_function=fallback_func.__name__,
                            fallback_error=str(fallback_error),
                            correlation_id=correlation_id
                        )
                
                if return_error_context:
                    return error_context
                else:
                    raise e
        
        return wrapper
    return decorator

# Performance monitoring functions
def log_performance_metric(metric_name: str, 
                          value: Union[int, float], 
                          user_id: Optional[str] = None,
                          additional_data: Optional[Dict[str, Any]] = None):
    """Log performance metrics with structured data"""
    logger = StructuredLogger()
    
    metric_data = {
        'metric_name': metric_name,
        'value': value,
        'timestamp': datetime.now().isoformat(),
        'correlation_id': getattr(_request_context, 'correlation_id', None),
        'user_id': user_id or getattr(_request_context, 'user_id', None)
    }
    
    if additional_data:
        metric_data.update(additional_data)
    
    logger.performance(f"Performance metric: {metric_name}", **metric_data)

def measure_performance(func: Callable) -> Callable:
    """Decorator to measure and log function performance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            
            log_performance_metric(
                f"{func.__name__}_duration_ms",
                duration * 1000,
                additional_data={
                    'function': func.__name__,
                    'success': True
                }
            )
            
            return result
        except Exception as e:
            duration = time.time() - start_time
            
            log_performance_metric(
                f"{func.__name__}_duration_ms",
                duration * 1000,
                additional_data={
                    'function': func.__name__,
                    'success': False,
                    'error_type': type(e).__name__
                }
            )
            
            raise e
    
    return wrapper

# Request context management
def set_request_context(user_id: Optional[str] = None, 
                       request_id: Optional[str] = None,
                       correlation_id: Optional[str] = None):
    """Set request context for logging and tracking"""
    if user_id:
        _request_context.user_id = user_id
    if request_id:
        _request_context.request_id = request_id
    
    _request_context.correlation_id = correlation_id or str(uuid.uuid4())

def get_request_context() -> Dict[str, Any]:
    """Get current request context"""
    context = {}
    
    if hasattr(_request_context, 'user_id'):
        context['user_id'] = _request_context.user_id
    if hasattr(_request_context, 'request_id'):
        context['request_id'] = _request_context.request_id
    if hasattr(_request_context, 'correlation_id'):
        context['correlation_id'] = _request_context.correlation_id
    
    return context

# Initialize global instances
structured_logger = StructuredLogger()
retry_manager = RetryManager()
health_monitor = HealthMonitor()
fallback_manager = FallbackManager()

# Export commonly used decorators and functions
retry_with_backoff = retry_manager.retry_with_backoff 