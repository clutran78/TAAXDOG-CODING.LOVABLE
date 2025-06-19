import os
import sys
import logging
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime

# Add project paths for imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))
sys.path.insert(0, os.path.join(project_root, 'backend'))
sys.path.insert(0, os.path.join(project_root, 'database'))

try:
    from backend.services.subaccount_manager import subaccount_manager
    from backend.utils.auth_middleware import require_auth
    from backend.utils.validators import validate_required_fields, validate_positive_number
except ImportError as e:
    logging.warning(f"Import warning in subaccount_routes: {e}")
    
    # Fallback functions for development
    from functools import wraps
    
    def require_auth(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            return f(*args, **kwargs)
        return wrapper
    
    def validate_required_fields(*fields):
        def decorator(f):
            @wraps(f)
            def wrapper(*args, **kwargs):
                return f(*args, **kwargs)
            return wrapper
        return decorator
    
    def validate_positive_number(field):
        def decorator(f):
            @wraps(f)
            def wrapper(*args, **kwargs):
                return f(*args, **kwargs)
            return wrapper
        return decorator

# Configure logging
logger = logging.getLogger(__name__)

# Create Blueprint
subaccount_bp = Blueprint('subaccounts', __name__, url_prefix='/api/subaccounts')

# ==================== HELPER FUNCTIONS ====================

def get_user_id_from_request():
    """
    Extract user ID from request (from auth token or session).
    This should be adapted based on your authentication system.
    """
    # TODO: Implement based on your authentication system
    # For now, returning a placeholder - update this based on your auth implementation
    return request.headers.get('X-User-ID') or 'demo-user-id'

def validate_subaccount_data(data):
    """Validate subaccount creation data."""
    required_fields = ['goalId', 'name', 'sourceAccountId']
    errors = []
    
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f'Missing required field: {field}')
    
    if 'settings' in data:
        settings = data['settings']
        if 'interestRate' in settings:
            try:
                rate = float(settings['interestRate'])
                if rate < 0 or rate > 100:
                    errors.append('Interest rate must be between 0 and 100')
            except (ValueError, TypeError):
                errors.append('Interest rate must be a valid number')
    
    return errors

def validate_transfer_data(data):
    """Validate transfer request data."""
    required_fields = ['amount', 'type']
    errors = []
    
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f'Missing required field: {field}')
    
    if 'type' in data and data['type'] not in ['deposit', 'withdrawal']:
        errors.append('Transfer type must be either "deposit" or "withdrawal"')
    
    if 'amount' in data:
        try:
            amount = float(data['amount'])
            if amount <= 0:
                errors.append('Amount must be greater than 0')
        except (ValueError, TypeError):
            errors.append('Amount must be a valid number')
    
    return errors

# ==================== SUBACCOUNT CRUD ENDPOINTS ====================

