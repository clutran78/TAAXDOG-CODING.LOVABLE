"""
TAAXDOG Notification Routes
API endpoints for managing user notifications.
"""

from flask import Blueprint, request, jsonify, current_app
from firebase_admin import auth
import asyncio
import logging
import sys
import os

# Add parent directory to path for cross-module imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

try:
    from notifications.notification_system import notification_system, run_notification_checks
    from utils.auth_middleware import require_auth
    from utils.validators import validate_json
except ImportError:
    # Fallback for development mode
    notification_system = None
    def run_notification_checks(): return {}
    def require_auth(func): return func
    def validate_json(*args): return lambda func: func
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

notification_bp = Blueprint('notifications', __name__)

@notification_bp.route('/api/notifications', methods=['GET'])
@require_auth
def get_notifications():
    """Get user's notifications with pagination."""
    try:
        user_id = request.user_id
        limit = min(int(request.args.get('limit', 50)), 100)  # Max 100
        offset = int(request.args.get('offset', 0))
        
        # Run async function
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            notifications = loop.run_until_complete(
                notification_system.get_user_notifications(user_id, limit + offset)
            )
            
            # Apply offset and limit
            paginated_notifications = notifications[offset:offset + limit]
            
            return jsonify({
                'success': True,
                'notifications': paginated_notifications,
                'total': len(notifications),
                'limit': limit,
                'offset': offset
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting notifications: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve notifications'
        }), 500

@notification_bp.route('/api/notifications/<notification_id>/read', methods=['POST'])
@require_auth
def mark_notification_read(notification_id):
    """Mark a notification as read."""
    try:
        user_id = request.user_id
        
        # Run async function
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            success = loop.run_until_complete(
                notification_system.mark_notification_read(user_id, notification_id)
            )
            
            return jsonify({
                'success': success,
                'message': 'Notification marked as read' if success else 'Failed to mark notification as read'
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to mark notification as read'
        }), 500

@notification_bp.route('/api/notifications/preferences', methods=['GET'])
@require_auth
def get_notification_preferences():
    """Get user's notification preferences."""
    try:
        user_id = request.user_id
        
        # Get preferences from Redis
        prefs_key = f"notification_prefs:{user_id}"
        preferences = notification_system.redis_client.hgetall(prefs_key)
        
        # Default preferences if none exist
        if not preferences:
            preferences = {
                'overspending_alerts': 'true',
                'goal_progress_updates': 'true',
                'subscription_reminders': 'true',
                'petrol_price_alerts': 'true',
                'weekly_reports': 'true',
                'email_notifications': 'true',
                'push_notifications': 'true',
                'sms_notifications': 'false'
            }
        
        # Convert string booleans to actual booleans
        for key, value in preferences.items():
            preferences[key] = value.lower() == 'true'
        
        return jsonify({
            'success': True,
            'preferences': preferences
        })
        
    except Exception as e:
        logger.error(f"Error getting notification preferences: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve notification preferences'
        }), 500

@notification_bp.route('/api/notifications/preferences', methods=['POST'])
@require_auth
@validate_json
def update_notification_preferences():
    """Update user's notification preferences."""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        valid_preferences = {
            'overspending_alerts',
            'goal_progress_updates', 
            'subscription_reminders',
            'petrol_price_alerts',
            'weekly_reports',
            'email_notifications',
            'push_notifications',
            'sms_notifications'
        }
        
        # Validate preferences
        preferences = {}
        for key, value in data.items():
            if key in valid_preferences and isinstance(value, bool):
                preferences[key] = str(value).lower()
        
        if not preferences:
            return jsonify({
                'success': False,
                'error': 'No valid preferences provided'
            }), 400
        
        # Save preferences to Redis
        prefs_key = f"notification_prefs:{user_id}"
        notification_system.redis_client.hset(prefs_key, mapping=preferences)
        
        return jsonify({
            'success': True,
            'message': 'Notification preferences updated successfully',
            'preferences': {k: v == 'true' for k, v in preferences.items()}
        })
        
    except Exception as e:
        logger.error(f"Error updating notification preferences: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to update notification preferences'
        }), 500

