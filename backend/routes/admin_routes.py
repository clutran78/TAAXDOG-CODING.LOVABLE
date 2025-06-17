from flask import Blueprint, request, jsonify
from flask_restx import Namespace, Resource, fields
from config.basiq_config import get_basiq_config
import sys
import os

# Add parent directory to path for cross-module imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from integrations.basiq_client import basiq_client
from .utils import api_error, login_required, logger
from datetime import datetime

admin_routes = Namespace('admin', description='Admin operations for BASIQ', path='/api/admin')

# Define admin models for request/response
environment_switch_model = admin_routes.model('EnvironmentSwitch', {
    'environment': fields.String(required=True, description='Target environment (development/production)')
})

environment_status_model = admin_routes.model('EnvironmentStatus', {
    'current_environment': fields.String(description='Current environment'),
    'api_endpoint': fields.String(description='Current API endpoint'),
    'api_key_configured': fields.Boolean(description='Whether API key is configured'),
    'configuration_valid': fields.Boolean(description='Whether configuration is valid')
})

basiq_config_model = admin_routes.model('BasiqConfig', {
    'timeout': fields.Integer(description='Request timeout in seconds'),
    'retry_attempts': fields.Integer(description='Number of retry attempts'),
    'sync_interval_hours': fields.Integer(description='Sync interval in hours'),
    'match_threshold': fields.Float(description='Transaction matching threshold')
})

def require_admin_auth(f):
    """
    Decorator to require admin authentication.
    In a production environment, this should check for admin privileges.
    """
    def wrapper(*args, **kwargs):
        # For now, just require login. In production, add admin check
        return login_required(f)(*args, **kwargs)
    return wrapper

