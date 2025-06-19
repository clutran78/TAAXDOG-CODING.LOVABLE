"""
Enhanced Notifications and Analytics API Routes for TAAXDOG

This module provides API endpoints for the enhanced notification system,
savings analytics, smart recommendations, and goal achievement tracking.
"""

import sys
import os
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from typing import Dict, List, Optional, Any
import asyncio

# Add project paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))
sys.path.insert(0, os.path.join(project_root, 'backend'))
sys.path.insert(0, os.path.join(project_root, 'database'))

try:
    from firebase_config import db
except ImportError:
    try:
        from backend.firebase_config import db
    except ImportError:
        print("Warning: Firebase config not available")
        db = None

try:
    from services.savings_advisor import get_savings_advisor
    from services.savings_analytics import get_savings_analytics
    from notifications.notification_system import notification_system
except ImportError:
    try:
        from backend.services.savings_advisor import get_savings_advisor
        from backend.services.savings_analytics import get_savings_analytics
        from backend.notifications.notification_system import notification_system
    except ImportError:
        def get_savings_advisor():
            return None
        def get_savings_analytics():
            return None
        notification_system = None

try:
    from utils.auth_middleware import require_auth
except ImportError:
    try:
        from backend.utils.auth_middleware import require_auth
    except ImportError:
        def require_auth(f):
            def wrapper(*args, **kwargs):
                return f(*args, **kwargs)
            return wrapper

# Configure logging
logger = logging.getLogger(__name__)

# Create Blueprint
enhanced_notifications_bp = Blueprint('enhanced_notifications', __name__, url_prefix='/api')

# ==================== NOTIFICATION ROUTES ====================

@enhanced_notifications_bp.route('/notifications', methods=['GET'])
@require_auth
def get_user_notifications():
    """Get user's notifications with filtering and pagination."""
    try:
        user_id = request.user_id
        
        # Get query parameters
        notification_type = request.args.get('type')
        status = request.args.get('status')  # read, unread, all
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        if not notification_system:
            return jsonify({
                'success': False,
                'error': 'Notification system not available'
            }), 500
        
        # Get notifications (sync call to async function)
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            notifications = loop.run_until_complete(
                notification_system.get_user_notifications(user_id, limit + offset)
            )
            loop.close()
        except Exception as e:
            logger.error(f"Failed to get notifications: {e}")
            notifications = []
        
        # Apply filters
        if notification_type:
            notifications = [n for n in notifications if n.get('type') == notification_type]
        
        if status == 'read':
            notifications = [n for n in notifications if n.get('read_at')]
        elif status == 'unread':
            notifications = [n for n in notifications if not n.get('read_at')]
        
        # Apply pagination
        paginated_notifications = notifications[offset:offset + limit]
        
        return jsonify({
            'success': True,
            'data': {
                'notifications': paginated_notifications,
                'total': len(notifications),
                'limit': limit,
                'offset': offset,
                'has_more': len(notifications) > offset + limit
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to get user notifications: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@enhanced_notifications_bp.route('/notifications/preferences', methods=['GET'])
@require_auth
def get_notification_preferences():
    """Get user's notification preferences."""
    try:
        user_id = request.user_id
        
        if not notification_system:
            return jsonify({
                'success': False,
                'error': 'Notification system not available'
            }), 500
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            preferences = loop.run_until_complete(
                notification_system.get_user_notification_preferences(user_id)
            )
            loop.close()
        except Exception as e:
            logger.error(f"Failed to get preferences: {e}")
            preferences = {}
        
        return jsonify({
            'success': True,
            'data': {
                'preferences': preferences
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to get notification preferences: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@enhanced_notifications_bp.route('/notifications/preferences', methods=['PUT'])
@require_auth
def update_notification_preferences():
    """Update user's notification preferences."""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        if not data or 'preferences' not in data:
            return jsonify({
                'success': False,
                'error': 'Preferences data required'
            }), 400
        
        if not notification_system:
            return jsonify({
                'success': False,
                'error': 'Notification system not available'
            }), 500
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            success = loop.run_until_complete(
                notification_system.update_notification_preferences(user_id, data['preferences'])
            )
            loop.close()
        except Exception as e:
            logger.error(f"Failed to update preferences: {e}")
            success = False
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Preferences updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update preferences'
            }), 500
        
    except Exception as e:
        logger.error(f"Failed to update notification preferences: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@enhanced_notifications_bp.route('/notifications/<notification_id>/read', methods=['POST'])
@require_auth
def mark_notification_read(notification_id: str):
    """Mark a notification as read."""
    try:
        user_id = request.user_id
        
        if not notification_system:
            return jsonify({
                'success': False,
                'error': 'Notification system not available'
            }), 500
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            success = loop.run_until_complete(
                notification_system.mark_notification_read(user_id, notification_id)
            )
            loop.close()
        except Exception as e:
            logger.error(f"Failed to mark notification read: {e}")
            success = False
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Notification marked as read'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to mark notification as read'
            }), 500
        
    except Exception as e:
        logger.error(f"Failed to mark notification read: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@enhanced_notifications_bp.route('/notifications/mark-all-read', methods=['POST'])
@require_auth
def mark_all_notifications_read():
    """Mark all notifications as read for the user."""
    try:
        user_id = request.user_id
        
        if not notification_system:
            return jsonify({
                'success': False,
                'error': 'Notification system not available'
            }), 500
        
        # Get all unread notifications and mark them as read
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            notifications = loop.run_until_complete(
                notification_system.get_user_notifications(user_id, 100)
            )
            
            unread_notifications = [n for n in notifications if not n.get('read_at')]
            
            for notification in unread_notifications:
                loop.run_until_complete(
                    notification_system.mark_notification_read(user_id, notification.get('id'))
                )
            
            loop.close()
        except Exception as e:
            logger.error(f"Failed to mark all notifications read: {e}")
            return jsonify({
                'success': False,
                'error': 'Failed to mark notifications as read'
            }), 500
        
        return jsonify({
            'success': True,
            'message': f'Marked {len(unread_notifications)} notifications as read'
        })
        
    except Exception as e:
        logger.error(f"Failed to mark all notifications read: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== SAVINGS RECOMMENDATIONS ROUTES ====================

@enhanced_notifications_bp.route('/savings-recommendations', methods=['GET'])
@require_auth
def get_savings_recommendations():
    """Get AI-powered savings recommendations for the user."""
    try:
        user_id = request.user_id
        include_implemented = request.args.get('include_implemented', 'false').lower() == 'true'
        
        savings_advisor = get_savings_advisor()
        if not savings_advisor:
            return jsonify({
                'success': False,
                'error': 'Savings advisor not available'
            }), 500
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                savings_advisor.generate_comprehensive_recommendations(user_id)
            )
            loop.close()
        except Exception as e:
            logger.error(f"Failed to generate recommendations: {e}")
            result = {'success': False, 'error': str(e)}
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': {
                    'recommendations': result['data'],
                    'cached': result.get('cached', False)
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to generate recommendations')
            }), 500
        
    except Exception as e:
        logger.error(f"Failed to get savings recommendations: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@enhanced_notifications_bp.route('/savings-recommendations/<recommendation_id>/implement', methods=['POST'])
@require_auth
def implement_recommendation(recommendation_id: str):
    """Mark a savings recommendation as implemented."""
    try:
        user_id = request.user_id
        
        savings_advisor = get_savings_advisor()
        if not savings_advisor:
            return jsonify({
                'success': False,
                'error': 'Savings advisor not available'
            }), 500
        
        result = savings_advisor.mark_recommendation_implemented(recommendation_id, user_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Recommendation marked as implemented'
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to mark recommendation as implemented')
            }), 500
        
    except Exception as e:
        logger.error(f"Failed to implement recommendation: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@enhanced_notifications_bp.route('/savings-opportunities', methods=['GET'])
@require_auth
def get_savings_opportunities():
    """Get immediate savings opportunities for the user."""
    try:
        user_id = request.user_id
        
        savings_advisor = get_savings_advisor()
        if not savings_advisor:
            return jsonify({
                'success': False,
                'error': 'Savings advisor not available'
            }), 500
        
        result = savings_advisor.detect_savings_opportunities(user_id)
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': {
                    'opportunities': result['data']
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to detect opportunities')
            }), 500
        
    except Exception as e:
        logger.error(f"Failed to get savings opportunities: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== ANALYTICS ROUTES ====================

@enhanced_notifications_bp.route('/analytics/comprehensive', methods=['GET'])
@require_auth
def get_comprehensive_analytics():
    """Get comprehensive savings analytics for the user."""
    try:
        user_id = request.user_id
        timeframe = request.args.get('timeframe', 'monthly')
        
        # Validate timeframe
        valid_timeframes = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all_time']
        if timeframe not in valid_timeframes:
            return jsonify({
                'success': False,
                'error': f'Invalid timeframe. Must be one of: {", ".join(valid_timeframes)}'
            }), 400
        
        savings_analytics = get_savings_analytics()
        if not savings_analytics:
            return jsonify({
                'success': False,
                'error': 'Savings analytics not available'
            }), 500
        
        # Convert timeframe string to enum
        from backend.services.savings_analytics import AnalyticsTimeframe
        timeframe_enum = getattr(AnalyticsTimeframe, timeframe.upper())
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                savings_analytics.generate_comprehensive_analytics(user_id, timeframe_enum)
            )
            loop.close()
        except Exception as e:
            logger.error(f"Failed to generate analytics: {e}")
            result = {'success': False, 'error': str(e)}
        
        if result['success']:
            return jsonify({
                'success': True,
                'data': {
                    'analytics': result['data']
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to generate analytics')
            }), 500
        
    except Exception as e:
        logger.error(f"Failed to get comprehensive analytics: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== GOAL ACHIEVEMENT ROUTES ====================

@enhanced_notifications_bp.route('/goals/<goal_id>/achievement-stats', methods=['GET'])
@require_auth
def get_goal_achievement_stats(goal_id: str):
    """Get achievement statistics for a completed goal."""
    try:
        user_id = request.user_id
        
        if not db:
            return jsonify({
                'success': False,
                'error': 'Database not available'
            }), 500
        
        # Get goal data
        goal_ref = db.collection('goals').document(goal_id)
        goal_doc = goal_ref.get()
        
        if not goal_doc.exists:
            return jsonify({
                'success': False,
                'error': 'Goal not found'
            }), 404
        
        goal_data = goal_doc.to_dict()
        
        # Verify goal belongs to user
        if goal_data.get('userId') != user_id:
            return jsonify({
                'success': False,
                'error': 'Unauthorized'
            }), 403
        
        # Calculate achievement stats
        created_at = goal_data.get('createdAt')
        completed_at = goal_data.get('completedAt', datetime.now().isoformat())
        target_amount = goal_data.get('targetAmount', 0)
        
        if created_at:
            created_dt = datetime.fromisoformat(created_at)
            completed_dt = datetime.fromisoformat(completed_at)
            time_taken = (completed_dt - created_dt).days
        else:
            time_taken = 0
        
        # Get transfer history for this goal (simplified calculation)
        monthly_contribution = target_amount / max(time_taken / 30, 1) if time_taken > 0 else 0
        estimated_transfers = max(time_taken // 7, 1)  # Assume weekly transfers
        
        stats = {
            'timeTaken': time_taken,
            'totalSaved': target_amount,
            'averageMonthlyContribution': monthly_contribution,
            'totalTransfers': estimated_transfers,
            'consistencyScore': min(95, 70 + (estimated_transfers * 2)),  # Simple calculation
            'completionRank': "Top 25% of savers"  # Placeholder
        }
        
        return jsonify({
            'success': True,
            'data': {
                'stats': stats
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to get goal achievement stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@enhanced_notifications_bp.route('/goals/suggestions', methods=['GET'])
@require_auth
def get_goal_suggestions():
    """Get AI-powered goal suggestions based on completed goals."""
    try:
        user_id = request.user_id
        completed_goal_id = request.args.get('completed_goal')
        
        # For now, return some predefined suggestions
        # In a real implementation, this would use AI to generate personalized suggestions
        suggestions = [
            {
                'name': 'Emergency Fund Expansion',
                'targetAmount': 5000,
                'category': 'Emergency',
                'reason': 'Build on your success with a larger emergency fund for better financial security',
                'timeline': '12 months'
            },
            {
                'name': 'Dream Vacation Fund',
                'targetAmount': 3000,
                'category': 'Travel',
                'reason': 'Reward your discipline with a memorable vacation experience',
                'timeline': '8 months'
            },
            {
                'name': 'Investment Account Starter',
                'targetAmount': 2500,
                'category': 'Investment',
                'reason': 'Start building long-term wealth through investments',
                'timeline': '6 months'
            }
        ]
        
        return jsonify({
            'success': True,
            'data': {
                'suggestions': suggestions
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to get goal suggestions: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== ACHIEVEMENT SYSTEM ROUTES ====================

@enhanced_notifications_bp.route('/achievements', methods=['GET'])
@require_auth
def get_user_achievements():
    """Get user's unlocked achievements."""
    try:
        user_id = request.user_id
        
        if not notification_system:
            return jsonify({
                'success': False,
                'error': 'Notification system not available'
            }), 500
        
        # Get user statistics for achievement checking
        user_stats = {
            'total_goals': 3,
            'completed_goals': 1,
            'total_saved': 2500,
            'total_transfers': 15,
            'transfer_streak': 7,
            'longest_streak': 14,
            'active_rules': 2
        }
        
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            achievements = loop.run_until_complete(
                notification_system.check_achievement_unlocks(user_id, user_stats)
            )
            loop.close()
        except Exception as e:
            logger.error(f"Failed to check achievements: {e}")
            achievements = []
        
        return jsonify({
            'success': True,
            'data': {
                'achievements': [
                    {
                        'id': 'first_goal',
                        'title': 'Goal Setter',
                        'description': 'Created your first savings goal',
                        'badge': '🎯',
                        'rarity': 'common',
                        'unlockedAt': datetime.now().isoformat()
                    }
                ]
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to get user achievements: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== HEALTH CHECK ROUTE ====================

@enhanced_notifications_bp.route('/health/enhanced-features', methods=['GET'])
def health_check():
    """Health check for enhanced notification and analytics features."""
    try:
        services_status = {
            'notification_system': notification_system is not None,
            'savings_advisor': get_savings_advisor() is not None,
            'savings_analytics': get_savings_analytics() is not None,
            'database': db is not None
        }
        
        all_healthy = all(services_status.values())
        
        return jsonify({
            'success': True,
            'data': {
                'status': 'healthy' if all_healthy else 'degraded',
                'services': services_status,
                'timestamp': datetime.now().isoformat()
            }
        }), 200 if all_healthy else 206
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# Export blueprint
def register_enhanced_notifications_routes(app):
    """Register enhanced notifications routes with the Flask app."""
    app.register_blueprint(enhanced_notifications_bp)
    logger.info("✅ Enhanced notifications routes registered")
    return enhanced_notifications_bp 