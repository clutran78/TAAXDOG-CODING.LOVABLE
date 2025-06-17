"""
Receipt Processing Configuration and Monitoring Setup
Provides centralized configuration for receipt processing pipeline
"""

import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
import json
from decimal import Decimal

# Processing Configuration
PROCESSING_CONFIG = {
    "max_file_size_mb": 10,
    "allowed_formats": ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'],
    "min_dimensions": (50, 50),
    "max_dimensions": (4096, 4096),
    "retry_attempts": 3,
    "retry_delay": 1,
    "rate_limit_delay": 60,
    "network_timeout": 30,
    "quality_threshold": 0.5,
    "confidence_threshold": 0.3
}

# Validation Rules
VALIDATION_RULES = {
    "required_fields": ["merchant_name", "total_amount", "date"],
    "amount_limits": {
        "min": 0.01,
        "max": 999999.99,
        "warning_threshold": 10000.00
    },
    "date_limits": {
        "max_future_days": 1,
        "max_past_years": 5
    },
    "merchant_name": {
        "min_length": 2,
        "max_length": 100
    },
    "gst_tolerance": 0.50
}

# Error Categories and User Messages
ERROR_MESSAGES = {
    "file_not_selected": "Please select a file to upload.",
    "file_too_large": "File is too large. Maximum size is {max_size}MB.",
    "invalid_format": "Unsupported file format. Supported formats: {formats}",
    "corrupted_image": "Image file appears to be corrupted. Please try a different image.",
    "image_too_small": "Image is too small ({width}x{height}). Minimum size is {min_width}x{min_height}.",
    "extraction_failed": "Could not extract data from receipt. Please ensure the image is clear and try again.",
    "validation_failed": "Extracted data is incomplete: {details}",
    "api_rate_limit": "Service is busy. Please wait a moment and try again.",
    "api_error": "Processing service is temporarily unavailable. Please try again later.",
    "network_error": "Connection issue. Please check your internet and try again.",
    "auth_error": "Service authentication failed. Please contact support.",
    "generic_error": "An unexpected error occurred. Please try again."
}

# Receipt Processor Configuration for TAAXDOG
# Enhanced with Australian Business Compliance Settings

# Enhanced Gemini 2.0 Flash Settings
ENHANCED_GEMINI_CONFIG = {
    'api_key': os.getenv('GEMINI_API_KEY'),
    'model': 'gemini-2.0-flash-exp',
    'temperature': 0.1,
    'max_tokens': 2048,
    'timeout': 30,
    'retry_attempts': 3,
    'retry_delay': 1,
    
    # Australian tax compliance specific settings
    'australia_specific': {
        'gst_rate': 0.10,  # 10% GST
        'currency': 'AUD',
        'date_formats': ['%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d'],
        'merchant_patterns': {
            'chains': ['woolworths', 'coles', 'bunnings', 'officeworks', 'kmart'],
            'fuel': ['shell', 'bp', 'caltex', 'mobil', '7-eleven'],
            'restaurants': ['mcdonalds', 'kfc', 'subway', 'dominos']
        }
    }
}

# Australian Business Register (ABR) API Configuration
ABR_CONFIG = {
    'api_key': os.getenv('ABR_API_KEY'),  # Optional - for enhanced ABN verification
    'base_url': 'https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx',
    'timeout': 10,
    'retry_attempts': 2,
    'cache_duration': 86400,  # 24 hours cache for ABN lookups
}

# Business Compliance Settings
BUSINESS_COMPLIANCE_CONFIG = {
    'gst_threshold': 75000,  # ATO GST registration threshold
    'simplified_invoice_threshold': 82.50,  # ATO simplified tax invoice threshold
    'bas_quarters': {
        'Q1': {'start': (1, 1), 'end': (3, 31)},
        'Q2': {'start': (4, 1), 'end': (6, 30)},
        'Q3': {'start': (7, 1), 'end': (9, 30)},
        'Q4': {'start': (10, 1), 'end': (12, 31)}
    },
    'payg_withholding_threshold': 1,  # $1 per payment period
    'entity_types': {
        'individual': 'Individual/Sole Trader',
        'company': 'Company',
        'partnership': 'Partnership',
        'trust': 'Trust',
        'super_fund': 'Superannuation Fund'
    }
}