@admin_routes.route('/basiq/environment/status')
class BasiqEnvironmentStatus(Resource):
    @admin_routes.response(200, 'Success', environment_status_model)
    @admin_routes.response(403, 'Forbidden')
    @require_admin_auth
    def get(self):
        """
        Get current BASIQ environment status and configuration.
        """
        try:
            basiq_config = get_basiq_config()
            status = basiq_config.get_environment_status()
            
            # Add additional runtime information
            status.update({
                'basiq_client_initialized': hasattr(basiq_client, 'app'),
                'token_cached': bool(basiq_client.access_token),
                'token_expires': basiq_client.token_expires.isoformat() if basiq_client.token_expires else None,
                'last_checked': datetime.now().isoformat()
            })
            
            return {
                'success': True,
                'status': status
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get BASIQ environment status: {str(e)}")
            return api_error('Failed to get environment status', status=500, details=str(e))

@admin_routes.route('/basiq/environment/switch')
class BasiqEnvironmentSwitch(Resource):
    @admin_routes.expect(environment_switch_model)
    @admin_routes.response(200, 'Success')
    @admin_routes.response(400, 'Invalid environment')
    @admin_routes.response(403, 'Forbidden')
    @require_admin_auth
    def post(self):
        """
        Switch BASIQ environment between development and production.
        """
        try:
            data = admin_routes.payload
            new_environment = data.get('environment')
            
            if not new_environment:
                return api_error('Environment parameter is required', status=400)
            
            # Switch environment in configuration
            basiq_config = get_basiq_config()
            switch_result = basiq_config.switch_environment(new_environment)
            
            if not switch_result['success']:
                return api_error(switch_result['error'], status=400, details=switch_result)
            
            # Update BASIQ client environment
            if hasattr(basiq_client, 'switch_environment'):
                client_result = basiq_client.switch_environment(new_environment)
                if not client_result['success']:
                    logger.warning(f"⚠️ Failed to update BASIQ client: {client_result.get('error')}")
            
            # Update Flask app configuration if available
            try:
                from flask import current_app
                basiq_config.update_flask_app(current_app)
            except:
                pass  # App context may not be available
            
            logger.info(f"✅ Admin switched BASIQ environment to {new_environment}")
            
            return {
                'success': True,
                'message': switch_result['message'],
                'environment': switch_result['environment'],
                'previous_environment': switch_result.get('previous_environment'),
                'api_endpoint': switch_result.get('api_endpoint'),
                'warnings': switch_result.get('warnings', [])
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to switch BASIQ environment: {str(e)}")
            return api_error('Failed to switch environment', status=500, details=str(e))

@admin_routes.route('/basiq/environment/validate')
class BasiqEnvironmentValidate(Resource):
    @admin_routes.response(200, 'Success')
    @admin_routes.response(403, 'Forbidden')
    @require_admin_auth
    def get(self):
        """
        Validate current BASIQ environment configuration.
        """
        try:
            basiq_config = get_basiq_config()
            validation = basiq_config.validate_config()
            
            # Test API connectivity if configured
            connectivity_test = None
            if validation['valid']:
                try:
                    # Test token acquisition
                    token = basiq_client.get_access_token()
                    connectivity_test = {
                        'api_reachable': bool(token),
                        'token_acquired': bool(token),
                        'test_timestamp': datetime.now().isoformat()
                    }
                except Exception as e:
                    connectivity_test = {
                        'api_reachable': False,
                        'error': str(e),
                        'test_timestamp': datetime.now().isoformat()
                    }
            
            return {
                'success': True,
                'validation': {
                    **validation,
                    'connectivity_test': connectivity_test
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to validate BASIQ configuration: {str(e)}")
            return api_error('Failed to validate configuration', status=500, details=str(e))

@admin_routes.route('/basiq/config')
class BasiqConfigManagement(Resource):
    @admin_routes.response(200, 'Success', basiq_config_model)
    @admin_routes.response(403, 'Forbidden')
    @require_admin_auth
    def get(self):
        """
        Get current BASIQ configuration parameters.
        """
        try:
            basiq_config = get_basiq_config()
            config = basiq_config.get_config()
            
            # Remove sensitive information
            safe_config = {k: v for k, v in config.items() if k != 'api_key'}
            safe_config['api_key_configured'] = bool(config.get('api_key'))
            
            return {
                'success': True,
                'config': safe_config
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get BASIQ configuration: {str(e)}")
            return api_error('Failed to get configuration', status=500, details=str(e))

@admin_routes.route('/basiq/institutions')
class BasiqInstitutions(Resource):
    @admin_routes.response(200, 'Success')
    @admin_routes.response(403, 'Forbidden')
    @require_admin_auth
    def get(self):
        """
        Get list of supported financial institutions from BASIQ.
        """
        try:
            institutions = basiq_client.get_supported_institutions()
            
            return {
                'success': True,
                'institutions': institutions,
                'count': len(institutions),
                'retrieved_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get BASIQ institutions: {str(e)}")
            return api_error('Failed to get institutions', status=500, details=str(e))

@admin_routes.route('/basiq/test-connection')
class BasiqTestConnection(Resource):
    @admin_routes.response(200, 'Success')
    @admin_routes.response(403, 'Forbidden')
    @require_admin_auth
    def post(self):
        """
        Test BASIQ API connection and authentication.
        """
        try:
            test_results = {
                'timestamp': datetime.now().isoformat(),
                'environment': basiq_client.environment,
                'api_endpoint': basiq_client.base_url
            }
            
            # Test 1: Token acquisition
            try:
                token = basiq_client.get_access_token()
                test_results['token_test'] = {
                    'success': bool(token),
                    'token_length': len(token) if token else 0,
                    'expires_at': basiq_client.token_expires.isoformat() if basiq_client.token_expires else None
                }
            except Exception as e:
                test_results['token_test'] = {
                    'success': False,
                    'error': str(e)
                }
            
            # Test 2: Institutions API
            try:
                institutions = basiq_client.get_supported_institutions()
                test_results['institutions_test'] = {
                    'success': len(institutions) > 0,
                    'count': len(institutions)
                }
            except Exception as e:
                test_results['institutions_test'] = {
                    'success': False,
                    'error': str(e)
                }
            
            # Overall success
            overall_success = (
                test_results['token_test']['success'] and 
                test_results['institutions_test']['success']
            )
            
            test_results['overall_success'] = overall_success
            test_results['status'] = 'All tests passed' if overall_success else 'Some tests failed'
            
            logger.info(f"🧪 BASIQ connection test completed: {'✅' if overall_success else '❌'}")
            
            return {
                'success': True,
                'test_results': test_results
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to test BASIQ connection: {str(e)}")
            return api_error('Failed to test connection', status=500, details=str(e))

@admin_routes.route('/basiq/sync/trigger')
class BasiqSyncTrigger(Resource):
    @admin_routes.response(200, 'Success')
    @admin_routes.response(403, 'Forbidden')
    @require_admin_auth
    def post(self):
        """
        Manually trigger transaction sync for all users (admin only).
        """
        try:
            # This would trigger a background task in a real implementation
            # For now, return a placeholder response
            
            sync_job = {
                'job_id': f"sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                'status': 'initiated',
                'timestamp': datetime.now().isoformat(),
                'message': 'Manual sync job initiated'
            }
            
            logger.info(f"🔄 Admin triggered manual BASIQ sync: {sync_job['job_id']}")
            
            return {
                'success': True,
                'sync_job': sync_job,
                'message': 'Sync job initiated successfully'
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to trigger BASIQ sync: {str(e)}")
            return api_error('Failed to trigger sync', status=500, details=str(e))

@admin_routes.route('/basiq/logs')
class BasiqLogs(Resource):
    @admin_routes.response(200, 'Success')
    @admin_routes.response(403, 'Forbidden')
    @require_admin_auth
    def get(self):
        """
        Get recent BASIQ-related log entries (admin only).
        """
        try:
            # In a real implementation, this would read from log files
            # For now, return a placeholder
            
            log_entries = [
                {
                    'timestamp': datetime.now().isoformat(),
                    'level': 'INFO',
                    'message': 'BASIQ environment status checked',
                    'module': 'basiq_admin'
                }
            ]
            
            return {
                'success': True,
                'logs': log_entries,
                'count': len(log_entries),
                'retrieved_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get BASIQ logs: {str(e)}")
            return api_error('Failed to get logs', status=500, details=str(e)) 