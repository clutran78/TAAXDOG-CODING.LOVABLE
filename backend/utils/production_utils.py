"""
Production Utilities for TAAXDOG
===============================

Comprehensive production-ready utilities including:
- Structured logging with correlation IDs
- Retry logic with exponential backoff
- User-friendly error messages and recovery options
- Health monitoring and service status checks
- Graceful degradation when services fail
- Performance monitoring and alerting
"""

import logging
import time
import functools
import uuid
import json
import traceback
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Callable, List, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from threading import local
import asyncio
from concurrent.futures import ThreadPoolExecutor
import os

# Thread-local storage for request context
_request_context = local()

class LogLevel(Enum):
    """Log levels for structured logging"""
    DEBUG = "DEBUG"
    INFO = "INFO"  
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class ServiceStatus(Enum):
    """Service health status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class ErrorContext:
    """Error context for user-friendly error handling"""
    error_code: str
    user_message: str
    technical_message: str
    recovery_options: List[str]
    retry_possible: bool = False
    estimated_fix_time: Optional[str] = None
    contact_support: bool = False

@dataclass
class ServiceHealth:
    """Service health status information"""
    service_name: str
    status: ServiceStatus
    response_time_ms: Optional[float]
    last_check: datetime
    error_message: Optional[str] = None
    version: Optional[str] = None
    dependencies: Optional[Dict[str, 'ServiceHealth']] = None

class StructuredLogger:
    """Enhanced structured logger with correlation IDs and context"""
    
    def __init__(self, logger_name: str):
        self.logger = logging.getLogger(logger_name)
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup structured logging format"""
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    def _get_correlation_id(self) -> str:
        """Get or create correlation ID for request tracking"""
        if not hasattr(_request_context, 'correlation_id'):
            _request_context.correlation_id = str(uuid.uuid4())
        return _request_context.correlation_id
    
    def _format_log_data(self, message: str, **kwargs) -> str:
        """Format log data with correlation ID and context"""
        log_data = {
            'timestamp': datetime.now().isoformat(),
            'correlation_id': self._get_correlation_id(),
            'message': message,
            **kwargs
        }
        
        # Add user context if available
        if hasattr(_request_context, 'user_id'):
            log_data['user_id'] = _request_context.user_id
        
        if hasattr(_request_context, 'request_id'):
            log_data['request_id'] = _request_context.request_id
            
        return json.dumps(log_data, default=str)
    
    def info(self, message: str, **kwargs):
        """Log info level message"""
        self.logger.info(self._format_log_data(message, **kwargs))
    
    def warning(self, message: str, **kwargs):
        """Log warning level message"""
        self.logger.warning(self._format_log_data(message, **kwargs))
    
    def error(self, message: str, **kwargs):
        """Log error level message"""
        self.logger.error(self._format_log_data(message, **kwargs))
    
    def critical(self, message: str, **kwargs):
        """Log critical level message"""
        self.logger.critical(self._format_log_data(message, **kwargs))
    
    def debug(self, message: str, **kwargs):
        """Log debug level message"""
        self.logger.debug(self._format_log_data(message, **kwargs))

# Global logger instance
logger = StructuredLogger('taaxdog')

def set_request_context(user_id: Optional[str] = None, request_id: Optional[str] = None):
    """Set request context for logging"""
    if user_id:
        _request_context.user_id = user_id
    if request_id:
        _request_context.request_id = request_id
    _request_context.correlation_id = str(uuid.uuid4())

