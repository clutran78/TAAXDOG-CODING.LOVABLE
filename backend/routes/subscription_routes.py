"""
TAAXDOG Subscription Routes
API endpoints for subscription management, billing, and premium features.
"""

from flask import Blueprint, request, jsonify
import asyncio
import logging
import stripe
from datetime import datetime
import sys
import os

# Add parent directory to path for cross-module imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

try:
    from subscription_manager import subscription_manager, SubscriptionTier, FeatureAccess
    from utils.auth_middleware import require_auth
    from utils.validators import validate_json
except ImportError:
    # Fallback for development mode
    subscription_manager = None
    class SubscriptionTier: pass
    class FeatureAccess: pass
    def require_auth(func): return func
    def validate_json(*args): return lambda func: func

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

subscription_bp = Blueprint('subscription', __name__)

@subscription_bp.route('/api/subscription/plans', methods=['GET'])
def get_subscription_plans():
    """Get all available subscription plans"""
    try:
        plans_data = []
        
        for tier, plan in subscription_manager.subscription_plans.items():
            plan_dict = {
                'tier': tier.value,
                'name': plan.name,
                'price_monthly': plan.price_monthly,
                'price_yearly': plan.price_yearly,
                'receipts_per_month': plan.receipts_per_month,
                'api_calls_per_month': plan.api_calls_per_month,
                'team_members': plan.team_members,
                'description': plan.description,
                'features': [feature.value for feature in plan.features],
                'savings_yearly': (plan.price_monthly * 12) - plan.price_yearly if plan.price_yearly > 0 else 0
            }
            plans_data.append(plan_dict)
        
        return jsonify({
            'success': True,
            'plans': plans_data
        })
        
    except Exception as e:
        logger.error(f"Error getting subscription plans: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve subscription plans'
        }), 500

@subscription_bp.route('/api/subscription/current', methods=['GET'])
@require_auth
def get_current_subscription():
    """Get user's current subscription details"""
    try:
        user_id = request.user_id
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            subscription = loop.run_until_complete(
                subscription_manager.get_user_subscription(user_id)
            )
            
            # Get usage stats
            receipt_usage = loop.run_until_complete(
                subscription_manager.check_usage_limit(user_id, "receipts")
            )
            
            api_usage = loop.run_until_complete(
                subscription_manager.check_usage_limit(user_id, "api_calls")
            )
            
            subscription_data = {
                'tier': subscription.tier.value,
                'status': subscription.status,
                'start_date': subscription.start_date.isoformat(),
                'end_date': subscription.end_date.isoformat() if subscription.end_date else None,
                'trial_end_date': subscription.trial_end_date.isoformat() if subscription.trial_end_date else None,
                'usage': {
                    'receipts': receipt_usage,
                    'api_calls': api_usage
                },
                'plan_details': {
                    'name': subscription_manager.subscription_plans[subscription.tier].name,
                    'price_monthly': subscription_manager.subscription_plans[subscription.tier].price_monthly,
                    'features': [f.value for f in subscription_manager.subscription_plans[subscription.tier].features]
                }
            }
            
            return jsonify({
                'success': True,
                'subscription': subscription_data
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting current subscription for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve subscription details'
        }), 500

@subscription_bp.route('/api/subscription/usage', methods=['GET'])
@require_auth
def get_usage_stats():
    """Get detailed usage statistics"""
    try:
        user_id = request.user_id
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Get current month usage
            receipt_usage = loop.run_until_complete(
                subscription_manager.check_usage_limit(user_id, "receipts", current_month=True)
            )
            
            api_usage = loop.run_until_complete(
                subscription_manager.check_usage_limit(user_id, "api_calls", current_month=True)
            )
            
            # Get total usage
            receipt_usage_total = loop.run_until_complete(
                subscription_manager.check_usage_limit(user_id, "receipts", current_month=False)
            )
            
            api_usage_total = loop.run_until_complete(
                subscription_manager.check_usage_limit(user_id, "api_calls", current_month=False)
            )
            
            return jsonify({
                'success': True,
                'usage': {
                    'current_month': {
                        'receipts': receipt_usage,
                        'api_calls': api_usage
                    },
                    'total': {
                        'receipts': receipt_usage_total,
                        'api_calls': api_usage_total
                    }
                },
                'month': datetime.now().strftime('%Y-%m')
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting usage stats for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve usage statistics'
        }), 500

@subscription_bp.route('/api/subscription/upgrade', methods=['POST'])
@require_auth
@validate_json
def create_upgrade_session():
    """Create Stripe checkout session for subscription upgrade"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        tier_str = data.get('tier')
        billing_period = data.get('billing_period', 'monthly')
        
        if not tier_str or tier_str not in [t.value for t in SubscriptionTier]:
            return jsonify({
                'success': False,
                'error': 'Invalid subscription tier'
            }), 400
        
        if billing_period not in ['monthly', 'yearly']:
            return jsonify({
                'success': False,
                'error': 'Invalid billing period'
            }), 400
        
        tier = SubscriptionTier(tier_str)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                subscription_manager.create_stripe_checkout_session(user_id, tier, billing_period)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error creating upgrade session for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to create upgrade session'
        }), 500

@subscription_bp.route('/api/subscription/trial', methods=['POST'])
@require_auth
@validate_json
def start_trial():
    """Start a trial period for premium features"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        tier_str = data.get('tier', 'premium')
        trial_days = int(data.get('trial_days', 14))
        
        if tier_str not in [t.value for t in SubscriptionTier]:
            return jsonify({
                'success': False,
                'error': 'Invalid subscription tier'
            }), 400
        
        if trial_days < 1 or trial_days > 30:
            return jsonify({
                'success': False,
                'error': 'Trial period must be between 1 and 30 days'
            }), 400
        
        tier = SubscriptionTier(tier_str)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                subscription_manager.start_trial(user_id, tier, trial_days)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error starting trial for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to start trial'
        }), 500

