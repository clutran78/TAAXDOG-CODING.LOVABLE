from flask import Blueprint, request, jsonify
from firebase_config import db
from basiq_api import (
    create_basiq_user, get_basiq_user, create_auth_link, get_user_connections,
    get_user_accounts, get_user_transactions, refresh_connection, delete_connection,
)
from .utils import api_error, login_required, logger, serialize_dates
import json, os
from datetime import datetime, timedelta
from flask_restx import Namespace, Resource, fields
from flask import current_app

banking_routes = Namespace('banking', description='Banking operations', path='/api/banking')

# Define data models for request and response payloads
user_model = banking_routes.model('User', {
    'id': fields.String(description='User ID'),
    'email': fields.String(description='Email address'),
    'mobile': fields.String(description='Mobile number'),
    'firstName': fields.String(description='First name'),
    'lastName': fields.String(description='Last name'),
    'businessName': fields.String(description='Business name'),
    'businessIdNo': fields.String(description='Business ID number'),
    'businessIdNoType': fields.String(description='Business ID type'),
    'verificationStatus': fields.Boolean(description='Verification status'),
    'verificationDate': fields.Date(description='Verification date'),
    'businessAddress': fields.String(description='Business address')
})

auth_link_model = banking_routes.model('AuthLink', {
    'url': fields.String(description='Authentication link URL'),
    'expiresAt': fields.DateTime(description='Authentication link expiration timestamp')
})

connection_model = banking_routes.model('Connection', {
    'id': fields.String(description='Connection ID'),
    'institution': fields.String(description='Institution name'),
    'status': fields.String(description='Connection status')
})

account_model = banking_routes.model('Account', {
    'id': fields.String(description='Account ID'),
    'name': fields.String(description='Account name'),
    'balance': fields.Float(description='Account balance')
})

transaction_model = banking_routes.model('Transaction', {
    'id': fields.String(description='Transaction ID'),
    'description': fields.String(description='Transaction description'),
    'amount': fields.Float(description='Transaction amount'),
    'date': fields.Date(description='Transaction date')
})

setup_user_model = banking_routes.model('SetupUser', {
    'email': fields.String(required=True, description='Email address'),
    'mobile': fields.String(description='Mobile number'),
    'firstName': fields.String(description='First name'),
    'lastName': fields.String(description='Last name'),
    'businessName': fields.String(description='Business name'),
    'businessIdNo': fields.String(description='Business ID number'),
    'businessIdNoType': fields.String(description='Business ID type'),
    'verificationStatus': fields.Boolean(description='Verification status'),
    'verificationDate': fields.Date(description='Verification date'),
    'businessAddress': fields.String(description='Business address')
})

@banking_routes.route('/setup-user')
class SetupBasiqUser(Resource):
    @banking_routes.expect(setup_user_model)
    @banking_routes.response(200, 'Success', user_model)
    @banking_routes.response(400, 'Validation error')
    @banking_routes.response(500, 'Server error')
    @login_required
    def post(self):
        """
        Set up a user in the Basiq system using data from request payload.
        If the user already has a Basiq user ID, return it.
        Otherwise, create a new Basiq user.
        """
        try:
            firebase_user_id = request.user_id
            logger.info(f"🔥 Firebase UID received from token: {firebase_user_id}")
            # Get Firestore user document
            user_doc = db.collection('users').document(firebase_user_id).get()

            if not user_doc.exists:
                return api_error('User not found in Firebase', status=404)

            user_data = user_doc.to_dict()
            basiq_user_id = user_data.get('basiq_user_id')

            # If already exists, return user from Basiq
            if basiq_user_id:
                result = get_basiq_user(basiq_user_id)
                if result['success']:
                    return jsonify({
                        'success': True,
                        'user': result['user'],
                        'message': 'Retrieved existing Basiq user'
                    })
                else:
                    basiq_user_id = None  # fallback to recreate

            # 🔽 Extract form data from request body
            data = banking_routes.payload
            email = data.get('email')
            mobile = data.get('mobile')
            first_name = data.get('firstName')
            last_name = data.get('lastName')
            business_name = data.get('businessName')
            business_id = data.get('businessIdNo')
            business_id_type = data.get('businessIdNoType')
            verification_status = data.get('verificationStatus', True)
            verification_date = data.get('verificationDate')
            business_address = data.get('businessAddress')

            if not email:
                return api_error('Email is required', status=400)

            # 🏗 Create new Basiq user
            result = create_basiq_user(
                email=email,
                mobile=mobile,
                name=f"{first_name} {last_name}",
                business_name=business_name,
                business_id=business_id,
                business_id_type=business_id_type,
                verification_status=verification_status,
                verification_date=verification_date,
                business_address=business_address
            )

            if result['success']:
                basiq_user_id = result['user']['id']
                db.collection('users').document(firebase_user_id).update({
                    'basiq_user_id': basiq_user_id
                })
                return jsonify({
                    'success': True,
                    'user': result['user'],
                    'message': 'Created new Basiq user'
                })
            else:
                return api_error(result.get('error', 'Failed to create Basiq user'), status=400, details=result.get('error_data'))

        except Exception as e:
            logger.error(f"❌ Exception: {str(e)}")
            return api_error('Server error occurred', status=500)
    
