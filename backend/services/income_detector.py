"""
Income Detection Service for TAAXDOG Automated Transfer Engine

This module provides intelligent income detection capabilities that:
- Analyzes bank transaction patterns to identify income sources
- Calculates surplus amounts available for automated transfers
- Provides smart transfer recommendations based on spending patterns
- Integrates with BASIQ API for real-time transaction analysis
"""

import sys
import os
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import json
from collections import defaultdict

# Add project paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))
sys.path.insert(0, os.path.join(project_root, 'backend'))

try:
    from src.integrations.basiq_client import BasiqClient
except ImportError:
    try:
        from integrations.basiq_client import BasiqClient
    except ImportError:
        print("Warning: BASIQ client not available")
        BasiqClient = None

try:
    from firebase_config import db
except ImportError:
    try:
        from backend.firebase_config import db
    except ImportError:
        print("Warning: Firebase config not available")
        db = None

# Configure logging
logger = logging.getLogger(__name__)


class IncomeType(Enum):
    """Income type classification."""
    SALARY = "salary"
    FREELANCE = "freelance"
    BUSINESS = "business"
    INVESTMENT = "investment"
    GOVERNMENT = "government"
    OTHER = "other"


class TransactionCategory(Enum):
    """Transaction category classification."""
    INCOME = "income"
    ESSENTIAL_EXPENSE = "essential_expense"
    DISCRETIONARY_EXPENSE = "discretionary_expense"
    TRANSFER = "transfer"
    UNKNOWN = "unknown"


@dataclass
class IncomePattern:
    """Data class representing an identified income pattern."""
    source_description: str
    income_type: IncomeType
    amount: float
    frequency_days: int
    confidence_score: float
    last_occurrence: datetime
    occurrence_count: int
    variance: float  # Amount variance between occurrences
    next_expected_date: Optional[datetime] = None


@dataclass
class SpendingAnalysis:
    """Data class representing spending pattern analysis."""
    essential_expenses: float
    discretionary_expenses: float
    average_monthly_spending: float
    spending_categories: Dict[str, float]
    recurring_expenses: List[Dict]
    seasonal_patterns: Dict[str, float]


@dataclass
class SurplusCalculation:
    """Data class representing surplus calculation result."""
    total_income: float
    essential_expenses: float
    discretionary_expenses: float
    calculated_surplus: float
    recommended_transfer_amount: float
    confidence_level: float
    analysis_period_days: int


