"""
Claude-Powered Savings Advisor for TAAXDOG

This module provides intelligent savings recommendations using Claude AI,
analyzing user financial data to suggest optimal savings strategies,
goal prioritization, and personalized financial advice.
"""

import sys
import os
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
import asyncio

# Add project paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))
sys.path.insert(0, os.path.join(project_root, 'backend'))

try:
    from firebase_config import db
except ImportError:
    try:
        from backend.firebase_config import db
    except ImportError:
        print("Warning: Firebase config not available")
        db = None

try:
    from src.integrations.claude_client import claude_client
except ImportError:
    try:
        from integrations.claude_client import claude_client
    except ImportError:
        print("Warning: Claude client not available")
        claude_client = None

try:
    from services.income_detector import get_income_detector
    from services.transfer_engine import get_transfer_engine
except ImportError:
    try:
        from backend.services.income_detector import get_income_detector
        from backend.services.transfer_engine import get_transfer_engine
    except ImportError:
        def get_income_detector():
            return None
        def get_transfer_engine():
            return None

# Configure logging
logger = logging.getLogger(__name__)


class RecommendationType(Enum):
    """Types of savings recommendations."""
    TRANSFER_OPTIMIZATION = "transfer_optimization"
    GOAL_PRIORITIZATION = "goal_prioritization"
    EMERGENCY_FUND = "emergency_fund"
    DEBT_MANAGEMENT = "debt_management"
    SEASONAL_ADJUSTMENT = "seasonal_adjustment"
    OPPORTUNITY_ALERT = "opportunity_alert"
    SPENDING_OPTIMIZATION = "spending_optimization"
    INVESTMENT_SUGGESTION = "investment_suggestion"


