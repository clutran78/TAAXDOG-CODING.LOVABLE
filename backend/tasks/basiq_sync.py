"""
BASIQ Sync Task Manager

This module handles automated synchronization of BASIQ data including:
- User accounts synchronization
- Transaction import scheduling
- Background sync operations
- Connection health monitoring
"""

import logging
import time
import sys
import os
from datetime import datetime, timedelta
from threading import Thread, Event
from typing import Dict, List, Any, Optional

# Add parent directory to path for cross-module imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))

from integrations.basiq_client import basiq_client
from config.basiq_config import get_basiq_config

logger = logging.getLogger(__name__)

class BasiqSyncScheduler:
    """
    Background scheduler for BASIQ transaction synchronization.
    Handles periodic sync tasks, error recovery, and user management.
    """
    
    def __init__(self):
        """Initialize the sync scheduler."""
        self.is_running = False
        self.stop_event = Event()
        self.sync_thread = None
        self.config = get_basiq_config()
        self.db = None
        self.stats = {
            'last_sync': None,
            'successful_syncs': 0,
            'failed_syncs': 0,
            'users_synced': 0,
            'transactions_imported': 0,
            'errors': []
        }
        
        # Initialize Firestore if available
        try:
            self.db = firestore.client()
        except Exception as e:
            logger.warning(f"⚠️ Firestore not available for sync scheduler: {str(e)}")
    
    def start(self):
        """Start the background sync scheduler."""
        if self.is_running:
            logger.warning("⚠️ BASIQ sync scheduler is already running")
            return
        
        self.is_running = True
        self.stop_event.clear()
        
        # Start the sync thread
        self.sync_thread = Thread(target=self._sync_loop, daemon=True)
        self.sync_thread.start()
        
        logger.info("✅ BASIQ sync scheduler started")
    
    def stop(self):
        """Stop the background sync scheduler."""
        if not self.is_running:
            return
        
        self.is_running = False
        self.stop_event.set()
        
        if self.sync_thread and self.sync_thread.is_alive():
            self.sync_thread.join(timeout=30)
        
        logger.info("🛑 BASIQ sync scheduler stopped")
    
    def _sync_loop(self):
        """Main sync loop that runs in the background."""
        logger.info("🔄 BASIQ sync loop started")
        
        while not self.stop_event.is_set():
            try:
                # Get sync interval from configuration
                config = self.config.get_config()
                sync_interval_hours = config.get('sync_interval_hours', 6)
                sync_interval_seconds = sync_interval_hours * 3600
                
                # Check if it's time to sync
                if self._should_sync():
                    logger.info("🔄 Starting scheduled BASIQ sync")
                    self._perform_sync()
                
                # Wait for next sync or stop event
                self.stop_event.wait(timeout=min(sync_interval_seconds, 300))  # Check every 5 minutes max
                
            except Exception as e:
                logger.error(f"❌ Error in BASIQ sync loop: {str(e)}")
                self.stats['errors'].append({
                    'timestamp': datetime.now().isoformat(),
                    'error': str(e),
                    'type': 'sync_loop_error'
                })
                
                # Keep only last 10 errors
                self.stats['errors'] = self.stats['errors'][-10:]
                
                # Wait before retrying
                self.stop_event.wait(timeout=60)
        
        logger.info("🏁 BASIQ sync loop ended")
    
    def _should_sync(self) -> bool:
        """
        Determine if a sync should be performed now.
        
        Returns:
            bool: True if sync should be performed
        """
        if not self.stats['last_sync']:
            return True
        
        config = self.config.get_config()
        sync_interval_hours = config.get('sync_interval_hours', 6)
        
        last_sync = datetime.fromisoformat(self.stats['last_sync'])
        next_sync = last_sync + timedelta(hours=sync_interval_hours)
        
        return datetime.now() >= next_sync
    
    def _perform_sync(self):
        """Perform the actual synchronization process."""
        sync_start = datetime.now()
        
        try:
            # Update last sync time
            self.stats['last_sync'] = sync_start.isoformat()
            
            # Get list of users who have BASIQ connections
            users_to_sync = self._get_users_with_basiq_connections()
            
            if not users_to_sync:
                logger.info("ℹ️ No users with BASIQ connections found")
                return
            
            logger.info(f"🔄 Syncing {len(users_to_sync)} users with BASIQ connections")
            
            sync_results = {
                'users_processed': 0,
                'users_successful': 0,
                'users_failed': 0,
                'total_transactions': 0,
                'total_accounts': 0,
                'errors': []
            }
            
            # Sync each user
            for user_id, basiq_user_id in users_to_sync:
                try:
                    user_result = self._sync_user(user_id, basiq_user_id)
                    sync_results['users_processed'] += 1
                    
                    if user_result['success']:
                        sync_results['users_successful'] += 1
                        sync_results['total_transactions'] += user_result.get('transactions_count', 0)
                        sync_results['total_accounts'] += user_result.get('accounts_count', 0)
                    else:
                        sync_results['users_failed'] += 1
                        sync_results['errors'].append({
                            'user_id': user_id,
                            'error': user_result.get('error', 'Unknown error')
                        })
                
                except Exception as e:
                    logger.error(f"❌ Failed to sync user {user_id}: {str(e)}")
                    sync_results['users_failed'] += 1
                    sync_results['errors'].append({
                        'user_id': user_id,
                        'error': str(e)
                    })
                
                # Small delay between users to avoid rate limiting
                if not self.stop_event.is_set():
                    time.sleep(1)
            
            # Update statistics
            if sync_results['users_failed'] == 0:
                self.stats['successful_syncs'] += 1
            else:
                self.stats['failed_syncs'] += 1
            
            self.stats['users_synced'] += sync_results['users_successful']
            self.stats['transactions_imported'] += sync_results['total_transactions']
            
            sync_duration = (datetime.now() - sync_start).total_seconds()
            
            logger.info(
                f"✅ BASIQ sync completed in {sync_duration:.1f}s: "
                f"{sync_results['users_successful']}/{sync_results['users_processed']} users, "
                f"{sync_results['total_transactions']} transactions, "
                f"{sync_results['total_accounts']} accounts"
            )
            
            # Store sync results if database is available
            if self.db:
                self._store_sync_results(sync_start, sync_results)
        
        except Exception as e:
            logger.error(f"❌ BASIQ sync failed: {str(e)}")
            self.stats['failed_syncs'] += 1
            self.stats['errors'].append({
                'timestamp': datetime.now().isoformat(),
                'error': str(e),
                'type': 'sync_error'
            })
    
    def _get_users_with_basiq_connections(self) -> List[tuple]:
        """
        Get list of users who have BASIQ connections.
        
        Returns:
            list: List of (user_id, basiq_user_id) tuples
        """
        users = []
        
        if not self.db:
            logger.warning("⚠️ Database not available, cannot get users for sync")
            return users
        
        try:
            # Query users collection for those with basiq_user_id
            users_ref = self.db.collection('users')
            query = users_ref.where('basiq_user_id', '>', '')
            
            for doc in query.stream():
                user_data = doc.to_dict()
                basiq_user_id = user_data.get('basiq_user_id')
                if basiq_user_id:
                    users.append((doc.id, basiq_user_id))
            
            logger.info(f"📋 Found {len(users)} users with BASIQ connections")
        
        except Exception as e:
            logger.error(f"❌ Failed to get users with BASIQ connections: {str(e)}")
        
        return users
    
    def _sync_user(self, user_id: str, basiq_user_id: str) -> Dict:
        """
        Synchronize a single user's BASIQ data.
        
        Args:
            user_id: Firebase user ID
            basiq_user_id: BASIQ user ID
            
        Returns:
            dict: Sync result
        """
        try:
            # Get configuration
            config = self.config.get_config()
            days_back = config.get('transaction_days_back', 30)
            
            # Import transactions
            transactions = basiq_client.import_transactions(basiq_user_id, days_back=days_back)
            
            # Sync accounts
            accounts = basiq_client.sync_user_accounts(basiq_user_id)
            
            logger.info(f"✅ Synced user {user_id}: {len(transactions)} transactions, {len(accounts)} accounts")
            
            return {
                'success': True,
                'transactions_count': len(transactions),
                'accounts_count': len(accounts)
            }
        
        except Exception as e:
            logger.error(f"❌ Failed to sync user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _store_sync_results(self, sync_start: datetime, results: Dict):
        """
        Store sync results in the database.
        
        Args:
            sync_start: Sync start timestamp
            results: Sync results dictionary
        """
        try:
            sync_record = {
                'timestamp': sync_start.isoformat(),
                'duration_seconds': (datetime.now() - sync_start).total_seconds(),
                'environment': self.config.environment,
                'results': results,
                'created_at': datetime.now().isoformat()
            }
            
            # Store in sync_logs collection
            self.db.collection('basiq_sync_logs').add(sync_record)
            
            # Clean up old logs (keep last 100)
            logs_ref = self.db.collection('basiq_sync_logs')
            old_logs = logs_ref.order_by('timestamp').limit_to_last(100).stream()
            
            # Delete older logs
            batch = self.db.batch()
            count = 0
            for doc in old_logs:
                if count > 100:
                    batch.delete(doc.reference)
                count += 1
            
            if count > 100:
                batch.commit()
        
        except Exception as e:
            logger.error(f"❌ Failed to store sync results: {str(e)}")
    
    def manual_sync(self, user_id: Optional[str] = None) -> Dict:
        """
        Trigger a manual sync for all users or a specific user.
        
        Args:
            user_id: Optional specific user ID to sync
            
        Returns:
            dict: Sync operation result
        """
        try:
            logger.info(f"🔄 Manual BASIQ sync triggered" + (f" for user {user_id}" if user_id else ""))
            
            if user_id:
                # Sync specific user
                if not self.db:
                    return {'success': False, 'error': 'Database not available'}
                
                # Get user's BASIQ ID
                user_doc = self.db.collection('users').document(user_id).get()
                if not user_doc.exists:
                    return {'success': False, 'error': 'User not found'}
                
                user_data = user_doc.to_dict()
                basiq_user_id = user_data.get('basiq_user_id')
                if not basiq_user_id:
                    return {'success': False, 'error': 'User has no BASIQ connection'}
                
                result = self._sync_user(user_id, basiq_user_id)
                return result
            
            else:
                # Sync all users
                self._perform_sync()
                return {'success': True, 'message': 'Manual sync completed'}
        
        except Exception as e:
            logger.error(f"❌ Manual sync failed: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_status(self) -> Dict:
        """
        Get current scheduler status and statistics.
        
        Returns:
            dict: Status information
        """
        return {
            'running': self.is_running,
            'environment': self.config.environment,
            'config': {
                'sync_interval_hours': self.config.get_config().get('sync_interval_hours', 6),
                'transaction_days_back': self.config.get_config().get('transaction_days_back', 30)
            },
            'statistics': self.stats.copy(),
            'next_sync': self._get_next_sync_time(),
            'basiq_client_status': {
                'token_cached': bool(basiq_client.access_token),
                'environment': basiq_client.environment
            }
        }
    
    def _get_next_sync_time(self) -> Optional[str]:
        """Get the next scheduled sync time."""
        if not self.stats['last_sync']:
            return None
        
        try:
            config = self.config.get_config()
            sync_interval_hours = config.get('sync_interval_hours', 6)
            
            last_sync = datetime.fromisoformat(self.stats['last_sync'])
            next_sync = last_sync + timedelta(hours=sync_interval_hours)
            
            return next_sync.isoformat()
        except:
            return None


# Global scheduler instance
basiq_scheduler = BasiqSyncScheduler()

def init_basiq_scheduler():
    """Initialize and start the BASIQ sync scheduler."""
    basiq_scheduler.start()
    return basiq_scheduler

def get_basiq_scheduler():
    """Get the global BASIQ scheduler instance."""
    return basiq_scheduler

def stop_basiq_scheduler():
    """Stop the BASIQ sync scheduler."""
    basiq_scheduler.stop() 