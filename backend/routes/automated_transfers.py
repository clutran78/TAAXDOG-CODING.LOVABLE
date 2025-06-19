"""
Automated Transfer Routes for TAAXDOG Application

This module handles automated transfer management endpoints for the savings system,
including transfer rule creation, income detection, and transfer history.
"""

import sys
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from flask import request, jsonify, Blueprint
from flask_restx import Namespace, Resource, fields
import logging
from functools import wraps

# Import with proper path handling
try:
    from firebase_config import db
except ImportError:
    try:
        from backend.firebase_config import db
    except ImportError:
        print("Warning: Firebase config not available")
        db = None

# Add parent directory to path for cross-module imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))
sys.path.insert(0, os.path.join(project_root, 'backend'))
sys.path.insert(0, os.path.join(project_root, 'database'))

try:
    from services.transfer_engine import get_transfer_engine
    from services.income_detector import get_income_detector
except ImportError:
    try:
        from backend.services.transfer_engine import get_transfer_engine
        from backend.services.income_detector import get_income_detector
    except ImportError:
        print("Warning: Transfer services not available")
        def get_transfer_engine():
            return None
        def get_income_detector():
            return None

# Configure logging
logger = logging.getLogger(__name__)

# Create namespace for API documentation
automated_transfers = Namespace('automated-transfers', description='Automated transfer operations', path='/api/automated-transfers')

def require_auth(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Simple auth check - in production this would verify JWT tokens
        user_id = request.headers.get('X-User-ID')
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Authentication required'
            }), 401
        
        request.user_id = user_id
        return f(*args, **kwargs)
    return decorated_function

def api_error(message: str, status: int = 400, details: Any = None) -> tuple:
    """Create standardized API error response."""
    response = {
        'success': False,
        'error': message
    }
    if details:
        response['details'] = details
    return jsonify(response), status

def api_success(data: Any = None, message: str = None) -> tuple:
    """Create standardized API success response."""
    response = {'success': True}
    if data is not None:
        response['data'] = data
    if message:
        response['message'] = message
    return jsonify(response), 200

# ==================== DATA MODELS ====================

transfer_rule_model = automated_transfers.model('TransferRule', {
    'goal_id': fields.String(required=True, description='Goal ID'),
    'source_account_id': fields.String(required=True, description='BASIQ source account ID'),
    'target_subaccount_id': fields.String(required=True, description='Target subaccount ID'),
    'transfer_type': fields.String(required=True, enum=['fixed_amount', 'percentage_income', 'income_based', 'smart_surplus'], description='Transfer type'),
    'amount': fields.Float(required=True, description='Transfer amount or percentage'),
    'frequency': fields.String(required=True, enum=['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly'], description='Transfer frequency'),
    'start_date': fields.String(required=True, description='Start date (ISO format)'),
    'end_date': fields.String(description='End date (ISO format)'),
    'income_detection_enabled': fields.Boolean(description='Enable income detection'),
    'minimum_income_threshold': fields.Float(description='Minimum income threshold'),
    'maximum_transfer_per_period': fields.Float(description='Maximum transfer per period'),
    'surplus_calculation_enabled': fields.Boolean(description='Enable surplus calculation')
})

transfer_rule_update_model = automated_transfers.model('TransferRuleUpdate', {
    'amount': fields.Float(description='Transfer amount or percentage'),
    'frequency': fields.String(enum=['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly'], description='Transfer frequency'),
    'is_active': fields.Boolean(description='Whether rule is active'),
    'end_date': fields.String(description='End date (ISO format)'),
    'maximum_transfer_per_period': fields.Float(description='Maximum transfer per period')
})

# ==================== TRANSFER RULE ENDPOINTS ====================

@automated_transfers.route('/rules')
class TransferRules(Resource):
    @automated_transfers.response(200, 'Success')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def get(self):
        """
        Get all transfer rules for the authenticated user.
        """
        try:
            user_id = request.user_id
            transfer_engine = get_transfer_engine()
            
            if not transfer_engine:
                return api_error('Transfer engine not available', status=503)
            
            result = transfer_engine.get_user_transfer_rules(user_id)
            
            if result['success']:
                return api_success(result['data'])
            else:
                return api_error(result['error'], status=400)
                
        except Exception as e:
            logger.error(f"❌ Error getting transfer rules: {str(e)}")
            return api_error('Server error occurred', status=500)
    
    @automated_transfers.expect(transfer_rule_model)
    @automated_transfers.response(201, 'Transfer rule created')
    @automated_transfers.response(400, 'Validation error')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def post(self):
        """
        Create a new automated transfer rule.
        """
        try:
            user_id = request.user_id
            data = automated_transfers.payload
            
            if not data:
                return api_error('No data provided')
            
            # Add user_id to the rule data
            data['user_id'] = user_id
            
            transfer_engine = get_transfer_engine()
            if not transfer_engine:
                return api_error('Transfer engine not available', status=503)
            
            result = transfer_engine.create_transfer_rule(data)
            
            if result['success']:
                logger.info(f"✅ Created transfer rule for goal {data.get('goal_id')} by user {user_id}")
                return api_success(result['data'], 'Transfer rule created successfully')
            else:
                return api_error(result['error'], status=400, details=result.get('details'))
                
        except Exception as e:
            logger.error(f"❌ Error creating transfer rule: {str(e)}")
            return api_error('Server error occurred', status=500)

