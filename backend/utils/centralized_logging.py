"""
TAAXDOG Centralized Production Logging System
============================================

Unified logging configuration for all TAAXDOG components with:
- Structured JSON logging with correlation IDs
- Australian timezone support
- Performance metrics integration
- Security event tracking
- Automated log rotation and cleanup
"""

import os
import sys
import json
import logging
import logging.handlers
from datetime import datetime
from typing import Dict, Any, Optional
from threading import local
import uuid
import pytz

# Australian timezone for consistent logging
AUSTRALIAN_TZ = pytz.timezone('Australia/Sydney')

# Thread-local storage for request context
_request_context = local()

class TAAXDOGFormatter(logging.Formatter):
    """Unified TAAXDOG JSON formatter with Australian compliance"""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON with all context"""
        
        # Base log data
        log_data = {
            'timestamp': datetime.now(AUSTRALIAN_TZ).isoformat(),
            'timezone': 'Australia/Sydney',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add correlation ID for request tracking
        if hasattr(_request_context, 'correlation_id'):
            log_data['correlation_id'] = _request_context.correlation_id
        
        # Add user context
        if hasattr(_request_context, 'user_id'):
            log_data['user_id'] = _request_context.user_id
        
        if hasattr(_request_context, 'request_id'):
            log_data['request_id'] = _request_context.request_id
        
        # Add session context
        if hasattr(_request_context, 'session_id'):
            log_data['session_id'] = _request_context.session_id
        
        # Add component-specific context
        component_contexts = ['receipt_id', 'goal_id', 'transfer_id', 'stage', 'event_type']
        for context in component_contexts:
            if hasattr(_request_context, context):
                log_data[context] = getattr(_request_context, context)
        
        # Add extra fields from record
        for key, value in record.__dict__.items():
            if key.startswith(('extra_', 'log_')):
                clean_key = key[6:] if key.startswith('extra_') else key[4:]
                log_data[clean_key] = value
        
        # Add exception information
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Add stack trace for critical errors
        if record.levelno >= logging.CRITICAL and record.stack_info:
            log_data['stack_trace'] = self.formatStack(record.stack_info)
        
        return json.dumps(log_data, default=str, ensure_ascii=False)

class TAAXDOGLogger:
    """Centralized logger for all TAAXDOG components"""
    
    def __init__(self, name: str = 'taaxdog', logs_dir: str = None):
        self.name = name
        self.logs_dir = logs_dir or os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 'logs'
        )
        
        # Ensure logs directory exists
        os.makedirs(self.logs_dir, exist_ok=True)
        
        # Initialize loggers
        self.main_logger = self._setup_main_logger()
        self.security_logger = self._setup_security_logger()
        self.performance_logger = self._setup_performance_logger()
        self.audit_logger = self._setup_audit_logger()
        self.error_logger = self._setup_error_logger()
        
    def _setup_main_logger(self) -> logging.Logger:
        """Setup main application logger"""
        logger = logging.getLogger(f'{self.name}.main')
        logger.setLevel(logging.INFO)
        logger.handlers.clear()
        
        # Main application log file
        main_handler = logging.handlers.RotatingFileHandler(
            os.path.join(self.logs_dir, 'taaxdog_main.log'),
            maxBytes=50*1024*1024,  # 50MB
            backupCount=10
        )
        main_handler.setLevel(logging.INFO)
        main_handler.setFormatter(TAAXDOGFormatter())
        
        # Console handler for development
        console_handler = logging.StreamHandler()
        console_handler.setLevel(
            logging.DEBUG if os.getenv('FLASK_ENV') == 'development' else logging.WARNING
        )
        console_handler.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        
        logger.addHandler(main_handler)
        logger.addHandler(console_handler)
        
        return logger
    
    def _setup_security_logger(self) -> logging.Logger:
        """Setup security events logger"""
        logger = logging.getLogger(f'{self.name}.security')
        logger.setLevel(logging.INFO)
        logger.handlers.clear()
        
        # Security events log file
        security_handler = logging.handlers.RotatingFileHandler(
            os.path.join(self.logs_dir, 'taaxdog_security.log'),
            maxBytes=20*1024*1024,  # 20MB
            backupCount=20  # Keep longer history for security events
        )
        security_handler.setLevel(logging.INFO)
        security_handler.setFormatter(TAAXDOGFormatter())
        
        logger.addHandler(security_handler)
        return logger
    
    def _setup_performance_logger(self) -> logging.Logger:
        """Setup performance metrics logger"""
        logger = logging.getLogger(f'{self.name}.performance')
        logger.setLevel(logging.INFO)
        logger.handlers.clear()
        
        # Performance metrics log file
        perf_handler = logging.handlers.RotatingFileHandler(
            os.path.join(self.logs_dir, 'taaxdog_performance.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        perf_handler.setLevel(logging.INFO)
        perf_handler.setFormatter(TAAXDOGFormatter())
        
        logger.addHandler(perf_handler)
        return logger
    
    def _setup_audit_logger(self) -> logging.Logger:
        """Setup audit trail logger for ATO compliance"""
        logger = logging.getLogger(f'{self.name}.audit')
        logger.setLevel(logging.INFO)
        logger.handlers.clear()
        
        # Audit trail log file - longer retention for compliance
        audit_handler = logging.handlers.RotatingFileHandler(
            os.path.join(self.logs_dir, 'taaxdog_audit.log'),
            maxBytes=20*1024*1024,  # 20MB
            backupCount=50  # 7+ years retention for ATO compliance
        )
        audit_handler.setLevel(logging.INFO)
        audit_handler.setFormatter(TAAXDOGFormatter())
        
        logger.addHandler(audit_handler)
        return logger
    
    def _setup_error_logger(self) -> logging.Logger:
        """Setup error-only logger for critical monitoring"""
        logger = logging.getLogger(f'{self.name}.errors')
        logger.setLevel(logging.ERROR)
        logger.handlers.clear()
        
        # Critical errors log file
        error_handler = logging.handlers.RotatingFileHandler(
            os.path.join(self.logs_dir, 'taaxdog_errors.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=15
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(TAAXDOGFormatter())
        
        logger.addHandler(error_handler)
        return logger
    
    # Context management methods
    def set_context(self, **kwargs):
        """Set logging context for current request/operation"""
        for key, value in kwargs.items():
            setattr(_request_context, key, value)
    
    def set_correlation_id(self, correlation_id: str = None):
        """Set correlation ID for request tracking"""
        _request_context.correlation_id = correlation_id or str(uuid.uuid4())
    
    def clear_context(self):
        """Clear all context for current thread"""
        for attr in list(vars(_request_context).keys()):
            delattr(_request_context, attr)
    
    # Logging methods
    def info(self, message: str, component: str = 'main', **extra):
        """Log info level message"""
        logger = getattr(self, f'{component}_logger', self.main_logger)
        logger.info(message, extra=extra)
    
    def warning(self, message: str, component: str = 'main', **extra):
        """Log warning level message"""
        logger = getattr(self, f'{component}_logger', self.main_logger)
        logger.warning(message, extra=extra)
    
    def error(self, message: str, component: str = 'main', **extra):
        """Log error level message"""
        logger = getattr(self, f'{component}_logger', self.main_logger)
        logger.error(message, extra=extra)
        
        # Also log to error logger for monitoring
        self.error_logger.error(message, extra=extra)
    
    def critical(self, message: str, component: str = 'main', **extra):
        """Log critical level message"""
        logger = getattr(self, f'{component}_logger', self.main_logger)
        logger.critical(message, extra=extra)
        
        # Also log to error logger for monitoring
        self.error_logger.critical(message, extra=extra)
    
    def debug(self, message: str, component: str = 'main', **extra):
        """Log debug level message"""
        logger = getattr(self, f'{component}_logger', self.main_logger)
        logger.debug(message, extra=extra)
    
    # Specialized logging methods
    def log_security_event(self, event_type: str, severity: str, details: Dict[str, Any]):
        """Log security event"""
        self.security_logger.warning(
            f"Security Event: {event_type}",
            extra={
                'event_type': event_type,
                'severity': severity,
                'details': details,
                'source_ip': details.get('source_ip'),
                'user_id': details.get('user_id')
            }
        )
    
    def log_performance_metric(self, metric_name: str, value: float, **metadata):
        """Log performance metric"""
        self.performance_logger.info(
            f"Performance Metric: {metric_name} = {value}",
            extra={
                'metric_name': metric_name,
                'metric_value': value,
                'metadata': metadata
            }
        )
    
    def log_audit_event(self, action: str, resource: str, details: Dict[str, Any]):
        """Log audit event for ATO compliance"""
        self.audit_logger.info(
            f"Audit: {action} on {resource}",
            extra={
                'audit_action': action,
                'audit_resource': resource,
                'audit_details': details,
                'compliance_event': True
            }
        )
    
    def log_transfer_event(self, transfer_id: str, event_type: str, status: str, **details):
        """Log automated transfer event"""
        self.set_context(transfer_id=transfer_id)
        self.audit_logger.info(
            f"Transfer {event_type}: {status}",
            extra={
                'transfer_event': event_type,
                'transfer_status': status,
                'transfer_details': details,
                'financial_transaction': True
            }
        )
    
    def log_receipt_processing(self, receipt_id: str, stage: str, status: str, **details):
        """Log receipt processing event"""
        self.set_context(receipt_id=receipt_id, stage=stage)
        self.main_logger.info(
            f"Receipt Processing: {stage} - {status}",
            extra={
                'processing_stage': stage,
                'processing_status': status,
                'processing_details': details
            }
        )

# Global logger instance
production_logger = TAAXDOGLogger()

# Convenience functions for easy integration
def set_logging_context(**kwargs):
    """Set logging context for current request"""
    production_logger.set_context(**kwargs)

def clear_logging_context():
    """Clear logging context"""
    production_logger.clear_context()

def log_info(message: str, component: str = 'main', **extra):
    """Log info message"""
    production_logger.info(message, component, **extra)

def log_warning(message: str, component: str = 'main', **extra):
    """Log warning message"""
    production_logger.warning(message, component, **extra)

def log_error(message: str, component: str = 'main', **extra):
    """Log error message"""
    production_logger.error(message, component, **extra)

def log_security_event(event_type: str, severity: str, **details):
    """Log security event"""
    production_logger.log_security_event(event_type, severity, details)

def log_performance_metric(metric_name: str, value: float, **metadata):
    """Log performance metric"""
    production_logger.log_performance_metric(metric_name, value, **metadata)

def log_audit_event(action: str, resource: str, **details):
    """Log audit event"""
    production_logger.log_audit_event(action, resource, details) 