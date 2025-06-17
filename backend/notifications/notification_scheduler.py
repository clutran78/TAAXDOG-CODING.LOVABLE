"""
TAAXDOG Notification Scheduler
Background service for running periodic notification checks.
"""

import asyncio
import logging
from datetime import datetime, timedelta
import schedule
import time
from typing import Dict, List
import firebase_admin
from firebase_admin import firestore
from .notification_system import run_notification_checks, notification_system

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NotificationScheduler:
    def __init__(self):
        self.db = firestore.client()
        self.is_running = False
        
    async def get_active_users(self) -> List[str]:
        """Get list of active users for notification processing."""
        try:
            # Get users who have been active in the last 7 days
            cutoff_date = datetime.now() - timedelta(days=7)
            
            users_ref = self.db.collection('users')
            query = users_ref.where('last_activity', '>=', cutoff_date)
            docs = query.stream()
            
            user_ids = []
            for doc in docs:
                user_ids.append(doc.id)
                
            return user_ids
            
        except Exception as e:
            logger.error(f"Error getting active users: {e}")
            return []
    
    async def get_user_data(self, user_id: str) -> Dict:
        """Get user data needed for notification checks."""
        try:
            user_data = {}
            
            # Get user document
            user_doc = self.db.collection('users').document(user_id).get()
            if user_doc.exists:
                user_data.update(user_doc.to_dict())
            
            # Get transactions (last 30 days)
            cutoff_date = datetime.now() - timedelta(days=30)
            transactions_ref = self.db.collection('transactions').where('user_id', '==', user_id)
            transactions_query = transactions_ref.where('date', '>=', cutoff_date)
            transactions = [doc.to_dict() for doc in transactions_query.stream()]
            user_data['transactions'] = transactions
            
            # Get goals
            goals_ref = self.db.collection('goals').where('user_id', '==', user_id)
            goals = [doc.to_dict() for doc in goals_ref.stream()]
            user_data['goals'] = goals
            
            # Get subscriptions
            subscriptions_ref = self.db.collection('subscriptions').where('user_id', '==', user_id)
            subscriptions = [doc.to_dict() for doc in subscriptions_ref.stream()]
            user_data['subscriptions'] = subscriptions
            
            return user_data
            
        except Exception as e:
            logger.error(f"Error getting user data for {user_id}: {e}")
            return {}
    
    async def process_user_notifications(self, user_id: str) -> None:
        """Process all notifications for a single user."""
        try:
            user_data = await self.get_user_data(user_id)
            if user_data:
                await run_notification_checks(user_id, user_data)
                
        except Exception as e:
            logger.error(f"Error processing notifications for user {user_id}: {e}")
    
    async def run_daily_checks(self) -> None:
        """Run daily notification checks for all active users."""
        logger.info("Starting daily notification checks...")
        
        try:
            user_ids = await self.get_active_users()
            logger.info(f"Processing notifications for {len(user_ids)} active users")
            
            # Process users in batches to avoid overwhelming the system
            batch_size = 10
            for i in range(0, len(user_ids), batch_size):
                batch = user_ids[i:i + batch_size]
                tasks = [self.process_user_notifications(user_id) for user_id in batch]
                await asyncio.gather(*tasks, return_exceptions=True)
                
                # Small delay between batches
                await asyncio.sleep(1)
                
            logger.info("Daily notification checks completed")
            
        except Exception as e:
            logger.error(f"Error in daily notification checks: {e}")
    
    async def run_hourly_checks(self) -> None:
        """Run hourly checks for urgent notifications."""
        logger.info("Starting hourly notification checks...")
        
        try:
            # Only check for urgent notifications (overspending, goal deadlines)
            user_ids = await self.get_active_users()
            
            for user_id in user_ids:
                user_data = await self.get_user_data(user_id)
                if user_data:
                    # Only check overspending (most time-sensitive)
                    if user_data.get('transactions'):
                        overspend_notifications = await notification_system.check_overspending_alerts(
                            user_id, user_data['transactions']
                        )
                        
                        # Only send high priority overspending alerts
                        urgent_notifications = [
                            n for n in overspend_notifications 
                            if n.priority.value in ['high', 'urgent']
                        ]
                        
                        for notification in urgent_notifications:
                            await notification_system.send_notification(notification)
                            
        except Exception as e:
            logger.error(f"Error in hourly notification checks: {e}")
    
    async def run_weekly_reports(self) -> None:
        """Send weekly financial summary reports."""
        logger.info("Starting weekly report generation...")
        
        try:
            user_ids = await self.get_active_users()
            
            for user_id in user_ids:
                user_data = await self.get_user_data(user_id)
                if user_data and user_data.get('preferences', {}).get('weekly_reports', True):
                    await self._generate_weekly_report(user_id, user_data)
                    
        except Exception as e:
            logger.error(f"Error generating weekly reports: {e}")
    
    async def _generate_weekly_report(self, user_id: str, user_data: Dict) -> None:
        """Generate and send weekly financial report."""
        try:
            # Calculate weekly statistics
            transactions = user_data.get('transactions', [])
            weekly_spending = sum(abs(float(t.get('amount', 0))) for t in transactions 
                                if t.get('amount', 0) < 0)  # Negative amounts are expenses
            weekly_income = sum(float(t.get('amount', 0)) for t in transactions 
                              if t.get('amount', 0) > 0)  # Positive amounts are income
            
            # Goal progress
            goals = user_data.get('goals', [])
            goals_on_track = sum(1 for g in goals if self._is_goal_on_track(g))
            
            report_message = f"""
            Your Weekly Financial Summary:
            
            💰 Income: ${weekly_income:.2f}
            💸 Spending: ${weekly_spending:.2f}
            📊 Net: ${weekly_income - weekly_spending:.2f}
            
            🎯 Goals on track: {goals_on_track}/{len(goals)}
            
            Have a great week ahead!
            """
            
            from .notification_system import Notification, NotificationType, NotificationPriority
            
            notification = Notification(
                id=f"weekly_report_{user_id}_{datetime.now().strftime('%Y%W')}",
                user_id=user_id,
                type=NotificationType.INCOME_ALERT,  # Reusing for reports
                priority=NotificationPriority.LOW,
                title="Your Weekly Financial Summary",
                message=report_message.strip(),
                data={'weekly_spending': weekly_spending, 'weekly_income': weekly_income},
                created_at=datetime.now(),
                channels=['email']
            )
            
            await notification_system.send_notification(notification)
            
        except Exception as e:
            logger.error(f"Error generating weekly report for user {user_id}: {e}")
    
    def _is_goal_on_track(self, goal: Dict) -> bool:
        """Check if a goal is on track to be completed on time."""
        try:
            current_amount = float(goal.get('current_amount', 0))
            target_amount = float(goal.get('target_amount', 0))
            target_date_str = goal.get('target_date')
            
            if not target_date_str or target_amount <= 0:
                return False
                
            target_date = datetime.fromisoformat(target_date_str.replace('Z', '+00:00'))
            days_remaining = (target_date - datetime.now()).days
            
            if days_remaining <= 0:
                return current_amount >= target_amount
                
            # Calculate required daily savings
            remaining_amount = target_amount - current_amount
            required_daily = remaining_amount / days_remaining
            
            # Get recent daily average (last 7 days)
            # This is a simplified calculation - in practice you'd look at actual saving rate
            return required_daily <= 50  # Assume $50/day is reasonable
            
        except Exception:
            return False
    
    def start_scheduler(self) -> None:
        """Start the notification scheduler."""
        if self.is_running:
            logger.warning("Scheduler is already running")
            return
            
        logger.info("Starting notification scheduler...")
        
        # Schedule daily checks at 9 AM
        schedule.every().day.at("09:00").do(
            lambda: asyncio.create_task(self.run_daily_checks())
        )
        
        # Schedule hourly checks for urgent notifications
        schedule.every().hour.do(
            lambda: asyncio.create_task(self.run_hourly_checks())
        )
        
        # Schedule weekly reports on Sundays at 6 PM
        schedule.every().sunday.at("18:00").do(
            lambda: asyncio.create_task(self.run_weekly_reports())
        )
        
        self.is_running = True
        
        # Run scheduler loop
        while self.is_running:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    
    def stop_scheduler(self) -> None:
        """Stop the notification scheduler."""
        logger.info("Stopping notification scheduler...")
        self.is_running = False
        schedule.clear()

# Global scheduler instance
scheduler = NotificationScheduler()

def start_notification_service():
    """Start the notification service in background."""
    try:
        scheduler.start_scheduler()
    except KeyboardInterrupt:
        scheduler.stop_scheduler()
    except Exception as e:
        logger.error(f"Error in notification service: {e}")
        scheduler.stop_scheduler()

if __name__ == "__main__":
    start_notification_service() 