def retry_with_backoff(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    backoff_factor: float = 2.0,
    exceptions: Tuple = (Exception,)
):
    """
    Decorator for retry logic with exponential backoff
    
    Args:
        max_attempts: Maximum number of retry attempts
        base_delay: Initial delay between retries (seconds)
        max_delay: Maximum delay between retries (seconds)
        backoff_factor: Multiplier for delay on each retry
        exceptions: Tuple of exceptions to catch and retry
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_attempts):
                try:
                    result = func(*args, **kwargs)
                    
                    # Log successful retry if not first attempt
                    if attempt > 0:
                        logger.info(
                            f"Function {func.__name__} succeeded on attempt {attempt + 1}",
                            function=func.__name__,
                            attempt=attempt + 1,
                            max_attempts=max_attempts
                        )
                    
                    return result
                    
                except exceptions as e:
                    last_exception = e
                    
                    if attempt == max_attempts - 1:
                        # Last attempt failed
                        logger.error(
                            f"Function {func.__name__} failed after {max_attempts} attempts",
                            function=func.__name__,
                            error=str(e),
                            total_attempts=max_attempts,
                            error_type=type(e).__name__
                        )
                        raise e
                    
                    # Calculate delay with exponential backoff
                    delay = min(base_delay * (backoff_factor ** attempt), max_delay)
                    
                    logger.warning(
                        f"Function {func.__name__} failed on attempt {attempt + 1}, retrying in {delay}s",
                        function=func.__name__,
                        attempt=attempt + 1,
                        error=str(e),
                        retry_delay=delay,
                        error_type=type(e).__name__
                    )
                    
                    time.sleep(delay)
            
            # This should never be reached, but just in case
            raise last_exception
        
        return wrapper
    return decorator

class ErrorHandler:
    """User-friendly error handling with recovery options"""
    
    # Error code mappings
    ERROR_CODES = {
        'GEMINI_API_ERROR': ErrorContext(
            error_code='GEMINI_API_ERROR',
            user_message='Receipt processing is temporarily unavailable. Please try again in a few minutes.',
            technical_message='Gemini API request failed',
            recovery_options=[
                'Try uploading the receipt again',
                'Check your internet connection',
                'Contact support if the issue persists'
            ],
            retry_possible=True,
            estimated_fix_time='2-5 minutes'
        ),
        'BASIQ_API_ERROR': ErrorContext(
            error_code='BASIQ_API_ERROR',
            user_message='Banking data is temporarily unavailable. Your transactions will sync automatically once the connection is restored.',
            technical_message='Basiq API request failed',
            recovery_options=[
                'Banking data will sync automatically',
                'Upload receipts manually in the meantime',
                'Check account connections in settings'
            ],
            retry_possible=True,
            estimated_fix_time='5-10 minutes'
        ),
        'FIREBASE_ERROR': ErrorContext(
            error_code='FIREBASE_ERROR',
            user_message='There was an issue saving your data. Please try again.',
            technical_message='Firebase database operation failed',
            recovery_options=[
                'Try the action again',
                'Check your internet connection',
                'Data may sync automatically when connection improves'
            ],
            retry_possible=True,
            estimated_fix_time='1-3 minutes'
        ),
        'ABR_API_ERROR': ErrorContext(
            error_code='ABR_API_ERROR',
            user_message='ABN verification is temporarily unavailable. Basic validation will be used instead.',
            technical_message='Australian Business Register API request failed',
            recovery_options=[
                'ABN format validation will still work',
                'Detailed verification will retry automatically',
                'You can continue using the application normally'
            ],
            retry_possible=True,
            estimated_fix_time='10-15 minutes'
        ),
        'VALIDATION_ERROR': ErrorContext(
            error_code='VALIDATION_ERROR',
            user_message='Please check your input and try again.',
            technical_message='Input validation failed',
            recovery_options=[
                'Verify all required fields are filled',
                'Check data format (dates, amounts, etc.)',
                'Contact support if you believe this is an error'
            ],
            retry_possible=False
        ),
        'NETWORK_ERROR': ErrorContext(
            error_code='NETWORK_ERROR',
            user_message='Network connection issue. Please check your internet connection and try again.',
            technical_message='Network request failed',
            recovery_options=[
                'Check your internet connection',
                'Try again in a few minutes',
                'Contact your network administrator if issue persists'
            ],
            retry_possible=True,
            estimated_fix_time='Depends on your connection'
        ),
        'UNKNOWN_ERROR': ErrorContext(
            error_code='UNKNOWN_ERROR',
            user_message='An unexpected error occurred. Our team has been notified.',
            technical_message='Unhandled exception',
            recovery_options=[
                'Try refreshing the page',
                'Contact support with details of what you were doing',
                'Try again later'
            ],
            retry_possible=True,
            contact_support=True
        )
    }
    
    @classmethod
    def handle_error(cls, error: Exception, context: str = '', user_id: str = '') -> ErrorContext:
        """
        Handle error and return user-friendly error context
        
        Args:
            error: The exception that occurred
            context: Additional context about where the error occurred
            user_id: User ID for logging purposes
            
        Returns:
            ErrorContext with user-friendly information
        """
        
        # Determine error type and get appropriate context
        error_type = type(error).__name__
        error_message = str(error)
        
        # Map common errors to user-friendly contexts
        if 'gemini' in error_message.lower() or 'google' in error_message.lower():
            error_context = cls.ERROR_CODES['GEMINI_API_ERROR']
        elif 'basiq' in error_message.lower():
            error_context = cls.ERROR_CODES['BASIQ_API_ERROR']
        elif 'firebase' in error_message.lower() or 'firestore' in error_message.lower():
            error_context = cls.ERROR_CODES['FIREBASE_ERROR']
        elif 'abr' in error_message.lower() or 'abn' in error_message.lower():
            error_context = cls.ERROR_CODES['ABR_API_ERROR']
        elif 'validation' in error_message.lower() or error_type in ['ValidationError', 'ValueError']:
            error_context = cls.ERROR_CODES['VALIDATION_ERROR']
        elif 'network' in error_message.lower() or 'connection' in error_message.lower():
            error_context = cls.ERROR_CODES['NETWORK_ERROR']
        else:
            error_context = cls.ERROR_CODES['UNKNOWN_ERROR']
        
        # Log the error with full context
        logger.error(
            f"Error in {context}: {error_message}",
            error_type=error_type,
            error_message=error_message,
            context=context,
            user_id=user_id,
            stack_trace=traceback.format_exc(),
            error_code=error_context.error_code
        )
        
        return error_context

class HealthMonitor:
    """Health monitoring for external services and system components"""
    
    def __init__(self):
        self.last_checks = {}
        self.check_interval = 300  # 5 minutes
    
    def check_service_health(self, service_name: str, check_func: Callable) -> ServiceHealth:
        """Check health of a specific service"""
        start_time = time.time()
        
        try:
            # Run the health check
            result = check_func()
            response_time = (time.time() - start_time) * 1000  # Convert to ms
            
            status = ServiceStatus.HEALTHY
            error_message = None
            
            # Determine status based on response time
            if response_time > 5000:  # 5 seconds
                status = ServiceStatus.DEGRADED
            elif response_time > 10000:  # 10 seconds
                status = ServiceStatus.UNHEALTHY
                
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            status = ServiceStatus.UNHEALTHY
            error_message = str(e)
            
            logger.warning(
                f"Health check failed for {service_name}",
                service=service_name,
                error=error_message,
                response_time_ms=response_time
            )
        
        health = ServiceHealth(
            service_name=service_name,
            status=status,
            response_time_ms=response_time,
            last_check=datetime.now(),
            error_message=error_message
        )
        
        self.last_checks[service_name] = health
        return health
    
    def check_gemini_health(self) -> ServiceHealth:
        """Check Gemini API health"""
        def gemini_check():
            # Simple ping to Gemini API
            import google.generativeai as genai
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
            response = model.generate_content("test")
            return response is not None
        
        return self.check_service_health('gemini_api', gemini_check)
    
    def check_firebase_health(self) -> ServiceHealth:
        """Check Firebase health"""
        def firebase_check():
            from firebase_config import db
            if db:
                # Simple read operation
                test_ref = db.collection('health_check').limit(1)
                test_ref.get()
                return True
            return False
        
        return self.check_service_health('firebase', firebase_check)
    
    def check_basiq_health(self) -> ServiceHealth:
        """Check Basiq API health"""
        def basiq_check():
            # Check if Basiq API is accessible
            response = requests.get('https://au-api.basiq.io/reference', timeout=5)
            return response.status_code == 200
        
        return self.check_service_health('basiq_api', basiq_check)
    
    def check_abr_health(self) -> ServiceHealth:
        """Check ABR API health"""
        def abr_check():
            # Check if ABR API is accessible
            url = "https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx"
            response = requests.get(url, timeout=5)
            return response.status_code == 200
        
        return self.check_service_health('abr_api', abr_check)
    
    def get_overall_health(self) -> Dict[str, Any]:
        """Get overall system health status"""
        # Run all health checks
        services = {
            'gemini_api': self.check_gemini_health(),
            'firebase': self.check_firebase_health(),
            'basiq_api': self.check_basiq_health(),
            'abr_api': self.check_abr_health()
        }
        
        # Determine overall status
        unhealthy_count = sum(1 for s in services.values() if s.status == ServiceStatus.UNHEALTHY)
        degraded_count = sum(1 for s in services.values() if s.status == ServiceStatus.DEGRADED)
        
        if unhealthy_count > 1:
            overall_status = ServiceStatus.UNHEALTHY
        elif unhealthy_count > 0 or degraded_count > 1:
            overall_status = ServiceStatus.DEGRADED
        else:
            overall_status = ServiceStatus.HEALTHY
        
        return {
            'overall_status': overall_status.value,
            'timestamp': datetime.now().isoformat(),
            'services': {name: asdict(health) for name, health in services.items()},
            'summary': {
                'total_services': len(services),
                'healthy': sum(1 for s in services.values() if s.status == ServiceStatus.HEALTHY),
                'degraded': degraded_count,
                'unhealthy': unhealthy_count
            }
        }

class GracefulDegradation:
    """Graceful degradation when services fail"""
    
    @staticmethod
    def fallback_receipt_processing(receipt_data: Dict) -> Dict:
        """Fallback receipt processing when Gemini fails"""
        logger.info("Using fallback receipt processing")
        
        # Basic fallback processing
        fallback_data = {
            'success': True,
            'fallback_mode': True,
            'message': 'Receipt processed using basic extraction (Gemini API unavailable)',
            'extracted_data': {
                'merchant_name': receipt_data.get('filename', 'Unknown Merchant'),
                'total_amount': 0.0,
                'date': datetime.now().strftime('%Y-%m-%d'),
                'category': 'PERSONAL',
                'confidence': 0.3,
                'requires_manual_review': True,
                'processing_method': 'fallback'
            }
        }
        
        return fallback_data
    
    @staticmethod
    def fallback_abn_verification(abn: str) -> Dict:
        """Fallback ABN verification when ABR API fails"""
        from ..australian_business_compliance import AustralianBusinessCompliance
        
        logger.info("Using fallback ABN verification")
        
        # Use local checksum validation only
        compliance = AustralianBusinessCompliance()
        cleaned_abn = compliance._clean_abn(abn)
        is_valid = compliance._verify_abn_checksum(cleaned_abn)
        
        return {
            'abn': cleaned_abn,
            'is_valid': is_valid,
            'entity_name': 'Unknown Entity (API unavailable)',
            'entity_type': 'Other',
            'status': 'Format valid' if is_valid else 'Invalid',
            'gst_registered': False,
            'gst_from_date': None,
            'gst_to_date': None,
            'fallback_mode': True,
            'note': 'Enhanced verification unavailable - using basic validation only'
        }
    
    @staticmethod
    def fallback_categorization(transaction_data: Dict) -> Dict:
        """Fallback categorization when enhanced categorization fails"""
        logger.info("Using fallback transaction categorization")
        
        # Simple rule-based categorization
        description = transaction_data.get('description', '').lower()
        amount = abs(float(transaction_data.get('amount', 0)))
        
        # Basic categorization rules
        if any(word in description for word in ['fuel', 'petrol', 'gas', 'shell', 'bp']):
            category = 'D1'
            confidence = 0.6
        elif any(word in description for word in ['office', 'supplies', 'stationery']):
            category = 'D5'
            confidence = 0.5
        elif any(word in description for word in ['restaurant', 'cafe', 'food']):
            category = 'D2'
            confidence = 0.4
        else:
            category = 'PERSONAL'
            confidence = 0.3
        
        return {
            'category': category,
            'confidence': confidence,
            'deductibility': 1.0 if category != 'PERSONAL' else 0.0,
            'reasoning': f'Fallback categorization based on keyword matching',
            'requires_verification': True,
            'suggested_evidence': ['Receipt', 'Business purpose documentation'],
            'alternative_categories': [],
            'fallback_mode': True
        }

# Global instances
health_monitor = HealthMonitor()
error_handler = ErrorHandler()

# Utility functions for easy import
def log_performance(func_name: str, duration_ms: float, **kwargs):
    """Log performance metrics"""
    logger.info(
        f"Performance metric for {func_name}",
        function=func_name,
        duration_ms=duration_ms,
        **kwargs
    )

def measure_performance(func: Callable) -> Callable:
    """Decorator to measure and log function performance"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            duration_ms = (time.time() - start_time) * 1000
            log_performance(func.__name__, duration_ms, success=True)
            return result
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            log_performance(func.__name__, duration_ms, success=False, error=str(e))
            raise
    return wrapper

# Export all utilities
__all__ = [
    'StructuredLogger',
    'logger',
    'set_request_context',
    'retry_with_backoff',
    'ErrorHandler',
    'HealthMonitor',
    'GracefulDegradation',
    'health_monitor',
    'error_handler',
    'measure_performance',
    'log_performance',
    'ServiceStatus',
    'ServiceHealth',
    'ErrorContext'
] 