@automated_transfers.route('/rules/<string:rule_id>')
class TransferRule(Resource):
    @automated_transfers.response(200, 'Success')
    @automated_transfers.response(404, 'Rule not found')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def get(self, rule_id):
        """
        Get a specific transfer rule by ID.
        """
        try:
            transfer_engine = get_transfer_engine()
            if not transfer_engine:
                return api_error('Transfer engine not available', status=503)
            
            result = transfer_engine.get_transfer_rule(rule_id)
            
            if result['success']:
                # Verify ownership
                rule_data = result['data']
                if rule_data.get('user_id') != request.user_id:
                    return api_error('Unauthorized', status=403)
                
                return api_success(rule_data)
            else:
                return api_error(result['error'], status=404)
                
        except Exception as e:
            logger.error(f"❌ Error getting transfer rule {rule_id}: {str(e)}")
            return api_error('Server error occurred', status=500)
    
    @automated_transfers.expect(transfer_rule_update_model)
    @automated_transfers.response(200, 'Rule updated')
    @automated_transfers.response(404, 'Rule not found')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def put(self, rule_id):
        """
        Update a transfer rule.
        """
        try:
            data = automated_transfers.payload
            if not data:
                return api_error('No data provided')
            
            transfer_engine = get_transfer_engine()
            if not transfer_engine:
                return api_error('Transfer engine not available', status=503)
            
            # First verify ownership
            rule_result = transfer_engine.get_transfer_rule(rule_id)
            if not rule_result['success']:
                return api_error('Rule not found', status=404)
            
            if rule_result['data'].get('user_id') != request.user_id:
                return api_error('Unauthorized', status=403)
            
            # Update the rule
            result = transfer_engine.update_transfer_rule(rule_id, data)
            
            if result['success']:
                logger.info(f"✅ Updated transfer rule {rule_id}")
                return api_success(message='Transfer rule updated successfully')
            else:
                return api_error(result['error'], status=400)
                
        except Exception as e:
            logger.error(f"❌ Error updating transfer rule {rule_id}: {str(e)}")
            return api_error('Server error occurred', status=500)
    
    @automated_transfers.response(200, 'Rule deleted')
    @automated_transfers.response(404, 'Rule not found')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def delete(self, rule_id):
        """
        Delete/deactivate a transfer rule.
        """
        try:
            transfer_engine = get_transfer_engine()
            if not transfer_engine:
                return api_error('Transfer engine not available', status=503)
            
            # First verify ownership
            rule_result = transfer_engine.get_transfer_rule(rule_id)
            if not rule_result['success']:
                return api_error('Rule not found', status=404)
            
            if rule_result['data'].get('user_id') != request.user_id:
                return api_error('Unauthorized', status=403)
            
            # Delete the rule
            result = transfer_engine.delete_transfer_rule(rule_id)
            
            if result['success']:
                logger.info(f"✅ Deleted transfer rule {rule_id}")
                return api_success(message='Transfer rule deleted successfully')
            else:
                return api_error(result['error'], status=400)
                
        except Exception as e:
            logger.error(f"❌ Error deleting transfer rule {rule_id}: {str(e)}")
            return api_error('Server error occurred', status=500)

# ==================== INCOME DETECTION ENDPOINTS ====================

@automated_transfers.route('/income-analysis/<string:account_id>')
class IncomeAnalysis(Resource):
    @automated_transfers.response(200, 'Success')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def get(self, account_id):
        """
        Analyze income patterns for a specific account.
        """
        try:
            user_id = request.user_id
            analysis_days = request.args.get('days', 90, type=int)
            
            income_detector = get_income_detector()
            if not income_detector:
                return api_error('Income detector not available', status=503)
            
            result = income_detector.detect_income_patterns(user_id, account_id, analysis_days)
            
            if result['success']:
                return api_success(result['data'])
            else:
                return api_error(result['error'], status=400)
                
        except Exception as e:
            logger.error(f"❌ Error analyzing income for account {account_id}: {str(e)}")
            return api_error('Server error occurred', status=500)

@automated_transfers.route('/surplus-calculation/<string:account_id>')
class SurplusCalculation(Resource):
    @automated_transfers.response(200, 'Success')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def get(self, account_id):
        """
        Calculate available surplus for automated transfers.
        """
        try:
            user_id = request.user_id
            safety_buffer = request.args.get('safety_buffer', 20.0, type=float)
            
            income_detector = get_income_detector()
            if not income_detector:
                return api_error('Income detector not available', status=503)
            
            result = income_detector.calculate_surplus(user_id, account_id, safety_buffer)
            
            if result['success']:
                return api_success(result['data'])
            else:
                return api_error(result['error'], status=400)
                
        except Exception as e:
            logger.error(f"❌ Error calculating surplus for account {account_id}: {str(e)}")
            return api_error('Server error occurred', status=500)

@automated_transfers.route('/transfer-recommendations/<string:account_id>')
class TransferRecommendations(Resource):
    @automated_transfers.response(200, 'Success')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def get(self, account_id):
        """
        Get smart transfer recommendations based on income analysis.
        """
        try:
            user_id = request.user_id
            target_percentage = request.args.get('target_percentage', 20.0, type=float)
            
            income_detector = get_income_detector()
            if not income_detector:
                return api_error('Income detector not available', status=503)
            
            result = income_detector.get_transfer_recommendations(user_id, account_id, target_percentage)
            
            if result['success']:
                return api_success(result['data'])
            else:
                return api_error(result['error'], status=400)
                
        except Exception as e:
            logger.error(f"❌ Error getting transfer recommendations for account {account_id}: {str(e)}")
            return api_error('Server error occurred', status=500)

# ==================== TRANSFER EXECUTION ENDPOINTS ====================

@automated_transfers.route('/execute')
class ExecuteTransfers(Resource):
    @automated_transfers.response(200, 'Transfers executed')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def post(self):
        """
        Manually trigger execution of scheduled transfers.
        """
        try:
            limit = request.args.get('limit', 100, type=int)
            
            transfer_engine = get_transfer_engine()
            if not transfer_engine:
                return api_error('Transfer engine not available', status=503)
            
            result = transfer_engine.execute_scheduled_transfers(limit)
            
            if result['success']:
                return api_success(result['data'], 'Transfers executed successfully')
            else:
                return api_error(result['error'], status=400)
                
        except Exception as e:
            logger.error(f"❌ Error executing transfers: {str(e)}")
            return api_error('Server error occurred', status=500)

# ==================== TRANSFER HISTORY ENDPOINTS ====================

@automated_transfers.route('/history')
class TransferHistory(Resource):
    @automated_transfers.response(200, 'Success')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def get(self):
        """
        Get transfer history for the authenticated user.
        """
        try:
            user_id = request.user_id
            goal_id = request.args.get('goal_id')
            limit = request.args.get('limit', 50, type=int)
            
            # Parse date filters if provided
            start_date = None
            end_date = None
            
            start_date_str = request.args.get('start_date')
            if start_date_str:
                start_date = datetime.fromisoformat(start_date_str)
            
            end_date_str = request.args.get('end_date')
            if end_date_str:
                end_date = datetime.fromisoformat(end_date_str)
            
            transfer_engine = get_transfer_engine()
            if not transfer_engine:
                return api_error('Transfer engine not available', status=503)
            
            result = transfer_engine.get_transfer_history(
                user_id=user_id,
                goal_id=goal_id,
                limit=limit,
                start_date=start_date,
                end_date=end_date
            )
            
            if result['success']:
                return api_success(result['data'])
            else:
                return api_error(result['error'], status=400)
                
        except Exception as e:
            logger.error(f"❌ Error getting transfer history: {str(e)}")
            return api_error('Server error occurred', status=500)

@automated_transfers.route('/statistics')
class TransferStatistics(Resource):
    @automated_transfers.response(200, 'Success')
    @automated_transfers.response(401, 'Authentication required')
    @automated_transfers.response(500, 'Server error')
    @require_auth
    def get(self):
        """
        Get transfer statistics for the authenticated user.
        """
        try:
            user_id = request.user_id
            period_days = request.args.get('period_days', 90, type=int)
            
            transfer_engine = get_transfer_engine()
            if not transfer_engine:
                return api_error('Transfer engine not available', status=503)
            
            result = transfer_engine.get_transfer_statistics(user_id, period_days)
            
            if result['success']:
                return api_success(result['data'])
            else:
                return api_error(result['error'], status=400)
                
        except Exception as e:
            logger.error(f"❌ Error getting transfer statistics: {str(e)}")
            return api_error('Server error occurred', status=500)

# ==================== BLUEPRINT CREATION ====================

def create_automated_transfers_blueprint():
    """Create and configure the automated transfers blueprint."""
    bp = Blueprint('automated_transfers', __name__, url_prefix='/api/automated-transfers')
    
    # Add all routes to blueprint
    bp.add_url_rule('/rules', view_func=TransferRules.as_view('transfer_rules'))
    bp.add_url_rule('/rules/<string:rule_id>', view_func=TransferRule.as_view('transfer_rule'))
    bp.add_url_rule('/income-analysis/<string:account_id>', view_func=IncomeAnalysis.as_view('income_analysis'))
    bp.add_url_rule('/surplus-calculation/<string:account_id>', view_func=SurplusCalculation.as_view('surplus_calculation'))
    bp.add_url_rule('/transfer-recommendations/<string:account_id>', view_func=TransferRecommendations.as_view('transfer_recommendations'))
    bp.add_url_rule('/execute', view_func=ExecuteTransfers.as_view('execute_transfers'))
    bp.add_url_rule('/history', view_func=TransferHistory.as_view('transfer_history'))
    bp.add_url_rule('/statistics', view_func=TransferStatistics.as_view('transfer_statistics'))
    
    return bp 