@banking_routes.route('/auth-link')
class GetAuthLink(Resource):
    @banking_routes.response(200, 'Success', auth_link_model)
    @banking_routes.response(500, 'Server error')
    @login_required
    def post(self):
        """
        Get an authentication link for connecting bank accounts.
        """
        try:
            firebase_user_id = request.user_id
            try:
                data = request.get_json()
            except Exception as e:
                logger.error(f"❌ Error parsing JSON data: {str(e)}")
                data = {}
            user_doc = None

            # Check if we're in development mode
            if os.environ.get('FLASK_ENV') == 'development' or not db:
                # In dev mode, create a mock auth link
                mock_auth_link = {
                    'success': True,
                    'auth_link': {
                        'url': 'https://mockbank-connect.basiq.io?token=mock-token',
                        'expiresAt': (datetime.now() + timedelta(hours=1)).isoformat()
                    },
                    'message': 'Generated mock auth link for development'
                }
                return jsonify(mock_auth_link)
            else:
                # In production mode, use real Basiq API
                user_doc = db.collection('users').document(firebase_user_id).get()
                
                if not user_doc.exists:
                    return api_error('User not found in Firebase', status=404)
                    
                user_data = user_doc.to_dict()
                basiq_user_id = user_data.get('basiq_user_id')
                
                # If user doesn't have a Basiq ID yet, create one
                if not basiq_user_id:
                    # Create a Basiq user first
                    setup_user_resource = SetupBasiqUser()
                    # setup_result = setup_user_resource.post()

                    with current_app.test_request_context():
                        setup_result = setup_user_resource.post()

                    if not isinstance(setup_result, tuple):  # Not an error response
                        response_data = json.loads(setup_result.data)
                        if response_data.get('success'):
                            basiq_user_id = response_data['user']['id']
                        else:
                            return api_error('Failed to create Basiq user', status=400, details=response_data.get('error'))
                    else:
                        return setup_result  # Return the error response
                
                # For mobile or desktop
                mobile = data.get('mobile', True)
                
                # Get the auth link from Basiq
                result = create_auth_link(basiq_user_id, mobile)
                
                if result['success']:
                    return jsonify(result)
                else:
                    return api_error(result.get('error', 'Failed to create auth link'), status=400)
        except Exception as e:
            return api_error('Server error occurred', status=500, details=str(e))
    

@banking_routes.route('/connections')
class GetBankConnections(Resource):
    @banking_routes.response(200, 'Success', [connection_model])
    @banking_routes.response(400, 'Validation error')
    @banking_routes.response(500, 'Server error')
    @login_required
    def get(self):
        try:
            firebase_user_id = request.user_id
            user_doc = db.collection('users').document(firebase_user_id).get()
            
            if not user_doc.exists:
                return api_error('User not found in Firebase', status=404)

            user_data = user_doc.to_dict()
            basiq_user_id = user_data.get('basiq_user_id')

            if not basiq_user_id:
                return api_error('Basiq user not set up. Please call /api/banking/setup-user first.', status=400)

            result = get_user_connections(basiq_user_id)

            if result['success']:
                return jsonify({
                    'success': True,
                    'connections': result['connections']
                })
            else:
                return api_error(result.get('error', 'Unknown error'), status=400)

        except Exception as e:
            logger.error(f"[ERROR] Failed to get bank connections: {e}")
            return api_error('Server error occurred', status=500, details=str(e))
    
