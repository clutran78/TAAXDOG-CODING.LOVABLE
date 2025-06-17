import os
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class BasiqConfig:
    """
    BASIQ API configuration management with environment switching capabilities.
    Handles development and production environment configurations.
    """
    
    def __init__(self):
        """Initialize BASIQ configuration."""
        self._environment = None
        self._config_cache = {}
        self.load_environment()
    
    def load_environment(self):
        """Load current environment from environment variables."""
        self._environment = os.getenv('BASIQ_ENVIRONMENT', 'development')
        logger.info(f"🔧 BASIQ environment loaded: {self._environment}")
    
    @property
    def environment(self) -> str:
        """Get current environment."""
        return self._environment
    
    @environment.setter
    def environment(self, env: str):
        """
        Set environment and clear cache.
        
        Args:
            env: Environment name ('development' or 'production')
        """
        if env not in ['development', 'production']:
            raise ValueError("Environment must be 'development' or 'production'")
        
        self._environment = env
        self._config_cache.clear()
        os.environ['BASIQ_ENVIRONMENT'] = env
        logger.info(f"🔄 BASIQ environment switched to: {env}")
    
    def get_api_key(self) -> str:
        """
        Get API key for current environment.
        
        Returns:
            str: BASIQ API key
        """
        if self._environment == 'production':
            key = os.getenv('BASIQ_API_KEY_PROD')
            if not key:
                logger.warning("⚠️ Production BASIQ API key not configured")
            return key
        
        key = os.getenv('BASIQ_API_KEY_DEV')
        if not key:
            logger.warning("⚠️ Development BASIQ API key not configured")
        return key
    
    def get_base_url(self) -> str:
        """
        Get base URL for current environment.
        
        Returns:
            str: BASIQ API base URL
        """
        if self._environment == 'production':
            return os.getenv('BASIQ_BASE_URL_PROD', 'https://au-api.basiq.io')
        return os.getenv('BASIQ_BASE_URL_DEV', 'https://au-api.basiq.io')
    
    def get_config(self) -> Dict[str, Any]:
        """
        Get complete configuration for current environment.
        
        Returns:
            dict: Configuration dictionary
        """
        cache_key = f"config_{self._environment}"
        
        if cache_key in self._config_cache:
            return self._config_cache[cache_key]
        
        config = {
            'environment': self._environment,
            'api_key': self.get_api_key(),
            'base_url': self.get_base_url(),
            'api_version': '3.0',
            'timeout': int(os.getenv('BASIQ_TIMEOUT', '30')),
            'retry_attempts': int(os.getenv('BASIQ_RETRY_ATTEMPTS', '3')),
            'retry_delay': float(os.getenv('BASIQ_RETRY_DELAY', '1.0')),
            'token_buffer_seconds': int(os.getenv('BASIQ_TOKEN_BUFFER_SECONDS', '300')),
            'max_connections': int(os.getenv('BASIQ_MAX_CONNECTIONS', '10')),
            'sync_interval_hours': int(os.getenv('BASIQ_SYNC_INTERVAL_HOURS', '6')),
            'transaction_days_back': int(os.getenv('BASIQ_TRANSACTION_DAYS_BACK', '30')),
            'match_threshold': float(os.getenv('BASIQ_MATCH_THRESHOLD', '0.7')),
            'match_date_range_days': int(os.getenv('BASIQ_MATCH_DATE_RANGE_DAYS', '3')),
            'match_amount_tolerance': float(os.getenv('BASIQ_MATCH_AMOUNT_TOLERANCE', '5.0'))
        }
        
        # Cache the configuration
        self._config_cache[cache_key] = config
        return config
    
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self._environment == 'production'
    
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self._environment == 'development'
    
    def validate_config(self) -> Dict[str, Any]:
        """
        Validate current configuration.
        
        Returns:
            dict: Validation results
        """
        config = self.get_config()
        issues = []
        warnings = []
        
        # Check required fields
        if not config['api_key']:
            issues.append(f"BASIQ API key not configured for {self._environment} environment")
        
        if not config['base_url']:
            issues.append(f"BASIQ base URL not configured for {self._environment} environment")
        
        # Check API key format (basic validation)
        if config['api_key'] and len(config['api_key']) < 10:
            warnings.append("BASIQ API key appears to be too short")
        
        # Check timeouts
        if config['timeout'] < 5:
            warnings.append("BASIQ timeout is very low (< 5 seconds)")
        
        if config['timeout'] > 120:
            warnings.append("BASIQ timeout is very high (> 120 seconds)")
        
        # Check sync intervals
        if config['sync_interval_hours'] < 1:
            warnings.append("BASIQ sync interval is very frequent (< 1 hour)")
        
        if config['sync_interval_hours'] > 24:
            warnings.append("BASIQ sync interval is very infrequent (> 24 hours)")
        
        # Check matching parameters
        if config['match_threshold'] < 0.5:
            warnings.append("BASIQ match threshold is very low (< 0.5)")
        
        if config['match_threshold'] > 0.95:
            warnings.append("BASIQ match threshold is very high (> 0.95)")
        
        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'warnings': warnings,
            'environment': self._environment,
            'config': config
        }
    
    def get_environment_status(self) -> Dict[str, Any]:
        """
        Get detailed environment status.
        
        Returns:
            dict: Environment status information
        """
        config = self.get_config()
        validation = self.validate_config()
        
        return {
            'current_environment': self._environment,
            'api_endpoint': config['base_url'],
            'api_key_configured': bool(config['api_key']),
            'api_key_preview': config['api_key'][:10] + '...' if config['api_key'] else None,
            'configuration_valid': validation['valid'],
            'issues': validation['issues'],
            'warnings': validation['warnings'],
            'available_environments': ['development', 'production'],
            'config_summary': {
                'timeout': config['timeout'],
                'retry_attempts': config['retry_attempts'],
                'sync_interval_hours': config['sync_interval_hours'],
                'match_threshold': config['match_threshold']
            }
        }
    
    def switch_environment(self, new_environment: str) -> Dict[str, Any]:
        """
        Switch to a different environment.
        
        Args:
            new_environment: Target environment ('development' or 'production')
            
        Returns:
            dict: Switch operation result
        """
        if new_environment not in ['development', 'production']:
            return {
                'success': False,
                'error': 'Invalid environment. Must be "development" or "production"',
                'current_environment': self._environment
            }
        
        if new_environment == self._environment:
            return {
                'success': True,
                'message': f'Already in {new_environment} environment',
                'environment': self._environment
            }
        
        old_environment = self._environment
        
        try:
            # Switch environment
            self.environment = new_environment
            
            # Validate new configuration
            validation = self.validate_config()
            
            if not validation['valid']:
                # Switch back if invalid
                self.environment = old_environment
                return {
                    'success': False,
                    'error': f'Invalid configuration for {new_environment} environment',
                    'issues': validation['issues'],
                    'current_environment': self._environment
                }
            
            logger.info(f"✅ Successfully switched BASIQ environment from {old_environment} to {new_environment}")
            
            return {
                'success': True,
                'message': f'Successfully switched to {new_environment} environment',
                'environment': new_environment,
                'previous_environment': old_environment,
                'api_endpoint': self.get_base_url(),
                'warnings': validation['warnings']
            }
            
        except Exception as e:
            # Restore previous environment on error
            self.environment = old_environment
            logger.error(f"❌ Failed to switch BASIQ environment: {str(e)}")
            
            return {
                'success': False,
                'error': f'Failed to switch environment: {str(e)}',
                'current_environment': self._environment
            }
    
    def get_flask_config(self) -> Dict[str, Any]:
        """
        Get configuration in Flask format.
        
        Returns:
            dict: Flask configuration dictionary
        """
        config = self.get_config()
        
        return {
            'BASIQ_ENVIRONMENT': config['environment'],
            'BASIQ_API_KEY': config['api_key'],
            'BASIQ_BASE_URL': config['base_url'],
            'BASIQ_API_VERSION': config['api_version'],
            'BASIQ_TIMEOUT': config['timeout'],
            'BASIQ_RETRY_ATTEMPTS': config['retry_attempts'],
            'BASIQ_RETRY_DELAY': config['retry_delay'],
            'BASIQ_TOKEN_BUFFER_SECONDS': config['token_buffer_seconds'],
            'BASIQ_MAX_CONNECTIONS': config['max_connections'],
            'BASIQ_SYNC_INTERVAL_HOURS': config['sync_interval_hours'],
            'BASIQ_TRANSACTION_DAYS_BACK': config['transaction_days_back'],
            'BASIQ_MATCH_THRESHOLD': config['match_threshold'],
            'BASIQ_MATCH_DATE_RANGE_DAYS': config['match_date_range_days'],
            'BASIQ_MATCH_AMOUNT_TOLERANCE': config['match_amount_tolerance']
        }
    
    def update_flask_app(self, app):
        """
        Update Flask app configuration with current BASIQ settings.
        
        Args:
            app: Flask application instance
        """
        flask_config = self.get_flask_config()
        app.config.update(flask_config)
        logger.info(f"🔧 Updated Flask app with BASIQ {self._environment} configuration")


# Global configuration instance
basiq_config = BasiqConfig()

def get_basiq_config():
    """Get the global BASIQ configuration instance."""
    return basiq_config

def init_basiq_config(app):
    """
    Initialize BASIQ configuration with Flask app.
    
    Args:
        app: Flask application instance
    """
    basiq_config.update_flask_app(app)
    return basiq_config 