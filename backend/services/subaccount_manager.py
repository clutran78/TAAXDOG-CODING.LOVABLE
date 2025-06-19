import os
import sys
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import uuid
from decimal import Decimal, ROUND_HALF_UP

# Add project paths for imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))
sys.path.insert(0, os.path.join(project_root, 'backend'))
sys.path.insert(0, os.path.join(project_root, 'database'))

try:
    from firebase_admin import firestore
    from google.cloud.firestore import FieldFilter
    from src.integrations.basiq_client import BasiqClient
    from database.models import db
    import firebase_admin
except ImportError as e:
    logging.warning(f"Import warning in subaccount_manager: {e}")

# Configure logging
logger = logging.getLogger(__name__)

class SubaccountManager:
    """
    Comprehensive subaccount management service for TAAXDOG's automated savings system.
    Handles subaccount lifecycle, transaction processing, balance synchronization,
    and integration with BASIQ API for real bank subaccounts where supported.
    """
    
    def __init__(self, app=None):
        """
        Initialize the subaccount manager.
        
        Args:
            app: Flask application instance (optional)
        """
        self.app = app
        self.basiq_client = None
        self.db = None
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """
        Initialize with Flask app configuration.
        
        Args:
            app: Flask application instance
        """
        self.app = app
        
        # Initialize BASIQ client
        try:
            self.basiq_client = BasiqClient(app)
        except Exception as e:
            logger.error(f"Failed to initialize BASIQ client: {e}")
            self.basiq_client = None
        
        # Initialize Firestore database
        try:
            if not firebase_admin._apps:
                # Firebase should already be initialized by the main app
                pass
            self.db = firestore.client()
        except Exception as e:
            logger.error(f"Failed to initialize Firestore: {e}")
            self.db = None
    
    # ==================== SUBACCOUNT CRUD OPERATIONS ====================
    
    def create_subaccount(self, goal_id: str, user_id: str, subaccount_data: Dict) -> Dict:
        """
        Create a new subaccount for a goal.
        
        Args:
            goal_id: Goal ID this subaccount belongs to
            user_id: User ID who owns the subaccount
            subaccount_data: Subaccount configuration data
            
        Returns:
            dict: Result with success status and subaccount data
        """
        try:
            # Generate unique subaccount ID
            subaccount_id = str(uuid.uuid4())
            
            # Validate required fields
            required_fields = ['name', 'sourceAccountId']
            for field in required_fields:
                if field not in subaccount_data:
                    return {
                        'success': False,
                        'error': f'Missing required field: {field}'
                    }
            
            # Check if goal already has a subaccount
            existing = self._get_subaccount_by_goal_id(goal_id)
            if existing:
                return {
                    'success': False,
                    'error': 'Goal already has a subaccount'
                }
            
            # Get bank information for the source account
            bank_info = self._get_bank_info_for_account(subaccount_data['sourceAccountId'], user_id)
            
            # Create subaccount document
            subaccount = {
                'id': subaccount_id,
                'goalId': goal_id,
                'userId': user_id,
                'name': subaccount_data['name'],
                'description': subaccount_data.get('description', ''),
                'currency': 'AUD',
                'balance': {
                    'current': 0.0,
                    'available': 0.0,
                    'pending': 0.0,
                    'lastUpdated': datetime.now().isoformat(),
                    'interestEarned': {
                        'daily': 0.0,
                        'monthly': 0.0,
                        'yearToDate': 0.0,
                        'totalLifetime': 0.0
                    }
                },
                'bankInfo': bank_info,
                'settings': {
                    'interestEnabled': subaccount_data.get('settings', {}).get('interestEnabled', False),
                    'interestRate': subaccount_data.get('settings', {}).get('interestRate', 0.0),
                    'interestCompoundingFrequency': 'monthly',
                    'notifications': {
                        'balanceUpdates': True,
                        'interestPayments': True,
                        'goalMilestones': True,
                        'lowBalanceThreshold': 50.0
                    },
                    'restrictions': {
                        'allowManualWithdrawals': True,
                        'minimumBalance': 0.0,
                        'withdrawalLimits': {}
                    }
                },
                'createdAt': datetime.now().isoformat(),
                'updatedAt': datetime.now().isoformat(),
                'createdBy': user_id,
                'status': 'active',
                'statusReason': None
            }
            
            # Attempt to create real bank subaccount if supported
            bank_subaccount_result = self._create_bank_subaccount(subaccount, subaccount_data['sourceAccountId'])
            if bank_subaccount_result['success']:
                subaccount['bankInfo'].update(bank_subaccount_result['bankInfo'])
            
            # Save to Firestore
            if self.db:
                self.db.collection('goal_subaccounts').document(subaccount_id).set(subaccount)
                
                # Update goal document to reference subaccount
                goal_ref = self.db.collection('goals').document(goal_id)
                goal_ref.update({
                    'subaccount': {
                        'isEnabled': True,
                        'subaccountId': subaccount_id,
                        'useSubaccountBalance': True
                    }
                })
            
            logger.info(f"✅ Created subaccount {subaccount_id} for goal {goal_id}")
            
            return {
                'success': True,
                'data': subaccount
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to create subaccount: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_subaccount(self, subaccount_id: str) -> Dict:
        """
        Get subaccount by ID.
        
        Args:
            subaccount_id: Subaccount ID
            
        Returns:
            dict: Subaccount data or error
        """
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not initialized'}
            
            doc = self.db.collection('goal_subaccounts').document(subaccount_id).get()
            
            if not doc.exists:
                return {
                    'success': False,
                    'error': 'Subaccount not found'
                }
            
            subaccount = doc.to_dict()
            
            # Sync balance if needed
            if self._should_sync_balance(subaccount):
                sync_result = self.sync_subaccount_balance(subaccount_id)
                if sync_result['success']:
                    subaccount = sync_result['data']
            
            return {
                'success': True,
                'data': subaccount
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get subaccount {subaccount_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_subaccount_by_goal_id(self, goal_id: str) -> Dict:
        """
        Get subaccount by goal ID.
        
        Args:
            goal_id: Goal ID
            
        Returns:
            dict: Subaccount data or error
        """
        try:
            subaccount = self._get_subaccount_by_goal_id(goal_id)
            
            if not subaccount:
                return {
                    'success': False,
                    'error': 'No subaccount found for this goal'
                }
            
            return {
                'success': True,
                'data': subaccount
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get subaccount for goal {goal_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_user_subaccounts(self, user_id: str) -> Dict:
        """
        Get all subaccounts for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            dict: List of subaccounts
        """
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not initialized'}
            
            subaccounts_ref = self.db.collection('goal_subaccounts')
            query = subaccounts_ref.where(filter=FieldFilter('userId', '==', user_id))
            docs = query.stream()
            
            subaccounts = []
            for doc in docs:
                subaccount = doc.to_dict()
                if subaccount.get('status') == 'active':
                    subaccounts.append(subaccount)
            
            return {
                'success': True,
                'data': subaccounts
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get subaccounts for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def update_subaccount(self, subaccount_id: str, updates: Dict) -> Dict:
        """
        Update subaccount settings.
        
        Args:
            subaccount_id: Subaccount ID
            updates: Fields to update
            
        Returns:
            dict: Updated subaccount data
        """
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not initialized'}
            
            # Get current subaccount
            current_result = self.get_subaccount(subaccount_id)
            if not current_result['success']:
                return current_result
            
            subaccount = current_result['data']
            
            # Merge updates (protect critical fields)
            protected_fields = ['id', 'goalId', 'userId', 'createdAt', 'createdBy']
            for field in protected_fields:
                if field in updates:
                    del updates[field]
            
            updates['updatedAt'] = datetime.now().isoformat()
            
            # Update document
            self.db.collection('goal_subaccounts').document(subaccount_id).update(updates)
            
            # Get updated document
            updated_result = self.get_subaccount(subaccount_id)
            
            logger.info(f"✅ Updated subaccount {subaccount_id}")
            
            return updated_result
            
        except Exception as e:
            logger.error(f"❌ Failed to update subaccount {subaccount_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def delete_subaccount(self, subaccount_id: str, reason: str = None) -> Dict:
        """
        Delete/close a subaccount.
        
        Args:
            subaccount_id: Subaccount ID
            reason: Reason for closure
            
        Returns:
            dict: Success status
        """
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not initialized'}
            
            # Get current subaccount
            current_result = self.get_subaccount(subaccount_id)
            if not current_result['success']:
                return current_result
            
            subaccount = current_result['data']
            
            # Check if there's a balance remaining
            if subaccount['balance']['current'] > 0:
                return {
                    'success': False,
                    'error': 'Cannot close subaccount with remaining balance. Please withdraw all funds first.'
                }
            
            # Close bank subaccount if it exists
            if not subaccount['bankInfo']['isVirtual']:
                self._close_bank_subaccount(subaccount)
            
            # Mark as closed instead of deleting
            updates = {
                'status': 'closed',
                'statusReason': reason or 'Deleted by user',
                'updatedAt': datetime.now().isoformat()
            }
            
            self.db.collection('goal_subaccounts').document(subaccount_id).update(updates)
            
            # Update goal to disable subaccount
            goal_ref = self.db.collection('goals').document(subaccount['goalId'])
            goal_ref.update({
                'subaccount': {
                    'isEnabled': False,
                    'subaccountId': None,
                    'useSubaccountBalance': False
                }
            })
            
            logger.info(f"✅ Closed subaccount {subaccount_id}")
            
            return {
                'success': True,
                'message': 'Subaccount closed successfully'
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to close subaccount {subaccount_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # ==================== TRANSACTION PROCESSING ====================
    
    def process_transfer(self, transfer_request: Dict) -> Dict:
        """
        Process a manual transfer (deposit/withdrawal).
        
        Args:
            transfer_request: Transfer details
            
        Returns:
            dict: Transaction result
        """
        try:
            subaccount_id = transfer_request['subaccountId']
            amount = Decimal(str(transfer_request['amount'])).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            transfer_type = transfer_request['type']  # 'deposit' or 'withdrawal'
            description = transfer_request.get('description', f'Manual {transfer_type}')
            
            # Get subaccount
            subaccount_result = self.get_subaccount(subaccount_id)
            if not subaccount_result['success']:
                return subaccount_result
            
            subaccount = subaccount_result['data']
            
            # Validate withdrawal
            if transfer_type == 'withdrawal':
                if float(amount) > subaccount['balance']['available']:
                    return {
                        'success': False,
                        'error': 'Insufficient funds available for withdrawal'
                    }
                
                # Check withdrawal restrictions
                restrictions = subaccount['settings']['restrictions']
                if not restrictions.get('allowManualWithdrawals', True):
                    return {
                        'success': False,
                        'error': 'Manual withdrawals are not allowed for this subaccount'
                    }
            
            # Create transaction record
            transaction_id = str(uuid.uuid4())
            transaction = {
                'id': transaction_id,
                'subaccountId': subaccount_id,
                'type': transfer_type,
                'amount': float(amount) if transfer_type == 'deposit' else -float(amount),
                'description': description,
                'timestamp': datetime.now().isoformat(),
                'source': 'manual',
                'metadata': {
                    'requestedBy': subaccount['userId'],
                    'originalAmount': float(amount)
                }
            }
            
            # Process the transfer
            new_balance = self._update_balance(subaccount, transaction)
            
            # Save transaction
            self._save_transaction(transaction)
            
            # Update subaccount balance
            balance_update = {
                'balance': new_balance,
                'updatedAt': datetime.now().isoformat()
            }
            
            self.db.collection('goal_subaccounts').document(subaccount_id).update(balance_update)
            
            logger.info(f"✅ Processed {transfer_type} of ${amount} for subaccount {subaccount_id}")
            
            return {
                'success': True,
                'data': transaction
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to process transfer: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_subaccount_transactions(self, subaccount_id: str, **options) -> Dict:
        """
        Get transaction history for a subaccount.
        
        Args:
            subaccount_id: Subaccount ID
            **options: Query options (page, limit, startDate, endDate, type)
            
        Returns:
            dict: Transaction list
        """
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not initialized'}
            
            # Build query
            transactions_ref = self.db.collection('goal_subaccounts').document(subaccount_id).collection('transactions')
            query = transactions_ref.order_by('timestamp', direction=firestore.Query.DESCENDING)
            
            # Apply filters
            if options.get('startDate'):
                query = query.where(filter=FieldFilter('timestamp', '>=', options['startDate']))
            if options.get('endDate'):
                query = query.where(filter=FieldFilter('timestamp', '<=', options['endDate']))
            if options.get('type'):
                query = query.where(filter=FieldFilter('type', '==', options['type']))
            
            # Apply pagination
            limit = min(options.get('limit', 20), 100)  # Max 100 transactions per request
            if options.get('page', 1) > 1:
                offset = (options['page'] - 1) * limit
                query = query.offset(offset)
            
            query = query.limit(limit)
            
            # Execute query
            docs = query.stream()
            transactions = [doc.to_dict() for doc in docs]
            
            return {
                'success': True,
                'data': transactions
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get transactions for subaccount {subaccount_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # ==================== BALANCE SYNCHRONIZATION ====================
    
    def sync_subaccount_balance(self, subaccount_id: str) -> Dict:
        """
        Sync subaccount balance with bank.
        
        Args:
            subaccount_id: Subaccount ID
            
        Returns:
            dict: Updated subaccount data
        """
        try:
            # Get current subaccount
            current_result = self.get_subaccount(subaccount_id)
            if not current_result['success']:
                return current_result
            
            subaccount = current_result['data']
            
            # Skip sync for virtual subaccounts or if bank not supported
            if subaccount['bankInfo']['isVirtual'] or subaccount['bankInfo']['syncStatus'] == 'not_supported':
                logger.debug(f"Skipping sync for virtual/unsupported subaccount {subaccount_id}")
                return current_result
            
            # Attempt bank sync
            sync_result = self._sync_with_bank(subaccount)
            
            if sync_result['success']:
                # Update balance and sync status
                updates = {
                    'balance': sync_result['balance'],
                    'bankInfo.syncStatus': 'synced',
                    'bankInfo.lastSyncDate': datetime.now().isoformat(),
                    'updatedAt': datetime.now().isoformat()
                }
                
                if 'syncError' in subaccount['bankInfo']:
                    updates['bankInfo.syncError'] = firestore.DELETE_FIELD
                
                self.db.collection('goal_subaccounts').document(subaccount_id).update(updates)
                
                # Get updated subaccount
                return self.get_subaccount(subaccount_id)
            else:
                # Update sync error status
                updates = {
                    'bankInfo.syncStatus': 'error',
                    'bankInfo.syncError': sync_result['error'],
                    'bankInfo.lastSyncDate': datetime.now().isoformat(),
                    'updatedAt': datetime.now().isoformat()
                }
                
                self.db.collection('goal_subaccounts').document(subaccount_id).update(updates)
                
                logger.warning(f"Bank sync failed for subaccount {subaccount_id}: {sync_result['error']}")
                return current_result  # Return current data even if sync failed
            
        except Exception as e:
            logger.error(f"❌ Failed to sync balance for subaccount {subaccount_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_subaccount_summary(self, subaccount_id: str) -> Dict:
        """
        Get subaccount summary for goal card display.
        
        Args:
            subaccount_id: Subaccount ID
            
        Returns:
            dict: Subaccount summary
        """
        try:
            # Get subaccount data
            subaccount_result = self.get_subaccount(subaccount_id)
            if not subaccount_result['success']:
                return subaccount_result
            
            subaccount = subaccount_result['data']
            
            # Get recent transactions (last 5)
            transactions_result = self.get_subaccount_transactions(subaccount_id, limit=5)
            recent_transactions = transactions_result.get('data', []) if transactions_result['success'] else []
            
            # Calculate interest earned this month
            month_start = datetime.now().replace(day=1).isoformat()
            interest_result = self.get_subaccount_transactions(
                subaccount_id, 
                startDate=month_start, 
                type='interest'
            )
            
            interest_this_month = 0.0
            if interest_result['success']:
                interest_this_month = sum(t['amount'] for t in interest_result['data'])
            
            # Calculate projected growth
            projections = self._calculate_growth_projections(subaccount)
            
            summary = {
                'subaccountId': subaccount_id,
                'currentBalance': subaccount['balance']['current'],
                'interestEarnedThisMonth': interest_this_month,
                'lastTransactionDate': recent_transactions[0]['timestamp'] if recent_transactions else None,
                'recentTransactions': recent_transactions,
                'projectedGrowth': {
                    'nextMonth': projections.get('monthly', {}).get('projectedAmount', 0.0),
                    'nextYear': projections.get('yearly', {}).get('projectedAmount', 0.0)
                }
            }
            
            return {
                'success': True,
                'data': summary
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get summary for subaccount {subaccount_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # ==================== ANALYTICS AND PROJECTIONS ====================
    
    def get_subaccount_analytics(self, subaccount_id: str, start_date: str, end_date: str) -> Dict:
        """
        Get analytics for a subaccount over a period.
        
        Args:
            subaccount_id: Subaccount ID
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            
        Returns:
            dict: Analytics data
        """
        try:
            # Get transactions for the period
            transactions_result = self.get_subaccount_transactions(
                subaccount_id,
                startDate=start_date,
                endDate=end_date,
                limit=1000  # High limit to get all transactions in period
            )
            
            if not transactions_result['success']:
                return transactions_result
            
            transactions = transactions_result['data']
            
            # Calculate analytics
            total_deposits = sum(t['amount'] for t in transactions if t['amount'] > 0 and t['type'] in ['deposit', 'transfer_in'])
            total_withdrawals = sum(abs(t['amount']) for t in transactions if t['amount'] < 0 and t['type'] in ['withdrawal', 'transfer_out'])
            interest_earned = sum(t['amount'] for t in transactions if t['type'] == 'interest')
            net_growth = total_deposits - total_withdrawals + interest_earned
            
            # Calculate average balance (simplified - using current balance as proxy)
            subaccount_result = self.get_subaccount(subaccount_id)
            average_balance = subaccount_result['data']['balance']['current'] if subaccount_result['success'] else 0.0
            
            analytics = {
                'subaccountId': subaccount_id,
                'period': {
                    'startDate': start_date,
                    'endDate': end_date
                },
                'totalDeposits': total_deposits,
                'totalWithdrawals': total_withdrawals,
                'interestEarned': interest_earned,
                'netGrowth': net_growth,
                'averageBalance': average_balance,
                'transactionCount': len(transactions),
                'growthProjections': []  # Will be populated by separate method
            }
            
            return {
                'success': True,
                'data': analytics
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get analytics for subaccount {subaccount_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def calculate_growth_projections(self, subaccount_id: str, scenarios: Dict = None) -> Dict:
        """
        Calculate growth projections for a subaccount.
        
        Args:
            subaccount_id: Subaccount ID
            scenarios: Custom scenarios for projection
            
        Returns:
            dict: Growth projections
        """
        try:
            # Get subaccount data
            subaccount_result = self.get_subaccount(subaccount_id)
            if not subaccount_result['success']:
                return subaccount_result
            
            subaccount = subaccount_result['data']
            projections = self._calculate_growth_projections(subaccount, scenarios)
            
            return {
                'success': True,
                'data': list(projections.values())
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to calculate projections for subaccount {subaccount_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # ==================== PRIVATE HELPER METHODS ====================
    
    def _get_subaccount_by_goal_id(self, goal_id: str) -> Optional[Dict]:
        """Get subaccount by goal ID."""
        if not self.db:
            return None
        
        try:
            subaccounts_ref = self.db.collection('goal_subaccounts')
            query = subaccounts_ref.where(filter=FieldFilter('goalId', '==', goal_id))
            docs = list(query.stream())
            
            if docs:
                subaccount = docs[0].to_dict()
                if subaccount.get('status') == 'active':
                    return subaccount
            
            return None
        except Exception as e:
            logger.error(f"Error getting subaccount by goal ID: {e}")
            return None
    
    def _get_bank_info_for_account(self, source_account_id: str, user_id: str) -> Dict:
        """Get bank information for a source account."""
        bank_info = {
            'bankSubaccountId': None,
            'institutionName': 'Unknown Bank',
            'accountNumber': None,
            'bsb': None,
            'isVirtual': True,  # Default to virtual until we can create real subaccount
            'syncStatus': 'not_supported',
            'lastSyncDate': None,
            'syncError': None
        }
        
        if self.basiq_client:
            try:
                # Get account details from BASIQ
                accounts_result = self.basiq_client.get_user_accounts(user_id)
                if accounts_result.get('success'):
                    accounts = accounts_result.get('accounts', {}).get('data', [])
                    for account in accounts:
                        if account['id'] == source_account_id:
                            bank_info.update({
                                'institutionName': account.get('institution', {}).get('name', 'Unknown Bank'),
                                'accountNumber': account.get('accountNo'),
                                'bsb': account.get('routingNo')
                            })
                            break
            except Exception as e:
                logger.warning(f"Failed to get bank info for account {source_account_id}: {e}")
        
        return bank_info
    
    def _create_bank_subaccount(self, subaccount: Dict, source_account_id: str) -> Dict:
        """Attempt to create a real bank subaccount."""
        # For now, all subaccounts are virtual
        # In the future, this will integrate with bank APIs that support subaccount creation
        return {
            'success': False,
            'reason': 'Bank subaccount creation not yet implemented',
            'bankInfo': {
                'isVirtual': True,
                'syncStatus': 'not_supported'
            }
        }
    
    def _close_bank_subaccount(self, subaccount: Dict) -> bool:
        """Close a real bank subaccount."""
        # Placeholder for future implementation
        return True
    
    def _should_sync_balance(self, subaccount: Dict) -> bool:
        """Check if balance should be synced with bank."""
        if subaccount['bankInfo']['isVirtual']:
            return False
        
        if subaccount['bankInfo']['syncStatus'] == 'not_supported':
            return False
        
        # Sync if last sync was more than 1 hour ago
        last_sync = subaccount['bankInfo'].get('lastSyncDate')
        if not last_sync:
            return True
        
        last_sync_dt = datetime.fromisoformat(last_sync.replace('Z', '+00:00'))
        return datetime.now() - last_sync_dt.replace(tzinfo=None) > timedelta(hours=1)
    
    def _sync_with_bank(self, subaccount: Dict) -> Dict:
        """Sync balance with bank API."""
        # Placeholder for real bank sync
        # For now, return current balance
        return {
            'success': True,
            'balance': subaccount['balance']
        }
    
    def _update_balance(self, subaccount: Dict, transaction: Dict) -> Dict:
        """Update subaccount balance based on transaction."""
        current_balance = subaccount['balance']
        
        new_current = current_balance['current'] + transaction['amount']
        new_available = current_balance['available'] + transaction['amount']
        
        # Ensure balance doesn't go negative
        if new_current < 0:
            new_current = 0
        if new_available < 0:
            new_available = 0
        
        return {
            'current': round(new_current, 2),
            'available': round(new_available, 2),
            'pending': current_balance['pending'],
            'lastUpdated': datetime.now().isoformat(),
            'interestEarned': current_balance.get('interestEarned', {
                'daily': 0.0,
                'monthly': 0.0,
                'yearToDate': 0.0,
                'totalLifetime': 0.0
            })
        }
    
    def _save_transaction(self, transaction: Dict):
        """Save transaction to database."""
        if self.db:
            self.db.collection('goal_subaccounts').document(transaction['subaccountId']).collection('transactions').document(transaction['id']).set(transaction)
    
    def _calculate_growth_projections(self, subaccount: Dict, scenarios: Dict = None) -> Dict:
        """Calculate growth projections for different timeframes."""
        current_balance = subaccount['balance']['current']
        interest_rate = subaccount['settings'].get('interestRate', 0.0) / 100  # Convert to decimal
        
        # Default assumptions (can be overridden by scenarios)
        monthly_transfer = scenarios.get('transferAmount', 100.0) if scenarios else 100.0
        
        projections = {}
        
        # Monthly projection
        monthly_interest = current_balance * (interest_rate / 12)
        monthly_projection = current_balance + monthly_transfer + monthly_interest
        
        projections['monthly'] = {
            'timeframe': 'month',
            'projectedAmount': round(monthly_projection, 2),
            'interestComponent': round(monthly_interest, 2),
            'transferComponent': monthly_transfer,
            'assumptions': {
                'currentTransferRate': monthly_transfer,
                'averageInterestRate': interest_rate * 100,
                'transferFrequency': 'monthly'
            }
        }
        
        # Yearly projection (compounded)
        yearly_balance = current_balance
        for month in range(12):
            monthly_interest = yearly_balance * (interest_rate / 12)
            yearly_balance += monthly_transfer + monthly_interest
        
        projections['yearly'] = {
            'timeframe': 'year',
            'projectedAmount': round(yearly_balance, 2),
            'interestComponent': round(yearly_balance - current_balance - (monthly_transfer * 12), 2),
            'transferComponent': monthly_transfer * 12,
            'assumptions': {
                'currentTransferRate': monthly_transfer,
                'averageInterestRate': interest_rate * 100,
                'transferFrequency': 'monthly'
            }
        }
        
        return projections


# Singleton instance
subaccount_manager = SubaccountManager()

def init_subaccount_manager(app):
    """Initialize subaccount manager with Flask app."""
    subaccount_manager.init_app(app)
    return subaccount_manager 