class IncomeDetector:
    """
    Intelligent income detection and surplus calculation service.
    
    Analyzes bank transaction data to identify income patterns,
    categorize expenses, and calculate available surplus for transfers.
    """
    
    def __init__(self, app=None):
        """
        Initialize the income detector.
        
        Args:
            app: Flask application instance (optional)
        """
        self.app = app
        self.db = db
        self.basiq_client = BasiqClient(app) if BasiqClient else None
        
        # Configuration
        self.analysis_period_days = 90
        self.minimum_income_amount = 100.0
        self.minimum_confidence_score = 0.7
        self.income_keywords = [
            'salary', 'wage', 'income', 'payroll', 'pay', 'pension',
            'benefit', 'allowance', 'dividend', 'interest', 'refund',
            'commission', 'bonus', 'deposit'
        ]
        self.essential_expense_keywords = [
            'rent', 'mortgage', 'utilities', 'insurance', 'medical',
            'grocery', 'petrol', 'gas', 'electricity', 'water',
            'phone', 'internet', 'council', 'rates', 'tax'
        ]
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize with Flask app configuration."""
        self.app = app
        
        # Register with app extensions
        if not hasattr(app, 'extensions'):
            app.extensions = {}
        app.extensions['income_detector'] = self
    
    # ==================== INCOME DETECTION ====================
    
    def detect_income_patterns(self, user_id: str, account_id: str, 
                              analysis_days: int = None) -> Dict:
        """
        Detect income patterns for a user's account.
        
        Args:
            user_id: User ID
            account_id: Bank account ID
            analysis_days: Number of days to analyze (default: 90)
            
        Returns:
            dict: Income patterns analysis result
        """
        try:
            if not self.basiq_client:
                return {
                    'success': False,
                    'error': 'BASIQ client not available'
                }
            
            analysis_days = analysis_days or self.analysis_period_days
            from_date = (datetime.now() - timedelta(days=analysis_days)).strftime('%Y-%m-%d')
            
            # Get account transactions
            transactions_result = self.basiq_client.get_account_transactions(
                user_id=user_id,
                account_id=account_id,
                from_date=from_date
            )
            
            if not transactions_result['success']:
                return {
                    'success': False,
                    'error': 'Failed to get account transactions'
                }
            
            transactions = transactions_result['transactions'].get('data', [])
            
            # Filter and categorize income transactions
            income_transactions = self._filter_income_transactions(transactions)
            
            # Identify income patterns
            income_patterns = self._identify_income_patterns(income_transactions)
            
            # Calculate confidence scores
            for pattern in income_patterns:
                pattern.confidence_score = self._calculate_pattern_confidence(pattern)
            
            # Filter by minimum confidence
            reliable_patterns = [p for p in income_patterns if p.confidence_score >= self.minimum_confidence_score]
            
            # Calculate next expected income dates
            for pattern in reliable_patterns:
                pattern.next_expected_date = self._calculate_next_income_date(pattern)
            
            logger.info(f"✅ Detected {len(reliable_patterns)} reliable income patterns for account {account_id}")
            
            return {
                'success': True,
                'data': {
                    'income_patterns': [self._pattern_to_dict(p) for p in reliable_patterns],
                    'total_monthly_income': self._calculate_monthly_income(reliable_patterns),
                    'analysis_period_days': analysis_days,
                    'confidence_level': self._calculate_overall_confidence(reliable_patterns)
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to detect income patterns: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _filter_income_transactions(self, transactions: List[Dict]) -> List[Dict]:
        """Filter transactions that appear to be income."""
        income_transactions = []
        
        for transaction in transactions:
            amount = float(transaction.get('amount', 0))
            description = transaction.get('description', '').lower()
            
            # Look for positive amounts above minimum threshold
            if amount >= self.minimum_income_amount:
                # Check for income keywords in description
                if any(keyword in description for keyword in self.income_keywords):
                    income_transactions.append({
                        'amount': amount,
                        'description': transaction.get('description', ''),
                        'date': transaction.get('postDate', transaction.get('date')),
                        'id': transaction.get('id'),
                        'account': transaction.get('account')
                    })
                # Also include large regular deposits that might be salary
                elif amount > 1000 and not any(exclude in description for exclude in [
                    'transfer', 'withdrawal', 'fee', 'charge'
                ]):
                    income_transactions.append({
                        'amount': amount,
                        'description': transaction.get('description', ''),
                        'date': transaction.get('postDate', transaction.get('date')),
                        'id': transaction.get('id'),
                        'account': transaction.get('account'),
                        'potential_income': True
                    })
        
        return income_transactions
    
    def _identify_income_patterns(self, income_transactions: List[Dict]) -> List[IncomePattern]:
        """Identify recurring income patterns from transactions."""
        patterns = []
        
        # Group transactions by similar amounts and descriptions
        amount_groups = defaultdict(list)
        
        for transaction in income_transactions:
            # Round amount to nearest $10 for grouping
            rounded_amount = round(transaction['amount'] / 10) * 10
            amount_groups[rounded_amount].append(transaction)
        
        # Analyze each group for patterns
        for amount, group in amount_groups.items():
            if len(group) >= 2:  # Need at least 2 occurrences to identify pattern
                pattern = self._analyze_transaction_group(group, amount)
                if pattern:
                    patterns.append(pattern)
        
        return patterns
    
    def _analyze_transaction_group(self, transactions: List[Dict], base_amount: float) -> Optional[IncomePattern]:
        """Analyze a group of similar transactions for patterns."""
        if len(transactions) < 2:
            return None
        
        # Sort by date
        transactions.sort(key=lambda x: datetime.fromisoformat(x['date'].replace('Z', '+00:00')))
        
        # Calculate time intervals between transactions
        intervals = []
        for i in range(1, len(transactions)):
            date1 = datetime.fromisoformat(transactions[i-1]['date'].replace('Z', '+00:00'))
            date2 = datetime.fromisoformat(transactions[i]['date'].replace('Z', '+00:00'))
            interval_days = (date2 - date1).days
            intervals.append(interval_days)
        
        if not intervals:
            return None
        
        # Calculate average interval
        avg_interval = sum(intervals) / len(intervals)
        
        # Calculate variance in intervals
        interval_variance = sum((interval - avg_interval) ** 2 for interval in intervals) / len(intervals)
        
        # Calculate amount variance
        amounts = [t['amount'] for t in transactions]
        avg_amount = sum(amounts) / len(amounts)
        amount_variance = sum((amount - avg_amount) ** 2 for amount in amounts) / len(amounts)
        
        # Determine income type from descriptions
        income_type = self._classify_income_type(transactions)
        
        # Get most recent transaction
        last_transaction = transactions[-1]
        last_date = datetime.fromisoformat(last_transaction['date'].replace('Z', '+00:00'))
        
        return IncomePattern(
            source_description=self._get_representative_description(transactions),
            income_type=income_type,
            amount=avg_amount,
            frequency_days=int(avg_interval),
            confidence_score=0.0,  # Will be calculated later
            last_occurrence=last_date,
            occurrence_count=len(transactions),
            variance=amount_variance,
            next_expected_date=None  # Will be calculated later
        )
    
    def _classify_income_type(self, transactions: List[Dict]) -> IncomeType:
        """Classify the type of income based on transaction descriptions."""
        descriptions = ' '.join([t['description'].lower() for t in transactions])
        
        if any(keyword in descriptions for keyword in ['salary', 'wage', 'payroll']):
            return IncomeType.SALARY
        elif any(keyword in descriptions for keyword in ['freelance', 'contract', 'invoice']):
            return IncomeType.FREELANCE
        elif any(keyword in descriptions for keyword in ['business', 'company', 'profit']):
            return IncomeType.BUSINESS
        elif any(keyword in descriptions for keyword in ['dividend', 'interest', 'capital']):
            return IncomeType.INVESTMENT
        elif any(keyword in descriptions for keyword in ['pension', 'benefit', 'centrelink']):
            return IncomeType.GOVERNMENT
        else:
            return IncomeType.OTHER
    
    def _get_representative_description(self, transactions: List[Dict]) -> str:
        """Get a representative description for a group of transactions."""
        descriptions = [t['description'] for t in transactions]
        
        # Find common words
        word_counts = defaultdict(int)
        for desc in descriptions:
            words = desc.lower().split()
            for word in words:
                if len(word) > 3:  # Ignore short words
                    word_counts[word] += 1
        
        # Find most common meaningful words
        common_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        
        if common_words:
            return ' '.join([word for word, count in common_words[:3]])
        else:
            return descriptions[0] if descriptions else "Income"
    
    def _calculate_pattern_confidence(self, pattern: IncomePattern) -> float:
        """Calculate confidence score for an income pattern."""
        confidence = 0.0
        
        # Base confidence from occurrence count
        occurrence_factor = min(pattern.occurrence_count / 10, 1.0)  # Max 1.0 for 10+ occurrences
        confidence += occurrence_factor * 0.4
        
        # Regularity factor (lower variance = higher confidence)
        if pattern.frequency_days > 0:
            regularity_factor = max(0, 1 - (pattern.variance / (pattern.amount * 0.1)))
            confidence += regularity_factor * 0.3
        
        # Frequency factor (more frequent = higher confidence)
        if pattern.frequency_days <= 7:  # Weekly or more frequent
            confidence += 0.2
        elif pattern.frequency_days <= 31:  # Monthly
            confidence += 0.15
        else:
            confidence += 0.05
        
        # Amount consistency factor
        if pattern.variance < pattern.amount * 0.05:  # Less than 5% variance
            confidence += 0.1
        
        return min(confidence, 1.0)
    
    def _calculate_monthly_income(self, patterns: List[IncomePattern]) -> float:
        """Calculate estimated monthly income from patterns."""
        total_monthly = 0.0
        
        for pattern in patterns:
            if pattern.frequency_days > 0:
                # Convert to monthly equivalent
                monthly_frequency = 30 / pattern.frequency_days
                monthly_amount = pattern.amount * monthly_frequency
                total_monthly += monthly_amount
        
        return total_monthly
    
    def _calculate_overall_confidence(self, patterns: List[IncomePattern]) -> float:
        """Calculate overall confidence in income detection."""
        if not patterns:
            return 0.0
        
        # Weight by pattern amounts
        total_weight = sum(p.amount for p in patterns)
        if total_weight == 0:
            return 0.0
        
        weighted_confidence = sum(p.confidence_score * p.amount for p in patterns) / total_weight
        return weighted_confidence
    
    def _calculate_next_income_date(self, pattern: IncomePattern) -> datetime:
        """Calculate when the next income is expected."""
        return pattern.last_occurrence + timedelta(days=pattern.frequency_days)
    
    # ==================== SPENDING ANALYSIS ====================
    
    def analyze_spending_patterns(self, user_id: str, account_id: str, 
                                analysis_days: int = None) -> Dict:
        """
        Analyze spending patterns to categorize expenses.
        
        Args:
            user_id: User ID
            account_id: Bank account ID
            analysis_days: Number of days to analyze
            
        Returns:
            dict: Spending analysis result
        """
        try:
            if not self.basiq_client:
                return {
                    'success': False,
                    'error': 'BASIQ client not available'
                }
            
            analysis_days = analysis_days or self.analysis_period_days
            from_date = (datetime.now() - timedelta(days=analysis_days)).strftime('%Y-%m-%d')
            
            # Get account transactions
            transactions_result = self.basiq_client.get_account_transactions(
                user_id=user_id,
                account_id=account_id,
                from_date=from_date
            )
            
            if not transactions_result['success']:
                return {
                    'success': False,
                    'error': 'Failed to get account transactions'
                }
            
            transactions = transactions_result['transactions'].get('data', [])
            
            # Filter expense transactions (negative amounts)
            expense_transactions = [
                t for t in transactions 
                if float(t.get('amount', 0)) < 0
            ]
            
            # Categorize expenses
            categorized_expenses = self._categorize_expenses(expense_transactions)
            
            # Calculate monthly averages
            monthly_factor = 30 / analysis_days
            monthly_spending = {
                category: total * monthly_factor 
                for category, total in categorized_expenses.items()
            }
            
            # Identify recurring expenses
            recurring_expenses = self._identify_recurring_expenses(expense_transactions)
            
            # Create spending analysis
            analysis = SpendingAnalysis(
                essential_expenses=monthly_spending.get('essential', 0.0),
                discretionary_expenses=monthly_spending.get('discretionary', 0.0),
                average_monthly_spending=sum(monthly_spending.values()),
                spending_categories=monthly_spending,
                recurring_expenses=recurring_expenses,
                seasonal_patterns={}  # Could be expanded for seasonal analysis
            )
            
            logger.info(f"✅ Analyzed spending patterns for account {account_id}")
            
            return {
                'success': True,
                'data': {
                    'essential_expenses': analysis.essential_expenses,
                    'discretionary_expenses': analysis.discretionary_expenses,
                    'total_monthly_spending': analysis.average_monthly_spending,
                    'spending_breakdown': analysis.spending_categories,
                    'recurring_expenses': analysis.recurring_expenses,
                    'analysis_period_days': analysis_days
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to analyze spending patterns: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _categorize_expenses(self, transactions: List[Dict]) -> Dict[str, float]:
        """Categorize expense transactions into essential vs discretionary."""
        categories = {
            'essential': 0.0,
            'discretionary': 0.0,
            'transfers': 0.0,
            'unknown': 0.0
        }
        
        for transaction in transactions:
            amount = abs(float(transaction.get('amount', 0)))
            description = transaction.get('description', '').lower()
            
            if any(keyword in description for keyword in self.essential_expense_keywords):
                categories['essential'] += amount
            elif any(keyword in description for keyword in ['transfer', 'payment', 'withdrawal']):
                categories['transfers'] += amount
            else:
                # For now, treat unknown as discretionary
                categories['discretionary'] += amount
        
        return categories
    
    def _identify_recurring_expenses(self, transactions: List[Dict]) -> List[Dict]:
        """Identify recurring expense patterns."""
        # Group by similar descriptions and amounts
        expense_groups = defaultdict(list)
        
        for transaction in transactions:
            amount = abs(float(transaction.get('amount', 0)))
            description = transaction.get('description', '')
            
            # Create a key based on rounded amount and cleaned description
            cleaned_desc = re.sub(r'\d+', '', description).strip()
            key = f"{cleaned_desc}_{round(amount/10)*10}"
            
            expense_groups[key].append({
                'amount': amount,
                'description': description,
                'date': transaction.get('postDate', transaction.get('date'))
            })
        
        recurring_expenses = []
        for key, group in expense_groups.items():
            if len(group) >= 3:  # At least 3 occurrences to be considered recurring
                avg_amount = sum(t['amount'] for t in group) / len(group)
                recurring_expenses.append({
                    'description': group[0]['description'],
                    'average_amount': avg_amount,
                    'frequency': len(group),
                    'category': 'essential' if any(
                        keyword in group[0]['description'].lower() 
                        for keyword in self.essential_expense_keywords
                    ) else 'discretionary'
                })
        
        return recurring_expenses
    
    # ==================== SURPLUS CALCULATION ====================
    
    def calculate_surplus(self, user_id: str, account_id: str, 
                         safety_buffer_percentage: float = 20.0) -> Dict:
        """
        Calculate available surplus for automated transfers.
        
        Args:
            user_id: User ID
            account_id: Bank account ID
            safety_buffer_percentage: Safety buffer as percentage of income
            
        Returns:
            dict: Surplus calculation result
        """
        try:
            # Get income patterns
            income_result = self.detect_income_patterns(user_id, account_id)
            if not income_result['success']:
                return {
                    'success': False,
                    'error': 'Failed to detect income patterns'
                }
            
            income_data = income_result['data']
            monthly_income = income_data['total_monthly_income']
            
            # Get spending patterns
            spending_result = self.analyze_spending_patterns(user_id, account_id)
            if not spending_result['success']:
                return {
                    'success': False,
                    'error': 'Failed to analyze spending patterns'
                }
            
            spending_data = spending_result['data']
            essential_expenses = spending_data['essential_expenses']
            discretionary_expenses = spending_data['discretionary_expenses']
            
            # Calculate surplus
            total_expenses = essential_expenses + discretionary_expenses
            safety_buffer = monthly_income * (safety_buffer_percentage / 100)
            calculated_surplus = monthly_income - total_expenses - safety_buffer
            
            # Ensure surplus is not negative
            calculated_surplus = max(calculated_surplus, 0.0)
            
            # Recommend conservative transfer amount (80% of surplus)
            recommended_transfer = calculated_surplus * 0.8
            
            # Calculate confidence level
            income_confidence = income_data.get('confidence_level', 0.0)
            spending_confidence = 0.8  # Assume reasonable confidence in spending analysis
            overall_confidence = (income_confidence + spending_confidence) / 2
            
            surplus_calc = SurplusCalculation(
                total_income=monthly_income,
                essential_expenses=essential_expenses,
                discretionary_expenses=discretionary_expenses,
                calculated_surplus=calculated_surplus,
                recommended_transfer_amount=recommended_transfer,
                confidence_level=overall_confidence,
                analysis_period_days=self.analysis_period_days
            )
            
            logger.info(f"✅ Calculated surplus for account {account_id}: ${calculated_surplus:.2f}")
            
            return {
                'success': True,
                'data': {
                    'monthly_income': surplus_calc.total_income,
                    'essential_expenses': surplus_calc.essential_expenses,
                    'discretionary_expenses': surplus_calc.discretionary_expenses,
                    'safety_buffer': safety_buffer,
                    'calculated_surplus': surplus_calc.calculated_surplus,
                    'recommended_transfer_amount': surplus_calc.recommended_transfer_amount,
                    'confidence_level': surplus_calc.confidence_level,
                    'analysis_period_days': surplus_calc.analysis_period_days,
                    'breakdown': {
                        'income_patterns': income_data.get('income_patterns', []),
                        'spending_breakdown': spending_data.get('spending_breakdown', {}),
                        'recurring_expenses': spending_data.get('recurring_expenses', [])
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to calculate surplus: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # ==================== UTILITY METHODS ====================
    
    def _pattern_to_dict(self, pattern: IncomePattern) -> Dict:
        """Convert IncomePattern to dictionary."""
        return {
            'source_description': pattern.source_description,
            'income_type': pattern.income_type.value,
            'amount': pattern.amount,
            'frequency_days': pattern.frequency_days,
            'confidence_score': pattern.confidence_score,
            'last_occurrence': pattern.last_occurrence.isoformat(),
            'occurrence_count': pattern.occurrence_count,
            'variance': pattern.variance,
            'next_expected_date': pattern.next_expected_date.isoformat() if pattern.next_expected_date else None
        }
    
    def get_transfer_recommendations(self, user_id: str, account_id: str, 
                                   target_percentage: float = 20.0) -> Dict:
        """
        Get smart transfer recommendations based on income and spending analysis.
        
        Args:
            user_id: User ID
            account_id: Bank account ID
            target_percentage: Target percentage of income to save
            
        Returns:
            dict: Transfer recommendations
        """
        try:
            # Calculate surplus
            surplus_result = self.calculate_surplus(user_id, account_id)
            if not surplus_result['success']:
                return surplus_result
            
            surplus_data = surplus_result['data']
            monthly_income = surplus_data['monthly_income']
            calculated_surplus = surplus_data['calculated_surplus']
            
            # Calculate target amount based on percentage
            target_amount = monthly_income * (target_percentage / 100)
            
            # Recommend the smaller of target amount or calculated surplus
            recommended_amount = min(target_amount, calculated_surplus)
            
            # Generate frequency recommendations
            frequency_recommendations = []
            
            # Weekly transfers
            weekly_amount = recommended_amount / 4.33  # Average weeks per month
            if weekly_amount >= 25:  # Minimum viable weekly transfer
                frequency_recommendations.append({
                    'frequency': 'weekly',
                    'amount': weekly_amount,
                    'description': f'${weekly_amount:.2f} weekly'
                })
            
            # Bi-weekly transfers
            biweekly_amount = recommended_amount / 2.17  # Average bi-weeks per month
            if biweekly_amount >= 50:  # Minimum viable bi-weekly transfer
                frequency_recommendations.append({
                    'frequency': 'bi_weekly',
                    'amount': biweekly_amount,
                    'description': f'${biweekly_amount:.2f} bi-weekly'
                })
            
            # Monthly transfers
            frequency_recommendations.append({
                'frequency': 'monthly',
                'amount': recommended_amount,
                'description': f'${recommended_amount:.2f} monthly'
            })
            
            return {
                'success': True,
                'data': {
                    'recommended_monthly_amount': recommended_amount,
                    'target_percentage': target_percentage,
                    'available_surplus': calculated_surplus,
                    'confidence_level': surplus_data['confidence_level'],
                    'frequency_options': frequency_recommendations,
                    'analysis_summary': {
                        'monthly_income': monthly_income,
                        'essential_expenses': surplus_data['essential_expenses'],
                        'discretionary_expenses': surplus_data['discretionary_expenses']
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get transfer recommendations: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


# Global income detector instance
income_detector = None

def init_income_detector(app):
    """Initialize the global income detector with Flask app."""
    global income_detector
    income_detector = IncomeDetector(app)
    return income_detector

def get_income_detector():
    """Get the global income detector instance."""
    return income_detector 