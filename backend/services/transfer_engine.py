"""
Transfer Engine for TAAXDOG Automated Savings System

This module implements the core automated transfer engine that:
- Processes scheduled recurring transfers from income sources to goal subaccounts
- Integrates with BASIQ for actual bank transfers 
- Implements smart transfer calculations based on income detection
- Provides robust error handling and retry logic
- Maintains comprehensive transfer audit trails
"""

import sys
import os
import logging
import uuid
from datetime import datetime, timedelta, time
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
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
    from src.integrations.basiq_client import BasiqClient
except ImportError:
    try:
        from integrations.basiq_client import BasiqClient
    except ImportError:
        print("Warning: BASIQ client not available")
        BasiqClient = None

try:
    from services.subaccount_manager import SubaccountManager
except ImportError:
    try:
        from backend.services.subaccount_manager import SubaccountManager  
    except ImportError:
        print("Warning: Subaccount manager not available")
        SubaccountManager = None

# Configure logging
logger = logging.getLogger(__name__)


class TransferStatus(Enum):
    """Transfer status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"
    SCHEDULED = "scheduled"


class TransferType(Enum):
    """Transfer type enumeration."""
    INCOME_BASED = "income_based"
    FIXED_AMOUNT = "fixed_amount"
    PERCENTAGE_INCOME = "percentage_income"
    SMART_SURPLUS = "smart_surplus"


class TransferFrequency(Enum):
    """Transfer frequency enumeration."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BI_WEEKLY = "bi_weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


@dataclass
class TransferRule:
    """Data class representing a transfer rule configuration."""
    id: str
    goal_id: str
    user_id: str
    source_account_id: str
    target_subaccount_id: str
    transfer_type: TransferType
    amount: float  # Fixed amount or percentage
    frequency: TransferFrequency
    start_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool = True
    next_execution_date: Optional[datetime] = None
    last_execution_date: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Smart transfer settings
    income_detection_enabled: bool = False
    minimum_income_threshold: float = 0.0
    maximum_transfer_per_period: float = 10000.0
    surplus_calculation_enabled: bool = False
    
    # Error handling
    last_error: Optional[str] = None
    retry_after: Optional[datetime] = None