@banking_routes.route('/accounts')
class GetBankAccounts(Resource):
    @banking_routes.response(200, 'Success', [account_model])
    @banking_routes.response(400, 'Validation error')
    @banking_routes.response(500, 'Server error')
    @login_required
    def get(self):
        """
        Get all bank accounts for the user.
        """
        try:
            firebase_user_id = request.user_id
            user_doc = db.collection('users').document(firebase_user_id).get()
            
            if not user_doc.exists:
                return api_error('User not found in Firebase', status=404)
                
            user_data = user_doc.to_dict()
            basiq_user_id = user_data.get('basiq_user_id')
            
            if not basiq_user_id:
                return api_error('Basiq user not set up. Please call /api/banking/setup-user first.', status=400)
                
            result = get_user_accounts(basiq_user_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'accounts': result['accounts']
                })
            else:
                return api_error(result.get('error', 'Unknown error'), status=400)
                
        except Exception as e:
            return api_error('Server error occurred', status=500, details=str(e))

@banking_routes.route('/transactions')
class GetBankTransactions(Resource):
    @banking_routes.response(200, 'Success', [transaction_model])
    @banking_routes.response(400, 'Validation error')
    @banking_routes.response(500, 'Server error')
    @banking_routes.param('filter', 'Optional filter string')
    @login_required
    def get(self):
        """
        Get bank transactions for the user.
        """
        try:
            firebase_user_id = request.user_id
            user_doc = db.collection('users').document(firebase_user_id).get()
            if not user_doc.exists:
                return api_error('User not found in Firebase', status=404)
                
            user_data = user_doc.to_dict()
            basiq_user_id = user_data.get('basiq_user_id')
            if not basiq_user_id:
                return api_error('Basiq user not set up. Please call /api/banking/setup-user first.', status=400)
                
            # Optional filter
            filter_str = request.args.get('filter')
            result = get_user_transactions(basiq_user_id, filter_str)
            if result['success']:
                return jsonify({
                    'success': True,
                    'transactions': result['transactions']
                })
            else:
                return api_error(result.get('error', 'Unknown error'), status=400)
                
        except Exception as e:
            return api_error('Server error occurred', status=500, details=str(e))

job_model = banking_routes.model('Job', {
    'job': fields.String(description='Job ID')
})

@banking_routes.route('/connections/<connection_id>/refresh')
@banking_routes.param('connection_id', 'The connection identifier')
class RefreshBankConnection(Resource):
    @banking_routes.response(200, 'Success', job_model)
    @banking_routes.response(400, 'Validation error')
    @banking_routes.response(500, 'Server error')
    @login_required
    def post(self, connection_id):
        """
        Refresh a bank connection to update account and transaction data.
        """
        try:
            firebase_user_id = request.user_id
            user_doc = db.collection('users').document(firebase_user_id).get()
            
            if not user_doc.exists:
                return api_error('User not found in Firebase', status=404)
                
            user_data = user_doc.to_dict()
            basiq_user_id = user_data.get('basiq_user_id')
            
            if not basiq_user_id:
                return api_error('Basiq user not set up. Please call /api/banking/setup-user first.', status=400)
                
            result = refresh_connection(basiq_user_id, connection_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'job': result['job']
                })
            else:
                return api_error(result.get('error', 'Unknown error'), status=400)
                
        except Exception as e:
            return api_error('Server error occurred', status=500, details=str(e))
    
message_model = banking_routes.model('Message', {
    'message': fields.String(description='Success message')
})

@banking_routes.route('/connections/<connection_id>')
@banking_routes.param('connection_id', 'The connection identifier')
class DeleteBankConnection(Resource):
    @banking_routes.response(200, 'Success', message_model)
    @banking_routes.response(400, 'Validation error')
    @banking_routes.response(500, 'Server error')
    @login_required
    def delete(self, connection_id):
        """
        Delete a bank connection.
        """
        try:
            firebase_user_id = request.user_id
            user_doc = db.collection('users').document(firebase_user_id).get()
            
            if not user_doc.exists:
                return api_error('User not found in Firebase', status=404)
                
            user_data = user_doc.to_dict()
            basiq_user_id = user_data.get('basiq_user_id')
            
            if not basiq_user_id:
                return api_error('Basiq user not set up. Please call /api/banking/setup-user first.', status=400)
                
            result = delete_connection(basiq_user_id, connection_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'message': result['message']
                })
            else:
                return api_error(result.get('error', 'Unknown error'), status=400)
                
        except Exception as e:
            return api_error('Server error occurred', status=500, details=str(e))

