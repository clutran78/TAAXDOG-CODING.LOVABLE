"""
TAAXDOG Subscription Manager
Handles premium features, subscription tiers, billing, and usage tracking.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import stripe
from firebase_config import db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

class SubscriptionTier(Enum):
    FREE = "free"
    PREMIUM = "premium"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"

class FeatureAccess(Enum):
    BASIC_SCANNING = "basic_scanning"
    AUTO_CATEGORIZATION = "auto_categorization"
    TAX_INSIGHTS = "tax_insights"
    ADVANCED_REPORTS = "advanced_reports"
    API_ACCESS = "api_access"
    TEAM_COLLABORATION = "team_collaboration"
    PRIORITY_SUPPORT = "priority_support"
    UNLIMITED_RECEIPTS = "unlimited_receipts"
    CUSTOM_CATEGORIES = "custom_categories"
    AUTOMATED_REPORTS = "automated_reports"
    TAX_AGENT_PORTAL = "tax_agent_portal"
    BANK_INTEGRATIONS = "bank_integrations"
    CARBON_TRACKING = "carbon_tracking"
    INVESTMENT_TRACKING = "investment_tracking"

@dataclass
class SubscriptionPlan:
    tier: SubscriptionTier
    name: str
    price_monthly: float
    price_yearly: float
    receipts_per_month: int
    features: List[FeatureAccess]
    api_calls_per_month: int
    team_members: int
    description: str
    stripe_price_id_monthly: str
    stripe_price_id_yearly: str

@dataclass
class UserSubscription:
    user_id: str
    tier: SubscriptionTier
    status: str  # active, cancelled, expired, trial
    start_date: datetime
    end_date: Optional[datetime]
    stripe_subscription_id: Optional[str]
    stripe_customer_id: Optional[str]
    usage_stats: Dict[str, int]
    trial_end_date: Optional[datetime]

class SubscriptionManager:
    """Manages user subscriptions, billing, and feature access"""
    
    def __init__(self):
        self.subscription_plans = self._initialize_plans()
        
    def _initialize_plans(self) -> Dict[SubscriptionTier, SubscriptionPlan]:
        """Initialize subscription plan configurations"""
        return {
            SubscriptionTier.FREE: SubscriptionPlan(
                tier=SubscriptionTier.FREE,
                name="Free Starter",
                price_monthly=0.0,
                price_yearly=0.0,
                receipts_per_month=50,
                features=[
                    FeatureAccess.BASIC_SCANNING,
                    FeatureAccess.BANK_INTEGRATIONS
                ],
                api_calls_per_month=0,
                team_members=1,
                description="Perfect for personal use with basic receipt scanning",
                stripe_price_id_monthly="",
                stripe_price_id_yearly=""
            ),
            
            SubscriptionTier.PREMIUM: SubscriptionPlan(
                tier=SubscriptionTier.PREMIUM,
                name="Premium Individual",
                price_monthly=19.99,
                price_yearly=199.99,  # 2 months free
                receipts_per_month=500,
                features=[
                    FeatureAccess.BASIC_SCANNING,
                    FeatureAccess.AUTO_CATEGORIZATION,
                    FeatureAccess.TAX_INSIGHTS,
                    FeatureAccess.ADVANCED_REPORTS,
                    FeatureAccess.CUSTOM_CATEGORIES,
                    FeatureAccess.BANK_INTEGRATIONS,
                    FeatureAccess.CARBON_TRACKING
                ],
                api_calls_per_month=1000,
                team_members=1,
                description="Advanced features for tax optimization and financial insights",
                stripe_price_id_monthly=os.getenv('STRIPE_PREMIUM_MONTHLY_PRICE_ID', ''),
                stripe_price_id_yearly=os.getenv('STRIPE_PREMIUM_YEARLY_PRICE_ID', '')
            ),
            
            SubscriptionTier.BUSINESS: SubscriptionPlan(
                tier=SubscriptionTier.BUSINESS,
                name="Business Professional",
                price_monthly=49.99,
                price_yearly=499.99,  # 2 months free
                receipts_per_month=-1,  # unlimited
                features=[
                    FeatureAccess.BASIC_SCANNING,
                    FeatureAccess.AUTO_CATEGORIZATION,
                    FeatureAccess.TAX_INSIGHTS,
                    FeatureAccess.ADVANCED_REPORTS,
                    FeatureAccess.API_ACCESS,
                    FeatureAccess.TEAM_COLLABORATION,
                    FeatureAccess.UNLIMITED_RECEIPTS,
                    FeatureAccess.CUSTOM_CATEGORIES,
                    FeatureAccess.AUTOMATED_REPORTS,
                    FeatureAccess.BANK_INTEGRATIONS,
                    FeatureAccess.CARBON_TRACKING,
                    FeatureAccess.INVESTMENT_TRACKING
                ],
                api_calls_per_month=10000,
                team_members=5,
                description="Complete business solution with team collaboration",
                stripe_price_id_monthly=os.getenv('STRIPE_BUSINESS_MONTHLY_PRICE_ID', ''),
                stripe_price_id_yearly=os.getenv('STRIPE_BUSINESS_YEARLY_PRICE_ID', '')
            ),
            
            SubscriptionTier.ENTERPRISE: SubscriptionPlan(
                tier=SubscriptionTier.ENTERPRISE,
                name="Enterprise",
                price_monthly=199.99,
                price_yearly=1999.99,
                receipts_per_month=-1,  # unlimited
                features=[
                    FeatureAccess.BASIC_SCANNING,
                    FeatureAccess.AUTO_CATEGORIZATION,
                    FeatureAccess.TAX_INSIGHTS,
                    FeatureAccess.ADVANCED_REPORTS,
                    FeatureAccess.API_ACCESS,
                    FeatureAccess.TEAM_COLLABORATION,
                    FeatureAccess.PRIORITY_SUPPORT,
                    FeatureAccess.UNLIMITED_RECEIPTS,
                    FeatureAccess.CUSTOM_CATEGORIES,
                    FeatureAccess.AUTOMATED_REPORTS,
                    FeatureAccess.TAX_AGENT_PORTAL,
                    FeatureAccess.BANK_INTEGRATIONS,
                    FeatureAccess.CARBON_TRACKING,
                    FeatureAccess.INVESTMENT_TRACKING
                ],
                api_calls_per_month=-1,  # unlimited
                team_members=-1,  # unlimited
                description="Enterprise-grade solution with tax agent portal and unlimited usage",
                stripe_price_id_monthly=os.getenv('STRIPE_ENTERPRISE_MONTHLY_PRICE_ID', ''),
                stripe_price_id_yearly=os.getenv('STRIPE_ENTERPRISE_YEARLY_PRICE_ID', '')
            )
        }
    
    async def get_user_subscription(self, user_id: str) -> UserSubscription:
        """Get user's current subscription details"""
        try:
            if not db:
                # Default to free tier if no database
                return UserSubscription(
                    user_id=user_id,
                    tier=SubscriptionTier.FREE,
                    status="active",
                    start_date=datetime.now(),
                    end_date=None,
                    stripe_subscription_id=None,
                    stripe_customer_id=None,
                    usage_stats={},
                    trial_end_date=None
                )
            
            # Get subscription from Firestore
            sub_ref = db.collection('subscriptions').document(user_id)
            sub_doc = sub_ref.get()
            
            if sub_doc.exists:
                data = sub_doc.to_dict()
                return UserSubscription(
                    user_id=user_id,
                    tier=SubscriptionTier(data.get('tier', 'free')),
                    status=data.get('status', 'active'),
                    start_date=datetime.fromisoformat(data.get('start_date')),
                    end_date=datetime.fromisoformat(data.get('end_date')) if data.get('end_date') else None,
                    stripe_subscription_id=data.get('stripe_subscription_id'),
                    stripe_customer_id=data.get('stripe_customer_id'),
                    usage_stats=data.get('usage_stats', {}),
                    trial_end_date=datetime.fromisoformat(data.get('trial_end_date')) if data.get('trial_end_date') else None
                )
            else:
                # New user - start with free tier
                subscription = UserSubscription(
                    user_id=user_id,
                    tier=SubscriptionTier.FREE,
                    status="active",
                    start_date=datetime.now(),
                    end_date=None,
                    stripe_subscription_id=None,
                    stripe_customer_id=None,
                    usage_stats={},
                    trial_end_date=None
                )
                await self._save_subscription(subscription)
                return subscription
                
        except Exception as e:
            logger.error(f"Error getting subscription for user {user_id}: {e}")
            # Default to free tier on error
            return UserSubscription(
                user_id=user_id,
                tier=SubscriptionTier.FREE,
                status="active",
                start_date=datetime.now(),
                end_date=None,
                stripe_subscription_id=None,
                stripe_customer_id=None,
                usage_stats={},
                trial_end_date=None
            )
    
    async def check_feature_access(self, user_id: str, feature: FeatureAccess) -> bool:
        """Check if user has access to a specific feature"""
        try:
            subscription = await self.get_user_subscription(user_id)
            
            # Check if subscription is active
            if subscription.status != "active":
                return feature in self.subscription_plans[SubscriptionTier.FREE].features
            
            # Check if trial has expired
            if subscription.trial_end_date and datetime.now() > subscription.trial_end_date:
                if subscription.tier == SubscriptionTier.FREE:
                    return feature in self.subscription_plans[SubscriptionTier.FREE].features
                else:
                    # Downgrade to free if trial expired and no payment
                    await self._downgrade_to_free(user_id)
                    return feature in self.subscription_plans[SubscriptionTier.FREE].features
            
            # Check feature access based on tier
            return feature in self.subscription_plans[subscription.tier].features
            
        except Exception as e:
            logger.error(f"Error checking feature access for user {user_id}, feature {feature}: {e}")
            return False
    
    async def check_usage_limit(self, user_id: str, usage_type: str, current_month: bool = True) -> Dict[str, Any]:
        """Check usage against subscription limits"""
        try:
            subscription = await self.get_user_subscription(user_id)
            plan = self.subscription_plans[subscription.tier]
            
            # Get current usage
            usage_key = f"{usage_type}_monthly" if current_month else f"{usage_type}_total"
            current_usage = subscription.usage_stats.get(usage_key, 0)
            
            # Determine limit based on usage type
            if usage_type == "receipts":
                limit = plan.receipts_per_month
            elif usage_type == "api_calls":
                limit = plan.api_calls_per_month
            else:
                limit = -1  # unlimited for unknown types
            
            # Calculate remaining and percentage
            if limit == -1:  # unlimited
                remaining = -1
                percentage_used = 0
                at_limit = False
            else:
                remaining = max(0, limit - current_usage)
                percentage_used = (current_usage / limit * 100) if limit > 0 else 0
                at_limit = current_usage >= limit
            
            return {
                'current_usage': current_usage,
                'limit': limit,
                'remaining': remaining,
                'percentage_used': percentage_used,
                'at_limit': at_limit,
                'unlimited': limit == -1
            }
            
        except Exception as e:
            logger.error(f"Error checking usage limit for user {user_id}, type {usage_type}: {e}")
            return {
                'current_usage': 0,
                'limit': 0,
                'remaining': 0,
                'percentage_used': 0,
                'at_limit': True,
                'unlimited': False
            }
    
    async def increment_usage(self, user_id: str, usage_type: str, amount: int = 1) -> bool:
        """Increment usage counter and check limits"""
        try:
            subscription = await self.get_user_subscription(user_id)
            
            # Check if at limit
            usage_check = await self.check_usage_limit(user_id, usage_type)
            if usage_check['at_limit'] and not usage_check['unlimited']:
                return False
            
            # Increment usage
            current_month = datetime.now().strftime('%Y-%m')
            usage_key = f"{usage_type}_{current_month}"
            monthly_key = f"{usage_type}_monthly"
            
            subscription.usage_stats[usage_key] = subscription.usage_stats.get(usage_key, 0) + amount
            subscription.usage_stats[monthly_key] = subscription.usage_stats.get(monthly_key, 0) + amount
            
            # Save updated subscription
            await self._save_subscription(subscription)
            
            return True
            
        except Exception as e:
            logger.error(f"Error incrementing usage for user {user_id}, type {usage_type}: {e}")
            return False
    
    async def create_stripe_checkout_session(self, user_id: str, tier: SubscriptionTier, billing_period: str = "monthly") -> Dict[str, Any]:
        """Create Stripe checkout session for subscription upgrade"""
        try:
            plan = self.subscription_plans[tier]
            current_subscription = await self.get_user_subscription(user_id)
            
            # Get price ID based on billing period
            price_id = plan.stripe_price_id_monthly if billing_period == "monthly" else plan.stripe_price_id_yearly
            
            if not price_id:
                raise ValueError(f"No Stripe price ID configured for {tier.value} {billing_period}")
            
            # Create or get Stripe customer
            customer_id = current_subscription.stripe_customer_id
            if not customer_id:
                # Get user email from Firebase
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                user_email = user_doc.to_dict().get('email') if user_doc.exists else None
                
                customer = stripe.Customer.create(
                    email=user_email,
                    metadata={'user_id': user_id}
                )
                customer_id = customer.id
            
            # Create checkout session
            checkout_session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=['card'],
                line_items=[{
                    'price': price_id,
                    'quantity': 1,
                }],
                mode='subscription',
                success_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard?upgrade=success",
                cancel_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard?upgrade=cancelled",
                metadata={
                    'user_id': user_id,
                    'tier': tier.value,
                    'billing_period': billing_period
                }
            )
            
            return {
                'success': True,
                'checkout_url': checkout_session.url,
                'session_id': checkout_session.id
            }
            
        except Exception as e:
            logger.error(f"Error creating checkout session for user {user_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def handle_stripe_webhook(self, event_type: str, data: Dict[str, Any]) -> bool:
        """Handle Stripe webhook events"""
        try:
            if event_type == 'checkout.session.completed':
                # Handle successful subscription creation
                session = data['object']
                user_id = session['metadata']['user_id']
                tier = SubscriptionTier(session['metadata']['tier'])
                
                # Get subscription from Stripe
                stripe_subscription = stripe.Subscription.retrieve(session['subscription'])
                
                # Update user subscription
                subscription = await self.get_user_subscription(user_id)
                subscription.tier = tier
                subscription.status = "active"
                subscription.stripe_subscription_id = stripe_subscription.id
                subscription.stripe_customer_id = stripe_subscription.customer
                subscription.start_date = datetime.fromtimestamp(stripe_subscription.current_period_start)
                subscription.end_date = datetime.fromtimestamp(stripe_subscription.current_period_end)
                
                await self._save_subscription(subscription)
                
            elif event_type == 'invoice.payment_succeeded':
                # Handle successful payment
                invoice = data['object']
                stripe_subscription_id = invoice['subscription']
                
                # Find user by subscription ID
                user_id = await self._find_user_by_subscription_id(stripe_subscription_id)
                if user_id:
                    subscription = await self.get_user_subscription(user_id)
                    subscription.status = "active"
                    subscription.end_date = datetime.fromtimestamp(invoice['period_end'])
                    await self._save_subscription(subscription)
                    
            elif event_type == 'invoice.payment_failed':
                # Handle failed payment
                invoice = data['object']
                stripe_subscription_id = invoice['subscription']
                
                user_id = await self._find_user_by_subscription_id(stripe_subscription_id)
                if user_id:
                    subscription = await self.get_user_subscription(user_id)
                    subscription.status = "past_due"
                    await self._save_subscription(subscription)
                    
            elif event_type == 'customer.subscription.deleted':
                # Handle subscription cancellation
                stripe_subscription = data['object']
                user_id = await self._find_user_by_subscription_id(stripe_subscription.id)
                
                if user_id:
                    await self._downgrade_to_free(user_id)
                    
            return True
            
        except Exception as e:
            logger.error(f"Error handling Stripe webhook {event_type}: {e}")
            return False
    
    async def cancel_subscription(self, user_id: str) -> Dict[str, Any]:
        """Cancel user subscription"""
        try:
            subscription = await self.get_user_subscription(user_id)
            
            if subscription.stripe_subscription_id:
                # Cancel in Stripe
                stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    cancel_at_period_end=True
                )
                
                subscription.status = "cancelled"
                await self._save_subscription(subscription)
                
                return {
                    'success': True,
                    'message': 'Subscription will be cancelled at the end of the current billing period'
                }
            else:
                # Free tier - just downgrade
                await self._downgrade_to_free(user_id)
                return {
                    'success': True,
                    'message': 'Subscription cancelled'
                }
                
        except Exception as e:
            logger.error(f"Error cancelling subscription for user {user_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def start_trial(self, user_id: str, tier: SubscriptionTier, trial_days: int = 14) -> Dict[str, Any]:
        """Start a trial period for a user"""
        try:
            subscription = await self.get_user_subscription(user_id)
            
            # Check if user has already had a trial
            if subscription.trial_end_date:
                return {
                    'success': False,
                    'error': 'Trial already used'
                }
            
            # Set trial
            subscription.tier = tier
            subscription.status = "trial"
            subscription.trial_end_date = datetime.now() + timedelta(days=trial_days)
            
            await self._save_subscription(subscription)
            
            return {
                'success': True,
                'trial_end_date': subscription.trial_end_date.isoformat(),
                'days_remaining': trial_days
            }
            
        except Exception as e:
            logger.error(f"Error starting trial for user {user_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_subscription_analytics(self) -> Dict[str, Any]:
        """Get subscription analytics for admin dashboard"""
        try:
            analytics = {
                'total_users': 0,
                'active_subscriptions': 0,
                'revenue_monthly': 0,
                'revenue_yearly': 0,
                'tier_distribution': {},
                'churn_rate': 0,
                'trial_conversion_rate': 0
            }
            
            if not db:
                return analytics
            
            # Get all subscriptions
            subs_ref = db.collection('subscriptions')
            all_subs = subs_ref.get()
            
            analytics['total_users'] = len(all_subs)
            
            tier_counts = defaultdict(int)
            active_count = 0
            monthly_revenue = 0
            yearly_revenue = 0
            
            for sub_doc in all_subs:
                data = sub_doc.to_dict()
                tier = SubscriptionTier(data.get('tier', 'free'))
                status = data.get('status', 'active')
                
                tier_counts[tier.value] += 1
                
                if status == "active":
                    active_count += 1
                    plan = self.subscription_plans[tier]
                    monthly_revenue += plan.price_monthly
                    yearly_revenue += plan.price_yearly
            
            analytics['active_subscriptions'] = active_count
            analytics['revenue_monthly'] = monthly_revenue
            analytics['revenue_yearly'] = yearly_revenue
            analytics['tier_distribution'] = dict(tier_counts)
            
            return analytics
            
        except Exception as e:
            logger.error(f"Error getting subscription analytics: {e}")
            return {}
    
    async def _save_subscription(self, subscription: UserSubscription) -> None:
        """Save subscription to Firestore"""
        try:
            if not db:
                return
            
            sub_data = {
                'user_id': subscription.user_id,
                'tier': subscription.tier.value,
                'status': subscription.status,
                'start_date': subscription.start_date.isoformat(),
                'end_date': subscription.end_date.isoformat() if subscription.end_date else None,
                'stripe_subscription_id': subscription.stripe_subscription_id,
                'stripe_customer_id': subscription.stripe_customer_id,
                'usage_stats': subscription.usage_stats,
                'trial_end_date': subscription.trial_end_date.isoformat() if subscription.trial_end_date else None,
                'updated_at': datetime.now().isoformat()
            }
            
            db.collection('subscriptions').document(subscription.user_id).set(sub_data)
            
        except Exception as e:
            logger.error(f"Error saving subscription for user {subscription.user_id}: {e}")
    
    async def _downgrade_to_free(self, user_id: str) -> None:
        """Downgrade user to free tier"""
        try:
            subscription = await self.get_user_subscription(user_id)
            subscription.tier = SubscriptionTier.FREE
            subscription.status = "active"
            subscription.stripe_subscription_id = None
            subscription.end_date = None
            
            await self._save_subscription(subscription)
            
        except Exception as e:
            logger.error(f"Error downgrading user {user_id} to free: {e}")
    
    async def _find_user_by_subscription_id(self, stripe_subscription_id: str) -> Optional[str]:
        """Find user ID by Stripe subscription ID"""
        try:
            if not db:
                return None
            
            subs_ref = db.collection('subscriptions')
            query = subs_ref.where('stripe_subscription_id', '==', stripe_subscription_id)
            docs = query.get()
            
            if docs:
                return docs[0].to_dict().get('user_id')
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding user by subscription ID {stripe_subscription_id}: {e}")
            return None

# Singleton instance
subscription_manager = SubscriptionManager() 