class UrgencyLevel(Enum):
    """Urgency levels for recommendations."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SavingsRecommendation:
    """Data class for savings recommendations."""
    id: str
    user_id: str
    type: RecommendationType
    title: str
    description: str
    reasoning: str
    action_items: List[str]
    potential_savings: float
    urgency: UrgencyLevel
    confidence_score: float
    expires_at: Optional[datetime] = None
    metadata: Optional[Dict] = None
    created_at: Optional[datetime] = None
    is_implemented: bool = False


class SavingsAdvisor:
    """
    Claude-powered savings advisor providing intelligent financial recommendations.
    
    Analyzes user financial data, goals, and spending patterns to provide
    personalized savings advice and optimization suggestions.
    """
    
    def __init__(self, app=None):
        """Initialize the savings advisor."""
        self.app = app
        self.db = db
        self.claude_client = claude_client
        self.income_detector = get_income_detector()
        self.transfer_engine = get_transfer_engine()
        
        # Configuration
        self.max_recommendations_per_user = 10
        self.recommendation_cache_hours = 24
        self.min_confidence_threshold = 0.6
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize with Flask app configuration."""
        self.app = app
        
        # Register with app extensions
        if not hasattr(app, 'extensions'):
            app.extensions = {}
        app.extensions['savings_advisor'] = self
    
    # ==================== MAIN RECOMMENDATION ENGINE ====================
    
    async def generate_comprehensive_recommendations(self, user_id: str) -> Dict:
        """
        Generate comprehensive savings recommendations for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            dict: Comprehensive recommendations
        """
        try:
            # Check for cached recommendations
            cached_recommendations = self._get_cached_recommendations(user_id)
            if cached_recommendations:
                return {
                    'success': True,
                    'data': cached_recommendations,
                    'cached': True
                }
            
            # Gather user financial data
            financial_data = await self._gather_user_financial_data(user_id)
            if not financial_data['success']:
                return {
                    'success': False,
                    'error': 'Unable to gather financial data'
                }
            
            # Generate AI-powered recommendations
            ai_recommendations = await self._generate_ai_recommendations(
                user_id, financial_data['data']
            )
            
            # Process and validate recommendations
            processed_recommendations = self._process_recommendations(
                user_id, ai_recommendations
            )
            
            # Cache recommendations
            self._cache_recommendations(user_id, processed_recommendations)
            
            logger.info(f"✅ Generated {len(processed_recommendations)} recommendations for user {user_id}")
            
            return {
                'success': True,
                'data': processed_recommendations,
                'cached': False
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to generate recommendations for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _gather_user_financial_data(self, user_id: str) -> Dict:
        """Gather comprehensive financial data for a user."""
        try:
            financial_data = {
                'user_id': user_id,
                'goals': [],
                'subaccounts': [],
                'transfer_rules': [],
                'transfer_history': [],
                'income_analysis': {},
                'spending_patterns': {},
                'account_balances': [],
                'recent_transactions': []
            }
            
            if not self.db:
                return {'success': False, 'error': 'Database not available'}
            
            # Get user goals
            goals_query = self.db.collection('goals').where('userId', '==', user_id)
            goals = []
            for doc in goals_query.stream():
                goal_data = doc.to_dict()
                goal_data['id'] = doc.id
                goals.append(goal_data)
            financial_data['goals'] = goals
            
            # Get subaccounts
            subaccounts_query = self.db.collection('goal_subaccounts').where('userId', '==', user_id)
            subaccounts = []
            for doc in subaccounts_query.stream():
                subaccount_data = doc.to_dict()
                subaccounts.append(subaccount_data)
            financial_data['subaccounts'] = subaccounts
            
            # Get transfer rules
            if self.transfer_engine:
                rules_result = self.transfer_engine.get_user_transfer_rules(user_id)
                if rules_result['success']:
                    financial_data['transfer_rules'] = rules_result['data']
                
                # Get transfer history
                history_result = self.transfer_engine.get_transfer_history(user_id, limit=50)
                if history_result['success']:
                    financial_data['transfer_history'] = history_result['data']
            
            # Get user bank accounts (if available)
            try:
                user_doc = self.db.collection('users').document(user_id).get()
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    basiq_user_id = user_data.get('basiq_user_id')
                    
                    if basiq_user_id and self.income_detector:
                        # This would normally get actual account data
                        # For now, use placeholder data
                        financial_data['account_balances'] = [
                            {'account_id': 'account_1', 'balance': 5000, 'type': 'checking'},
                            {'account_id': 'account_2', 'balance': 15000, 'type': 'savings'}
                        ]
            except Exception as e:
                logger.warning(f"Could not get account data: {e}")
            
            return {
                'success': True,
                'data': financial_data
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to gather financial data: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _generate_ai_recommendations(self, user_id: str, financial_data: Dict) -> List[Dict]:
        """Generate AI-powered recommendations using Claude."""
        try:
            if not self.claude_client:
                return self._generate_fallback_recommendations(financial_data)
            
            # Prepare data summary for Claude
            data_summary = self._prepare_data_for_claude(financial_data)
            
            # Claude prompt for savings analysis
            prompt = f"""
            As a financial advisor AI, analyze this user's financial situation and provide personalized savings recommendations.

            User Financial Data:
            {json.dumps(data_summary, indent=2)}

            Please provide 5-8 specific, actionable recommendations in the following JSON format:
            {{
                "recommendations": [
                    {{
                        "type": "transfer_optimization|goal_prioritization|emergency_fund|debt_management|seasonal_adjustment|opportunity_alert|spending_optimization|investment_suggestion",
                        "title": "Brief recommendation title",
                        "description": "Detailed description of the recommendation",
                        "reasoning": "Why this recommendation makes sense for this user",
                        "action_items": ["Specific action 1", "Specific action 2"],
                        "potential_savings": 150.50,
                        "urgency": "low|medium|high|critical",
                        "confidence_score": 0.85
                    }}
                ]
            }}

            Focus on:
            1. Transfer amount optimization based on income patterns
            2. Goal prioritization (emergency fund first, then other goals)
            3. Identifying savings opportunities from spending patterns
            4. Seasonal adjustments for holidays/expenses
            5. Debt vs savings balance recommendations

            Make recommendations specific, actionable, and personalized to this user's situation.
            """
            
            # Get Claude's response
            response = await self.claude_client.get_completion(prompt)
            
            if response and response.get('success'):
                try:
                    # Parse Claude's JSON response
                    ai_response = json.loads(response['content'])
                    return ai_response.get('recommendations', [])
                except json.JSONDecodeError:
                    logger.warning("Claude response was not valid JSON, using fallback")
                    return self._generate_fallback_recommendations(financial_data)
            else:
                logger.warning("Claude request failed, using fallback recommendations")
                return self._generate_fallback_recommendations(financial_data)
                
        except Exception as e:
            logger.error(f"❌ Failed to generate AI recommendations: {str(e)}")
            return self._generate_fallback_recommendations(financial_data)
    
    def _prepare_data_for_claude(self, financial_data: Dict) -> Dict:
        """Prepare financial data summary for Claude analysis."""
        summary = {
            'goals_summary': {
                'total_goals': len(financial_data.get('goals', [])),
                'goals': []
            },
            'savings_summary': {
                'total_subaccounts': len(financial_data.get('subaccounts', [])),
                'total_saved': 0,
                'monthly_transfers': 0
            },
            'transfer_activity': {
                'active_rules': len([r for r in financial_data.get('transfer_rules', []) if r.get('is_active')]),
                'recent_success_rate': 0,
                'avg_transfer_amount': 0
            }
        }
        
        # Summarize goals
        for goal in financial_data.get('goals', []):
            progress = (goal.get('currentAmount', 0) / goal.get('targetAmount', 1)) * 100
            summary['goals_summary']['goals'].append({
                'name': goal.get('name'),
                'target': goal.get('targetAmount'),
                'current': goal.get('currentAmount'),
                'progress': round(progress, 1),
                'due_date': goal.get('dueDate'),
                'has_direct_debit': bool(goal.get('directDebit', {}).get('isEnabled'))
            })
        
        # Summarize subaccounts
        for subaccount in financial_data.get('subaccounts', []):
            balance = subaccount.get('balance', {}).get('current', 0)
            summary['savings_summary']['total_saved'] += balance
        
        # Summarize transfer history
        transfers = financial_data.get('transfer_history', [])
        if transfers:
            successful_transfers = [t for t in transfers if t.get('status') == 'completed']
            if successful_transfers:
                summary['transfer_activity']['recent_success_rate'] = len(successful_transfers) / len(transfers) * 100
                summary['transfer_activity']['avg_transfer_amount'] = sum(t.get('amount', 0) for t in successful_transfers) / len(successful_transfers)
        
        return summary
    
    def _generate_fallback_recommendations(self, financial_data: Dict) -> List[Dict]:
        """Generate basic recommendations when Claude is not available."""
        recommendations = []
        
        goals = financial_data.get('goals', [])
        subaccounts = financial_data.get('subaccounts', [])
        transfer_rules = financial_data.get('transfer_rules', [])
        
        # Emergency fund recommendation
        has_emergency_goal = any('emergency' in goal.get('name', '').lower() for goal in goals)
        if not has_emergency_goal:
            recommendations.append({
                'type': 'emergency_fund',
                'title': 'Create Emergency Fund Goal',
                'description': 'Establish an emergency fund to cover 3-6 months of expenses before focusing on other savings goals.',
                'reasoning': 'Emergency funds provide financial security and should be the foundation of any savings strategy.',
                'action_items': [
                    'Create a new emergency fund goal',
                    'Set target amount to 3-6 months of expenses',
                    'Set up automated transfers to build it gradually'
                ],
                'potential_savings': 500,
                'urgency': 'high',
                'confidence_score': 0.9
            })
        
        # Transfer optimization
        if transfer_rules:
            avg_amount = sum(r.get('amount', 0) for r in transfer_rules) / len(transfer_rules)
            if avg_amount < 200:
                recommendations.append({
                    'type': 'transfer_optimization',
                    'title': 'Increase Transfer Amounts',
                    'description': 'Your current transfer amounts are relatively low. Consider increasing them to accelerate goal achievement.',
                    'reasoning': 'Higher transfer amounts will help you reach your goals faster and build better saving habits.',
                    'action_items': [
                        'Review your current transfer amounts',
                        'Consider increasing by 10-20%',
                        'Monitor your budget to ensure sustainability'
                    ],
                    'potential_savings': avg_amount * 0.2,
                    'urgency': 'medium',
                    'confidence_score': 0.7
                })
        
        # Goal prioritization
        if len(goals) > 3:
            recommendations.append({
                'type': 'goal_prioritization',
                'title': 'Focus on Priority Goals',
                'description': 'You have multiple goals. Consider focusing on 2-3 high-priority goals to achieve them faster.',
                'reasoning': 'Spreading savings across too many goals can slow progress. Focus creates momentum.',
                'action_items': [
                    'Rank your goals by importance',
                    'Focus transfers on top 2-3 goals',
                    'Pause or reduce transfers to lower priority goals'
                ],
                'potential_savings': 0,
                'urgency': 'medium',
                'confidence_score': 0.8
            })
        
        return recommendations
    
    def _process_recommendations(self, user_id: str, ai_recommendations: List[Dict]) -> List[SavingsRecommendation]:
        """Process and validate AI recommendations."""
        processed = []
        
        for i, rec in enumerate(ai_recommendations):
            try:
                # Validate recommendation data
                if not self._validate_recommendation(rec):
                    continue
                
                # Create recommendation object
                recommendation = SavingsRecommendation(
                    id=f"rec_{user_id}_{datetime.now().strftime('%Y%m%d')}_{i}",
                    user_id=user_id,
                    type=RecommendationType(rec.get('type')),
                    title=rec.get('title', ''),
                    description=rec.get('description', ''),
                    reasoning=rec.get('reasoning', ''),
                    action_items=rec.get('action_items', []),
                    potential_savings=float(rec.get('potential_savings', 0)),
                    urgency=UrgencyLevel(rec.get('urgency', 'medium')),
                    confidence_score=float(rec.get('confidence_score', 0.5)),
                    created_at=datetime.now(),
                    metadata=rec.get('metadata', {})
                )
                
                # Only include high-confidence recommendations
                if recommendation.confidence_score >= self.min_confidence_threshold:
                    processed.append(recommendation)
                    
            except Exception as e:
                logger.warning(f"Failed to process recommendation {i}: {e}")
                continue
        
        # Sort by urgency and confidence
        processed.sort(key=lambda x: (x.urgency.value, -x.confidence_score))
        
        # Limit to max recommendations
        return processed[:self.max_recommendations_per_user]
    
    def _validate_recommendation(self, rec: Dict) -> bool:
        """Validate a recommendation structure."""
        required_fields = ['type', 'title', 'description', 'reasoning', 'action_items', 'urgency']
        
        for field in required_fields:
            if field not in rec or not rec[field]:
                return False
        
        # Validate enum values
        try:
            RecommendationType(rec['type'])
            UrgencyLevel(rec['urgency'])
        except ValueError:
            return False
        
        return True
    
    # ==================== CACHING AND STORAGE ====================
    
    def _get_cached_recommendations(self, user_id: str) -> Optional[List[Dict]]:
        """Get cached recommendations for a user."""
        try:
            if not self.db:
                return None
            
            # Check for recent cached recommendations
            cutoff_time = datetime.now() - timedelta(hours=self.recommendation_cache_hours)
            
            query = (self.db.collection('savings_recommendations')
                    .where('user_id', '==', user_id)
                    .where('created_at', '>=', cutoff_time.isoformat())
                    .order_by('created_at', direction='DESCENDING')
                    .limit(self.max_recommendations_per_user))
            
            recommendations = []
            for doc in query.stream():
                rec_data = doc.to_dict()
                recommendations.append(rec_data)
            
            return recommendations if recommendations else None
            
        except Exception as e:
            logger.error(f"❌ Failed to get cached recommendations: {str(e)}")
            return None
    
    def _cache_recommendations(self, user_id: str, recommendations: List[SavingsRecommendation]):
        """Cache recommendations in the database."""
        try:
            if not self.db:
                return
            
            # Clear old recommendations for this user
            self._clear_old_recommendations(user_id)
            
            # Save new recommendations
            for rec in recommendations:
                rec_dict = self._recommendation_to_dict(rec)
                self.db.collection('savings_recommendations').document(rec.id).set(rec_dict)
            
            logger.info(f"✅ Cached {len(recommendations)} recommendations for user {user_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to cache recommendations: {str(e)}")
    
    def _clear_old_recommendations(self, user_id: str):
        """Clear old recommendations for a user."""
        try:
            # Delete recommendations older than cache period
            cutoff_time = datetime.now() - timedelta(hours=self.recommendation_cache_hours * 2)
            
            old_recs_query = (self.db.collection('savings_recommendations')
                             .where('user_id', '==', user_id)
                             .where('created_at', '<', cutoff_time.isoformat()))
            
            for doc in old_recs_query.stream():
                doc.reference.delete()
                
        except Exception as e:
            logger.error(f"❌ Failed to clear old recommendations: {str(e)}")
    
    def _recommendation_to_dict(self, rec: SavingsRecommendation) -> Dict:
        """Convert recommendation to dictionary for storage."""
        return {
            'id': rec.id,
            'user_id': rec.user_id,
            'type': rec.type.value,
            'title': rec.title,
            'description': rec.description,
            'reasoning': rec.reasoning,
            'action_items': rec.action_items,
            'potential_savings': rec.potential_savings,
            'urgency': rec.urgency.value,
            'confidence_score': rec.confidence_score,
            'expires_at': rec.expires_at.isoformat() if rec.expires_at else None,
            'metadata': rec.metadata,
            'created_at': rec.created_at.isoformat() if rec.created_at else None,
            'is_implemented': rec.is_implemented
        }
    
    # ==================== OPPORTUNITY DETECTION ====================
    
    def detect_savings_opportunities(self, user_id: str) -> Dict:
        """Detect immediate savings opportunities for a user."""
        try:
            opportunities = []
            
            if self.transfer_engine:
                # Get user transfer rules and history
                rules_result = self.transfer_engine.get_user_transfer_rules(user_id)
                if rules_result['success']:
                    rules = rules_result['data']
                    
                    # Check for inactive rules
                    inactive_rules = [r for r in rules if not r.get('is_active')]
                    if inactive_rules:
                        opportunities.append({
                            'type': 'inactive_transfers',
                            'title': 'Reactivate Paused Transfers',
                            'description': f'You have {len(inactive_rules)} paused transfer rules',
                            'action': 'Review and reactivate beneficial transfer rules',
                            'potential_savings': sum(r.get('amount', 0) for r in inactive_rules)
                        })
                    
                    # Check for low transfer amounts
                    low_amount_rules = [r for r in rules if r.get('is_active') and r.get('amount', 0) < 50]
                    if low_amount_rules:
                        opportunities.append({
                            'type': 'low_transfers',
                            'title': 'Increase Small Transfers',
                            'description': f'{len(low_amount_rules)} transfers could be increased',
                            'action': 'Consider increasing small transfer amounts',
                            'potential_savings': len(low_amount_rules) * 25
                        })
            
            return {
                'success': True,
                'data': opportunities
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to detect opportunities: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    # ==================== RECOMMENDATION ACTIONS ====================
    
    def mark_recommendation_implemented(self, recommendation_id: str, user_id: str) -> Dict:
        """Mark a recommendation as implemented."""
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not available'}
            
            # Update recommendation status
            rec_ref = self.db.collection('savings_recommendations').document(recommendation_id)
            rec_doc = rec_ref.get()
            
            if not rec_doc.exists:
                return {'success': False, 'error': 'Recommendation not found'}
            
            rec_data = rec_doc.to_dict()
            if rec_data.get('user_id') != user_id:
                return {'success': False, 'error': 'Unauthorized'}
            
            rec_ref.update({
                'is_implemented': True,
                'implemented_at': datetime.now().isoformat()
            })
            
            logger.info(f"✅ Marked recommendation {recommendation_id} as implemented")
            
            return {'success': True}
            
        except Exception as e:
            logger.error(f"❌ Failed to mark recommendation implemented: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_user_recommendations(self, user_id: str, include_implemented: bool = False) -> Dict:
        """Get all recommendations for a user."""
        try:
            if not self.db:
                return {'success': False, 'error': 'Database not available'}
            
            query = self.db.collection('savings_recommendations').where('user_id', '==', user_id)
            
            if not include_implemented:
                query = query.where('is_implemented', '==', False)
            
            query = query.order_by('created_at', direction='DESCENDING').limit(20)
            
            recommendations = []
            for doc in query.stream():
                rec_data = doc.to_dict()
                recommendations.append(rec_data)
            
            return {
                'success': True,
                'data': recommendations
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get user recommendations: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


# Global savings advisor instance
savings_advisor = None

def init_savings_advisor(app):
    """Initialize the global savings advisor with Flask app."""
    global savings_advisor
    savings_advisor = SavingsAdvisor(app)
    return savings_advisor

def get_savings_advisor():
    """Get the global savings advisor instance."""
    return savings_advisor 