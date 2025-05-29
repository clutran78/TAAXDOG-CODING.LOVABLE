from flask import Blueprint, request, jsonify
from firebase_config import db
from .utils import api_error, login_required, logger

user_routes = Blueprint('user', __name__, url_prefix='/api/users')

@user_routes.route('/profile', methods=['GET'])
@login_required
def get_user_profile():
    """
    Get the current user's profile
    """
    try:
        user_id = request.user_id
        user_doc = db.collection('users').document(user_id).get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            # Remove sensitive information
            if 'password' in user_data:
                del user_data['password']
            
            return jsonify({
                'success': True, 
                'user': user_data
            })
        else:
            return api_error('User not found', status=404)
            
    except Exception as e:
        return api_error('Failed to fetch user profile', status=500)
    
@user_routes.route('/profile', methods=['PUT'])
@login_required
def update_user_profile():
    """
    Update the current user's profile
    """
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Fields that can be updated
        allowed_fields = ['name', 'phone']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not update_data:
            return api_error('No valid fields to update', status=400)
        
        # Update the user document
        db.collection('users').document(user_id).update(update_data)
        
        return jsonify({
            'success': True, 
            'message': 'Profile updated successfully'
        })
            
    except Exception as e:
        return api_error('Failed to update user profile', status=500)