"""
Goal Transfer Routes for TAAXDOG Application

This module handles direct debit setup and automated goal transfers,
integrating with BASIQ API for bank account management and Firebase for goal storage.
"""

import sys
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from flask import request, jsonify
from flask_restx import Namespace, Resource, fields
from .utils import logger, create_error_response, create_success_response
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

try:
    from basiq_api import get_user_accounts, get_basiq_user
except ImportError:
    try:
        from backend.basiq_api import get_user_accounts, get_basiq_user
    except ImportError:
        print("Warning: BASIQ API not available")
        def get_user_accounts(*args, **kwargs):
            return {'success': False, 'error': 'BASIQ API not available'}
        def get_basiq_user(*args, **kwargs):
            return {'success': False, 'error': 'BASIQ API not available'}

# Add parent directory to path for cross-module imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))
sys.path.insert(0, os.path.join(project_root, 'backend'))
sys.path.insert(0, os.path.join(project_root, 'database'))

goal_transfers = Namespace('goal-transfers', description='Goal transfer and direct debit operations', path='/api/goal-transfers')

# Helper functions
def login_required(f):
    """Decorator to require authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # In a real implementation, you'd validate the auth token here
        # For now, we'll assume the user_id is available on the request
        if not hasattr(request, 'user_id') or not request.user_id:
            return create_error_response('Authentication required', code='AUTH_REQUIRED'), 401
        return f(*args, **kwargs)
    return decorated_function

def api_error(message: str, status: int = 400, details: Any = None) -> tuple:
    """Create an API error response."""
    response = create_error_response(message, details=details)
    return response, status

def serialize_dates(obj: Any) -> Any:
    """Serialize datetime objects in a dictionary or list."""
    if isinstance(obj, dict):
        return {k: serialize_dates(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_dates(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

# Define data models for request and response payloads
direct_debit_model = goal_transfers.model('DirectDebit', {
    'isEnabled': fields.Boolean(required=True, description='Whether direct debit is enabled'),
    'sourceAccountId': fields.String(required=True, description='BASIQ account ID for transfers'),
    'transferType': fields.String(required=True, enum=['percentage', 'fixed'], description='Transfer type'),
    'transferAmount': fields.Float(required=True, description='Transfer amount (percentage or fixed)'),
    'frequency': fields.String(required=True, enum=['weekly', 'monthly', 'bi-weekly'], description='Transfer frequency'),
    'startDate': fields.String(required=True, description='Start date for transfers'),
    'nextTransferDate': fields.String(description='Next scheduled transfer date'),
    'lastTransferDate': fields.String(description='Last completed transfer date')
})

goal_transfer_setup_model = goal_transfers.model('GoalTransferSetup', {
    'goalId': fields.String(required=True, description='Goal ID'),
    'directDebit': fields.Nested(direct_debit_model, required=True, description='Direct debit configuration')
})

transfer_validation_model = goal_transfers.model('TransferValidation', {
    'isValid': fields.Boolean(description='Whether the transfer configuration is valid'),
    'errors': fields.List(fields.String, description='List of validation errors'),
    'estimatedAmount': fields.Float(description='Estimated transfer amount'),
    'accountBalance': fields.Float(description='Current account balance'),
    'nextTransferDate': fields.String(description='Next transfer date')
})

# Utility functions
def calculate_next_transfer_date(start_date: str, frequency: str) -> str:
    """Calculate the next transfer date based on frequency."""
    start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    next_date = start
    
    if frequency == 'weekly':
        next_date = start + timedelta(weeks=1)
    elif frequency == 'bi-weekly':
        next_date = start + timedelta(weeks=2)
    elif frequency == 'monthly':
        # Add one month, handling month overflow
        if start.month == 12:
            next_date = start.replace(year=start.year + 1, month=1)
        else:
            next_date = start.replace(month=start.month + 1)
    
    return next_date.isoformat()

def validate_transfer_configuration(
    direct_debit: Dict[str, Any], 
    user_accounts: Optional[Dict] = None
) -> Dict[str, Any]:
    """Validate direct debit configuration."""
    errors = []
    
    # Basic validation
    if not direct_debit.get('sourceAccountId'):
        errors.append('Source account ID is required')
    
    if not direct_debit.get('transferAmount') or direct_debit['transferAmount'] <= 0:
        errors.append('Transfer amount must be greater than 0')
    
    if direct_debit.get('transferType') == 'percentage' and direct_debit['transferAmount'] > 50:
        errors.append('Percentage transfers cannot exceed 50% for safety')
    
    if not direct_debit.get('startDate'):
        errors.append('Start date is required')
    else:
        start_date = datetime.fromisoformat(direct_debit['startDate'].replace('Z', '+00:00'))
        if start_date <= datetime.now():
            errors.append('Start date must be in the future')
    
    # Account validation if accounts data is provided
    estimated_amount = 0
    account_balance = 0
    
    if user_accounts and direct_debit.get('sourceAccountId'):
        source_account = None
        for account in user_accounts.get('data', []):
            if account.get('id') == direct_debit['sourceAccountId']:
                source_account = account
                break
        
        if source_account:
            account_balance = source_account.get('availableBalance', source_account.get('balance', 0))
            
            if direct_debit['transferType'] == 'fixed':
                estimated_amount = direct_debit['transferAmount']
                if estimated_amount > account_balance:
                    errors.append('Insufficient account balance for the specified transfer amount')
            else:  # percentage
                estimated_amount = (account_balance * direct_debit['transferAmount']) / 100
        else:
            errors.append('Selected bank account not found')
    
    next_transfer_date = ""
    if direct_debit.get('startDate') and direct_debit.get('frequency'):
        next_transfer_date = calculate_next_transfer_date(
            direct_debit['startDate'], 
            direct_debit['frequency']
        )
    
    return {
        'isValid': len(errors) == 0,
        'errors': errors,
        'estimatedAmount': estimated_amount,
        'accountBalance': account_balance,
        'nextTransferDate': next_transfer_date
    }

@goal_transfers.route('/setup')
class SetupGoalTransfer(Resource):
    @goal_transfers.expect(goal_transfer_setup_model)
    @goal_transfers.response(200, 'Success', transfer_validation_model)
    @goal_transfers.response(400, 'Validation error')
    @goal_transfers.response(404, 'Goal not found')
    @goal_transfers.response(500, 'Server error')
    @login_required
    def post(self):
        """
        Set up or update direct debit configuration for a goal.
        """
        try:
            firebase_user_id = request.user_id
            data = goal_transfers.payload
            
            goal_id = data.get('goalId')
            direct_debit_config = data.get('directDebit')
            
            if not goal_id or not direct_debit_config:
                return api_error('Goal ID and direct debit configuration are required', status=400)
            
            # Get the goal from Firebase
            goal_ref = db.collection('goals').document(goal_id)
            goal_doc = goal_ref.get()
            
            if not goal_doc.exists:
                return api_error('Goal not found', status=404)
            
            goal_data = goal_doc.to_dict()
            
            # Verify goal ownership
            if goal_data.get('userId') != firebase_user_id:
                return api_error('Unauthorized access to goal', status=403)
            
            # Get user's BASIQ data for validation
            user_doc = db.collection('users').document(firebase_user_id).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
            basiq_user_id = user_data.get('basiq_user_id')
            
            user_accounts = None
            if basiq_user_id:
                accounts_result = get_user_accounts(basiq_user_id)
                if accounts_result.get('success'):
                    user_accounts = accounts_result.get('accounts')
            
            # Validate the configuration
            validation_result = validate_transfer_configuration(direct_debit_config, user_accounts)
            
            if not validation_result['isValid']:
                return api_error('Invalid direct debit configuration', status=400, details={
                    'validation': validation_result
                })
            
            # Calculate next transfer date
            next_transfer_date = calculate_next_transfer_date(
                direct_debit_config['startDate'], 
                direct_debit_config['frequency']
            )
            
            # Update direct debit configuration
            updated_direct_debit = {
                **direct_debit_config,
                'nextTransferDate': next_transfer_date,
                'lastTransferDate': direct_debit_config.get('lastTransferDate')  # Preserve existing value
            }
            
            # Update the goal in Firebase
            goal_ref.update({
                'directDebit': updated_direct_debit,
                'updatedAt': datetime.now().isoformat()
            })
            
            logger.info(f"✅ Direct debit configured for goal {goal_id} by user {firebase_user_id}")
            
            return {
                'success': True,
                'message': 'Direct debit configuration updated successfully',
                'validation': validation_result,
                'nextTransferDate': next_transfer_date
            }
            
        except Exception as e:
            logger.error(f"❌ Error setting up goal transfer: {str(e)}")
            return api_error('Server error occurred', status=500, details=str(e))

@goal_transfers.route('/validate')
class ValidateTransferConfiguration(Resource):
    @goal_transfers.expect(direct_debit_model)
    @goal_transfers.response(200, 'Success', transfer_validation_model)
    @goal_transfers.response(400, 'Validation error')
    @goal_transfers.response(500, 'Server error')
    @login_required
    def post(self):
        """
        Validate a direct debit configuration without saving it.
        """
        try:
            firebase_user_id = request.user_id
            direct_debit_config = goal_transfers.payload
            
            # Get user's BASIQ data for validation
            user_doc = db.collection('users').document(firebase_user_id).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
            basiq_user_id = user_data.get('basiq_user_id')
            
            user_accounts = None
            if basiq_user_id:
                accounts_result = get_user_accounts(basiq_user_id)
                if accounts_result.get('success'):
                    user_accounts = accounts_result.get('accounts')
            
            # Validate the configuration
            validation_result = validate_transfer_configuration(direct_debit_config, user_accounts)
            
            return {
                'success': True,
                'validation': validation_result
            }
            
        except Exception as e:
            logger.error(f"❌ Error validating transfer configuration: {str(e)}")
            return api_error('Server error occurred', status=500, details=str(e))

@goal_transfers.route('/<goal_id>/disable')
@goal_transfers.param('goal_id', 'The goal identifier')
class DisableGoalTransfer(Resource):
    @goal_transfers.response(200, 'Success')
    @goal_transfers.response(404, 'Goal not found')
    @goal_transfers.response(500, 'Server error')
    @login_required
    def post(self, goal_id):
        """
        Disable direct debit for a specific goal.
        """
        try:
            firebase_user_id = request.user_id
            
            # Get the goal from Firebase
            goal_ref = db.collection('goals').document(goal_id)
            goal_doc = goal_ref.get()
            
            if not goal_doc.exists:
                return api_error('Goal not found', status=404)
            
            goal_data = goal_doc.to_dict()
            
            # Verify goal ownership
            if goal_data.get('userId') != firebase_user_id:
                return api_error('Unauthorized access to goal', status=403)
            
            # Update direct debit to disabled
            current_direct_debit = goal_data.get('directDebit', {})
            updated_direct_debit = {
                **current_direct_debit,
                'isEnabled': False
            }
            
            # Update the goal in Firebase
            goal_ref.update({
                'directDebit': updated_direct_debit,
                'updatedAt': datetime.now().isoformat()
            })
            
            logger.info(f"✅ Direct debit disabled for goal {goal_id} by user {firebase_user_id}")
            
            return {
                'success': True,
                'message': 'Direct debit disabled successfully'
            }
            
        except Exception as e:
            logger.error(f"❌ Error disabling goal transfer: {str(e)}")
            return api_error('Server error occurred', status=500, details=str(e))

@goal_transfers.route('/<goal_id>/status')
@goal_transfers.param('goal_id', 'The goal identifier')
class GetGoalTransferStatus(Resource):
    @goal_transfers.response(200, 'Success')
    @goal_transfers.response(404, 'Goal not found')
    @goal_transfers.response(500, 'Server error')
    @login_required
    def get(self, goal_id):
        """
        Get the current direct debit status and configuration for a goal.
        """
        try:
            firebase_user_id = request.user_id
            
            # Get the goal from Firebase
            goal_ref = db.collection('goals').document(goal_id)
            goal_doc = goal_ref.get()
            
            if not goal_doc.exists:
                return api_error('Goal not found', status=404)
            
            goal_data = goal_doc.to_dict()
            
            # Verify goal ownership
            if goal_data.get('userId') != firebase_user_id:
                return api_error('Unauthorized access to goal', status=403)
            
            direct_debit = goal_data.get('directDebit')
            
            if not direct_debit:
                return {
                    'success': True,
                    'directDebitEnabled': False,
                    'message': 'No direct debit configuration found'
                }
            
            return {
                'success': True,
                'directDebitEnabled': direct_debit.get('isEnabled', False),
                'configuration': serialize_dates(direct_debit)
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting goal transfer status: {str(e)}")
            return api_error('Server error occurred', status=500, details=str(e)) 