@subaccount_bp.route('', methods=['POST'])
@require_auth
def create_subaccount():
    """
    Create a new subaccount for a goal.
    
    Expected JSON body:
    {
        "goalId": "string",
        "name": "string",
        "description": "string (optional)",
        "sourceAccountId": "string",
        "settings": {
            "interestEnabled": boolean,
            "interestRate": number,
            "notifications": {},
            "restrictions": {}
        }
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate data
        validation_errors = validate_subaccount_data(data)
        if validation_errors:
            return jsonify({
                'success': False,
                'error': 'Validation failed',
                'details': validation_errors
            }), 400
        
        user_id = get_user_id_from_request()
        
        # Create subaccount
        result = subaccount_manager.create_subaccount(
            goal_id=data['goalId'],
            user_id=user_id,
            subaccount_data=data
        )
        
        if result['success']:
            logger.info(f"✅ Created subaccount for goal {data['goalId']} by user {user_id}")
            return jsonify(result), 201
        else:
            logger.warning(f"❌ Failed to create subaccount: {result['error']}")
            return jsonify(result), 400
        
    except Exception as e:
        logger.error(f"❌ Error creating subaccount: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@subaccount_bp.route('/<subaccount_id>', methods=['GET'])
@require_auth
def get_subaccount(subaccount_id):
    """Get subaccount by ID."""
    try:
        result = subaccount_manager.get_subaccount(subaccount_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 404 if 'not found' in result['error'].lower() else 400
        
    except Exception as e:
        logger.error(f"❌ Error getting subaccount {subaccount_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@subaccount_bp.route('/goal/<goal_id>', methods=['GET'])
@require_auth
def get_subaccount_by_goal(goal_id):
    """Get subaccount by goal ID."""
    try:
        result = subaccount_manager.get_subaccount_by_goal_id(goal_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 404 if 'not found' in result['error'].lower() else 400
        
    except Exception as e:
        logger.error(f"❌ Error getting subaccount for goal {goal_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@subaccount_bp.route('/user', methods=['GET'])
@subaccount_bp.route('/user/<user_id>', methods=['GET'])
@require_auth
def get_user_subaccounts(user_id=None):
    """Get all subaccounts for a user."""
    try:
        if not user_id:
            user_id = get_user_id_from_request()
        
        result = subaccount_manager.get_user_subaccounts(user_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
        
    except Exception as e:
        logger.error(f"❌ Error getting user subaccounts for {user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@subaccount_bp.route('/<subaccount_id>', methods=['PUT'])
@require_auth
def update_subaccount(subaccount_id):
    """
    Update subaccount settings.
    
    Expected JSON body:
    {
        "name": "string (optional)",
        "description": "string (optional)",
        "settings": {
            "interestEnabled": boolean,
            "interestRate": number,
            "notifications": {},
            "restrictions": {}
        }
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate interest rate if provided
        if 'settings' in data and 'interestRate' in data['settings']:
            try:
                rate = float(data['settings']['interestRate'])
                if rate < 0 or rate > 100:
                    return jsonify({
                        'success': False,
                        'error': 'Interest rate must be between 0 and 100'
                    }), 400
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Interest rate must be a valid number'
                }), 400
        
        result = subaccount_manager.update_subaccount(subaccount_id, data)
        
        if result['success']:
            logger.info(f"✅ Updated subaccount {subaccount_id}")
            return jsonify(result), 200
        else:
            return jsonify(result), 404 if 'not found' in result['error'].lower() else 400
        
    except Exception as e:
        logger.error(f"❌ Error updating subaccount {subaccount_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@subaccount_bp.route('/<subaccount_id>', methods=['DELETE'])
@require_auth
def delete_subaccount(subaccount_id):
    """
    Delete/close a subaccount.
    
    Expected JSON body (optional):
    {
        "reason": "string"
    }
    """
    try:
        data = request.get_json() or {}
        reason = data.get('reason')
        
        result = subaccount_manager.delete_subaccount(subaccount_id, reason)
        
        if result['success']:
            logger.info(f"✅ Deleted subaccount {subaccount_id}")
            return jsonify(result), 200
        else:
            return jsonify(result), 404 if 'not found' in result['error'].lower() else 400
        
    except Exception as e:
        logger.error(f"❌ Error deleting subaccount {subaccount_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

# ==================== TRANSACTION ENDPOINTS ====================

@subaccount_bp.route('/<subaccount_id>/transfer', methods=['POST'])
@require_auth
def process_transfer(subaccount_id):
    """
    Process a manual transfer (deposit/withdrawal).
    
    Expected JSON body:
    {
        "amount": number,
        "type": "deposit" | "withdrawal",
        "description": "string (optional)",
        "sourceAccountId": "string (optional)",
        "targetAccountId": "string (optional)"
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate data
        validation_errors = validate_transfer_data(data)
        if validation_errors:
            return jsonify({
                'success': False,
                'error': 'Validation failed',
                'details': validation_errors
            }), 400
        
        # Add subaccount ID to request
        transfer_request = {
            'subaccountId': subaccount_id,
            **data
        }
        
        result = subaccount_manager.process_transfer(transfer_request)
        
        if result['success']:
            logger.info(f"✅ Processed {data['type']} of ${data['amount']} for subaccount {subaccount_id}")
            return jsonify(result), 200
        else:
            return jsonify(result), 400
        
    except Exception as e:
        logger.error(f"❌ Error processing transfer for subaccount {subaccount_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@subaccount_bp.route('/<subaccount_id>/transactions', methods=['GET'])
@require_auth
def get_subaccount_transactions(subaccount_id):
    """
    Get transaction history for a subaccount.
    
    Query parameters:
    - page: int (default 1)
    - limit: int (default 20, max 100)
    - startDate: string (ISO format)
    - endDate: string (ISO format)
    - type: string (transaction type filter)
    """
    try:
        # Parse query parameters
        page = request.args.get('page', 1, type=int)
        limit = min(request.args.get('limit', 20, type=int), 100)
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        transaction_type = request.args.get('type')
        
        options = {
            'page': page,
            'limit': limit
        }
        
        if start_date:
            options['startDate'] = start_date
        if end_date:
            options['endDate'] = end_date
        if transaction_type:
            options['type'] = transaction_type
        
        result = subaccount_manager.get_subaccount_transactions(subaccount_id, **options)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
        
    except Exception as e:
        logger.error(f"❌ Error getting transactions for subaccount {subaccount_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

# ==================== BALANCE AND SYNC ENDPOINTS ====================

@subaccount_bp.route('/<subaccount_id>/sync', methods=['POST'])
@require_auth
def sync_subaccount_balance(subaccount_id):
    """Sync subaccount balance with bank."""
    try:
        result = subaccount_manager.sync_subaccount_balance(subaccount_id)
        
        if result['success']:
            logger.info(f"✅ Synced balance for subaccount {subaccount_id}")
            return jsonify(result), 200
        else:
            return jsonify(result), 400
        
    except Exception as e:
        logger.error(f"❌ Error syncing balance for subaccount {subaccount_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@subaccount_bp.route('/<subaccount_id>/summary', methods=['GET'])
@require_auth
def get_subaccount_summary(subaccount_id):
    """Get subaccount summary for goal card display."""
    try:
        result = subaccount_manager.get_subaccount_summary(subaccount_id)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 404 if 'not found' in result['error'].lower() else 400
        
    except Exception as e:
        logger.error(f"❌ Error getting summary for subaccount {subaccount_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

# ==================== ANALYTICS ENDPOINTS ====================

@subaccount_bp.route('/<subaccount_id>/analytics', methods=['GET'])
@require_auth
def get_subaccount_analytics(subaccount_id):
    """
    Get analytics for a subaccount.
    
    Query parameters:
    - startDate: string (ISO format, required)
    - endDate: string (ISO format, required)
    """
    try:
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        
        if not start_date or not end_date:
            return jsonify({
                'success': False,
                'error': 'Both startDate and endDate are required'
            }), 400
        
        # Validate date formats
        try:
            datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Invalid date format. Use ISO format (YYYY-MM-DD)'
            }), 400
        
        result = subaccount_manager.get_subaccount_analytics(subaccount_id, start_date, end_date)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
        
    except Exception as e:
        logger.error(f"❌ Error getting analytics for subaccount {subaccount_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

@subaccount_bp.route('/<subaccount_id>/projections', methods=['POST'])
@require_auth
def calculate_growth_projections(subaccount_id):
    """
    Calculate growth projections for a subaccount.
    
    Expected JSON body (optional):
    {
        "transferAmount": number,
        "frequency": "weekly" | "monthly" | "bi-weekly",
        "interestRate": number,
        "timeframe": "month" | "quarter" | "year"
    }
    """
    try:
        scenarios = request.get_json() or {}
        
        # Validate scenarios if provided
        if 'transferAmount' in scenarios:
            try:
                amount = float(scenarios['transferAmount'])
                if amount < 0:
                    return jsonify({
                        'success': False,
                        'error': 'Transfer amount must be non-negative'
                    }), 400
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Transfer amount must be a valid number'
                }), 400
        
        if 'interestRate' in scenarios:
            try:
                rate = float(scenarios['interestRate'])
                if rate < 0 or rate > 100:
                    return jsonify({
                        'success': False,
                        'error': 'Interest rate must be between 0 and 100'
                    }), 400
            except (ValueError, TypeError):
                return jsonify({
                    'success': False,
                    'error': 'Interest rate must be a valid number'
                }), 400
        
        result = subaccount_manager.calculate_growth_projections(subaccount_id, scenarios)
        
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400
        
    except Exception as e:
        logger.error(f"❌ Error calculating projections for subaccount {subaccount_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500

# ==================== UTILITY ENDPOINTS ====================

@subaccount_bp.route('/banks/<institution_id>/subaccount-support', methods=['GET'])
@require_auth
def check_bank_subaccount_support(institution_id):
    """Check if a bank supports real subaccounts."""
    try:
        # For now, all banks are treated as not supporting real subaccounts
        # This endpoint is prepared for future integration
        
        # Placeholder response - will be implemented when bank APIs support subaccounts
        response = {
            'supported': False,
            'features': [],
            'reason': 'Bank subaccount creation not yet supported'
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"❌ Error checking subaccount support for institution {institution_id}: {str(e)}")
        return jsonify({
            'supported': False,
            'features': [],
            'error': 'Internal server error'
        }), 500

# ==================== HEALTH CHECK ====================

@subaccount_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for subaccount service."""
    try:
        # Check if subaccount manager is initialized
        if subaccount_manager and subaccount_manager.db:
            status = 'healthy'
            message = 'Subaccount service is running'
        else:
            status = 'degraded'
            message = 'Subaccount service running with limited functionality'
        
        return jsonify({
            'status': status,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'service': 'subaccount_management'
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'message': 'Subaccount service error',
            'error': str(e),
            'timestamp': datetime.now().isoformat(),
            'service': 'subaccount_management'
        }), 500

# ==================== ERROR HANDLERS ====================

@subaccount_bp.errorhandler(400)
def bad_request(error):
    """Handle 400 Bad Request errors."""
    return jsonify({
        'success': False,
        'error': 'Bad request',
        'message': str(error)
    }), 400

@subaccount_bp.errorhandler(401)
def unauthorized(error):
    """Handle 401 Unauthorized errors."""
    return jsonify({
        'success': False,
        'error': 'Unauthorized',
        'message': 'Authentication required'
    }), 401

@subaccount_bp.errorhandler(404)
def not_found(error):
    """Handle 404 Not Found errors."""
    return jsonify({
        'success': False,
        'error': 'Not found',
        'message': 'Resource not found'
    }), 404

@subaccount_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 Internal Server Error."""
    logger.error(f"Internal server error in subaccount routes: {str(error)}")
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500 