@subscription_bp.route('/api/subscription/cancel', methods=['POST'])
@require_auth
def cancel_subscription():
    """Cancel user's subscription"""
    try:
        user_id = request.user_id
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                subscription_manager.cancel_subscription(user_id)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error cancelling subscription for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to cancel subscription'
        }), 500

@subscription_bp.route('/api/subscription/features', methods=['GET'])
@require_auth
def check_feature_access():
    """Check user's access to specific features"""
    try:
        user_id = request.user_id
        feature_str = request.args.get('feature')
        
        if feature_str and feature_str in [f.value for f in FeatureAccess]:
            feature = FeatureAccess(feature_str)
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                has_access = loop.run_until_complete(
                    subscription_manager.check_feature_access(user_id, feature)
                )
                
                return jsonify({
                    'success': True,
                    'feature': feature_str,
                    'has_access': has_access
                })
                
            finally:
                loop.close()
        else:
            # Return access status for all features
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                feature_access = {}
                for feature in FeatureAccess:
                    has_access = loop.run_until_complete(
                        subscription_manager.check_feature_access(user_id, feature)
                    )
                    feature_access[feature.value] = has_access
                
                return jsonify({
                    'success': True,
                    'feature_access': feature_access
                })
                
            finally:
                loop.close()
            
    except Exception as e:
        logger.error(f"Error checking feature access for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to check feature access'
        }), 500

@subscription_bp.route('/api/subscription/webhook', methods=['POST'])
def handle_stripe_webhook():
    """Handle Stripe webhook events"""
    try:
        payload = request.get_data()
        sig_header = request.headers.get('Stripe-Signature')
        endpoint_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
        
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, endpoint_secret
            )
        except ValueError:
            logger.error("Invalid payload in Stripe webhook")
            return jsonify({'error': 'Invalid payload'}), 400
        except stripe.error.SignatureVerificationError:
            logger.error("Invalid signature in Stripe webhook")
            return jsonify({'error': 'Invalid signature'}), 400
        
        # Handle the event
        event_type = event['type']
        data = event['data']
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            success = loop.run_until_complete(
                subscription_manager.handle_stripe_webhook(event_type, data)
            )
            
            if success:
                return jsonify({'success': True})
            else:
                return jsonify({'error': 'Failed to process webhook'}), 500
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error handling Stripe webhook: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@subscription_bp.route('/api/subscription/admin/analytics', methods=['GET'])
@require_auth
def get_subscription_analytics():
    """Get subscription analytics (admin only)"""
    try:
        user_id = request.user_id
        
        # Check if user has admin access (implement your admin check here)
        # For now, we'll allow enterprise users to see analytics
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            has_admin_access = loop.run_until_complete(
                subscription_manager.check_feature_access(user_id, FeatureAccess.TAX_AGENT_PORTAL)
            )
            
            if not has_admin_access:
                return jsonify({
                    'success': False,
                    'error': 'Admin access required'
                }), 403
            
            analytics = loop.run_until_complete(
                subscription_manager.get_subscription_analytics()
            )
            
            return jsonify({
                'success': True,
                'analytics': analytics
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting subscription analytics: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve analytics'
        }), 500

@subscription_bp.route('/api/subscription/billing-portal', methods=['POST'])
@require_auth
def create_billing_portal_session():
    """Create Stripe billing portal session"""
    try:
        user_id = request.user_id
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            subscription = loop.run_until_complete(
                subscription_manager.get_user_subscription(user_id)
            )
            
            if not subscription.stripe_customer_id:
                return jsonify({
                    'success': False,
                    'error': 'No billing information found'
                }), 400
            
            # Create billing portal session
            session = stripe.billing_portal.Session.create(
                customer=subscription.stripe_customer_id,
                return_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard?tab=subscription",
            )
            
            return jsonify({
                'success': True,
                'url': session.url
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error creating billing portal session for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to create billing portal session'
        }), 500

@subscription_bp.route('/api/subscription/usage/increment', methods=['POST'])
@require_auth
@validate_json
def increment_usage():
    """Increment usage counter (internal API)"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        usage_type = data.get('usage_type')
        amount = int(data.get('amount', 1))
        
        if not usage_type or usage_type not in ['receipts', 'api_calls']:
            return jsonify({
                'success': False,
                'error': 'Invalid usage type'
            }), 400
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            success = loop.run_until_complete(
                subscription_manager.increment_usage(user_id, usage_type, amount)
            )
            
            if success:
                # Get updated usage stats
                usage_stats = loop.run_until_complete(
                    subscription_manager.check_usage_limit(user_id, usage_type)
                )
                
                return jsonify({
                    'success': True,
                    'usage_stats': usage_stats
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Usage limit exceeded',
                    'upgrade_required': True
                }), 429
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error incrementing usage for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to update usage'
        }), 500 