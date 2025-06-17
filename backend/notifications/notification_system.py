"""
TAAXDOG Notification System
Handles all user notifications including overspending alerts, goal progress, and financial updates.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import asyncio
import aiohttp
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import json
import redis

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NotificationType(Enum):
    OVERSPENDING = "overspending"
    GOAL_PROGRESS = "goal_progress" 
    INCOME_ALERT = "income_alert"
    SPENDING_ALERT = "spending_alert"
    SUBSCRIPTION_REMINDER = "subscription_reminder"
    PETROL_PRICE = "petrol_price"

class NotificationPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

@dataclass
class Notification:
    id: str
    user_id: str
    type: NotificationType
    priority: NotificationPriority
    title: str
    message: str
    data: Dict[str, Any]
    created_at: datetime
    sent_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    channels: List[str] = None  # email, push, sms

@dataclass
class SpendingAlert:
    category: str
    current_amount: float
    budget_amount: float
    percentage_over: float
    period: str  # weekly, monthly

@dataclass
class GoalProgress:
    goal_id: str
    goal_name: str
    current_amount: float
    target_amount: float
    progress_percentage: float
    time_remaining: int  # days

@dataclass
class PetrolPrice:
    station_name: str
    price: float
    location: str
    distance_km: float
    last_updated: datetime

class NotificationSystem:
    def __init__(self):
        self.redis_client = redis.Redis.from_url(
            os.getenv('REDIS_URL', 'redis://localhost:6379'),
            decode_responses=True
        )
        self.email_config = {
            'smtp_server': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
            'smtp_port': int(os.getenv('SMTP_PORT', '587')),
            'email': os.getenv('NOTIFICATION_EMAIL'),
            'password': os.getenv('NOTIFICATION_EMAIL_PASSWORD')
        }
        self.petrol_api_key = os.getenv('PETROL_API_KEY')
        
    async def check_overspending_alerts(self, user_id: str, transactions: List[Dict]) -> List[Notification]:
        """Check for overspending in categories and create alerts."""
        notifications = []
        
        try:
            # Get user's budget settings
            budget_key = f"budget:{user_id}"
            budget_data = self.redis_client.hgetall(budget_key)
            
            if not budget_data:
                return notifications
                
            # Calculate spending by category for current month
            current_month = datetime.now().strftime('%Y-%m')
            category_spending = {}
            
            for transaction in transactions:
                if transaction.get('date', '').startswith(current_month):
                    category = transaction.get('category', 'Other')
                    amount = abs(float(transaction.get('amount', 0)))
                    category_spending[category] = category_spending.get(category, 0) + amount
            
            # Check each category against budget
            for category, budget_str in budget_data.items():
                budget = float(budget_str)
                spent = category_spending.get(category, 0)
                
                if spent > budget:
                    percentage_over = ((spent - budget) / budget) * 100
                    
                    alert = SpendingAlert(
                        category=category,
                        current_amount=spent,
                        budget_amount=budget,
                        percentage_over=percentage_over,
                        period="monthly"
                    )
                    
                    priority = NotificationPriority.HIGH if percentage_over > 50 else NotificationPriority.MEDIUM
                    
                    notification = Notification(
                        id=f"overspend_{user_id}_{category}_{current_month}",
                        user_id=user_id,
                        type=NotificationType.OVERSPENDING,
                        priority=priority,
                        title=f"Overspending Alert: {category}",
                        message=f"You've spent ${spent:.2f} on {category} this month, which is {percentage_over:.1f}% over your ${budget:.2f} budget.",
                        data=alert.__dict__,
                        created_at=datetime.now(),
                        channels=['email', 'push']
                    )
                    notifications.append(notification)
                    
        except Exception as e:
            logger.error(f"Error checking overspending alerts for user {user_id}: {e}")
            
        return notifications
    
    async def check_goal_progress(self, user_id: str, goals: List[Dict]) -> List[Notification]:
        """Check goal progress and create update notifications."""
        notifications = []
        
        try:
            for goal in goals:
                goal_id = goal.get('id')
                goal_name = goal.get('name', 'Unnamed Goal')
                current_amount = float(goal.get('current_amount', 0))
                target_amount = float(goal.get('target_amount', 0))
                target_date = goal.get('target_date')
                
                if target_amount <= 0:
                    continue
                    
                progress_percentage = (current_amount / target_amount) * 100
                
                # Calculate days remaining
                days_remaining = 0
                if target_date:
                    target_dt = datetime.fromisoformat(target_date.replace('Z', '+00:00'))
                    days_remaining = (target_dt - datetime.now()).days
                
                goal_progress = GoalProgress(
                    goal_id=goal_id,
                    goal_name=goal_name,
                    current_amount=current_amount,
                    target_amount=target_amount,
                    progress_percentage=progress_percentage,
                    time_remaining=days_remaining
                )
                
                # Check for milestone notifications (25%, 50%, 75%, 90%)
                milestones = [25, 50, 75, 90]
                for milestone in milestones:
                    if progress_percentage >= milestone:
                        milestone_key = f"milestone:{user_id}:{goal_id}:{milestone}"
                        
                        # Check if this milestone notification was already sent
                        if not self.redis_client.exists(milestone_key):
                            notification = Notification(
                                id=f"goal_progress_{user_id}_{goal_id}_{milestone}",
                                user_id=user_id,
                                type=NotificationType.GOAL_PROGRESS,
                                priority=NotificationPriority.MEDIUM,
                                title=f"Goal Progress: {goal_name}",
                                message=f"Great progress! You've reached {milestone}% of your {goal_name} goal. ${current_amount:.2f} of ${target_amount:.2f}",
                                data=goal_progress.__dict__,
                                created_at=datetime.now(),
                                channels=['email', 'push']
                            )
                            notifications.append(notification)
                            
                            # Mark milestone as sent
                            self.redis_client.setex(milestone_key, 86400 * 30, "sent")  # 30 days
                            
        except Exception as e:
            logger.error(f"Error checking goal progress for user {user_id}: {e}")
            
        return notifications
    
    async def check_subscription_reminders(self, user_id: str, subscriptions: List[Dict]) -> List[Notification]:
        """Check for upcoming subscription charges and create reminders."""
        notifications = []
        
        try:
            today = datetime.now().date()
            
            for subscription in subscriptions:
                next_charge_date_str = subscription.get('next_charge_date')
                if not next_charge_date_str:
                    continue
                    
                next_charge_date = datetime.fromisoformat(next_charge_date_str).date()
                days_until_charge = (next_charge_date - today).days
                
                # Send reminders 3 days before charge
                if days_until_charge == 3:
                    notification = Notification(
                        id=f"subscription_{user_id}_{subscription.get('id')}_{next_charge_date}",
                        user_id=user_id,
                        type=NotificationType.SUBSCRIPTION_REMINDER,
                        priority=NotificationPriority.LOW,
                        title=f"Upcoming Subscription: {subscription.get('name')}",
                        message=f"Your {subscription.get('name')} subscription of ${subscription.get('amount'):.2f} will be charged in 3 days.",
                        data=subscription,
                        created_at=datetime.now(),
                        channels=['email', 'push']
                    )
                    notifications.append(notification)
                    
        except Exception as e:
            logger.error(f"Error checking subscription reminders for user {user_id}: {e}")
            
        return notifications
    
    async def check_petrol_prices(self, user_id: str, user_location: Dict[str, float]) -> List[Notification]:
        """Check petrol prices within 10km radius and send alerts for good deals."""
        notifications = []
        
        if not self.petrol_api_key or not user_location:
            return notifications
            
        try:
            # Get user's average petrol spending to determine alert threshold
            avg_price_key = f"petrol_avg:{user_id}"
            avg_price_str = self.redis_client.get(avg_price_key)
            avg_price = float(avg_price_str) if avg_price_str else 1.80  # Default AUD per litre
            
            # Fetch petrol prices from API (placeholder - replace with actual API)
            petrol_stations = await self._fetch_petrol_prices(user_location)
            
            for station in petrol_stations:
                # Alert if price is 10 cents or more below average
                if station.price <= (avg_price - 0.10):
                    notification = Notification(
                        id=f"petrol_{user_id}_{station.station_name}_{datetime.now().strftime('%Y%m%d')}",
                        user_id=user_id,
                        type=NotificationType.PETROL_PRICE,
                        priority=NotificationPriority.LOW,
                        title="Cheap Petrol Alert!",
                        message=f"Great deal at {station.station_name}: ${station.price:.2f}/L ({station.distance_km:.1f}km away)",
                        data=station.__dict__,
                        created_at=datetime.now(),
                        channels=['push']
                    )
                    notifications.append(notification)
                    
        except Exception as e:
            logger.error(f"Error checking petrol prices for user {user_id}: {e}")
            
        return notifications
    
    async def _fetch_petrol_prices(self, location: Dict[str, float]) -> List[PetrolPrice]:
        """Fetch petrol prices from external API (placeholder implementation)."""
        # This is a placeholder - integrate with actual petrol price API
        # For Australia, you could use:
        # - FuelCheck NSW API
        # - MyFuelWA API
        # - PetrolSpy API
        
        mock_stations = [
            PetrolPrice(
                station_name="BP Service Station",
                price=1.75,
                location="123 Main St",
                distance_km=2.3,
                last_updated=datetime.now()
            ),
            PetrolPrice(
                station_name="Shell Express",
                price=1.82,
                location="456 High St", 
                distance_km=4.7,
                last_updated=datetime.now()
            )
        ]
        
        return mock_stations
    
    async def send_notification(self, notification: Notification) -> bool:
        """Send notification through specified channels."""
        success = True
        
        try:
            if 'email' in notification.channels:
                await self._send_email(notification)
                
            if 'push' in notification.channels:
                await self._send_push_notification(notification)
                
            if 'sms' in notification.channels:
                await self._send_sms(notification)
                
            # Store notification in database
            await self._store_notification(notification)
            
            notification.sent_at = datetime.now()
            
        except Exception as e:
            logger.error(f"Error sending notification {notification.id}: {e}")
            success = False
            
        return success
    
    async def _send_email(self, notification: Notification) -> None:
        """Send email notification."""
        if not self.email_config['email']:
            return
            
        try:
            # Get user email from cache or database
            user_email_key = f"user_email:{notification.user_id}"
            user_email = self.redis_client.get(user_email_key)
            
            if not user_email:
                return
                
            msg = MIMEMultipart()
            msg['From'] = self.email_config['email']
            msg['To'] = user_email
            msg['Subject'] = f"TAAXDOG: {notification.title}"
            
            body = f"""
            {notification.title}
            
            {notification.message}
            
            ---
            TAAXDOG Financial Management
            Login to your dashboard for more details.
            """
            
            msg.attach(MIMEText(body, 'plain'))
            
            server = smtplib.SMTP(self.email_config['smtp_server'], self.email_config['smtp_port'])
            server.starttls()
            server.login(self.email_config['email'], self.email_config['password'])
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent for notification {notification.id}")
            
        except Exception as e:
            logger.error(f"Error sending email for notification {notification.id}: {e}")
    
    async def _send_push_notification(self, notification: Notification) -> None:
        """Send push notification (placeholder for Firebase Cloud Messaging)."""
        # Implement FCM push notifications here
        logger.info(f"Push notification would be sent for {notification.id}")
    
    async def _send_sms(self, notification: Notification) -> None:
        """Send SMS notification (placeholder for Twilio/AWS SNS).""" 
        # Implement SMS notifications here
        logger.info(f"SMS would be sent for {notification.id}")
    
    async def _store_notification(self, notification: Notification) -> None:
        """Store notification in Redis for history."""
        notification_key = f"notification:{notification.user_id}:{notification.id}"
        notification_data = {
            'id': notification.id,
            'type': notification.type.value,
            'priority': notification.priority.value,
            'title': notification.title,
            'message': notification.message,
            'data': json.dumps(notification.data),
            'created_at': notification.created_at.isoformat(),
            'sent_at': notification.sent_at.isoformat() if notification.sent_at else None
        }
        
        self.redis_client.hset(notification_key, mapping=notification_data)
        self.redis_client.expire(notification_key, 86400 * 30)  # 30 days retention
    
    async def get_user_notifications(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get user's notification history."""
        pattern = f"notification:{user_id}:*"
        keys = self.redis_client.keys(pattern)
        
        notifications = []
        for key in keys[:limit]:
            notification_data = self.redis_client.hgetall(key)
            if notification_data:
                notifications.append(notification_data)
                
        # Sort by created_at desc
        notifications.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return notifications
    
    async def mark_notification_read(self, user_id: str, notification_id: str) -> bool:
        """Mark a notification as read."""
        notification_key = f"notification:{user_id}:{notification_id}"
        return self.redis_client.hset(notification_key, 'read_at', datetime.now().isoformat())

# Singleton instance
notification_system = NotificationSystem()

async def run_notification_checks(user_id: str, user_data: Dict) -> None:
    """Run all notification checks for a user."""
    all_notifications = []
    
    # Check overspending alerts
    if user_data.get('transactions'):
        overspend_notifications = await notification_system.check_overspending_alerts(
            user_id, user_data['transactions']
        )
        all_notifications.extend(overspend_notifications)
    
    # Check goal progress
    if user_data.get('goals'):
        goal_notifications = await notification_system.check_goal_progress(
            user_id, user_data['goals']
        )
        all_notifications.extend(goal_notifications)
    
    # Check subscription reminders
    if user_data.get('subscriptions'):
        subscription_notifications = await notification_system.check_subscription_reminders(
            user_id, user_data['subscriptions']
        )
        all_notifications.extend(subscription_notifications)
    
    # Check petrol prices
    if user_data.get('location'):
        petrol_notifications = await notification_system.check_petrol_prices(
            user_id, user_data['location']
        )
        all_notifications.extend(petrol_notifications)
    
    # Send all notifications
    for notification in all_notifications:
        await notification_system.send_notification(notification)
    
    logger.info(f"Processed {len(all_notifications)} notifications for user {user_id}") 