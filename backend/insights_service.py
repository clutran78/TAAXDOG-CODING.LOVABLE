"""
TAAXDOG Insights Service
Centralized service for financial insights, analytics, and recommendations.
Integrates AI-powered analysis with business intelligence for actionable insights.
"""

import sys
import os
from pathlib import Path

# Add project paths for imports
project_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "src"))
sys.path.insert(0, str(project_root / "backend"))
sys.path.insert(0, str(project_root / "database"))

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from collections import defaultdict

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import Claude client for enhanced financial analysis
try:
    from integrations.claude_client import get_claude_client
    claude_available = True
    logger.info("Claude client available for enhanced financial insights")
except ImportError:
    claude_available = False
    logger.warning("Claude client not available - using fallback analysis")

# Helper functions to replace numpy functionality
def mean(values):
    """Calculate mean without numpy"""
    return sum(values) / len(values) if values else 0

def median(values):
    """Calculate median without numpy"""
    if not values:
        return 0
    sorted_values = sorted(values)
    n = len(sorted_values)
    if n % 2 == 0:
        return (sorted_values[n//2 - 1] + sorted_values[n//2]) / 2
    else:
        return sorted_values[n//2]

def std(values):
    """Calculate standard deviation without numpy"""
    if len(values) < 2:
        return 0
    avg = mean(values)
    variance = sum((x - avg) ** 2 for x in values) / len(values)
    return variance ** 0.5

def var(values):
    """Calculate variance without numpy"""
    if len(values) < 2:
        return 0
    avg = mean(values)
    return sum((x - avg) ** 2 for x in values) / len(values)

class InsightsServiceError(Exception):
    """Custom exception for insights service errors"""
    pass

@dataclass
class InsightRequest:
    """Request object for insight generation"""
    user_id: str
    period: str = 'monthly'  # weekly, monthly, quarterly, yearly
    include_receipts: bool = True
    include_tax_analysis: bool = True
    include_ml_predictions: bool = True
    confidence_threshold: float = 0.7
    categories: Optional[List[str]] = None

@dataclass
class InsightResponse:
    """Response object containing generated insights"""
    insights: List[Dict[str, Any]]
    summary: Dict[str, Any]
    metadata: Dict[str, Any]
    status: str
    generated_at: str

class FinancialInsightsService:
    """
    Centralized financial insights service
    Provides comprehensive financial analysis, recommendations, and business intelligence
    """
    
    def __init__(self):
        """Initialize the insights service with all required engines"""
        try:
            # Initialize engines with graceful fallbacks
            self.financial_engine = None
            self.smart_engine = None
            self.ml_analytics = None
            
            # Try to import and initialize engines
            try:
                from ai.financial_insights import FinancialInsightsEngine
                self.financial_engine = FinancialInsightsEngine()
                logger.info("Financial insights engine initialized")
            except ImportError as e:
                logger.warning(f"Could not import financial insights engine: {e}")
            
            try:
                from backend.smart_insights import SmartInsightsEngine
                self.smart_engine = SmartInsightsEngine()
                logger.info("Smart insights engine initialized")
            except ImportError as e:
                logger.warning(f"Could not import smart insights engine: {e}")
            
            try:
                from backend.ml_analytics import MLAnalytics
                self.ml_analytics = MLAnalytics()
                logger.info("ML analytics engine initialized")
            except ImportError as e:
                logger.warning(f"Could not import ML analytics: {e}")
                
            logger.info("Financial Insights Service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize insights service: {e}")
            # Don't raise exception - allow service to work with available components

    def generate_comprehensive_insights(self, request: InsightRequest) -> InsightResponse:
        """
        Generate comprehensive financial insights for a user
        Combines AI analysis, smart insights, and ML predictions
        """
        try:
            logger.info(f"Generating comprehensive insights for user: {request.user_id}")
            
            # Validate request
            if not request.user_id:
                raise InsightsServiceError("User ID is required")
            
            # Fetch user data
            user_data = self._fetch_user_data(request)
            if not user_data.get('transactions'):
                return self._create_empty_response("No transaction data available")
            
            # Generate insights from different engines
            insights = []
            
            # 1. AI-powered transaction analysis
            if self.financial_engine and user_data.get('transactions'):
                ai_insights = self._generate_ai_insights(request, user_data)
                insights.extend(ai_insights)
            
            # 2. Smart business insights
            if self.smart_engine:
                try:
                    smart_insights = self.smart_engine.generate_comprehensive_insights(
                        request.user_id, self._get_period_months(request.period)
                    )
                    insights.extend([asdict(insight) for insight in smart_insights])
                except Exception as e:
                    logger.warning(f"Could not generate smart insights: {e}")
            
            # 3. ML-powered predictions and analysis
            if request.include_ml_predictions and self.ml_analytics and user_data.get('transactions'):
                ml_insights = self._generate_ml_insights(request, user_data)
                insights.extend(ml_insights)
            
            # 4. Tax deduction analysis
            if request.include_tax_analysis:
                tax_insights = self._generate_tax_insights(request, user_data)
                insights.extend(tax_insights)
            
            # Filter by confidence threshold
            filtered_insights = [
                insight for insight in insights
                if insight.get('confidence_score', 0) >= request.confidence_threshold
            ]
            
            # Generate summary statistics
            summary = self._generate_summary(filtered_insights, user_data)
            
            # Create metadata
            metadata = {
                'user_id': request.user_id,
                'request_period': request.period,
                'total_insights': len(filtered_insights),
                'data_sources': self._get_data_sources(user_data),
                'confidence_threshold': request.confidence_threshold,
                'generated_at': datetime.now().isoformat()
            }
            
            return InsightResponse(
                insights=filtered_insights,
                summary=summary,
                metadata=metadata,
                status='success',
                generated_at=datetime.now().isoformat()
            )
            
        except Exception as e:
            logger.error(f"Error generating comprehensive insights: {e}")
            raise InsightsServiceError(f"Failed to generate insights: {e}")

    def generate_claude_enhanced_insights(self, user_id: str, transactions: List[Dict], user_profile: Dict) -> Dict[str, Any]:
        """
        Generate Claude-powered financial insights with advanced AI analysis
        
        Args:
            user_id: User identifier
            transactions: User's transaction history
            user_profile: User's financial profile
            
        Returns:
            Dict containing Claude-enhanced financial analysis
        """
        try:
            if not claude_available:
                logger.info("Claude not available, using fallback analysis")
                return self._generate_fallback_insights(transactions, user_profile)
            
            claude_client = get_claude_client()
            if not claude_client:
                logger.warning("Failed to get Claude client instance")
                return self._generate_fallback_insights(transactions, user_profile)
            
            logger.info(f"Generating Claude-enhanced insights for user: {user_id}")
            
            # Use Claude for comprehensive financial analysis
            claude_result = claude_client.analyze_financial_data(transactions, user_profile)
            
            if claude_result.get("success"):
                analysis = claude_result.get("analysis", {})
                
                # Enhance with additional TAAXDOG-specific insights
                enhanced_insights = {
                    "claude_analysis": analysis,
                    "insights_type": "claude_enhanced",
                    "generated_by": "claude-3.7-sonnet",
                    "user_id": user_id,
                    "analysis_timestamp": datetime.now().isoformat(),
                    "data_points_analyzed": len(transactions),
                    
                    # Core financial insights
                    "spending_insights": analysis.get("spending_analysis", {}),
                    "tax_insights": analysis.get("tax_optimization", {}),
                    "budget_insights": analysis.get("budget_recommendations", {}),
                    "risk_insights": analysis.get("risk_assessment", {}),
                    "goal_suggestions": analysis.get("goals_suggestions", []),
                    
                    # Enhanced insights
                    "key_findings": analysis.get("insights", []),
                    "action_items": analysis.get("action_items", []),
                    "confidence_score": analysis.get("confidence_score", 0.8),
                    
                    # Australian tax specific
                    "ato_compliance_score": analysis.get("tax_optimization", {}).get("compliance_score", 0),
                    "potential_deductions": analysis.get("tax_optimization", {}).get("potential_deductions", 0),
                    
                    # Performance metadata
                    "processing_metadata": claude_result.get("analysis", {}).get("processing_metadata", {})
                }
                
                logger.info(f"Claude analysis completed successfully for user: {user_id}")
                return enhanced_insights
            else:
                logger.warning(f"Claude analysis failed: {claude_result.get('error')}")
                return self._generate_fallback_insights(transactions, user_profile)
                
        except Exception as e:
            logger.error(f"Error in Claude-enhanced insights generation: {e}")
            return self._generate_fallback_insights(transactions, user_profile)

    def _generate_fallback_insights(self, transactions: List[Dict], user_profile: Dict) -> Dict[str, Any]:
        """
        Generate basic insights when Claude is not available
        """
        try:
            # Basic spending analysis
            amounts = [float(t.get('amount', 0)) for t in transactions if t.get('amount')]
            total_spending = sum(amounts)
            avg_spending = total_spending / len(amounts) if amounts else 0
            
            # Category analysis
            categories = {}
            for transaction in transactions:
                category = transaction.get('category', 'Unknown')
                categories[category] = categories.get(category, 0) + abs(float(transaction.get('amount', 0)))
            
            top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]
            
            return {
                "insights_type": "fallback_analysis",
                "generated_by": "taaxdog_basic",
                "spending_insights": {
                    "total_spending": total_spending,
                    "average_transaction": avg_spending,
                    "top_categories": [{"category": cat, "amount": amt} for cat, amt in top_categories],
                    "transaction_count": len(transactions)
                },
                "budget_insights": {
                    "suggested_monthly_budget": avg_spending * 1.1,  # 10% buffer
                    "optimization_opportunities": [
                        "Review top spending categories for potential savings",
                        "Consider setting up automatic savings transfers"
                    ]
                },
                "risk_insights": {
                    "financial_health_score": 65,  # Default moderate score
                    "alerts": ["Consider upgrading to premium for AI-powered insights"]
                },
                "confidence_score": 0.6,  # Lower confidence for basic analysis
                "generated_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in fallback insights generation: {e}")
            return {
                "insights_type": "error",
                "error": str(e),
                "generated_at": datetime.now().isoformat()
            }

    def get_spending_insights(self, user_id: str, period: str = 'monthly') -> Dict[str, Any]:
        """
        Get detailed spending pattern analysis
        Focuses specifically on spending behavior and trends
        """
        try:
            request = InsightRequest(user_id=user_id, period=period)
            user_data = self._fetch_user_data(request)
            
            if not user_data.get('transactions'):
                return {'error': 'No transaction data available'}
            
            # Analyze spending patterns
            spending_analysis = {}
            if self.financial_engine:
                spending_analysis = self.financial_engine.analyze_transactions(
                    user_data['transactions'],
                    user_data.get('profile')
                )
            
            # Calculate additional spending metrics
            spending_metrics = self._calculate_spending_metrics(user_data['transactions'])
            
            # Identify spending anomalies
            anomalies = self._detect_spending_anomalies(user_data['transactions'])
            
            return {
                'analysis': spending_analysis,
                'metrics': spending_metrics,
                'anomalies': anomalies,
                'period': period,
                'transaction_count': len(user_data['transactions']),
                'generated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating spending insights: {e}")
            return {'error': f'Failed to analyze spending: {e}'}

    def get_tax_optimization_insights(self, user_id: str, tax_year: str = None) -> Dict[str, Any]:
        """
        Get comprehensive tax optimization recommendations
        Analyzes transactions and receipts for Australian tax compliance
        """
        try:
            # Use yearly period for tax analysis
            request = InsightRequest(
                user_id=user_id,
                period='yearly',
                include_tax_analysis=True
            )
            user_data = self._fetch_user_data(request)
            
            if not user_data.get('transactions'):
                return {'error': 'No transaction data available for tax analysis'}
            
            # Identify potential deductions
            deductions = []
            if self.financial_engine:
                deductions = self.financial_engine.identify_tax_deductions(
                    user_data['transactions'],
                    user_data.get('receipts', [])
                )
            
            # Generate tax optimization insights
            tax_insights = []
            if self.smart_engine:
                try:
                    tax_insights = self.smart_engine._generate_tax_optimization_insights(
                        user_id, user_data
                    )
                except Exception as e:
                    logger.warning(f"Could not generate tax insights: {e}")
            
            # Calculate tax metrics
            tax_metrics = self._calculate_tax_metrics(user_data, deductions)
            
            return {
                'deductions': deductions,
                'insights': [asdict(insight) for insight in tax_insights],
                'metrics': tax_metrics,
                'tax_year': tax_year or str(datetime.now().year),
                'generated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating tax insights: {e}")
            return {'error': f'Failed to analyze tax optimization: {e}'}

    def get_budget_recommendations(self, user_id: str) -> Dict[str, Any]:
        """
        Generate personalized budget recommendations
        Based on spending patterns and financial goals
        """
        try:
            request = InsightRequest(user_id=user_id, period='monthly')
            user_data = self._fetch_user_data(request)
            
            if not user_data.get('transactions'):
                return {'error': 'No transaction data available for budget analysis'}
            
            # Generate budget recommendations
            budget_insights = []
            if self.smart_engine:
                try:
                    budget_insights = self.smart_engine._create_budget_recommendations(
                        user_id, user_data
                    )
                except Exception as e:
                    logger.warning(f"Could not generate budget insights: {e}")
            
            # Calculate current spending by category
            category_spending = self._calculate_category_spending(user_data['transactions'])
            
            # Suggest budget allocations
            budget_allocations = self._suggest_budget_allocations(
                category_spending, user_data.get('profile', {})
            )
            
            return {
                'recommendations': [asdict(insight) for insight in budget_insights],
                'current_spending': category_spending,
                'suggested_allocations': budget_allocations,
                'generated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating budget recommendations: {e}")
            return {'error': f'Failed to generate budget recommendations: {e}'}

    def get_financial_goals_suggestions(self, user_id: str) -> Dict[str, Any]:
        """
        Generate SMART financial goals based on user's financial situation
        Provides actionable, time-bound financial objectives
        """
        try:
            request = InsightRequest(user_id=user_id, period='quarterly')
            user_data = self._fetch_user_data(request)
            
            if not user_data.get('transactions'):
                return {'error': 'No financial data available for goal suggestions'}
            
            # Generate goal suggestions using AI engine
            goal_suggestions = []
            if self.financial_engine:
                goal_suggestions = self.financial_engine.suggest_financial_goals(
                    user_data['transactions'], user_id
                )
            
            # Calculate financial capacity for goals
            financial_capacity = self._calculate_financial_capacity(user_data)
            
            # Prioritize goals based on user's situation
            prioritized_goals = self._prioritize_goals(goal_suggestions, financial_capacity)
            
            return {
                'suggested_goals': prioritized_goals,
                'financial_capacity': financial_capacity,
                'existing_goals': user_data.get('goals', []),
                'generated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating goal suggestions: {e}")
            return {'error': f'Failed to suggest financial goals: {e}'}

    def get_risk_assessment(self, user_id: str) -> Dict[str, Any]:
        """
        Assess financial risks and provide alerts
        Analyzes spending patterns, cash flow, and compliance risks
        """
        try:
            request = InsightRequest(user_id=user_id, period='quarterly')
            user_data = self._fetch_user_data(request)
            
            if not user_data.get('transactions'):
                return {'error': 'No data available for risk assessment'}
            
            # Generate audit risk assessment
            audit_risks = []
            if self.smart_engine:
                try:
                    audit_risks = self.smart_engine._assess_audit_risks(user_id, user_data)
                except Exception as e:
                    logger.warning(f"Could not assess audit risks: {e}")
            
            # Assess cash flow risks
            cash_flow_risks = self._assess_cash_flow_risks(user_data['transactions'])
            
            # Assess spending risks
            spending_risks = self._assess_spending_risks(user_data['transactions'])
            
            # Calculate overall risk score
            overall_risk_score = self._calculate_overall_risk_score(
                audit_risks, cash_flow_risks, spending_risks
            )
            
            return {
                'overall_risk_score': overall_risk_score,
                'audit_risks': [asdict(risk) for risk in audit_risks],
                'cash_flow_risks': cash_flow_risks,
                'spending_risks': spending_risks,
                'recommendations': self._generate_risk_mitigation_recommendations(
                    overall_risk_score, audit_risks, cash_flow_risks, spending_risks
                ),
                'generated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating risk assessment: {e}")
            return {'error': f'Failed to assess financial risks: {e}'}

    # Private helper methods

    def _fetch_user_data(self, request: InsightRequest) -> Dict[str, Any]:
        """Fetch comprehensive user data for analysis"""
        data = {}
        
        try:
            # Calculate date range
            end_date = datetime.now()
            period_months = self._get_period_months(request.period)
            start_date = end_date - timedelta(days=period_months * 30)
            
            # Try to get transactions from BASIQ
            try:
                from backend.basiq_api import get_user_transactions
                filter_str = f"transaction.postDate.gte={start_date.isoformat()}&transaction.postDate.lte={end_date.isoformat()}"
                transactions_result = get_user_transactions(request.user_id, filter_str)
                
                if transactions_result.get('success'):
                    data['transactions'] = transactions_result.get('transactions', {}).get('data', [])
                else:
                    data['transactions'] = []
            except ImportError:
                logger.warning("BASIQ API not available")
                data['transactions'] = []
            
            # Try to get user data from Firebase
            try:
                from backend.firebase_config import db
                if db:
                    # User profile
                    user_ref = db.collection('users').document(request.user_id)
                    user_doc = user_ref.get()
                    if user_doc.exists:
                        data['profile'] = user_doc.to_dict()
                    
                    # Tax profile
                    tax_profile_ref = db.collection('taxProfiles').where('userId', '==', request.user_id).get()
                    if tax_profile_ref:
                        data['tax_profile'] = tax_profile_ref[0].to_dict()
                    
                    # Goals
                    goals_ref = db.collection('goals').where('userId', '==', request.user_id).get()
                    data['goals'] = [doc.to_dict() for doc in goals_ref]
                    
                    # Receipts (if requested)
                    if request.include_receipts:
                        receipts_ref = db.collection('receipts').where('userId', '==', request.user_id).get()
                        data['receipts'] = [doc.to_dict() for doc in receipts_ref]
                    
                    # Subscriptions
                    subs_ref = db.collection('subscriptions').where('userId', '==', request.user_id).get()
                    data['subscriptions'] = [doc.to_dict() for doc in subs_ref]
            except ImportError:
                logger.warning("Firebase not available")
            
        except Exception as e:
            logger.error(f"Error fetching user data: {e}")
            
        return data

    def _generate_ai_insights(self, request: InsightRequest, user_data: Dict) -> List[Dict]:
        """Generate insights using the AI financial engine"""
        insights = []
        
        try:
            if not self.financial_engine:
                return insights
                
            # Transaction analysis
            analysis = self.financial_engine.analyze_transactions(
                user_data['transactions'],
                user_data.get('profile')
            )
            
            if 'error' not in analysis:
                insights.append({
                    'id': f"ai_analysis_{request.user_id}_{datetime.now().timestamp()}",
                    'type': 'transaction_analysis',
                    'priority': 'medium',
                    'title': 'AI Transaction Analysis',
                    'description': 'Comprehensive analysis of spending patterns using AI',
                    'data': analysis,
                    'confidence_score': 0.85,
                    'created_at': datetime.now().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Error generating AI insights: {e}")
            
        return insights

    def _generate_ml_insights(self, request: InsightRequest, user_data: Dict) -> List[Dict]:
        """Generate insights using ML analytics"""
        insights = []
        
        try:
            if not self.ml_analytics:
                return insights
                
            # Spending pattern prediction
            spending_prediction = self.ml_analytics.predict_spending_patterns(
                user_data['transactions']
            )
            
            if spending_prediction:
                insights.append({
                    'id': f"ml_spending_{request.user_id}_{datetime.now().timestamp()}",
                    'type': 'spending_prediction',
                    'priority': 'high',
                    'title': 'ML Spending Prediction',
                    'description': 'Machine learning based spending pattern prediction',
                    'data': spending_prediction,
                    'confidence_score': 0.8,
                    'created_at': datetime.now().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Error generating ML insights: {e}")
            
        return insights

    def _generate_tax_insights(self, request: InsightRequest, user_data: Dict) -> List[Dict]:
        """Generate tax-related insights"""
        insights = []
        
        try:
            if not self.financial_engine:
                return insights
                
            # Tax deduction analysis
            deductions = self.financial_engine.identify_tax_deductions(
                user_data['transactions'],
                user_data.get('receipts', [])
            )
            
            if deductions:
                total_deductions = sum(d.get('amount', 0) for d in deductions)
                insights.append({
                    'id': f"tax_deductions_{request.user_id}_{datetime.now().timestamp()}",
                    'type': 'tax_deductions',
                    'priority': 'high',
                    'title': 'Tax Deduction Opportunities',
                    'description': f'Found ${total_deductions:.2f} in potential tax deductions',
                    'data': {
                        'deductions': deductions,
                        'total_amount': total_deductions,
                        'deduction_count': len(deductions)
                    },
                    'confidence_score': 0.9,
                    'potential_savings': total_deductions * 0.3,  # Assume 30% tax rate
                    'created_at': datetime.now().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Error generating tax insights: {e}")
            
        return insights

    def _get_period_months(self, period: str) -> int:
        """Convert period string to number of months"""
        period_map = {
            'weekly': 0.25,
            'monthly': 1,
            'quarterly': 3,
            'yearly': 12
        }
        return int(period_map.get(period, 1) * 1)

    def _generate_summary(self, insights: List[Dict], user_data: Dict) -> Dict[str, Any]:
        """Generate summary statistics for insights"""
        if not insights:
            return {
                'total_insights': 0,
                'high_priority_count': 0,
                'potential_savings': 0,
                'average_confidence': 0
            }
        
        high_priority_count = len([i for i in insights if i.get('priority') == 'high'])
        total_savings = sum(i.get('potential_savings', 0) for i in insights)
        avg_confidence = mean([i.get('confidence_score', 0) for i in insights])
        
        return {
            'total_insights': len(insights),
            'high_priority_count': high_priority_count,
            'potential_savings': total_savings,
            'average_confidence': avg_confidence,
            'transaction_count': len(user_data.get('transactions', [])),
            'data_quality_score': self._calculate_data_quality_score(user_data)
        }

    def _get_data_sources(self, user_data: Dict) -> List[str]:
        """Identify available data sources"""
        sources = []
        if user_data.get('transactions'):
            sources.append('banking_transactions')
        if user_data.get('receipts'):
            sources.append('receipt_data')
        if user_data.get('profile'):
            sources.append('user_profile')
        if user_data.get('tax_profile'):
            sources.append('tax_profile')
        return sources

    def _create_empty_response(self, message: str) -> InsightResponse:
        """Create an empty response with a message"""
        return InsightResponse(
            insights=[],
            summary={'total_insights': 0, 'message': message},
            metadata={'generated_at': datetime.now().isoformat()},
            status='no_data',
            generated_at=datetime.now().isoformat()
        )

    def _calculate_spending_metrics(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Calculate detailed spending metrics"""
        if not transactions:
            return {}
        
        # Filter debit transactions (expenses)
        expenses = [t for t in transactions if t.get('direction') == 'debit']
        
        if not expenses:
            return {}
        
        amounts = [abs(float(t.get('amount', 0))) for t in expenses]
        
        return {
            'total_spending': sum(amounts),
            'average_transaction': mean(amounts),
            'median_transaction': median(amounts),
            'largest_transaction': max(amounts),
            'transaction_count': len(expenses),
            'spending_variance': var(amounts),
            'categories': self._get_top_expense_categories(expenses)
        }

    def _get_top_expense_categories(self, transactions: List[Dict]) -> List[Dict]:
        """Get top spending categories"""
        category_totals = defaultdict(float)
        
        for transaction in transactions:
            if transaction.get('direction') == 'debit':
                category = transaction.get('category', 'Other')
                amount = abs(float(transaction.get('amount', 0)))
                category_totals[category] += amount
        
        # Sort by amount and return top 5
        sorted_categories = sorted(
            category_totals.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]
        
        return [
            {'category': cat, 'amount': amount, 'percentage': 0}
            for cat, amount in sorted_categories
        ]

    def _detect_spending_anomalies(self, transactions: List[Dict]) -> List[Dict]:
        """Detect unusual spending patterns"""
        anomalies = []
        
        try:
            # Group transactions by day and calculate daily spending
            daily_spending = defaultdict(float)
            
            for transaction in transactions:
                if transaction.get('direction') == 'debit':
                    date_str = transaction.get('postDate', '')[:10]  # YYYY-MM-DD
                    amount = abs(float(transaction.get('amount', 0)))
                    daily_spending[date_str] += amount
            
            if len(daily_spending) < 7:  # Need at least a week of data
                return anomalies
            
            # Calculate statistics
            amounts = list(daily_spending.values())
            mean_spending = mean(amounts)
            std_spending = std(amounts)
            threshold = mean_spending + (2 * std_spending)  # 2 standard deviations
            
            # Find anomalous days
            for date, amount in daily_spending.items():
                if amount > threshold:
                    anomalies.append({
                        'date': date,
                        'amount': amount,
                        'threshold': threshold,
                        'deviation': amount - mean_spending,
                        'type': 'high_spending_day'
                    })
                    
        except Exception as e:
            logger.error(f"Error detecting spending anomalies: {e}")
            
        return anomalies

    def _calculate_tax_metrics(self, user_data: Dict, deductions: List[Dict]) -> Dict[str, Any]:
        """Calculate tax-related metrics"""
        total_deductions = sum(d.get('amount', 0) for d in deductions)
        total_income = self._estimate_annual_income(user_data['transactions'])
        
        return {
            'total_deductions': total_deductions,
            'deduction_count': len(deductions),
            'estimated_tax_savings': total_deductions * 0.3,  # Assume 30% tax rate
            'deduction_percentage': (total_deductions / total_income * 100) if total_income > 0 else 0,
            'compliance_score': self._calculate_compliance_score(user_data),
            'missing_receipts': self._identify_missing_receipts(user_data)
        }

    def _estimate_annual_income(self, transactions: List[Dict]) -> float:
        """Estimate annual income from transactions"""
        # Filter credit transactions (income)
        income_transactions = [
            t for t in transactions 
            if t.get('direction') == 'credit' and 
            t.get('category') not in ['Transfer', 'Refund']
        ]
        
        if not income_transactions:
            return 0
        
        monthly_income = sum(float(t.get('amount', 0)) for t in income_transactions)
        return monthly_income * 12  # Rough annual estimate

    def _calculate_compliance_score(self, user_data: Dict) -> float:
        """Calculate tax compliance score"""
        score = 0.5  # Base score
        
        # Add points for having receipts
        if user_data.get('receipts'):
            score += 0.2
        
        # Add points for having tax profile
        if user_data.get('tax_profile'):
            score += 0.2
        
        # Add points for organized transactions
        transactions = user_data.get('transactions', [])
        if transactions:
            categorized_count = len([t for t in transactions if t.get('category') != 'Other'])
            categorization_rate = categorized_count / len(transactions)
            score += categorization_rate * 0.1
        
        return min(score, 1.0)

    def _identify_missing_receipts(self, user_data: Dict) -> List[Dict]:
        """Identify transactions that might need receipts"""
        missing_receipts = []
        
        # Business-related categories that typically need receipts
        business_categories = [
            'Office Supplies', 'Travel', 'Meals & Entertainment',
            'Professional Services', 'Equipment', 'Software'
        ]
        
        transactions = user_data.get('transactions', [])
        receipts = user_data.get('receipts', [])
        
        # Create a set of receipt amounts for quick lookup
        receipt_amounts = {float(r.get('amount', 0)) for r in receipts}
        
        for transaction in transactions:
            if (transaction.get('category') in business_categories and
                transaction.get('direction') == 'debit'):
                
                amount = abs(float(transaction.get('amount', 0)))
                if amount not in receipt_amounts and amount > 10:  # Only flag amounts > $10
                    missing_receipts.append({
                        'transaction_id': transaction.get('id'),
                        'amount': amount,
                        'date': transaction.get('postDate'),
                        'category': transaction.get('category'),
                        'description': transaction.get('description', '')
                    })
        
        return missing_receipts[:10]  # Return top 10

    def _calculate_category_spending(self, transactions: List[Dict]) -> Dict[str, float]:
        """Calculate spending by category"""
        category_spending = defaultdict(float)
        
        for transaction in transactions:
            if transaction.get('direction') == 'debit':
                category = transaction.get('category', 'Other')
                amount = abs(float(transaction.get('amount', 0)))
                category_spending[category] += amount
        
        return dict(category_spending)

    def _suggest_budget_allocations(self, current_spending: Dict[str, float], profile: Dict) -> Dict[str, Dict]:
        """Suggest budget allocations based on spending patterns"""
        total_spending = sum(current_spending.values())
        
        # Default budget percentages (can be customized based on user profile)
        recommended_percentages = {
            'Housing': 0.30,
            'Food': 0.15,
            'Transportation': 0.15,
            'Utilities': 0.10,
            'Entertainment': 0.05,
            'Savings': 0.20,
            'Other': 0.05
        }
        
        suggestions = {}
        for category, current_amount in current_spending.items():
            recommended_percentage = recommended_percentages.get(category, 0.05)
            recommended_amount = total_spending * recommended_percentage
            
            suggestions[category] = {
                'current': current_amount,
                'recommended': recommended_amount,
                'difference': recommended_amount - current_amount,
                'percentage': recommended_percentage * 100
            }
        
        return suggestions

    def _calculate_financial_capacity(self, user_data: Dict) -> Dict[str, Any]:
        """Calculate user's financial capacity for goals"""
        transactions = user_data.get('transactions', [])
        
        # Calculate income and expenses
        monthly_income = self._calculate_monthly_income(transactions)
        monthly_expenses = self._calculate_monthly_expenses(transactions)
        monthly_surplus = monthly_income - monthly_expenses
        
        return {
            'monthly_income': monthly_income,
            'monthly_expenses': monthly_expenses,
            'monthly_surplus': monthly_surplus,
            'savings_rate': (monthly_surplus / monthly_income * 100) if monthly_income > 0 else 0,
            'available_for_goals': monthly_surplus * 0.8  # Conservative estimate
        }

    def _calculate_monthly_income(self, transactions: List[Dict]) -> float:
        """Calculate average monthly income"""
        income_transactions = [
            t for t in transactions 
            if t.get('direction') == 'credit' and 
            t.get('category') not in ['Transfer', 'Refund']
        ]
        
        if not income_transactions:
            return 0
        
        total_income = sum(float(t.get('amount', 0)) for t in income_transactions)
        months = self._get_transaction_months_span(transactions)
        
        return total_income / max(months, 1)

    def _calculate_monthly_expenses(self, transactions: List[Dict]) -> float:
        """Calculate average monthly expenses"""
        expense_transactions = [
            t for t in transactions 
            if t.get('direction') == 'debit'
        ]
        
        if not expense_transactions:
            return 0
        
        total_expenses = sum(abs(float(t.get('amount', 0))) for t in expense_transactions)
        months = self._get_transaction_months_span(transactions)
        
        return total_expenses / max(months, 1)

    def _get_transaction_months_span(self, transactions: List[Dict]) -> int:
        """Get the span of months covered by transactions"""
        if not transactions:
            return 1
        
        dates = [t.get('postDate', '') for t in transactions if t.get('postDate')]
        if not dates:
            return 1
        
        # Convert to month-year strings and count unique months
        months = set(date[:7] for date in dates if len(date) >= 7)  # YYYY-MM
        return max(len(months), 1)

    def _prioritize_goals(self, goals: List[Dict], capacity: Dict) -> List[Dict]:
        """Prioritize goals based on financial capacity and importance"""
        for goal in goals:
            # Calculate feasibility score
            monthly_requirement = goal.get('target_amount', 0) / max(goal.get('timeframe_months', 12), 1)
            available_monthly = capacity.get('available_for_goals', 0)
            
            feasibility = min(monthly_requirement / max(available_monthly, 1), 2.0) if available_monthly > 0 else 2.0
            
            # Calculate priority score (lower is better)
            importance = goal.get('importance', 5)  # 1-10 scale
            urgency = goal.get('urgency', 5)  # 1-10 scale
            
            priority_score = (feasibility * 0.4) + ((10 - importance) * 0.3) + ((10 - urgency) * 0.3)
            goal['priority_score'] = priority_score
            goal['feasibility'] = 'high' if feasibility < 1 else 'medium' if feasibility < 1.5 else 'low'
        
        # Sort by priority score (ascending)
        return sorted(goals, key=lambda x: x.get('priority_score', 10))

    def _assess_cash_flow_risks(self, transactions: List[Dict]) -> List[Dict]:
        """Assess cash flow related risks"""
        risks = []
        
        try:
            # Calculate monthly cash flow
            monthly_flows = self._calculate_monthly_cash_flows(transactions)
            
            if len(monthly_flows) < 3:
                return risks
            
            # Check for negative months
            negative_months = [month for month, flow in monthly_flows.items() if flow < 0]
            if len(negative_months) > len(monthly_flows) * 0.3:  # More than 30% negative months
                risks.append({
                    'type': 'frequent_negative_cash_flow',
                    'severity': 'high',
                    'description': f'Negative cash flow in {len(negative_months)} out of {len(monthly_flows)} months',
                    'months_affected': negative_months
                })
            
            # Check for volatility
            flows = list(monthly_flows.values())
            mean_flows = mean(flows)
            volatility = std(flows) / mean_flows if mean_flows != 0 else 0
            if volatility > 0.5:  # High volatility
                risks.append({
                    'type': 'high_cash_flow_volatility',
                    'severity': 'medium',
                    'description': f'High cash flow volatility (coefficient of variation: {volatility:.2f})',
                    'volatility_score': volatility
                })
                
        except Exception as e:
            logger.error(f"Error assessing cash flow risks: {e}")
            
        return risks

    def _calculate_monthly_cash_flows(self, transactions: List[Dict]) -> Dict[str, float]:
        """Calculate net cash flow by month"""
        monthly_flows = defaultdict(float)
        
        for transaction in transactions:
            date_str = transaction.get('postDate', '')
            if len(date_str) >= 7:
                month_key = date_str[:7]  # YYYY-MM
                amount = float(transaction.get('amount', 0))
                
                # Add for credits, subtract for debits
                if transaction.get('direction') == 'credit':
                    monthly_flows[month_key] += amount
                else:
                    monthly_flows[month_key] -= abs(amount)
        
        return dict(monthly_flows)

    def _assess_spending_risks(self, transactions: List[Dict]) -> List[Dict]:
        """Assess spending-related risks"""
        risks = []
        
        try:
            # Calculate spending trends
            monthly_spending = self._calculate_monthly_spending(transactions)
            
            if len(monthly_spending) < 3:
                return risks
            
            # Check for increasing trend
            spending_values = list(monthly_spending.values())
            if len(spending_values) >= 3:
                recent_avg = mean(spending_values[-3:])
                older_avg = mean(spending_values[:-3]) if len(spending_values) > 3 else spending_values[0]
                
                if recent_avg > older_avg * 1.2:  # 20% increase
                    risks.append({
                        'type': 'increasing_spending_trend',
                        'severity': 'medium',
                        'description': f'Spending increased by {((recent_avg/older_avg-1)*100):.1f}% in recent months',
                        'increase_percentage': (recent_avg/older_avg-1)*100
                    })
            
            # Check for large transactions
            large_transactions = [
                t for t in transactions 
                if t.get('direction') == 'debit' and abs(float(t.get('amount', 0))) > 1000
            ]
            
            if len(large_transactions) > len(transactions) * 0.1:  # More than 10% large transactions
                risks.append({
                    'type': 'frequent_large_transactions',
                    'severity': 'low',
                    'description': f'{len(large_transactions)} large transactions (>$1000) detected',
                    'large_transaction_count': len(large_transactions)
                })
                
        except Exception as e:
            logger.error(f"Error assessing spending risks: {e}")
            
        return risks

    def _calculate_monthly_spending(self, transactions: List[Dict]) -> Dict[str, float]:
        """Calculate total spending by month"""
        monthly_spending = defaultdict(float)
        
        for transaction in transactions:
            if transaction.get('direction') == 'debit':
                date_str = transaction.get('postDate', '')
                if len(date_str) >= 7:
                    month_key = date_str[:7]  # YYYY-MM
                    amount = abs(float(transaction.get('amount', 0)))
                    monthly_spending[month_key] += amount
        
        return dict(monthly_spending)

    def _calculate_overall_risk_score(self, audit_risks, cash_flow_risks, spending_risks) -> float:
        """Calculate overall financial risk score (0-1, higher is riskier)"""
        base_score = 0.0
        
        # Audit risks
        audit_risk_count = len(audit_risks)
        base_score += min(audit_risk_count * 0.1, 0.3)
        
        # Cash flow risks
        high_severity_cf = len([r for r in cash_flow_risks if r.get('severity') == 'high'])
        medium_severity_cf = len([r for r in cash_flow_risks if r.get('severity') == 'medium'])
        base_score += (high_severity_cf * 0.2) + (medium_severity_cf * 0.1)
        
        # Spending risks
        spending_risk_count = len(spending_risks)
        base_score += min(spending_risk_count * 0.05, 0.2)
        
        return min(base_score, 1.0)

    def _generate_risk_mitigation_recommendations(self, overall_score, audit_risks, cash_flow_risks, spending_risks) -> List[str]:
        """Generate recommendations to mitigate identified risks"""
        recommendations = []
        
        if overall_score > 0.7:
            recommendations.append("Consider consulting with a financial advisor for comprehensive risk management")
        
        if audit_risks:
            recommendations.append("Improve record keeping and receipt management to reduce audit risk")
            recommendations.append("Consider professional tax preparation services")
        
        if cash_flow_risks:
            recommendations.append("Create an emergency fund to handle cash flow fluctuations")
            recommendations.append("Consider setting up automatic savings to smooth out cash flow")
        
        if spending_risks:
            recommendations.append("Set up spending alerts for large transactions")
            recommendations.append("Create and stick to a monthly budget")
        
        if not recommendations:
            recommendations.append("Maintain current financial practices and monitor regularly")
        
        return recommendations

    def _calculate_data_quality_score(self, user_data: Dict) -> float:
        """Calculate a score representing the quality/completeness of user data"""
        score = 0.0
        
        # Check transaction data
        transactions = user_data.get('transactions', [])
        if transactions:
            score += 0.4
            
            # Check for categorized transactions
            categorized = len([t for t in transactions if t.get('category') and t.get('category') != 'Other'])
            if categorized / len(transactions) > 0.8:
                score += 0.1
        
        # Check for receipts
        if user_data.get('receipts'):
            score += 0.2
        
        # Check for user profile
        if user_data.get('profile'):
            score += 0.1
        
        # Check for tax profile
        if user_data.get('tax_profile'):
            score += 0.1
        
        # Check for goals
        if user_data.get('goals'):
            score += 0.1
        
        return min(score, 1.0) 