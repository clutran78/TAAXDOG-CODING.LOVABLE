"""
Production Configuration Module for TAAXDOG
Manages environment-specific settings and security configurations
"""

import os
import logging
from typing import Dict, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ProductionConfig:
    """Production configuration settings"""
    
    # Environment settings
    environment: str = 'production'
    debug: bool = False
    testing: bool = False
    
    # Security settings
    secret_key: str = os.environ.get('SECRET_KEY')
    jwt_secret_key: str = os.environ.get('JWT_SECRET_KEY')
    encrypt_key: str = os.environ.get('ENCRYPT_KEY')
    
    # Database settings
    firebase_project_id: str = os.environ.get('FIREBASE_PROJECT_ID')
    database_pool_size: int = int(os.environ.get('DATABASE_POOL_SIZE', 20))
    database_max_overflow: int = int(os.environ.get('DATABASE_MAX_OVERFLOW', 30))
    
    # Cache settings
    redis_url: str = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    cache_ttl: int = int(os.environ.get('CACHE_TTL', 3600))
    
    # Rate limiting
    rate_limit_per_minute: int = int(os.environ.get('RATE_LIMIT_PER_MINUTE', 60))
    rate_limit_per_hour: int = int(os.environ.get('RATE_LIMIT_PER_HOUR', 1000))
    premium_rate_limit_per_minute: int = int(os.environ.get('PREMIUM_RATE_LIMIT_PER_MINUTE', 200))
    
    # Australian market settings
    timezone: str = os.environ.get('TIMEZONE', 'Australia/Sydney')
    currency: str = os.environ.get('CURRENCY', 'AUD')
    tax_year_start: str = os.environ.get('TAX_YEAR_START', '07-01')
    gst_rate: float = float(os.environ.get('GST_RATE', 0.10))
    abn_validation_enabled: bool = os.environ.get('ABN_VALIDATION_ENABLED', 'true').lower() == 'true'
    
    # Monitoring
    sentry_dsn: str = os.environ.get('SENTRY_DSN')
    newrelic_license_key: str = os.environ.get('NEWRELIC_LICENSE_KEY')
    
    # Analytics
    google_analytics_id: str = os.environ.get('GOOGLE_ANALYTICS_ID')
    mixpanel_token: str = os.environ.get('MIXPANEL_TOKEN')
    
    # Feature flags
    enable_analytics: bool = os.environ.get('ENABLE_ANALYTICS', 'true').lower() == 'true'
    enable_feedback_system: bool = os.environ.get('ENABLE_FEEDBACK_SYSTEM', 'true').lower() == 'true'
    enable_ato_integration: bool = os.environ.get('ENABLE_ATO_INTEGRATION', 'false').lower() == 'true'
    enable_premium_features: bool = os.environ.get('ENABLE_PREMIUM_FEATURES', 'true').lower() == 'true'


class ConfigManager:
    """Manages configuration for different environments"""
    
    def __init__(self):
        self.config = ProductionConfig()
        self._validate_config()
    
    def _validate_config(self):
        """Validate critical configuration settings"""
        required_settings = [
            'secret_key',
            'firebase_project_id',
            'jwt_secret_key'
        ]
        
        missing_settings = []
        for setting in required_settings:
            if not getattr(self.config, setting):
                missing_settings.append(setting.upper())
        
        if missing_settings:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_settings)}")
    
    def get_security_headers(self) -> Dict[str, str]:
        """Get security headers for production"""
        return {
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Content-Security-Policy': self._get_csp_policy(),
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
    
    def _get_csp_policy(self) -> str:
        """Generate Content Security Policy"""
        return (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://api.taaxdog.com https://firebaseapp.com https://identitytoolkit.googleapis.com; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
    
    def get_cors_config(self) -> Dict[str, Any]:
        """Get CORS configuration for production"""
        allowed_origins = os.environ.get('CORS_ORIGINS', '').split(',')
        return {
            'origins': allowed_origins,
            'methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            'allow_headers': ['Content-Type', 'Authorization', 'X-User-ID', 'X-Request-ID'],
            'expose_headers': ['X-Request-ID'],
            'supports_credentials': True
        }
    
    def get_logging_config(self) -> Dict[str, Any]:
        """Get logging configuration for production"""
        return {
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': {
                'default': {
                    'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
                },
                'audit': {
                    'format': '[%(asctime)s] AUDIT %(levelname)s: %(message)s',
                }
            },
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                    'level': 'INFO',
                    'formatter': 'default',
                    'stream': 'ext://sys.stdout'
                },
                'file': {
                    'class': 'logging.handlers.RotatingFileHandler',
                    'level': 'INFO',
                    'formatter': 'default',
                    'filename': 'logs/app.log',
                    'maxBytes': 10485760,  # 10MB
                    'backupCount': 5
                },
                'audit': {
                    'class': 'logging.handlers.RotatingFileHandler',
                    'level': 'INFO',
                    'formatter': 'audit',
                    'filename': 'logs/audit.log',
                    'maxBytes': 10485760,  # 10MB
                    'backupCount': 10
                }
            },
            'loggers': {
                'taaxdog': {
                    'level': 'INFO',
                    'handlers': ['console', 'file'],
                    'propagate': False
                },
                'taaxdog.audit': {
                    'level': 'INFO',
                    'handlers': ['audit'],
                    'propagate': False
                }
            },
            'root': {
                'level': 'INFO',
                'handlers': ['console']
            }
        }


# Global configuration instance
config_manager = ConfigManager()
config = config_manager.config 