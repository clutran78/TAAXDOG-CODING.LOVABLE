"""
TAAXDOG Smart Insights Engine
Advanced business intelligence and financial insights system.
Provides intelligent recommendations, predictive analytics, and actionable insights.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import numpy as np
from collections import defaultdict
import requests
from ai.financial_insights import analyze_transactions
from firebase_config import db
from basiq_api import get_user_transactions

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class InsightType(Enum):
    SPENDING_PATTERN = "spending_pattern"
    TAX_OPTIMIZATION = "tax_optimization"
    BUDGET_RECOMMENDATION = "budget_recommendation"
    SAVINGS_OPPORTUNITY = "savings_opportunity"
    SUBSCRIPTION_ANALYSIS = "subscription_analysis"
    INVESTMENT_SUGGESTION = "investment_suggestion"
    CASH_FLOW_PREDICTION = "cash_flow_prediction"
    AUDIT_RISK_ALERT = "audit_risk_alert"

class InsightPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

@dataclass
class SmartInsight:
    id: str
    user_id: str
    type: InsightType
    priority: InsightPriority
    title: str
    description: str
    recommendation: str
    potential_savings: float
    confidence_score: float
    data: Dict[str, Any]
    created_at: datetime
    expires_at: Optional[datetime] = None
    action_items: List[str] = None

@dataclass
class SpendingPattern:
    category: str
    average_monthly: float
    trend: str  # increasing, decreasing, stable
    seasonal_variance: float
    peak_months: List[str]
    anomalies: List[Dict]

@dataclass
class TaxOptimization:
    potential_deductions: float
    missing_categories: List[str]
    timing_recommendations: List[str]
    compliance_score: float
    audit_risk_factors: List[str]

@dataclass
class BudgetRecommendation:
    category: str
    current_spend: float
    recommended_budget: float
    reasoning: str
    difficulty: str  # easy, moderate, hard

class SmartInsightsEngine:
    """Advanced analytics engine for generating financial insights"""
    
    def __init__(self):
        self.claude_api_key = os.getenv('CLAUDE_API_KEY')
        self.claude_api_url = os.getenv('CLAUDE_API_URL', 'https://api.anthropic.com/v1/messages')
        
    async def generate_comprehensive_insights(self, user_id: str, period_months: int = 6) -> List[SmartInsight]:
        """Generate comprehensive financial insights for a user"""
        insights = []
        
        try:
            # Get user data
            user_data = await self._get_user_data(user_id, period_months)
            
            if not user_data:
                logger.warning(f"No data found for user {user_id}")
                return insights
            
            # Generate different types of insights
            insights.extend(await self._analyze_spending_patterns(user_id, user_data))
            insights.extend(await self._generate_tax_optimization_insights(user_id, user_data))
            insights.extend(await self._create_budget_recommendations(user_id, user_data))
            insights.extend(await self._identify_savings_opportunities(user_id, user_data))
            insights.extend(await self._analyze_subscription_efficiency(user_id, user_data))
            insights.extend(await self._predict_cash_flow(user_id, user_data))
            insights.extend(await self._assess_audit_risks(user_id, user_data))
            
            # Sort by priority and confidence
            insights.sort(key=lambda x: (x.priority.value, -x.confidence_score), reverse=True)
            
            # Store insights in database
            await self._store_insights(insights)
            
        except Exception as e:
            logger.error(f"Error generating insights for user {user_id}: {e}")
            
        return insights
    
    async def _get_user_data(self, user_id: str, period_months: int) -> Dict[str, Any]:
        """Collect comprehensive user data for analysis"""
        data = {}
        
        try:
            # Get transactions
            end_date = datetime.now()
            start_date = end_date - timedelta(days=period_months * 30)
            filter_str = f"transaction.postDate.gte={start_date.isoformat()}&transaction.postDate.lte={end_date.isoformat()}"
            
            transactions_result = get_user_transactions(user_id, filter_str)
            if transactions_result.get('success'):
                data['transactions'] = transactions_result.get('transactions', {}).get('data', [])
            
            # Get user profile from Firebase
            if db:
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                if user_doc.exists:
                    data['profile'] = user_doc.to_dict()
                
                # Get tax profile
                tax_profile_ref = db.collection('taxProfiles').where('userId', '==', user_id).get()
                if tax_profile_ref:
                    data['tax_profile'] = tax_profile_ref[0].to_dict()
                
                # Get goals
                goals_ref = db.collection('goals').where('userId', '==', user_id).get()
                data['goals'] = [doc.to_dict() for doc in goals_ref]
                
                # Get subscriptions
                subs_ref = db.collection('subscriptions').where('userId', '==', user_id).get()
                data['subscriptions'] = [doc.to_dict() for doc in subs_ref]
                
                # Get receipts
                receipts_ref = db.collection('receipts').where('userId', '==', user_id).get()
                data['receipts'] = [doc.to_dict() for doc in receipts_ref]
            
        except Exception as e:
            logger.error(f"Error getting user data for {user_id}: {e}")
            
        return data
    
    async def _analyze_spending_patterns(self, user_id: str, user_data: Dict) -> List[SmartInsight]:
        """Analyze spending patterns and identify trends"""
        insights = []
        
        try:
            transactions = user_data.get('transactions', [])
            if not transactions:
                return insights
            
            # Group by category and month
            category_spending = defaultdict(lambda: defaultdict(float))
            monthly_totals = defaultdict(float)
            
            for transaction in transactions:
                if transaction.get('direction') == 'debit':
                    amount = abs(float(transaction.get('amount', 0)))
                    category = transaction.get('category', 'Other')
                    date_str = transaction.get('postDate', '')
                    
                    if date_str:
                        month_key = date_str[:7]  # YYYY-MM
                        category_spending[category][month_key] += amount
                        monthly_totals[month_key] += amount
            
            # Analyze trends for each category
            for category, monthly_amounts in category_spending.items():
                if len(monthly_amounts) < 3:  # Need at least 3 months
                    continue
                
                amounts = list(monthly_amounts.values())
                months = sorted(monthly_amounts.keys())
                
                # Calculate trend
                trend = self._calculate_trend(amounts)
                average_monthly = np.mean(amounts)
                variance = np.std(amounts) / average_monthly if average_monthly > 0 else 0
                
                # Identify anomalies
                anomalies = self._detect_anomalies(amounts, months)
                
                pattern = SpendingPattern(
                    category=category,
                    average_monthly=average_monthly,
                    trend=trend,
                    seasonal_variance=variance,
                    peak_months=self._identify_peak_months(monthly_amounts),
                    anomalies=anomalies
                )
                
                # Generate insights based on patterns
                if trend == "increasing" and variance > 0.3:
                    insights.append(SmartInsight(
                        id=f"spending_trend_{user_id}_{category}_{datetime.now().strftime('%Y%m')}",
                        user_id=user_id,
                        type=InsightType.SPENDING_PATTERN,
                        priority=InsightPriority.MEDIUM,
                        title=f"Rising {category} Spending",
                        description=f"Your {category} spending has increased by an average of {variance*100:.1f}% over recent months",
                        recommendation=f"Consider reviewing your {category} expenses and setting a monthly budget of ${average_monthly*0.9:.2f}",
                        potential_savings=average_monthly * 0.1,
                        confidence_score=0.8,
                        data=pattern.__dict__,
                        created_at=datetime.now(),
                        action_items=[
                            f"Review {category} transactions from last 3 months",
                            f"Set monthly budget limit of ${average_monthly*0.9:.2f}",
                            "Enable spending alerts for this category"
                        ]
                    ))
                
                if len(anomalies) > 0:
                    total_anomaly_amount = sum(a['amount'] for a in anomalies)
                    insights.append(SmartInsight(
                        id=f"spending_anomaly_{user_id}_{category}_{datetime.now().strftime('%Y%m')}",
                        user_id=user_id,
                        type=InsightType.SPENDING_PATTERN,
                        priority=InsightPriority.HIGH,
                        title=f"Unusual {category} Spending Detected",
                        description=f"Found {len(anomalies)} unusual {category} transactions totaling ${total_anomaly_amount:.2f}",
                        recommendation="Review these transactions for potential errors or fraud",
                        potential_savings=0,
                        confidence_score=0.9,
                        data={'anomalies': anomalies, 'category': category},
                        created_at=datetime.now(),
                        action_items=[
                            "Review flagged transactions",
                            "Contact bank if suspicious activity found",
                            "Update transaction categories if needed"
                        ]
                    ))
                    
        except Exception as e:
            logger.error(f"Error analyzing spending patterns for {user_id}: {e}")
            
        return insights
    
    async def _generate_tax_optimization_insights(self, user_id: str, user_data: Dict) -> List[SmartInsight]:
        """Generate tax optimization recommendations"""
        insights = []
        
        try:
            transactions = user_data.get('transactions', [])
            tax_profile = user_data.get('tax_profile', {})
            receipts = user_data.get('receipts', [])
            
            if not transactions:
                return insights
            
            # Analyze potential deductions
            potential_deductions = 0
            missing_categories = []
            compliance_score = 100
            audit_risks = []
            
            # Check for missing business expense categories
            business_categories = ['Office Supplies', 'Professional Development', 'Travel', 'Equipment']
            found_categories = set()
            
            for transaction in transactions:
                category = transaction.get('category', '')
                if category in business_categories:
                    found_categories.add(category)
                
                # Check for high cash transactions (audit risk)
                if float(transaction.get('amount', 0)) > 10000:
                    audit_risks.append(f"High-value cash transaction: ${transaction.get('amount')}")
                    compliance_score -= 5
            
            missing_categories = [cat for cat in business_categories if cat not in found_categories]
            
            # Calculate potential savings from better categorization
            uncategorized_amount = sum(
                abs(float(t.get('amount', 0))) for t in transactions 
                if t.get('direction') == 'debit' and not t.get('category')
            )
            
            # Estimate tax savings (30% tax rate assumption)
            potential_tax_savings = uncategorized_amount * 0.3 * 0.5  # Conservative estimate
            
            if potential_tax_savings > 100:
                insights.append(SmartInsight(
                    id=f"tax_categorization_{user_id}_{datetime.now().strftime('%Y%m')}",
                    user_id=user_id,
                    type=InsightType.TAX_OPTIMIZATION,
                    priority=InsightPriority.HIGH,
                    title="Improve Expense Categorization",
                    description=f"${uncategorized_amount:.2f} in uncategorized expenses could be tax deductible",
                    recommendation="Review and properly categorize all business-related expenses",
                    potential_savings=potential_tax_savings,
                    confidence_score=0.7,
                    data={
                        'uncategorized_amount': uncategorized_amount,
                        'missing_categories': missing_categories,
                        'audit_risks': audit_risks
                    },
                    created_at=datetime.now(),
                    action_items=[
                        "Review uncategorized transactions",
                        "Add missing business expense categories",
                        "Ensure receipts are attached to business expenses"
                    ]
                ))
            
            # End of financial year recommendations
            current_date = datetime.now()
            if current_date.month >= 5:  # May onwards (approaching Australian tax year end)
                insights.append(SmartInsight(
                    id=f"eofy_prep_{user_id}_{current_date.year}",
                    user_id=user_id,
                    type=InsightType.TAX_OPTIMIZATION,
                    priority=InsightPriority.MEDIUM,
                    title="End of Financial Year Preparation",
                    description="The Australian financial year ends on June 30. Prepare your tax return now.",
                    recommendation="Review all transactions, ensure proper categorization, and gather missing receipts",
                    potential_savings=potential_tax_savings,
                    confidence_score=1.0,
                    data={'year': current_date.year, 'days_remaining': (datetime(current_date.year, 6, 30) - current_date).days},
                    created_at=datetime.now(),
                    action_items=[
                        "Download tax report",
                        "Review all business expenses",
                        "Gather missing receipts",
                        "Consider pre-paying deductible expenses"
                    ]
                ))
                
        except Exception as e:
            logger.error(f"Error generating tax optimization insights for {user_id}: {e}")
            
        return insights
    
    async def _create_budget_recommendations(self, user_id: str, user_data: Dict) -> List[SmartInsight]:
        """Create intelligent budget recommendations"""
        insights = []
        
        try:
            transactions = user_data.get('transactions', [])
            goals = user_data.get('goals', [])
            
            if not transactions:
                return insights
            
            # Calculate current spending by category
            category_spending = defaultdict(float)
            monthly_income = 0
            
            for transaction in transactions:
                amount = abs(float(transaction.get('amount', 0)))
                category = transaction.get('category', 'Other')
                
                if transaction.get('direction') == 'credit':
                    monthly_income += amount
                else:
                    category_spending[category] += amount
            
            # Calculate monthly averages (assume 6 months of data)
            months = 6
            monthly_income = monthly_income / months
            for category in category_spending:
                category_spending[category] = category_spending[category] / months
            
            total_expenses = sum(category_spending.values())
            
            # Generate budget recommendations using 50/30/20 rule
            recommended_budgets = {
                'Housing': monthly_income * 0.30,
                'Food': monthly_income * 0.15,
                'Transportation': monthly_income * 0.15,
                'Entertainment': monthly_income * 0.10,
                'Shopping': monthly_income * 0.05,
                'Other': monthly_income * 0.05
            }
            
            # Compare with actual spending
            for category, recommended in recommended_budgets.items():
                current = category_spending.get(category, 0)
                
                if current > recommended * 1.2:  # 20% over recommended
                    potential_savings = current - recommended
                    
                    insights.append(SmartInsight(
                        id=f"budget_rec_{user_id}_{category}_{datetime.now().strftime('%Y%m')}",
                        user_id=user_id,
                        type=InsightType.BUDGET_RECOMMENDATION,
                        priority=InsightPriority.MEDIUM,
                        title=f"Optimize {category} Budget",
                        description=f"You're spending ${current:.2f}/month on {category}, which is {((current/recommended)-1)*100:.1f}% above recommended",
                        recommendation=f"Consider reducing {category} spending to ${recommended:.2f}/month",
                        potential_savings=potential_savings,
                        confidence_score=0.8,
                        data={
                            'current_spend': current,
                            'recommended_budget': recommended,
                            'category': category,
                            'difficulty': 'moderate' if potential_savings < 200 else 'hard'
                        },
                        created_at=datetime.now(),
                        action_items=[
                            f"Set monthly budget of ${recommended:.2f} for {category}",
                            f"Enable spending alerts at ${recommended*0.8:.2f}",
                            f"Review {category} transactions for unnecessary expenses"
                        ]
                    ))
            
            # Savings rate analysis
            savings_rate = (monthly_income - total_expenses) / monthly_income if monthly_income > 0 else 0
            recommended_savings_rate = 0.20  # 20%
            
            if savings_rate < recommended_savings_rate:
                shortfall = monthly_income * (recommended_savings_rate - savings_rate)
                
                insights.append(SmartInsight(
                    id=f"savings_rate_{user_id}_{datetime.now().strftime('%Y%m')}",
                    user_id=user_id,
                    type=InsightType.SAVINGS_OPPORTUNITY,
                    priority=InsightPriority.HIGH,
                    title="Improve Savings Rate",
                    description=f"Your current savings rate is {savings_rate*100:.1f}%, below the recommended 20%",
                    recommendation=f"Increase monthly savings by ${shortfall:.2f} to reach 20% savings rate",
                    potential_savings=shortfall * 12,  # Annual benefit
                    confidence_score=0.9,
                    data={
                        'current_rate': savings_rate,
                        'recommended_rate': recommended_savings_rate,
                        'monthly_shortfall': shortfall
                    },
                    created_at=datetime.now(),
                    action_items=[
                        "Set up automatic savings transfer",
                        "Review and reduce non-essential expenses",
                        "Consider additional income sources"
                    ]
                ))
                
        except Exception as e:
            logger.error(f"Error creating budget recommendations for {user_id}: {e}")
            
        return insights
    
    async def _identify_savings_opportunities(self, user_id: str, user_data: Dict) -> List[SmartInsight]:
        """Identify specific savings opportunities"""
        insights = []
        
        try:
            transactions = user_data.get('transactions', [])
            subscriptions = user_data.get('subscriptions', [])
            
            # Analyze subscription efficiency
            total_subscriptions = sum(float(sub.get('amount', 0)) for sub in subscriptions)
            
            if total_subscriptions > 100:  # More than $100/month in subscriptions
                insights.append(SmartInsight(
                    id=f"subscription_audit_{user_id}_{datetime.now().strftime('%Y%m')}",
                    user_id=user_id,
                    type=InsightType.SUBSCRIPTION_ANALYSIS,
                    priority=InsightPriority.MEDIUM,
                    title="Subscription Audit Recommended",
                    description=f"You have ${total_subscriptions:.2f}/month in subscriptions across {len(subscriptions)} services",
                    recommendation="Review all subscriptions and cancel unused services",
                    potential_savings=total_subscriptions * 0.2,  # Assume 20% can be saved
                    confidence_score=0.7,
                    data={
                        'total_monthly': total_subscriptions,
                        'subscription_count': len(subscriptions),
                        'subscriptions': subscriptions
                    },
                    created_at=datetime.now(),
                    action_items=[
                        "Review usage of each subscription service",
                        "Cancel unused or duplicate services",
                        "Consider annual plans for frequently used services"
                    ]
                ))
            
            # Identify frequent small purchases that add up
            small_purchases = [t for t in transactions 
                             if t.get('direction') == 'debit' 
                             and 5 <= abs(float(t.get('amount', 0))) <= 25]
            
            if len(small_purchases) > 20:  # More than 20 small purchases
                total_small = sum(abs(float(t.get('amount', 0))) for t in small_purchases)
                
                insights.append(SmartInsight(
                    id=f"small_purchases_{user_id}_{datetime.now().strftime('%Y%m')}",
                    user_id=user_id,
                    type=InsightType.SAVINGS_OPPORTUNITY,
                    priority=InsightPriority.LOW,
                    title="Small Purchases Add Up",
                    description=f"You made {len(small_purchases)} small purchases ($5-$25) totaling ${total_small:.2f}",
                    recommendation="Track small purchases and consider bulk buying or meal prep",
                    potential_savings=total_small * 0.3,  # 30% reduction possible
                    confidence_score=0.6,
                    data={
                        'purchase_count': len(small_purchases),
                        'total_amount': total_small,
                        'average_amount': total_small / len(small_purchases)
                    },
                    created_at=datetime.now(),
                    action_items=[
                        "Set daily spending limit for small purchases",
                        "Use shopping lists to avoid impulse buying",
                        "Consider meal prep to reduce food purchases"
                    ]
                ))
                
        except Exception as e:
            logger.error(f"Error identifying savings opportunities for {user_id}: {e}")
            
        return insights
    
    async def _analyze_subscription_efficiency(self, user_id: str, user_data: Dict) -> List[SmartInsight]:
        """Analyze subscription efficiency and usage"""
        insights = []
        
        try:
            subscriptions = user_data.get('subscriptions', [])
            transactions = user_data.get('transactions', [])
            
            # Group subscriptions by category
            category_subs = defaultdict(list)
            for sub in subscriptions:
                category_subs[sub.get('category', 'Other')].append(sub)
            
            # Check for potential duplicates
            for category, subs in category_subs.items():
                if len(subs) > 1 and category in ['Streaming', 'Software', 'Fitness']:
                    total_cost = sum(float(s.get('amount', 0)) for s in subs)
                    
                    insights.append(SmartInsight(
                        id=f"duplicate_subs_{user_id}_{category}_{datetime.now().strftime('%Y%m')}",
                        user_id=user_id,
                        type=InsightType.SUBSCRIPTION_ANALYSIS,
                        priority=InsightPriority.MEDIUM,
                        title=f"Multiple {category} Subscriptions",
                        description=f"You have {len(subs)} {category} subscriptions costing ${total_cost:.2f}/month",
                        recommendation=f"Consider consolidating {category} subscriptions to save money",
                        potential_savings=total_cost * 0.4,  # Assume 40% savings possible
                        confidence_score=0.8,
                        data={
                            'category': category,
                            'subscriptions': subs,
                            'total_cost': total_cost
                        },
                        created_at=datetime.now(),
                        action_items=[
                            f"Compare features of {category} services",
                            "Keep only the most used service",
                            "Cancel redundant subscriptions"
                        ]
                    ))
                    
        except Exception as e:
            logger.error(f"Error analyzing subscription efficiency for {user_id}: {e}")
            
        return insights
    
    async def _predict_cash_flow(self, user_id: str, user_data: Dict) -> List[SmartInsight]:
        """Predict future cash flow and identify potential issues"""
        insights = []
        
        try:
            transactions = user_data.get('transactions', [])
            subscriptions = user_data.get('subscriptions', [])
            goals = user_data.get('goals', [])
            
            if not transactions:
                return insights
            
            # Calculate average monthly income and expenses
            monthly_data = defaultdict(lambda: {'income': 0, 'expenses': 0})
            
            for transaction in transactions:
                amount = abs(float(transaction.get('amount', 0)))
                date_str = transaction.get('postDate', '')
                
                if date_str:
                    month_key = date_str[:7]  # YYYY-MM
                    
                    if transaction.get('direction') == 'credit':
                        monthly_data[month_key]['income'] += amount
                    else:
                        monthly_data[month_key]['expenses'] += amount
            
            # Calculate averages
            months = list(monthly_data.keys())
            if len(months) < 3:
                return insights
            
            avg_income = np.mean([data['income'] for data in monthly_data.values()])
            avg_expenses = np.mean([data['expenses'] for data in monthly_data.values()])
            
            # Add subscription costs
            monthly_subscriptions = sum(float(sub.get('amount', 0)) for sub in subscriptions)
            projected_expenses = avg_expenses + monthly_subscriptions
            
            # Predict next 3 months
            net_flow = avg_income - projected_expenses
            three_month_outlook = net_flow * 3
            
            if net_flow < 0:
                insights.append(SmartInsight(
                    id=f"negative_cashflow_{user_id}_{datetime.now().strftime('%Y%m')}",
                    user_id=user_id,
                    type=InsightType.CASH_FLOW_PREDICTION,
                    priority=InsightPriority.URGENT,
                    title="Negative Cash Flow Predicted",
                    description=f"Based on current trends, you may have a ${abs(net_flow):.2f} monthly shortfall",
                    recommendation="Reduce expenses or increase income to avoid financial strain",
                    potential_savings=abs(net_flow),
                    confidence_score=0.8,
                    data={
                        'avg_income': avg_income,
                        'avg_expenses': avg_expenses,
                        'monthly_shortfall': abs(net_flow),
                        'three_month_outlook': three_month_outlook
                    },
                    created_at=datetime.now(),
                    action_items=[
                        "Review and reduce non-essential expenses",
                        "Consider additional income sources",
                        "Build emergency fund if possible"
                    ]
                ))
            elif net_flow > 500:  # Positive cash flow > $500
                insights.append(SmartInsight(
                    id=f"investment_opportunity_{user_id}_{datetime.now().strftime('%Y%m')}",
                    user_id=user_id,
                    type=InsightType.INVESTMENT_SUGGESTION,
                    priority=InsightPriority.LOW,
                    title="Investment Opportunity",
                    description=f"You have positive cash flow of ${net_flow:.2f}/month available for investing",
                    recommendation="Consider investing surplus funds for long-term growth",
                    potential_savings=net_flow * 12 * 0.07,  # 7% annual return estimate
                    confidence_score=0.7,
                    data={
                        'monthly_surplus': net_flow,
                        'annual_surplus': net_flow * 12,
                        'potential_growth': net_flow * 12 * 0.07
                    },
                    created_at=datetime.now(),
                    action_items=[
                        "Consider high-interest savings account",
                        "Research investment options (ETFs, managed funds)",
                        "Consult with financial advisor"
                    ]
                ))
                
        except Exception as e:
            logger.error(f"Error predicting cash flow for {user_id}: {e}")
            
        return insights
    
    async def _assess_audit_risks(self, user_id: str, user_data: Dict) -> List[SmartInsight]:
        """Assess potential audit risks and compliance issues"""
        insights = []
        
        try:
            transactions = user_data.get('transactions', [])
            receipts = user_data.get('receipts', [])
            tax_profile = user_data.get('tax_profile', {})
            
            risk_factors = []
            risk_score = 0
            
            # Check for high cash transactions
            high_cash_count = 0
            for transaction in transactions:
                amount = abs(float(transaction.get('amount', 0)))
                if amount > 10000 and transaction.get('description', '').lower().find('cash') != -1:
                    high_cash_count += 1
                    risk_score += 10
            
            if high_cash_count > 0:
                risk_factors.append(f"{high_cash_count} high-value cash transactions")
            
            # Check receipt compliance
            business_transactions = [t for t in transactions 
                                   if t.get('direction') == 'debit' 
                                   and abs(float(t.get('amount', 0))) > 50]
            
            receipt_coverage = len(receipts) / len(business_transactions) if business_transactions else 0
            
            if receipt_coverage < 0.7:  # Less than 70% receipt coverage
                risk_factors.append("Low receipt coverage for business expenses")
                risk_score += 15
            
            # Check for round number transactions (potential red flag)
            round_transactions = [t for t in transactions 
                                if abs(float(t.get('amount', 0))) % 100 == 0 
                                and abs(float(t.get('amount', 0))) > 100]
            
            if len(round_transactions) > len(transactions) * 0.2:  # More than 20% round numbers
                risk_factors.append("High percentage of round-number transactions")
                risk_score += 5
            
            if risk_score > 20:
                insights.append(SmartInsight(
                    id=f"audit_risk_{user_id}_{datetime.now().strftime('%Y%m')}",
                    user_id=user_id,
                    type=InsightType.AUDIT_RISK_ALERT,
                    priority=InsightPriority.HIGH,
                    title="Audit Risk Assessment",
                    description=f"Your transactions show potential audit risk factors (risk score: {risk_score})",
                    recommendation="Improve record keeping and ensure all business expenses have receipts",
                    potential_savings=0,
                    confidence_score=0.8,
                    data={
                        'risk_score': risk_score,
                        'risk_factors': risk_factors,
                        'receipt_coverage': receipt_coverage,
                        'high_cash_count': high_cash_count
                    },
                    created_at=datetime.now(),
                    action_items=[
                        "Ensure all business expenses have receipts",
                        "Avoid large cash transactions when possible",
                        "Maintain detailed records of all deductions"
                    ]
                ))
                
        except Exception as e:
            logger.error(f"Error assessing audit risks for {user_id}: {e}")
            
        return insights
    
    def _calculate_trend(self, amounts: List[float]) -> str:
        """Calculate trend direction from a series of amounts"""
        if len(amounts) < 2:
            return "stable"
        
        # Simple linear regression to determine trend
        x = np.arange(len(amounts))
        slope = np.polyfit(x, amounts, 1)[0]
        
        if slope > np.mean(amounts) * 0.05:  # 5% increase
            return "increasing"
        elif slope < -np.mean(amounts) * 0.05:  # 5% decrease
            return "decreasing"
        else:
            return "stable"
    
    def _detect_anomalies(self, amounts: List[float], months: List[str]) -> List[Dict]:
        """Detect anomalous spending amounts"""
        if len(amounts) < 3:
            return []
        
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        threshold = mean_amount + 2 * std_amount  # 2 standard deviations
        
        anomalies = []
        for i, amount in enumerate(amounts):
            if amount > threshold:
                anomalies.append({
                    'month': months[i],
                    'amount': amount,
                    'deviation': (amount - mean_amount) / std_amount
                })
        
        return anomalies
    
    def _identify_peak_months(self, monthly_amounts: Dict[str, float]) -> List[str]:
        """Identify months with highest spending"""
        if not monthly_amounts:
            return []
        
        sorted_months = sorted(monthly_amounts.items(), key=lambda x: x[1], reverse=True)
        return [month for month, _ in sorted_months[:3]]  # Top 3 months
    
    async def _store_insights(self, insights: List[SmartInsight]) -> None:
        """Store insights in Firebase"""
        try:
            if not db:
                return
            
            for insight in insights:
                insight_data = {
                    'id': insight.id,
                    'user_id': insight.user_id,
                    'type': insight.type.value,
                    'priority': insight.priority.value,
                    'title': insight.title,
                    'description': insight.description,
                    'recommendation': insight.recommendation,
                    'potential_savings': insight.potential_savings,
                    'confidence_score': insight.confidence_score,
                    'data': insight.data,
                    'created_at': insight.created_at.isoformat(),
                    'expires_at': insight.expires_at.isoformat() if insight.expires_at else None,
                    'action_items': insight.action_items or []
                }
                
                db.collection('insights').document(insight.id).set(insight_data)
                
        except Exception as e:
            logger.error(f"Error storing insights: {e}")

# Singleton instance
smart_insights_engine = SmartInsightsEngine() 