# Tax Category Mapping for Australian Compliance
TAX_CATEGORY_COMPLIANCE = {
    'D1': {
        'gst_creditable': True,
        'business_use_required': True,
        'evidence_required': ['logbook', 'work_travel_diary'],
        'caps': {'cents_per_km': 0.85, 'max_5000km': 5000}
    },
    'D2': {
        'gst_creditable': True,
        'business_meals_rate': 0.5,  # 50% for meals
        'evidence_required': ['travel_diary', 'business_purpose'],
        'overnight_threshold': 6  # nights away from home
    },
    'D3': {
        'gst_creditable': True,
        'conventional_clothing_only': True,
        'evidence_required': ['uniform_policy', 'protective_nature']
    },
    'D4': {
        'gst_creditable': True,
        'work_related_required': True,
        'evidence_required': ['course_relevance', 'employer_requirements']
    },
    'D5': {
        'gst_creditable': True,
        'work_portion_only': True,
        'evidence_required': ['work_use_percentage', 'business_purpose']
    },
    'P8': {
        'gst_creditable': True,
        'business_use': 1.0,  # 100% business use
        'evidence_required': ['business_records', 'abn_registration'],
        'abn_required': True
    },
    'PERSONAL': {
        'gst_creditable': False,
        'deductible': False
    }
}

# GST-Free Categories (Australian specific)
GST_FREE_MERCHANTS = [
    # Basic food
    'woolworths', 'coles', 'aldi', 'iga', 'foodworks',
    # Medical
    'chemist warehouse', 'pharmacy', 'medical centre', 'hospital',
    # Education
    'university', 'tafe', 'school', 'education',
    # Exports (handled separately)
]

# Enhanced Confidence Scoring Rules
CONFIDENCE_SCORING = {
    'high_confidence': {
        'threshold': 0.8,
        'criteria': [
            'merchant_in_database',
            'clear_gst_amount',
            'occupation_match',
            'business_purpose_clear'
        ]
    },
    'medium_confidence': {
        'threshold': 0.5,
        'criteria': [
            'merchant_pattern_match',
            'calculated_gst',
            'category_inference',
            'amount_reasonable'
        ]
    },
    'low_confidence': {
        'threshold': 0.0,
        'requires_manual_review': True,
        'criteria': [
            'unknown_merchant',
            'unclear_purpose',
            'unusual_amount',
            'incomplete_data'
        ]
    }
}

# Error Handling and Validation
ERROR_HANDLING = {
    'max_retries': 3,
    'retry_delay': 1,
    'fallback_categorization': 'PERSONAL',
    'required_fields': ['merchant_name', 'total_amount', 'date'],
    'validation_rules': {
        'amount_range': {'min': 0, 'max': 999999},
        'date_range': {'years_back': 7, 'future_days': 30},
        'merchant_name_length': {'min': 2, 'max': 100}
    }
}

# Performance and Caching
PERFORMANCE_CONFIG = {
    'cache_merchant_rules': True,
    'cache_abn_lookups': True,
    'cache_duration': 3600,  # 1 hour
    'parallel_processing': False,  # For future enhancement
    'batch_size': 50
}

# Logging Configuration for Compliance
COMPLIANCE_LOGGING = {
    'log_abn_verifications': True,
    'log_gst_calculations': True,
    'log_category_decisions': True,
    'log_confidence_scores': True,
    'audit_trail': True,
    'retention_days': 2555  # 7 years as per ATO requirements
}

def setup_receipt_logging():
    """
    Configure comprehensive logging for receipt processing
    """
    # Create logs directory if it doesn't exist
    logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
    os.makedirs(logs_dir, exist_ok=True)
    
    # Configure main receipt processor logger
    receipt_logger = logging.getLogger('receipt_processor')
    receipt_logger.setLevel(logging.INFO)
    
    # Remove existing handlers to avoid duplication
    receipt_logger.handlers.clear()
    
    # File handler for all receipt processing logs
    log_file = os.path.join(logs_dir, 'receipt_processing.log')
    file_handler = RotatingFileHandler(
        log_file, 
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    
    # Error-only file handler
    error_log_file = os.path.join(logs_dir, 'receipt_errors.log')
    error_handler = RotatingFileHandler(
        error_log_file,
        maxBytes=5*1024*1024,  # 5MB
        backupCount=3
    )
    error_handler.setLevel(logging.ERROR)
    
    # Console handler for development
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO if os.getenv('FLASK_ENV') == 'development' else logging.WARNING)
    
    # Detailed formatter for files
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
    )
    
    # Simple formatter for console
    console_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # JSON formatter for structured logging (if needed for log aggregation)
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
            if hasattr(record, 'step'):
                log_obj['step'] = record.step
            if hasattr(record, 'user_id'):
                log_obj['user_id'] = record.user_id
            if hasattr(record, 'receipt_id'):
                log_obj['receipt_id'] = record.receipt_id
            if hasattr(record, 'duration_ms'):
                log_obj['duration_ms'] = record.duration_ms
            if hasattr(record, 'status'):
                log_obj['status'] = record.status
            if hasattr(record, 'details'):
                log_obj['details'] = record.details
                
            return json.dumps(log_obj)
    
    # Apply formatters
    file_handler.setFormatter(detailed_formatter)
    error_handler.setFormatter(detailed_formatter)
    console_handler.setFormatter(console_formatter)
    
    # Add handlers
    receipt_logger.addHandler(file_handler)
    receipt_logger.addHandler(error_handler)
    receipt_logger.addHandler(console_handler)
    
    # Configure Gemini API logger
    gemini_logger = logging.getLogger('gemini_api')
    gemini_logger.setLevel(logging.INFO)
    gemini_logger.handlers.clear()
    
    # Gemini-specific log file
    gemini_log_file = os.path.join(logs_dir, 'gemini_api.log')
    gemini_handler = RotatingFileHandler(
        gemini_log_file,
        maxBytes=5*1024*1024,  # 5MB
        backupCount=3
    )
    gemini_handler.setFormatter(detailed_formatter)
    gemini_logger.addHandler(gemini_handler)
    gemini_logger.addHandler(console_handler)
    
    # Performance monitoring logger
    perf_logger = logging.getLogger('performance')
    perf_logger.setLevel(logging.INFO)
    perf_logger.handlers.clear()
    
    perf_log_file = os.path.join(logs_dir, 'performance.log')
    perf_handler = RotatingFileHandler(
        perf_log_file,
        maxBytes=5*1024*1024,  # 5MB
        backupCount=3
    )
    perf_handler.setFormatter(JSONFormatter())
    perf_logger.addHandler(perf_handler)
    
    # Log configuration completion
    receipt_logger.info("Receipt processing logging configured successfully")
    receipt_logger.info(f"Log files created in: {logs_dir}")
    
    return {
        'receipt_logger': receipt_logger,
        'gemini_logger': gemini_logger,
        'performance_logger': perf_logger,
        'logs_directory': logs_dir
    }

