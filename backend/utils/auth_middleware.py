"""
Authentication middleware for TAAXDOG API
"""

from functools import wraps
from flask import request, jsonify, g
from firebase_admin import auth
import logging

logger = logging.getLogger(__name__)

def require_auth(f):
    """Decorator to require authentication for API endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get authorization header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({
                'success': False,
                'error': 'Authorization header required'
            }), 401
        
        try:
            # Extract token from "Bearer <token>" format
            if not auth_header.startswith('Bearer '):
                return jsonify({
                    'success': False,
                    'error': 'Invalid authorization header format'
                }), 401
                
            token = auth_header.split(' ')[1]
            
            # Verify Firebase token
            decoded_token = auth.verify_id_token(token)
            user_id = decoded_token['uid']
            
            # Store user ID in request for use in the endpoint
            request.user_id = user_id
            g.user_id = user_id
            
            return f(*args, **kwargs)
            
        except auth.InvalidIdTokenError:
            return jsonify({
                'success': False,
                'error': 'Invalid authentication token'
            }), 401
        except auth.ExpiredIdTokenError:
            return jsonify({
                'success': False,
                'error': 'Authentication token expired'
            }), 401
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return jsonify({
                'success': False,
                'error': 'Authentication failed'
            }), 401
    
    return decorated_function 