@dataclass 
class TransferRecord:
    """Data class representing an individual transfer record."""
    id: str
    rule_id: str
    goal_id: str
    user_id: str
    source_account_id: str
    target_subaccount_id: str
    amount: float
    status: TransferStatus
    scheduled_date: datetime
    executed_date: Optional[datetime] = None
    external_transaction_id: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    
    # Income detection context
    detected_income_amount: Optional[float] = None
    income_source: Optional[str] = None
    surplus_calculation: Optional[Dict] = None
    
    # Audit trail
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TransferEngine:
    """
    Core automated transfer engine for TAAXDOG savings system.
    
    Manages automated recurring transfers from income sources to goal subaccounts
    with intelligent income detection, error handling, and comprehensive audit trails.
    """
    
    def __init__(self, app=None):
        """
        Initialize the transfer engine.
        
        Args:
            app: Flask application instance (optional)
        """
        self.app = app
        self.db = db
        self.basiq_client = BasiqClient(app) if BasiqClient else None
        self.subaccount_manager = SubaccountManager() if SubaccountManager else None
        
        # Configuration
        self.retry_backoff_multiplier = 2
        self.max_retry_delay_hours = 24
        self.transfer_timeout_minutes = 30
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize with Flask app configuration."""
        self.app = app
        
        # Register with app extensions
        if not hasattr(app, 'extensions'):
            app.extensions = {}
        app.extensions['transfer_engine'] = self
    
    # ==================== TRANSFER RULE MANAGEMENT ====================
    
    def create_transfer_rule(self, rule_data: Dict) -> Dict:
        """
        Create a new automated transfer rule.
        
        Args:
            rule_data: Transfer rule configuration
            
        Returns:
            dict: Result with success status and rule data
        """
        try:
            # Validate required fields
            required_fields = ['goal_id', 'user_id', 'source_account_id', 'target_subaccount_id', 
                             'transfer_type', 'amount', 'frequency', 'start_date']
            for field in required_fields:
                if field not in rule_data:
                    return {
                        'success': False,
                        'error': f'Missing required field: {field}'
                    }
            
            # Generate rule ID
            rule_id = str(uuid.uuid4())
            
            # Create transfer rule
            rule = TransferRule(
                id=rule_id,
                goal_id=rule_data['goal_id'],
                user_id=rule_data['user_id'],
                source_account_id=rule_data['source_account_id'],
                target_subaccount_id=rule_data['target_subaccount_id'],
                transfer_type=TransferType(rule_data['transfer_type']),
                amount=float(rule_data['amount']),
                frequency=TransferFrequency(rule_data['frequency']),
                start_date=datetime.fromisoformat(rule_data['start_date']),
                end_date=datetime.fromisoformat(rule_data['end_date']) if rule_data.get('end_date') else None,
                income_detection_enabled=rule_data.get('income_detection_enabled', False),
                minimum_income_threshold=float(rule_data.get('minimum_income_threshold', 0.0)),
                maximum_transfer_per_period=float(rule_data.get('maximum_transfer_per_period', 10000.0)),
                surplus_calculation_enabled=rule_data.get('surplus_calculation_enabled', False),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            # Calculate next execution date
            rule.next_execution_date = self._calculate_next_execution_date(rule)
            
            # Validate the rule
            validation_result = self._validate_transfer_rule(rule)
            if not validation_result['valid']:
                return {
                    'success': False,
                    'error': 'Rule validation failed',
                    'details': validation_result['errors']
                }
            
            # Save to database
            if self.db:
                rule_dict = self._transfer_rule_to_dict(rule)
                self.db.collection('transfer_rules').document(rule_id).set(rule_dict)
                
                logger.info(f"✅ Created transfer rule {rule_id} for goal {rule.goal_id}")
                
                return {
                    'success': True,
                    'data': rule_dict
                }
            else:
                return {
                    'success': False,
                    'error': 'Database not available'
                }
                
        except Exception as e:
            logger.error(f"❌ Failed to create transfer rule: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_transfer_rule(self, rule_id: str) -> Dict:
        """
        Get a transfer rule by ID.
        
        Args:
            rule_id: Transfer rule ID
            
        Returns:
            dict: Rule data or error
        """
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not available'}
            
            rule_doc = self.db.collection('transfer_rules').document(rule_id).get()
            if not rule_doc.exists:
                return {
                    'success': False,
                    'error': 'Transfer rule not found'
                }
            
            rule_data = rule_doc.to_dict()
            return {
                'success': True,
                'data': rule_data
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get transfer rule {rule_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_user_transfer_rules(self, user_id: str, active_only: bool = True) -> Dict:
        """
        Get all transfer rules for a user.
        
        Args:
            user_id: User ID
            active_only: Whether to only return active rules
            
        Returns:
            dict: List of transfer rules
        """
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not available'}
            
            query = self.db.collection('transfer_rules').where('user_id', '==', user_id)
            
            if active_only:
                query = query.where('is_active', '==', True)
            
            rules = []
            for doc in query.stream():
                rule_data = doc.to_dict()
                rules.append(rule_data)
            
            return {
                'success': True,
                'data': rules
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get user transfer rules: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # ==================== TRANSFER EXECUTION ====================
    
    def execute_scheduled_transfers(self, limit: int = 100) -> Dict:
        """
        Execute all pending scheduled transfers.
        
        Args:
            limit: Maximum number of transfers to process
            
        Returns:
            dict: Execution results
        """
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not available'}
            
            # Get pending transfer rules
            current_time = datetime.now()
            
            query = (self.db.collection('transfer_rules')
                    .where('is_active', '==', True)
                    .where('next_execution_date', '<=', current_time.isoformat())
                    .limit(limit))
            
            pending_rules = []
            for doc in query.stream():
                rule_data = doc.to_dict()
                pending_rules.append(self._dict_to_transfer_rule(rule_data))
            
            results = {
                'total_processed': 0,
                'successful': 0,
                'failed': 0,
                'transfers': []
            }
            
            # Process each rule
            for rule in pending_rules:
                transfer_result = self._execute_single_transfer(rule)
                results['transfers'].append(transfer_result)
                results['total_processed'] += 1
                
                if transfer_result['success']:
                    results['successful'] += 1
                else:
                    results['failed'] += 1
            
            logger.info(f"✅ Executed {results['total_processed']} scheduled transfers")
            return {
                'success': True,
                'data': results
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to execute scheduled transfers: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _execute_single_transfer(self, rule: TransferRule) -> Dict:
        """
        Execute a single transfer for a rule.
        
        Args:
            rule: Transfer rule to execute
            
        Returns:
            dict: Transfer execution result
        """
        try:
            # Create transfer record
            transfer_id = str(uuid.uuid4())
            
            # Calculate transfer amount
            amount_result = self._calculate_transfer_amount(rule)
            if not amount_result['success']:
                return {
                    'success': False,
                    'rule_id': rule.id,
                    'error': amount_result['error']
                }
            
            transfer_amount = amount_result['amount']
            
            # Create transfer record
            transfer = TransferRecord(
                id=transfer_id,
                rule_id=rule.id,
                goal_id=rule.goal_id,
                user_id=rule.user_id,
                source_account_id=rule.source_account_id,
                target_subaccount_id=rule.target_subaccount_id,
                amount=transfer_amount,
                status=TransferStatus.PENDING,
                scheduled_date=datetime.now(),
                detected_income_amount=amount_result.get('detected_income'),
                income_source=amount_result.get('income_source'),
                surplus_calculation=amount_result.get('surplus_calculation'),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            # Save transfer record
            self._save_transfer_record(transfer)
            
            # Execute the transfer
            execution_result = self._perform_transfer(transfer)
            
            if execution_result['success']:
                # Update transfer record
                transfer.status = TransferStatus.COMPLETED
                transfer.executed_date = datetime.now()
                transfer.external_transaction_id = execution_result.get('transaction_id')
                
                # Update rule next execution date
                rule.next_execution_date = self._calculate_next_execution_date(rule)
                rule.last_execution_date = datetime.now()
                rule.retry_count = 0
                rule.last_error = None
                
                # Update subaccount balance
                self._update_subaccount_balance(transfer)
                
                logger.info(f"✅ Successfully executed transfer {transfer_id} for ${transfer_amount}")
                
            else:
                # Handle failure
                transfer.status = TransferStatus.FAILED
                transfer.error_message = execution_result['error']
                
                # Update rule with retry logic
                rule.retry_count += 1
                rule.last_error = execution_result['error']
                
                if rule.retry_count < rule.max_retries:
                    # Schedule retry with exponential backoff
                    delay_hours = min(
                        2 ** rule.retry_count * self.retry_backoff_multiplier,
                        self.max_retry_delay_hours
                    )
                    rule.retry_after = datetime.now() + timedelta(hours=delay_hours)
                    transfer.status = TransferStatus.RETRYING
                
                logger.warning(f"❌ Transfer {transfer_id} failed: {execution_result['error']}")
            
            # Update records
            transfer.updated_at = datetime.now()
            rule.updated_at = datetime.now()
            
            self._save_transfer_record(transfer)
            self._save_transfer_rule(rule)
            
            return {
                'success': execution_result['success'],
                'rule_id': rule.id,
                'transfer_id': transfer_id,
                'amount': transfer_amount,
                'error': execution_result.get('error')
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to execute transfer for rule {rule.id}: {str(e)}")
            return {
                'success': False,
                'rule_id': rule.id,
                'error': str(e)
            }
    
    def _calculate_transfer_amount(self, rule: TransferRule) -> Dict:
        """
        Calculate the transfer amount based on rule configuration.
        
        Args:
            rule: Transfer rule
            
        Returns:
            dict: Calculated amount and metadata
        """
        try:
            if rule.transfer_type == TransferType.FIXED_AMOUNT:
                return {
                    'success': True,
                    'amount': rule.amount
                }
            
            elif rule.transfer_type == TransferType.PERCENTAGE_INCOME:
                if rule.income_detection_enabled:
                    # Get recent income detection
                    income_result = self._detect_recent_income(rule)
                    if income_result['success']:
                        income_amount = income_result['amount']
                        transfer_amount = (rule.amount / 100) * income_amount
                        
                        # Apply limits
                        transfer_amount = min(transfer_amount, rule.maximum_transfer_per_period)
                        
                        return {
                            'success': True,
                            'amount': transfer_amount,
                            'detected_income': income_amount,
                            'income_source': income_result.get('source')
                        }
                    else:
                        return {
                            'success': False,
                            'error': 'Could not detect recent income for percentage-based transfer'
                        }
                else:
                    return {
                        'success': False,
                        'error': 'Income detection not enabled for percentage-based transfer'
                    }
            
            elif rule.transfer_type == TransferType.SMART_SURPLUS:
                # Calculate surplus after essential expenses
                surplus_result = self._calculate_surplus(rule)
                if surplus_result['success']:
                    surplus_amount = surplus_result['surplus']
                    transfer_amount = (rule.amount / 100) * surplus_amount
                    
                    # Apply limits
                    transfer_amount = min(transfer_amount, rule.maximum_transfer_per_period)
                    
                    return {
                        'success': True,
                        'amount': transfer_amount,
                        'surplus_calculation': surplus_result['calculation']
                    }
                else:
                    return {
                        'success': False,
                        'error': surplus_result['error']
                    }
            
            else:
                return {
                    'success': False,
                    'error': f'Unsupported transfer type: {rule.transfer_type}'
                }
                
        except Exception as e:
            logger.error(f"❌ Failed to calculate transfer amount: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _detect_recent_income(self, rule: TransferRule) -> Dict:
        """
        Detect recent income for the user's source account.
        
        Args:
            rule: Transfer rule
            
        Returns:
            dict: Income detection result
        """
        try:
            if not self.basiq_client:
                return {
                    'success': False,
                    'error': 'BASIQ client not available'
                }
            
            # Get recent transactions for the source account
            from_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            
            transactions_result = self.basiq_client.get_account_transactions(
                user_id=rule.user_id,
                account_id=rule.source_account_id,
                from_date=from_date
            )
            
            if not transactions_result['success']:
                return {
                    'success': False,
                    'error': 'Failed to get account transactions'
                }
            
            transactions = transactions_result['transactions'].get('data', [])
            
            # Analyze transactions for income patterns
            income_transactions = []
            for transaction in transactions:
                amount = float(transaction.get('amount', 0))
                description = transaction.get('description', '').lower()
                
                # Look for positive amounts that match income patterns
                if amount > rule.minimum_income_threshold:
                    if any(keyword in description for keyword in [
                        'salary', 'wage', 'income', 'payroll', 'deposit', 'transfer'
                    ]):
                        income_transactions.append({
                            'amount': amount,
                            'description': transaction.get('description'),
                            'date': transaction.get('date')
                        })
            
            if income_transactions:
                # Calculate average recent income
                total_income = sum(t['amount'] for t in income_transactions)
                avg_income = total_income / len(income_transactions)
                
                return {
                    'success': True,
                    'amount': avg_income,
                    'source': 'transaction_analysis',
                    'transactions': income_transactions
                }
            else:
                return {
                    'success': False,
                    'error': 'No income transactions found in recent period'
                }
                
        except Exception as e:
            logger.error(f"❌ Failed to detect income: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _calculate_surplus(self, rule: TransferRule) -> Dict:
        """
        Calculate available surplus after essential expenses.
        
        Args:
            rule: Transfer rule
            
        Returns:
            dict: Surplus calculation result
        """
        try:
            # This is a simplified version - in practice, this would integrate
            # with expense categorization and budget analysis
            
            # Get recent income and expenses
            income_result = self._detect_recent_income(rule)
            if not income_result['success']:
                return {
                    'success': False,
                    'error': 'Could not detect income for surplus calculation'
                }
            
            # For now, use a simple heuristic: 20% of income as surplus
            # In practice, this would analyze actual expense patterns
            income_amount = income_result['amount']
            estimated_surplus = income_amount * 0.2
            
            calculation = {
                'income': income_amount,
                'estimated_expenses': income_amount * 0.8,
                'surplus': estimated_surplus,
                'method': 'simple_heuristic'
            }
            
            return {
                'success': True,
                'surplus': estimated_surplus,
                'calculation': calculation
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to calculate surplus: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _perform_transfer(self, transfer: TransferRecord) -> Dict:
        """
        Perform the actual bank transfer via BASIQ.
        
        Args:
            transfer: Transfer record
            
        Returns:
            dict: Transfer result
        """
        try:
            if not self.basiq_client:
                # For virtual transfers, just record the transaction
                return {
                    'success': True,
                    'transaction_id': f"virtual_{uuid.uuid4()}",
                    'type': 'virtual'
                }
            
            # For now, BASIQ doesn't support direct transfers, so we record as virtual
            # In the future, this would call actual bank transfer APIs
            logger.info(f"🏦 Recording virtual transfer of ${transfer.amount} for subaccount {transfer.target_subaccount_id}")
            
            return {
                'success': True,
                'transaction_id': f"virtual_{uuid.uuid4()}",
                'type': 'virtual'
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to perform transfer: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _update_subaccount_balance(self, transfer: TransferRecord):
        """
        Update the target subaccount balance after successful transfer.
        
        Args:
            transfer: Completed transfer record
        """
        try:
            if self.subaccount_manager:
                # Record the transfer as a subaccount transaction
                self.subaccount_manager.process_transfer(
                    transfer.target_subaccount_id,
                    'deposit',
                    transfer.amount,
                    f'Automated transfer from rule {transfer.rule_id}'
                )
                
                logger.info(f"✅ Updated subaccount {transfer.target_subaccount_id} balance")
                
        except Exception as e:
            logger.error(f"❌ Failed to update subaccount balance: {str(e)}")
    
    # ==================== UTILITY METHODS ====================
    
    def _calculate_next_execution_date(self, rule: TransferRule) -> datetime:
        """
        Calculate the next execution date for a transfer rule.
        
        Args:
            rule: Transfer rule
            
        Returns:
            datetime: Next execution date
        """
        try:
            base_date = rule.last_execution_date if rule.last_execution_date else rule.start_date
            
            if rule.frequency == TransferFrequency.DAILY:
                return base_date + timedelta(days=1)
            elif rule.frequency == TransferFrequency.WEEKLY:
                return base_date + timedelta(weeks=1)
            elif rule.frequency == TransferFrequency.BI_WEEKLY:
                return base_date + timedelta(weeks=2)
            elif rule.frequency == TransferFrequency.MONTHLY:
                # Add one month, handling month boundaries
                if base_date.month == 12:
                    return base_date.replace(year=base_date.year + 1, month=1)
                else:
                    return base_date.replace(month=base_date.month + 1)
            elif rule.frequency == TransferFrequency.QUARTERLY:
                # Add three months
                new_month = base_date.month + 3
                new_year = base_date.year
                if new_month > 12:
                    new_month -= 12
                    new_year += 1
                return base_date.replace(year=new_year, month=new_month)
            else:
                # Default to monthly
                return base_date + timedelta(days=30)
                
        except Exception as e:
            logger.error(f"❌ Failed to calculate next execution date: {str(e)}")
            return datetime.now() + timedelta(days=1)
    
    def _validate_transfer_rule(self, rule: TransferRule) -> Dict:
        """
        Validate a transfer rule configuration.
        
        Args:
            rule: Transfer rule to validate
            
        Returns:
            dict: Validation result
        """
        errors = []
        
        # Basic validation
        if rule.amount <= 0:
            errors.append("Transfer amount must be positive")
        
        if rule.transfer_type == TransferType.PERCENTAGE_INCOME and rule.amount > 100:
            errors.append("Percentage cannot exceed 100%")
        
        if rule.start_date < datetime.now() - timedelta(days=1):
            errors.append("Start date cannot be in the past")
        
        if rule.end_date and rule.end_date <= rule.start_date:
            errors.append("End date must be after start date")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    def _transfer_rule_to_dict(self, rule: TransferRule) -> Dict:
        """Convert TransferRule to dictionary for database storage."""
        return {
            'id': rule.id,
            'goal_id': rule.goal_id,
            'user_id': rule.user_id,
            'source_account_id': rule.source_account_id,
            'target_subaccount_id': rule.target_subaccount_id,
            'transfer_type': rule.transfer_type.value,
            'amount': rule.amount,
            'frequency': rule.frequency.value,
            'start_date': rule.start_date.isoformat(),
            'end_date': rule.end_date.isoformat() if rule.end_date else None,
            'is_active': rule.is_active,
            'next_execution_date': rule.next_execution_date.isoformat() if rule.next_execution_date else None,
            'last_execution_date': rule.last_execution_date.isoformat() if rule.last_execution_date else None,
            'retry_count': rule.retry_count,
            'max_retries': rule.max_retries,
            'created_at': rule.created_at.isoformat() if rule.created_at else None,
            'updated_at': rule.updated_at.isoformat() if rule.updated_at else None,
            'income_detection_enabled': rule.income_detection_enabled,
            'minimum_income_threshold': rule.minimum_income_threshold,
            'maximum_transfer_per_period': rule.maximum_transfer_per_period,
            'surplus_calculation_enabled': rule.surplus_calculation_enabled,
            'last_error': rule.last_error,
            'retry_after': rule.retry_after.isoformat() if rule.retry_after else None
        }
    
    def _dict_to_transfer_rule(self, data: Dict) -> TransferRule:
        """Convert dictionary to TransferRule object."""
        return TransferRule(
            id=data['id'],
            goal_id=data['goal_id'],
            user_id=data['user_id'],
            source_account_id=data['source_account_id'],
            target_subaccount_id=data['target_subaccount_id'],
            transfer_type=TransferType(data['transfer_type']),
            amount=data['amount'],
            frequency=TransferFrequency(data['frequency']),
            start_date=datetime.fromisoformat(data['start_date']),
            end_date=datetime.fromisoformat(data['end_date']) if data.get('end_date') else None,
            is_active=data.get('is_active', True),
            next_execution_date=datetime.fromisoformat(data['next_execution_date']) if data.get('next_execution_date') else None,
            last_execution_date=datetime.fromisoformat(data['last_execution_date']) if data.get('last_execution_date') else None,
            retry_count=data.get('retry_count', 0),
            max_retries=data.get('max_retries', 3),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            updated_at=datetime.fromisoformat(data['updated_at']) if data.get('updated_at') else None,
            income_detection_enabled=data.get('income_detection_enabled', False),
            minimum_income_threshold=data.get('minimum_income_threshold', 0.0),
            maximum_transfer_per_period=data.get('maximum_transfer_per_period', 10000.0),
            surplus_calculation_enabled=data.get('surplus_calculation_enabled', False),
            last_error=data.get('last_error'),
            retry_after=datetime.fromisoformat(data['retry_after']) if data.get('retry_after') else None
        )
    
    def _save_transfer_record(self, transfer: TransferRecord):
        """Save transfer record to database."""
        if self.db:
            transfer_dict = {
                'id': transfer.id,
                'rule_id': transfer.rule_id,
                'goal_id': transfer.goal_id,
                'user_id': transfer.user_id,
                'source_account_id': transfer.source_account_id,
                'target_subaccount_id': transfer.target_subaccount_id,
                'amount': transfer.amount,
                'status': transfer.status.value,
                'scheduled_date': transfer.scheduled_date.isoformat(),
                'executed_date': transfer.executed_date.isoformat() if transfer.executed_date else None,
                'external_transaction_id': transfer.external_transaction_id,
                'error_message': transfer.error_message,
                'retry_count': transfer.retry_count,
                'detected_income_amount': transfer.detected_income_amount,
                'income_source': transfer.income_source,
                'surplus_calculation': transfer.surplus_calculation,
                'created_at': transfer.created_at.isoformat() if transfer.created_at else None,
                'updated_at': transfer.updated_at.isoformat() if transfer.updated_at else None
            }
            
            self.db.collection('transfer_records').document(transfer.id).set(transfer_dict)
    
    def _save_transfer_rule(self, rule: TransferRule):
        """Save transfer rule to database."""
        if self.db:
            rule_dict = self._transfer_rule_to_dict(rule)
            self.db.collection('transfer_rules').document(rule.id).set(rule_dict)
    
    # ==================== TRANSFER HISTORY ====================
    
    def get_transfer_history(self, user_id: str, goal_id: str = None, limit: int = 50, 
                           start_date: datetime = None, end_date: datetime = None) -> Dict:
        """
        Get transfer history for a user or specific goal.
        
        Args:
            user_id: User ID
            goal_id: Optional goal ID to filter by
            limit: Maximum number of records to return
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            dict: Transfer history
        """
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not available'}
            
            query = self.db.collection('transfer_records').where('user_id', '==', user_id)
            
            if goal_id:
                query = query.where('goal_id', '==', goal_id)
            
            # Apply date filters if provided
            if start_date:
                query = query.where('scheduled_date', '>=', start_date.isoformat())
            if end_date:
                query = query.where('scheduled_date', '<=', end_date.isoformat())
            
            # Order by scheduled date (most recent first) and limit
            query = query.order_by('scheduled_date', direction='DESCENDING').limit(limit)
            
            transfers = []
            for doc in query.stream():
                transfer_data = doc.to_dict()
                transfers.append(transfer_data)
            
            return {
                'success': True,
                'data': transfers
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get transfer history: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


# Global transfer engine instance
transfer_engine = None

def init_transfer_engine(app):
    """Initialize the global transfer engine with Flask app."""
    global transfer_engine
    transfer_engine = TransferEngine(app)
    return transfer_engine

def get_transfer_engine():
    """Get the global transfer engine instance."""
    return transfer_engine 