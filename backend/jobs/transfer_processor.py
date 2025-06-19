"""
Transfer Processor Cron Job for TAAXDOG Automated Transfer Engine

This module implements the scheduled job processor that:
- Runs daily to process pending automated transfers
- Implements retry logic with exponential backoff for failed transfers
- Updates goal progress after successful transfers
- Sends notifications for transfer status updates
- Generates transfer reports and analytics
"""

import sys
import os
import logging
import time
import schedule
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from threading import Thread
import asyncio
import json

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
    from services.transfer_engine import get_transfer_engine
    from services.income_detector import get_income_detector
except ImportError:
    try:
        from backend.services.transfer_engine import get_transfer_engine
        from backend.services.income_detector import get_income_detector
    except ImportError:
        print("Warning: Transfer services not available")
        def get_transfer_engine():
            return None
        def get_income_detector():
            return None

try:
    from notifications.notification_system import get_notification_system
except ImportError:
    try:
        from backend.notifications.notification_system import get_notification_system
    except ImportError:
        print("Warning: Notification system not available")
        def get_notification_system():
            return None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/transfer_processor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class TransferProcessor:
    """
    Automated transfer processor that runs scheduled jobs for processing transfers.
    
    Manages the execution of automated transfers, retry logic, notifications,
    and reporting for the TAAXDOG savings system.
    """
    
    def __init__(self):
        """Initialize the transfer processor."""
        self.db = db
        self.transfer_engine = get_transfer_engine()
        self.income_detector = get_income_detector()
        self.notification_system = get_notification_system()
        
        # Configuration
        self.max_transfers_per_batch = 100
        self.max_retry_attempts = 3
        self.retry_delay_hours = [1, 4, 24]  # Progressive delay for retries
        self.notification_batch_size = 50
        
        # Statistics tracking
        self.daily_stats = {
            'transfers_processed': 0,
            'transfers_successful': 0,
            'transfers_failed': 0,
            'total_amount_transferred': 0.0,
            'start_time': None,
            'end_time': None
        }
        
        logger.info("✅ Transfer Processor initialized")
    
    # ==================== MAIN PROCESSING METHODS ====================
    
    def process_scheduled_transfers(self):
        """
        Main method to process all scheduled transfers.
        Called by the daily cron job.
        """
        try:
            logger.info("🚀 Starting scheduled transfer processing")
            
            self.daily_stats['start_time'] = datetime.now()
            self.daily_stats['transfers_processed'] = 0
            self.daily_stats['transfers_successful'] = 0
            self.daily_stats['transfers_failed'] = 0
            self.daily_stats['total_amount_transferred'] = 0.0
            
            if not self.transfer_engine:
                logger.error("❌ Transfer engine not available")
                return
            
            # Get and process pending transfers
            result = self.transfer_engine.execute_scheduled_transfers(
                limit=self.max_transfers_per_batch
            )
            
            if result['success']:
                transfer_data = result['data']
                self.daily_stats['transfers_processed'] = transfer_data['total_processed']
                self.daily_stats['transfers_successful'] = transfer_data['successful']
                self.daily_stats['transfers_failed'] = transfer_data['failed']
                
                # Calculate total amount transferred
                for transfer in transfer_data.get('transfers', []):
                    if transfer.get('success'):
                        self.daily_stats['total_amount_transferred'] += transfer.get('amount', 0.0)
                
                logger.info(f"✅ Processed {self.daily_stats['transfers_processed']} transfers")
                logger.info(f"   ✅ Successful: {self.daily_stats['transfers_successful']}")
                logger.info(f"   ❌ Failed: {self.daily_stats['transfers_failed']}")
                logger.info(f"   💰 Total transferred: ${self.daily_stats['total_amount_transferred']:.2f}")
                
                # Process retry logic for failed transfers
                self._process_failed_transfer_retries()
                
                # Send notifications
                self._send_transfer_notifications(transfer_data.get('transfers', []))
                
                # Update goal progress
                self._update_goal_progress(transfer_data.get('transfers', []))
                
                # Generate daily report
                self._generate_daily_report()
                
            else:
                logger.error(f"❌ Failed to process scheduled transfers: {result['error']}")
            
            self.daily_stats['end_time'] = datetime.now()
            
        except Exception as e:
            logger.error(f"❌ Error in scheduled transfer processing: {str(e)}")
            self._send_error_notification(str(e))
    
    def _process_failed_transfer_retries(self):
        """Process retry logic for previously failed transfers."""
        try:
            if not self.db:
                return
            
            # Get transfer rules that are marked for retry
            current_time = datetime.now()
            
            # Query for rules that have retry_after time passed
            retry_query = (self.db.collection('transfer_rules')
                          .where('is_active', '==', True)
                          .where('retry_after', '<=', current_time.isoformat())
                          .where('retry_count', '<', self.max_retry_attempts))
            
            retry_rules = []
            for doc in retry_query.stream():
                rule_data = doc.to_dict()
                retry_rules.append(rule_data)
            
            if not retry_rules:
                logger.info("ℹ️ No transfers pending retry")
                return
            
            logger.info(f"🔄 Processing {len(retry_rules)} retry transfers")
            
            for rule_data in retry_rules:
                try:
                    # Create a temporary transfer rule object for retry
                    rule = self.transfer_engine._dict_to_transfer_rule(rule_data)
                    
                    # Execute the transfer
                    retry_result = self.transfer_engine._execute_single_transfer(rule)
                    
                    if retry_result['success']:
                        logger.info(f"✅ Retry successful for rule {rule.id}")
                    else:
                        logger.warning(f"❌ Retry failed for rule {rule.id}: {retry_result.get('error')}")
                        
                except Exception as e:
                    logger.error(f"❌ Error processing retry for rule {rule_data.get('id')}: {str(e)}")
            
        except Exception as e:
            logger.error(f"❌ Error processing failed transfer retries: {str(e)}")
    
    def _send_transfer_notifications(self, transfers: List[Dict]):
        """Send notifications for transfer results."""
        try:
            if not self.notification_system:
                logger.info("ℹ️ Notification system not available, skipping notifications")
                return
            
            # Group transfers by user for batching
            user_transfers = {}
            for transfer in transfers:
                user_id = transfer.get('user_id')
                if user_id:
                    if user_id not in user_transfers:
                        user_transfers[user_id] = {'successful': [], 'failed': []}
                    
                    if transfer.get('success'):
                        user_transfers[user_id]['successful'].append(transfer)
                    else:
                        user_transfers[user_id]['failed'].append(transfer)
            
            # Send notifications to each user
            for user_id, user_transfer_data in user_transfers.items():
                try:
                    successful_count = len(user_transfer_data['successful'])
                    failed_count = len(user_transfer_data['failed'])
                    
                    if successful_count > 0:
                        total_amount = sum(t.get('amount', 0.0) for t in user_transfer_data['successful'])
                        
                        self.notification_system.send_notification(
                            user_id=user_id,
                            notification_type='transfer_success',
                            title='Automated Transfers Completed',
                            message=f'Successfully transferred ${total_amount:.2f} across {successful_count} goal(s)',
                            data={
                                'transfer_count': successful_count,
                                'total_amount': total_amount,
                                'transfers': user_transfer_data['successful']
                            }
                        )
                    
                    if failed_count > 0:
                        self.notification_system.send_notification(
                            user_id=user_id,
                            notification_type='transfer_failed',
                            title='Some Transfers Failed',
                            message=f'{failed_count} automated transfer(s) failed. Please check your account.',
                            data={
                                'failed_count': failed_count,
                                'transfers': user_transfer_data['failed']
                            }
                        )
                
                except Exception as e:
                    logger.error(f"❌ Error sending notifications to user {user_id}: {str(e)}")
            
            logger.info(f"📧 Sent notifications to {len(user_transfers)} users")
            
        except Exception as e:
            logger.error(f"❌ Error sending transfer notifications: {str(e)}")
    
    def _update_goal_progress(self, transfers: List[Dict]):
        """Update goal progress after successful transfers."""
        try:
            if not self.db:
                return
            
            # Group successful transfers by goal
            goal_updates = {}
            for transfer in transfers:
                if not transfer.get('success'):
                    continue
                
                goal_id = transfer.get('goal_id')
                amount = transfer.get('amount', 0.0)
                
                if goal_id and amount > 0:
                    if goal_id not in goal_updates:
                        goal_updates[goal_id] = 0.0
                    goal_updates[goal_id] += amount
            
            # Update each goal's progress
            for goal_id, transfer_amount in goal_updates.items():
                try:
                    goal_ref = self.db.collection('goals').document(goal_id)
                    goal_doc = goal_ref.get()
                    
                    if goal_doc.exists:
                        goal_data = goal_doc.to_dict()
                        current_amount = goal_data.get('currentAmount', 0.0)
                        new_amount = current_amount + transfer_amount
                        
                        # Update goal
                        goal_ref.update({
                            'currentAmount': new_amount,
                            'updatedAt': datetime.now().isoformat()
                        })
                        
                        # Check if goal is completed
                        target_amount = goal_data.get('targetAmount', 0.0)
                        if new_amount >= target_amount and current_amount < target_amount:
                            # Goal just completed!
                            self._handle_goal_completion(goal_id, goal_data)
                        
                        logger.info(f"✅ Updated goal {goal_id} progress: ${current_amount:.2f} → ${new_amount:.2f}")
                
                except Exception as e:
                    logger.error(f"❌ Error updating goal {goal_id} progress: {str(e)}")
            
        except Exception as e:
            logger.error(f"❌ Error updating goal progress: {str(e)}")
    
    def _handle_goal_completion(self, goal_id: str, goal_data: Dict):
        """Handle goal completion notifications and actions."""
        try:
            user_id = goal_data.get('userId')
            goal_name = goal_data.get('name', 'Your Goal')
            target_amount = goal_data.get('targetAmount', 0.0)
            
            if user_id and self.notification_system:
                self.notification_system.send_notification(
                    user_id=user_id,
                    notification_type='goal_completed',
                    title='🎉 Goal Completed!',
                    message=f'Congratulations! You\'ve reached your goal "{goal_name}" of ${target_amount:.2f}',
                    data={
                        'goal_id': goal_id,
                        'goal_name': goal_name,
                        'target_amount': target_amount,
                        'completion_date': datetime.now().isoformat()
                    }
                )
            
            logger.info(f"🎉 Goal {goal_id} completed: {goal_name}")
            
        except Exception as e:
            logger.error(f"❌ Error handling goal completion: {str(e)}")
    
    def _generate_daily_report(self):
        """Generate daily transfer processing report."""
        try:
            if not self.db:
                return
            
            report_data = {
                'date': datetime.now().strftime('%Y-%m-%d'),
                'processing_time': self.daily_stats['start_time'].isoformat() if self.daily_stats['start_time'] else None,
                'completion_time': self.daily_stats['end_time'].isoformat() if self.daily_stats['end_time'] else None,
                'transfers_processed': self.daily_stats['transfers_processed'],
                'transfers_successful': self.daily_stats['transfers_successful'],
                'transfers_failed': self.daily_stats['transfers_failed'],
                'total_amount_transferred': self.daily_stats['total_amount_transferred'],
                'success_rate': (self.daily_stats['transfers_successful'] / max(self.daily_stats['transfers_processed'], 1)) * 100,
                'created_at': datetime.now().isoformat()
            }
            
            # Save report to database
            report_id = f"daily_report_{datetime.now().strftime('%Y%m%d')}"
            self.db.collection('transfer_reports').document(report_id).set(report_data)
            
            logger.info(f"📊 Generated daily transfer report")
            logger.info(f"   Success rate: {report_data['success_rate']:.1f}%")
            
        except Exception as e:
            logger.error(f"❌ Error generating daily report: {str(e)}")
    
    def _send_error_notification(self, error_message: str):
        """Send error notification to system administrators."""
        try:
            if not self.notification_system:
                return
            
            # For now, just log the error. In production, this would send to admin users
            logger.error(f"🚨 System error notification: {error_message}")
            
            # Could implement admin notification here
            # self.notification_system.send_admin_notification(...)
            
        except Exception as e:
            logger.error(f"❌ Error sending error notification: {str(e)}")
    
    # ==================== MONITORING AND ANALYTICS ====================
    
    def process_transfer_analytics(self):
        """
        Process transfer analytics and generate insights.
        Runs weekly to analyze transfer patterns and performance.
        """
        try:
            logger.info("📊 Starting transfer analytics processing")
            
            if not self.db:
                logger.warning("Database not available for analytics")
                return
            
            # Get transfer data from the last week
            start_date = datetime.now() - timedelta(days=7)
            
            query = (self.db.collection('transfer_records')
                    .where('created_at', '>=', start_date.isoformat()))
            
            transfers = []
            for doc in query.stream():
                transfer_data = doc.to_dict()
                transfers.append(transfer_data)
            
            if not transfers:
                logger.info("No transfers found for analytics processing")
                return
            
            # Calculate analytics
            analytics = self._calculate_transfer_analytics(transfers)
            
            # Save analytics report
            analytics_id = f"weekly_analytics_{datetime.now().strftime('%Y%m%d')}"
            self.db.collection('transfer_analytics').document(analytics_id).set(analytics)
            
            logger.info(f"📊 Generated weekly analytics report: {len(transfers)} transfers analyzed")
            
        except Exception as e:
            logger.error(f"❌ Error processing transfer analytics: {str(e)}")
    
    def _calculate_transfer_analytics(self, transfers: List[Dict]) -> Dict:
        """Calculate analytics from transfer data."""
        try:
            total_transfers = len(transfers)
            successful_transfers = [t for t in transfers if t.get('status') == 'completed']
            failed_transfers = [t for t in transfers if t.get('status') == 'failed']
            
            total_amount = sum(t.get('amount', 0.0) for t in successful_transfers)
            avg_amount = total_amount / len(successful_transfers) if successful_transfers else 0.0
            
            # Group by transfer type
            type_breakdown = {}
            for transfer in transfers:
                rule_id = transfer.get('rule_id')
                if rule_id:
                    # In a real implementation, we'd fetch the rule to get the type
                    # For now, use a placeholder
                    transfer_type = 'automated'
                    if transfer_type not in type_breakdown:
                        type_breakdown[transfer_type] = {
                            'count': 0,
                            'amount': 0.0,
                            'success_rate': 0.0
                        }
                    
                    type_breakdown[transfer_type]['count'] += 1
                    if transfer.get('status') == 'completed':
                        type_breakdown[transfer_type]['amount'] += transfer.get('amount', 0.0)
            
            # Calculate success rates
            for transfer_type, data in type_breakdown.items():
                successful_count = len([t for t in transfers if t.get('status') == 'completed'])
                data['success_rate'] = (successful_count / data['count']) * 100 if data['count'] > 0 else 0
            
            return {
                'period_start': (datetime.now() - timedelta(days=7)).isoformat(),
                'period_end': datetime.now().isoformat(),
                'total_transfers': total_transfers,
                'successful_transfers': len(successful_transfers),
                'failed_transfers': len(failed_transfers),
                'success_rate': (len(successful_transfers) / total_transfers) * 100 if total_transfers > 0 else 0,
                'total_amount_transferred': total_amount,
                'average_transfer_amount': avg_amount,
                'transfer_type_breakdown': type_breakdown,
                'created_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error calculating transfer analytics: {str(e)}")
            return {}
    
    # ==================== MAINTENANCE TASKS ====================
    
    def cleanup_old_records(self):
        """
        Clean up old transfer records and logs.
        Runs monthly to maintain database performance.
        """
        try:
            logger.info("🧹 Starting cleanup of old records")
            
            if not self.db:
                logger.warning("Database not available for cleanup")
                return
            
            # Delete transfer records older than 2 years
            cutoff_date = datetime.now() - timedelta(days=730)
            
            old_transfers_query = (self.db.collection('transfer_records')
                                 .where('created_at', '<', cutoff_date.isoformat())
                                 .limit(100))  # Process in batches
            
            deleted_count = 0
            for doc in old_transfers_query.stream():
                doc.reference.delete()
                deleted_count += 1
            
            logger.info(f"🧹 Cleaned up {deleted_count} old transfer records")
            
            # Archive old reports (older than 1 year)
            report_cutoff = datetime.now() - timedelta(days=365)
            
            old_reports_query = (self.db.collection('transfer_reports')
                               .where('created_at', '<', report_cutoff.isoformat())
                               .limit(50))
            
            archived_count = 0
            for doc in old_reports_query.stream():
                # Move to archived collection
                report_data = doc.to_dict()
                self.db.collection('archived_transfer_reports').document(doc.id).set(report_data)
                doc.reference.delete()
                archived_count += 1
            
            logger.info(f"📦 Archived {archived_count} old reports")
            
        except Exception as e:
            logger.error(f"❌ Error during cleanup: {str(e)}")


# ==================== SCHEDULER SETUP ====================

def setup_transfer_scheduler():
    """Set up the scheduled jobs for transfer processing."""
    processor = TransferProcessor()
    
    # Daily transfer processing at 2 AM
    schedule.every().day.at("02:00").do(processor.process_scheduled_transfers)
    
    # Weekly analytics processing on Sundays at 3 AM
    schedule.every().sunday.at("03:00").do(processor.process_transfer_analytics)
    
    # Monthly cleanup on the 1st at 4 AM
    schedule.every().month.do(processor.cleanup_old_records)
    
    logger.info("⏰ Transfer processor scheduler configured")
    
    return processor

def run_scheduler():
    """Run the scheduler in a continuous loop."""
    setup_transfer_scheduler()
    
    logger.info("🚀 Starting transfer processor scheduler")
    
    while True:
        try:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
        except KeyboardInterrupt:
            logger.info("⏹️ Transfer processor scheduler stopped")
            break
        except Exception as e:
            logger.error(f"❌ Error in scheduler loop: {str(e)}")
            time.sleep(300)  # Wait 5 minutes before retrying

def run_scheduler_daemon():
    """Run the scheduler as a daemon thread."""
    scheduler_thread = Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    logger.info("🔧 Transfer processor scheduler started as daemon")
    return scheduler_thread

# ==================== MANUAL EXECUTION ====================

def run_manual_processing():
    """Manually run transfer processing for testing/debugging."""
    processor = TransferProcessor()
    
    logger.info("🔧 Running manual transfer processing")
    processor.process_scheduled_transfers()
    
    logger.info("🔧 Running manual analytics processing")
    processor.process_transfer_analytics()
    
    logger.info("✅ Manual processing completed")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "manual":
        run_manual_processing()
    else:
        run_scheduler() 