@notification_bp.route('/api/notifications/budget', methods=['POST'])
@require_auth
@validate_json
def set_budget_alerts():
    """Set or update budget limits for overspending alerts."""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        budgets = data.get('budgets', {})
        
        # Validate budget data
        valid_budgets = {}
        for category, amount in budgets.items():
            if isinstance(category, str) and isinstance(amount, (int, float)) and amount > 0:
                valid_budgets[category] = str(float(amount))
        
        if not valid_budgets:
            return jsonify({
                'success': False,
                'error': 'No valid budget limits provided'
            }), 400
        
        # Save budgets to Redis
        budget_key = f"budget:{user_id}"
        notification_system.redis_client.hset(budget_key, mapping=valid_budgets)
        
        return jsonify({
            'success': True,
            'message': 'Budget alerts updated successfully',
            'budgets': {k: float(v) for k, v in valid_budgets.items()}
        })
        
    except Exception as e:
        logger.error(f"Error setting budget alerts: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to set budget alerts'
        }), 500

@notification_bp.route('/api/notifications/budget', methods=['GET'])
@require_auth
def get_budget_alerts():
    """Get user's budget limits."""
    try:
        user_id = request.user_id
        
        budget_key = f"budget:{user_id}"
        budgets = notification_system.redis_client.hgetall(budget_key)
        
        # Convert to float values
        budget_data = {k: float(v) for k, v in budgets.items()}
        
        return jsonify({
            'success': True,
            'budgets': budget_data
        })
        
    except Exception as e:
        logger.error(f"Error getting budget alerts: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve budget alerts'
        }), 500

@notification_bp.route('/api/notifications/test', methods=['POST'])
@require_auth
def test_notifications():
    """Test notification system by running checks for current user."""
    try:
        user_id = request.user_id
        
        # Get user data from Firebase (simplified for testing)
        from firebase_admin import firestore
        db = firestore.client()
        
        user_data = {}
        
        # Get basic user info
        user_doc = db.collection('users').document(user_id).get()
        if user_doc.exists:
            user_data.update(user_doc.to_dict())
        
        # Add some test data if none exists
        if not user_data.get('transactions'):
            user_data['transactions'] = [
                {
                    'id': 'test1',
                    'amount': -150.00,
                    'category': 'Groceries',
                    'date': '2024-01-15',
                    'description': 'Test grocery purchase'
                }
            ]
        
        if not user_data.get('goals'):
            user_data['goals'] = [
                {
                    'id': 'test_goal',
                    'name': 'Emergency Fund',
                    'current_amount': 2500,
                    'target_amount': 5000,
                    'target_date': '2024-12-31'
                }
            ]
        
        # Run notification checks
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            loop.run_until_complete(run_notification_checks(user_id, user_data))
            
            return jsonify({
                'success': True,
                'message': 'Test notifications processed successfully'
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error testing notifications: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to test notifications'
        }), 500

@notification_bp.route('/api/notifications/unread-count', methods=['GET'])
@require_auth
def get_unread_count():
    """Get count of unread notifications for user."""
    try:
        user_id = request.user_id
        
        # Get all notifications and count unread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            notifications = loop.run_until_complete(
                notification_system.get_user_notifications(user_id, 1000)
            )
            
            unread_count = sum(1 for n in notifications if not n.get('read_at'))
            
            return jsonify({
                'success': True,
                'unread_count': unread_count
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get unread count'
        }), 500

@notification_bp.route('/api/notifications/location', methods=['POST'])
@require_auth
@validate_json
def update_user_location():
    """Update user location for petrol price alerts."""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
            return jsonify({
                'success': False,
                'error': 'Valid latitude and longitude required'
            }), 400
        
        # Validate coordinate ranges
        if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
            return jsonify({
                'success': False,
                'error': 'Invalid coordinate ranges'
            }), 400
        
        # Store location in Redis
        location_key = f"location:{user_id}"
        location_data = {
            'latitude': str(latitude),
            'longitude': str(longitude),
            'updated_at': str(int(time.time()))
        }
        
        notification_system.redis_client.hset(location_key, mapping=location_data)
        
        return jsonify({
            'success': True,
            'message': 'Location updated successfully'
        })
        
    except Exception as e:
        logger.error(f"Error updating user location: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to update location'
        }), 500

# Error handlers
@notification_bp.errorhandler(400)
def bad_request(error):
    return jsonify({
        'success': False,
        'error': 'Bad request',
        'message': str(error)
    }), 400

@notification_bp.errorhandler(401)
def unauthorized(error):
    return jsonify({
        'success': False,
        'error': 'Unauthorized',
        'message': 'Authentication required'
    }), 401

@notification_bp.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500 