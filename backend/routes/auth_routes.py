from flask import Blueprint, request, jsonify
from firebase_config import db, auth
from .utils import api_error, logger
from flask_restx import Namespace,Resource, fields
from .utils import serialize_dates

auth_routes = Namespace('auth', description='Authentication endpoinst', path='/api/auth')
# auth_routes = Blueprint('auth', __name__, url_prefix='/api/auth')

verify_token_model = auth_routes.model('VerifyToken', {
    'idToken': fields.String(required=True, description='Firebase ID token')
})

@auth_routes.route('/verify-token')
class VerifyToken(Resource):
    @auth_routes.expect(verify_token_model)
    @auth_routes.response(200, 'Success')
    @auth_routes.response(400, 'No token provided')
    @auth_routes.response(401, 'Invalis or expired authentication token')
    def post(self):
        """Verify a Firebase ID Token"""
        try:
            data = auth_routes.payload
            id_token = data.get('idToken')
            if not id_token:
                return api_error('No Token provided', status=400)
            decoded_token = auth.verify_id_token(id_token)
            user_id = decoded_token['uid']
            user_doc = db.collection('users').document(user_id).get()
            if user_doc.exists:
                # user_data = user_doc.to_dict()
                # return {'success': True, 'user': user_data}, 200
                raw = user_doc.to_dict()
                user_data = serialize_dates(raw)
                return {'success': True, 'user': user_data}, 200
            else:
                return api_error('User document not found', status=404)
        except Exception as e:
            logger.warning(f"Token verification failed: {e}")
            return api_error('Invalid or expired authentication token', status=401)


# @auth_routes.route('/verify-token', methods=['POST'])
# def verify_token():
#     """
#     Verify Firebase ID token and return user information.
#     """
#     try:
#         data = request.get_json()
#         id_token = data.get('idToken')
#         if not id_token:
#             return api_error('ID token is required', status=400)
#         decoded_token = auth.verify_id_token(id_token)
#         user_id = decoded_token.get('uid')
#         user_doc = db.collection('users').document(user_id).get()
#         if user_doc.exists:
#             user_data = user_doc.to_dict()
#             return jsonify({'success': True, 'user': user_data}), 200
#         else:
#             return api_error('User not found', status=404)
#     except Exception as e:
#         logger.error(f"Token verification failed: {e}")
#         return api_error('Invalid or expired authentication token', status=401)