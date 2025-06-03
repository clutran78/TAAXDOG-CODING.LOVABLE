import os
from flask import jsonify, request
from functools import wraps
from firebase_config import auth
import logging

# Optional: Enable mock auth explicitly via .env
USE_MOCK_AUTH = os.environ.get("USE_MOCK_AUTH", "false").lower() == "true"

logger = logging.getLogger(__name__)

import datetime

def serialize_dates(obj):
    """
    Recursively walk through obj (dict, list, primitives) and convert
    any datetime.datetime (including Firestore’s DatetimeWithNanoseconds)
    to ISO-format strings.
    """
    if isinstance(obj, dict):
        return {k: serialize_dates(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_dates(v) for v in obj]
    elif isinstance(obj, datetime.datetime):
        return obj.isoformat()
    else:
        return obj


def api_error(message="An error occurred", status=500, details=None):
    logger.error(f"API Error: {message}" + (f" | Details: {details}" if details else ""))
    response = {"success": False, "error": message}
    if details:
        response["details"] = str(details)
    # return jsonify(response), status
    return response, status

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        id_token = request.headers.get('Authorization')
        if id_token and id_token.startswith('Bearer '):
            id_token = id_token[7:]

        if id_token:
            try:
                logger.info(f"🔐 Received Auth Token: {id_token[:10]}{'...' if len(id_token) > 20 else ''}")
                decoded_token = auth.verify_id_token(id_token)
                request.user_id = decoded_token.get('uid')

                logger.info(f"🔐 Received Auth Token: {id_token[:10]}{'...' if len(id_token) > 20 else ''}")

                # Check for mock fallback in production
                if request.user_id.startswith("mock-") and not USE_MOCK_AUTH:
                    logger.warning("🚫 Mock user detected but USE_MOCK_AUTH is disabled.")
                    # return jsonify({'success': False, 'error': 'Mock users not allowed'}), 403
                    return api_error('Mock users not allowed', status=403)

                return f(*args, **kwargs)

            except Exception as e:
                logger.warning("🚫 Mock user detected but USE_MOCK_AUTH is disabled.")

                if USE_MOCK_AUTH:
                    request.user_id = "mock-user-123"
                    logger.warning("⚠️ Using fallback mock-user-123 (dev only).")
                    return f(*args, **kwargs)

                # return jsonify({'success': False, 'error': 'Invalid or expired authentication token'}), 401
                return api_error('Invalid or expired authentication token', status=401)

        if USE_MOCK_AUTH:
            request.user_id = "mock-user-123"
            logger.warning("⚠️ No token provided, using mock-user-123 (dev only).")
            return f(*args, **kwargs)

        logger.warning("🚫 No token provided and mock mode disabled.")
        # return jsonify({'success': False, 'error': 'Authentication token required'}), 401
        return api_error('Authentication token required', status=401)

    return decorated_function