def get_user_friendly_error(error_type, **kwargs):
    """
    Get user-friendly error message based on error type
    
    Args:
        error_type (str): Type of error
        **kwargs: Additional parameters for message formatting
        
    Returns:
        str: User-friendly error message
    """
    message_template = ERROR_MESSAGES.get(error_type, ERROR_MESSAGES['generic_error'])
    
    try:
        return message_template.format(**kwargs)
    except KeyError:
        return ERROR_MESSAGES['generic_error']

def log_performance_metric(metric_name, value, user_id=None, additional_data=None):
    """
    Log performance metrics for monitoring
    
    Args:
        metric_name (str): Name of the metric
        value (float): Metric value
        user_id (str): Optional user ID
        additional_data (dict): Optional additional data
    """
    perf_logger = logging.getLogger('performance')
    
    metric_data = {
        'metric': metric_name,
        'value': value,
        'timestamp': datetime.now().isoformat(),
        'user_id': user_id
    }
    
    if additional_data:
        metric_data.update(additional_data)
    
    perf_logger.info("Performance metric", extra=metric_data)

def validate_processing_health():
    """
    Validate that all processing components are healthy
    
    Returns:
        dict: Health check results
    """
    health_status = {
        'overall_healthy': True,
        'checks': {}
    }
    
    # Check logs directory
    logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
    health_status['checks']['logs_directory'] = {
        'healthy': os.path.exists(logs_dir) and os.access(logs_dir, os.W_OK),
        'details': f"Logs directory: {logs_dir}"
    }
    
    # Check environment variables
    required_env_vars = ['GOOGLE_API_KEY', 'UPLOAD_FOLDER']
    env_check = {
        'healthy': True,
        'missing_vars': []
    }
    
    for var in required_env_vars:
        if not os.getenv(var):
            env_check['healthy'] = False
            env_check['missing_vars'].append(var)
    
    health_status['checks']['environment_variables'] = env_check
    
    # Check upload directory
    upload_folder = os.getenv('UPLOAD_FOLDER', './uploads')
    health_status['checks']['upload_directory'] = {
        'healthy': os.path.exists(upload_folder) and os.access(upload_folder, os.W_OK),
        'details': f"Upload directory: {upload_folder}"
    }
    
    # Update overall health
    health_status['overall_healthy'] = all(
        check['healthy'] for check in health_status['checks'].values()
    )
    
    return health_status

# Export configuration
def get_config():
    """Get complete configuration for business compliance processing"""
    return {
        'gemini': ENHANCED_GEMINI_CONFIG,
        'abr': ABR_CONFIG,
        'business_compliance': BUSINESS_COMPLIANCE_CONFIG,
        'tax_categories': TAX_CATEGORY_COMPLIANCE,
        'gst_free_merchants': GST_FREE_MERCHANTS,
        'confidence_scoring': CONFIDENCE_SCORING,
        'error_handling': ERROR_HANDLING,
        'performance': PERFORMANCE_CONFIG,
        'logging': COMPLIANCE_LOGGING
    }

# Initialize logging on module import
if __name__ != '__main__':
    setup_receipt_logging() 