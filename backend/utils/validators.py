"""
Validation utilities for TAAXDOG API
"""

from functools import wraps
from flask import request, jsonify
import logging

logger = logging.getLogger(__name__)

def validate_json(f):
    """Decorator to validate that request contains valid JSON."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request.is_json:
            return jsonify({
                'success': False,
                'error': 'Request must contain valid JSON'
            }), 400
        
        try:
            data = request.get_json()
            if data is None:
                return jsonify({
                    'success': False,
                    'error': 'Request body must contain valid JSON'
                }), 400
            
            return f(*args, **kwargs)
            
        except Exception as e:
            logger.error(f"JSON validation error: {e}")
            return jsonify({
                'success': False,
                'error': 'Invalid JSON format'
            }), 400
    
    return decorated_function

def validate_required_fields(required_fields):
    """Decorator to validate that required fields are present in JSON request."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json()
            
            missing_fields = []
            for field in required_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                return jsonify({
                    'success': False,
                    'error': f'Missing required fields: {", ".join(missing_fields)}'
                }), 400
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator 