"""
Financial insights module using Claude 3.7 for generating financial insights.

This module provides functions to analyze financial data and generate insights
using Claude 3.7 AI model. It processes transaction data, identifies patterns,
and provides recommendations for tax optimization and financial management.
"""

import os
import json
import requests
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Claude API configuration
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')
CLAUDE_API_URL = os.environ.get('CLAUDE_API_URL', 'https://api.anthropic.com/v1/messages')
CLAUDE_MODEL = os.environ.get('CLAUDE_MODEL', 'claude-3-7-sonnet-20240307')

class FinancialInsightsEngine:
    """
    AI-powered financial insights engine using Claude 3.7 Sonnet
    Provides transaction analysis, tax deduction identification, and personalized recommendations
    """
    
    def __init__(self):
        self.claude_api_key = os.getenv('CLAUDE_API_KEY')
        self.claude_api_url = os.getenv('CLAUDE_API_URL', 'https://api.anthropic.com/v1/messages')
        self.claude_model = os.getenv('CLAUDE_MODEL', 'claude-3-7-sonnet-20240307')
        
        # Australian tax categories for deduction identification
        self.ato_deduction_categories = {
            'D1': 'Advertising',
            'D2': 'Bad debts',
            'D3': 'Bank charges',
            'D4': 'Car expenses',
            'D5': 'Cleaning',
            'D6': 'Depreciation',
            'D7': 'Electricity, gas, water, telephone',
            'D8': 'Freight, cartage',
            'D9': 'Insurance',
            'D10': 'Interest',
            'D11': 'Legal and professional fees',
            'D12': 'Motor vehicle expenses',
            'D13': 'Printing and stationery',
            'D14': 'Rent',
            'D15': 'Repairs and maintenance'
        }
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def safe_claude_api_call(self, prompt: str, max_tokens: int = 4000) -> Dict[str, Any]:
        """
        Make a safe API call to Claude with proper error handling
        Returns parsed response or error information
        """
        try:
            if not self.claude_api_key:
                return {"error": "Claude API key not configured"}
                
            response = requests.post(
                self.claude_api_url,
                headers={
                    "x-api-key": self.claude_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": self.claude_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens
                },
                timeout=30
            )
            response.raise_for_status()
            return self.parse_claude_response(response.json())
            
        except requests.exceptions.Timeout:
            self.logger.error("Claude API timeout")
            return {"error": "API timeout - please try again"}
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Claude API request error: {str(e)}")
            return {"error": f"API request failed: {str(e)}"}
        except Exception as e:
            self.logger.error(f"Unexpected error in Claude API call: {str(e)}")
            return {"error": f"Unexpected error: {str(e)}"}

    def parse_claude_response(self, response_data: Dict) -> Dict[str, Any]:
        """
        Parse Claude API response and extract content
        Handles different response formats safely
        """
        try:
            if 'content' in response_data:
                content = response_data['content']
                if isinstance(content, list) and len(content) > 0:
                    return {"content": content[0].get('text', '')}
                elif isinstance(content, str):
                    return {"content": content}
            
            return {"error": "Invalid response format from Claude API"}
            
        except Exception as e:
            self.logger.error(f"Error parsing Claude response: {str(e)}")
            return {"error": "Failed to parse API response"}

    def analyze_transactions(self, transactions: List[Dict], user_profile: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Analyze spending patterns and provide comprehensive financial insights
        Uses Claude AI to identify patterns, trends, and provide recommendations
        """
        try:
            if not transactions:
                return {"error": "No transactions provided for analysis"}
            
            # Prepare transaction data for analysis
            transaction_summary = self.prepare_transaction_summary(transactions)
            user_context = self.prepare_user_context(user_profile)
            
            prompt = f"""
            As a financial advisor specializing in Australian tax law and personal finance, analyze the following transaction data and provide comprehensive insights:

            USER CONTEXT:
            {user_context}

            TRANSACTION SUMMARY:
            {transaction_summary}

            Please provide a detailed analysis including:
            1. SPENDING PATTERNS: Identify key spending patterns and trends
            2. TOP CATEGORIES: List top 5 spending categories with amounts and percentages
            3. RECOMMENDATIONS: Provide 3-5 actionable recommendations for improvement
            4. RISK INDICATORS: Identify any concerning spending behaviors
            5. OPTIMIZATION OPPORTUNITIES: Suggest areas for cost reduction

            Format your response as valid JSON with the following structure:
            {{
                "spending_patterns": [
                    {{"pattern": "description", "amount": 0, "trend": "increasing/decreasing/stable"}}
                ],
                "top_categories": [
                    {{"category": "name", "amount": 0, "percentage": 0}}
                ],
                "recommendations": [
                    {{"type": "category", "description": "detailed recommendation", "potential_saving": 0}}
                ],
                "risk_indicators": ["list of concerning patterns"],
                "total_analyzed": {len(transactions)},
                "analysis_period": "description of time period"
            }}
            """
            
            response = self.safe_claude_api_call(prompt)
            
            if "error" in response:
                return response
                
            # Parse JSON response from Claude
            try:
                analysis_result = json.loads(response["content"])
                analysis_result["generated_at"] = datetime.now().isoformat()
                return analysis_result
            except json.JSONDecodeError:
                # Fallback to basic analysis if Claude doesn't return valid JSON
                return self.fallback_transaction_analysis(transactions)
                
        except Exception as e:
            self.logger.error(f"Error analyzing transactions: {str(e)}")
            return {"error": f"Analysis failed: {str(e)}"}

    def identify_tax_deductions(self, transactions: List[Dict], receipts: Optional[List[Dict]] = None) -> List[Dict]:
        """
        Identify potential Australian tax deductions with confidence scores
        Analyzes transactions and receipts to find ATO-compliant deductions
        """
        try:
            if not transactions:
                return []
            
            # Prepare data for tax analysis
            business_transactions = self.filter_business_transactions(transactions)
            receipt_data = self.prepare_receipt_data(receipts) if receipts else ""
            
            prompt = f"""
            As an Australian tax expert familiar with ATO deduction categories (D1-D15), analyze these transactions and identify potential tax deductions:

            BUSINESS TRANSACTIONS:
            {json.dumps(business_transactions[:50], indent=2)}

            RECEIPT DATA:
            {receipt_data}

            ATO DEDUCTION CATEGORIES:
            {json.dumps(self.ato_deduction_categories, indent=2)}

            For each potential deduction, provide:
            1. ATO category (D1-D15)
            2. Transaction details
            3. Confidence score (HIGH/MEDIUM/LOW)
            4. Required documentation
            5. Amount that may be deductible

            Format as JSON array:
            [
                {{
                    "category": "ATO category code",
                    "category_name": "category description",
                    "amount": 0,
                    "confidence": "HIGH/MEDIUM/LOW",
                    "description": "detailed explanation",
                    "documentation_required": "what records are needed",
                    "transaction_ids": ["list of related transaction IDs"]
                }}
            ]
            """
            
            response = self.safe_claude_api_call(prompt)
            
            if "error" in response:
                self.logger.error(f"Error in tax deduction analysis: {response['error']}")
                return []
            
            try:
                deductions = json.loads(response["content"])
                return deductions if isinstance(deductions, list) else []
            except json.JSONDecodeError:
                # Fallback to rule-based deduction identification
                return self.fallback_deduction_analysis(transactions)
                
        except Exception as e:
            self.logger.error(f"Error identifying tax deductions: {str(e)}")
            return []

    def suggest_financial_goals(self, transactions: List[Dict], user_id: str) -> List[Dict]:
        """
        Generate personalized SMART financial goals based on spending patterns
        Creates achievable goals with specific targets and timelines
        """
        try:
            if not transactions:
                return []
            
            # Analyze current financial situation
            monthly_income = self.calculate_monthly_income(transactions)
            monthly_expenses = self.calculate_monthly_expenses(transactions)
            savings_rate = self.calculate_savings_rate(monthly_income, monthly_expenses)
            
            financial_summary = {
                "monthly_income": monthly_income,
                "monthly_expenses": monthly_expenses,
                "savings_rate": savings_rate,
                "top_expense_categories": self.get_top_expense_categories(transactions)
            }
            
            prompt = f"""
            As a financial planner, create 3-5 personalized SMART financial goals based on this financial profile:

            CURRENT FINANCIAL SITUATION:
            {json.dumps(financial_summary, indent=2)}

            Create goals that are:
            - Specific: Clear and well-defined
            - Measurable: With concrete targets
            - Achievable: Realistic based on current situation
            - Relevant: Aligned with financial improvement
            - Time-bound: With specific deadlines

            Format as JSON array:
            [
                {{
                    "goal_type": "emergency_fund/debt_reduction/savings/expense_reduction/investment",
                    "title": "Clear goal title",
                    "description": "Detailed description",
                    "target_amount": 0,
                    "current_amount": 0,
                    "timeline_months": 0,
                    "monthly_target": 0,
                    "priority": "HIGH/MEDIUM/LOW",
                    "action_steps": ["specific steps to achieve goal"]
                }}
            ]
            """
            
            response = self.safe_claude_api_call(prompt)
            
            if "error" in response:
                return self.fallback_goal_suggestions(financial_summary)
            
            try:
                goals = json.loads(response["content"])
                # Add user_id and timestamps to each goal
                for goal in goals:
                    goal["user_id"] = user_id
                    goal["created_at"] = datetime.now().isoformat()
                    goal["status"] = "suggested"
                
                return goals if isinstance(goals, list) else []
            except json.JSONDecodeError:
                return self.fallback_goal_suggestions(financial_summary)
                
        except Exception as e:
            self.logger.error(f"Error generating financial goals: {str(e)}")
            return []

    def generate_financial_report(self, user_id: str, transactions: List[Dict], period: str = "monthly") -> Dict[str, Any]:
        """
        Create comprehensive financial report with insights and recommendations
        Provides detailed analysis for the specified time period
        """
        try:
            if not transactions:
                return {"error": "No transactions available for report generation"}
            
            # Filter transactions by period
            filtered_transactions = self.filter_transactions_by_period(transactions, period)
            
            # Generate comprehensive analysis
            spending_analysis = self.analyze_transactions(filtered_transactions)
            tax_deductions = self.identify_tax_deductions(filtered_transactions)
            financial_goals = self.suggest_financial_goals(filtered_transactions, user_id)
            
            # Calculate key metrics
            metrics = self.calculate_financial_metrics(filtered_transactions)
            
            report = {
                "user_id": user_id,
                "period": period,
                "generated_at": datetime.now().isoformat(),
                "transaction_count": len(filtered_transactions),
                "metrics": metrics,
                "spending_analysis": spending_analysis,
                "tax_deductions": tax_deductions,
                "suggested_goals": financial_goals,
                "recommendations": self.generate_recommendations(metrics, spending_analysis),
                "next_review_date": self.calculate_next_review_date(period)
            }
            
            return report
            
        except Exception as e:
            self.logger.error(f"Error generating financial report: {str(e)}")
            return {"error": f"Report generation failed: {str(e)}"}

    # Helper methods for data processing and analysis
    
    def prepare_transaction_summary(self, transactions: List[Dict]) -> str:
        """Prepare a concise summary of transactions for AI analysis"""
        try:
            total_count = len(transactions)
            total_amount = sum(float(t.get('amount', 0)) for t in transactions)
            
            # Group by category
            categories = {}
            for transaction in transactions:
                category = transaction.get('category', 'Uncategorized')
                amount = float(transaction.get('amount', 0))
                categories[category] = categories.get(category, 0) + amount
            
            return f"""
            Total Transactions: {total_count}
            Total Amount: ${total_amount:.2f}
            Top Categories: {dict(sorted(categories.items(), key=lambda x: x[1], reverse=True)[:10])}
            Date Range: {self.get_date_range(transactions)}
            """
        except Exception as e:
            return f"Error preparing transaction summary: {str(e)}"

    def prepare_user_context(self, user_profile: Optional[Dict]) -> str:
        """Prepare user context for personalized analysis"""
        if not user_profile:
            return "No user profile information available"
        
        return f"""
        Tax Profile: {user_profile.get('tax_profile', 'Individual')}
        ABN: {'Yes' if user_profile.get('has_abn') else 'No'}
        Business Type: {user_profile.get('business_type', 'N/A')}
        """

    def filter_business_transactions(self, transactions: List[Dict]) -> List[Dict]:
        """Filter transactions that may be business-related"""
        business_keywords = [
            'office', 'equipment', 'software', 'professional', 'legal',
            'accounting', 'insurance', 'travel', 'fuel', 'parking',
            'stationery', 'advertising', 'marketing', 'training'
        ]
        
        business_transactions = []
        for transaction in transactions:
            description = transaction.get('description', '').lower()
            category = transaction.get('category', '').lower()
            
            if any(keyword in description or keyword in category for keyword in business_keywords):
                business_transactions.append(transaction)
        
        return business_transactions

    def prepare_receipt_data(self, receipts: List[Dict]) -> str:
        """Prepare receipt data for tax analysis"""
        if not receipts:
            return "No receipt data available"
        
        receipt_summary = []
        for receipt in receipts[:10]:  # Limit to 10 receipts
            receipt_summary.append({
                'merchant': receipt.get('merchant', 'Unknown'),
                'amount': receipt.get('amount', 0),
                'category': receipt.get('category', 'Uncategorized'),
                'date': receipt.get('date', 'Unknown')
            })
        
        return json.dumps(receipt_summary, indent=2)

    def calculate_monthly_income(self, transactions: List[Dict]) -> float:
        """Calculate average monthly income from transactions"""
        income_transactions = [t for t in transactions if float(t.get('amount', 0)) > 0]
        total_income = sum(float(t.get('amount', 0)) for t in income_transactions)
        
        # Estimate monthly income based on transaction date range
        months = self.get_months_span(transactions)
        return total_income / max(months, 1)

    def calculate_monthly_expenses(self, transactions: List[Dict]) -> float:
        """Calculate average monthly expenses from transactions"""
        expense_transactions = [t for t in transactions if float(t.get('amount', 0)) < 0]
        total_expenses = abs(sum(float(t.get('amount', 0)) for t in expense_transactions))
        
        months = self.get_months_span(transactions)
        return total_expenses / max(months, 1)

    def calculate_savings_rate(self, income: float, expenses: float) -> float:
        """Calculate savings rate as percentage"""
        if income <= 0:
            return 0
        return ((income - expenses) / income) * 100

    def get_top_expense_categories(self, transactions: List[Dict]) -> List[Dict]:
        """Get top expense categories with amounts"""
        categories = {}
        for transaction in transactions:
            if float(transaction.get('amount', 0)) < 0:  # Expenses only
                category = transaction.get('category', 'Uncategorized')
                amount = abs(float(transaction.get('amount', 0)))
                categories[category] = categories.get(category, 0) + amount
        
        sorted_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]
        return [{"category": cat, "amount": amount} for cat, amount in sorted_categories]

    def filter_transactions_by_period(self, transactions: List[Dict], period: str) -> List[Dict]:
        """Filter transactions by the specified period"""
        now = datetime.now()
        
        if period == "weekly":
            cutoff = now - timedelta(weeks=1)
        elif period == "monthly":
            cutoff = now - timedelta(days=30)
        elif period == "quarterly":
            cutoff = now - timedelta(days=90)
        elif period == "yearly":
            cutoff = now - timedelta(days=365)
        else:
            return transactions  # Return all if period not recognized
        
        filtered = []
        for transaction in transactions:
            date_str = transaction.get('date')
            if date_str:
                transaction_date = self.parse_transaction_date(str(date_str))
                if transaction_date and transaction_date >= cutoff:
                    filtered.append(transaction)
        
        return filtered

    def calculate_financial_metrics(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Calculate key financial metrics from transactions"""
        try:
            total_income = sum(float(t.get('amount', 0)) for t in transactions if float(t.get('amount', 0)) > 0)
            total_expenses = abs(sum(float(t.get('amount', 0)) for t in transactions if float(t.get('amount', 0)) < 0))
            net_income = total_income - total_expenses
            
            return {
                "total_income": total_income,
                "total_expenses": total_expenses,
                "net_income": net_income,
                "transaction_count": len(transactions),
                "average_transaction": total_expenses / max(len(transactions), 1),
                "savings_rate": self.calculate_savings_rate(total_income, total_expenses)
            }
        except Exception as e:
            self.logger.error(f"Error calculating financial metrics: {str(e)}")
            return {}

    def generate_recommendations(self, metrics: Dict, analysis: Dict) -> List[str]:
        """Generate actionable recommendations based on analysis"""
        recommendations = []
        
        try:
            savings_rate = metrics.get('savings_rate', 0)
            if savings_rate < 10:
                recommendations.append("Consider increasing your savings rate to at least 10% of income")
            
            if 'recommendations' in analysis and isinstance(analysis['recommendations'], list):
                for rec in analysis['recommendations']:
                    if isinstance(rec, dict) and 'description' in rec:
                        recommendations.append(rec['description'])
            
            return recommendations[:5]  # Limit to 5 recommendations
        except Exception:
            return ["Review your spending patterns regularly", "Set up automatic savings transfers"]

    def calculate_next_review_date(self, period: str) -> str:
        """Calculate when the next review should be done"""
        now = datetime.now()
        
        if period == "weekly":
            next_review = now + timedelta(weeks=1)
        elif period == "monthly":
            next_review = now + timedelta(days=30)
        elif period == "quarterly":
            next_review = now + timedelta(days=90)
        else:
            next_review = now + timedelta(days=30)  # Default to monthly
        
        return next_review.isoformat()

    def get_date_range(self, transactions: List[Dict]) -> str:
        """Get the date range of transactions"""
        try:
            dates = []
            for t in transactions:
                date_str = t.get('date')
                if date_str:
                    parsed_date = self.parse_transaction_date(str(date_str))
                    if parsed_date:
                        dates.append(parsed_date)
            
            if not dates:
                return "No valid dates found"
            
            min_date = min(dates)
            max_date = max(dates)
            return f"{min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}"
        except Exception:
            return "Date range calculation failed"

    def get_months_span(self, transactions: List[Dict]) -> int:
        """Calculate the number of months spanned by transactions"""
        try:
            dates = []
            for t in transactions:
                date_str = t.get('date')
                if date_str:
                    parsed_date = self.parse_transaction_date(str(date_str))
                    if parsed_date:
                        dates.append(parsed_date)
            
            if not dates:
                return 1
            
            min_date = min(dates)
            max_date = max(dates)
            
            months = (max_date.year - min_date.year) * 12 + (max_date.month - min_date.month) + 1
            return max(months, 1)
        except Exception:
            return 1

    def parse_transaction_date(self, date_str: str) -> Optional[datetime]:
        """Parse transaction date string to datetime object"""
        if not date_str:
            return None
        
        try:
            # Try different date formats
            formats = ['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f']
            for fmt in formats:
                try:
                    return datetime.strptime(date_str[:len(fmt.replace('%f', ''))], fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None

    # Fallback methods for when AI analysis fails
    
    def fallback_transaction_analysis(self, transactions: List[Dict]) -> Dict[str, Any]:
        """Fallback analysis when Claude API fails"""
        categories = {}
        total_amount = 0
        
        for transaction in transactions:
            category = transaction.get('category', 'Uncategorized')
            amount = abs(float(transaction.get('amount', 0)))
            categories[category] = categories.get(category, 0) + amount
            total_amount += amount
        
        top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            "spending_patterns": [{"pattern": "Basic spending analysis", "amount": total_amount, "trend": "stable"}],
            "top_categories": [{"category": cat, "amount": amount, "percentage": (amount/total_amount)*100} 
                             for cat, amount in top_categories],
            "recommendations": [{"type": "general", "description": "Review spending regularly", "potential_saving": 0}],
            "total_analyzed": len(transactions),
            "generated_at": datetime.now().isoformat(),
            "analysis_type": "fallback"
        }

    def fallback_deduction_analysis(self, transactions: List[Dict]) -> List[Dict]:
        """Fallback tax deduction analysis"""
        business_transactions = self.filter_business_transactions(transactions)
        
        deductions = []
        for transaction in business_transactions[:10]:  # Limit to 10
            deductions.append({
                "category": "D11",
                "category_name": "Professional fees",
                "amount": abs(float(transaction.get('amount', 0))),
                "confidence": "LOW",
                "description": f"Potential business expense: {transaction.get('description', 'Unknown')}",
                "documentation_required": "Receipts and business purpose records",
                "transaction_ids": [transaction.get('id', '')]
            })
        
        return deductions

    def fallback_goal_suggestions(self, financial_summary: Dict) -> List[Dict]:
        """Fallback goal suggestions when AI analysis fails"""
        goals = []
        
        # Emergency fund goal
        monthly_expenses = financial_summary.get('monthly_expenses', 0)
        if monthly_expenses > 0:
            goals.append({
                "goal_type": "emergency_fund",
                "title": "Build Emergency Fund",
                "description": "Save 3-6 months of expenses for financial security",
                "target_amount": monthly_expenses * 3,
                "current_amount": 0,
                "timeline_months": 12,
                "monthly_target": (monthly_expenses * 3) / 12,
                "priority": "HIGH",
                "action_steps": ["Set up automatic transfers", "Open high-yield savings account"]
            })
        
        # Savings improvement goal
        savings_rate = financial_summary.get('savings_rate', 0)
        if savings_rate < 20:
            goals.append({
                "goal_type": "savings",
                "title": "Improve Savings Rate",
                "description": "Increase savings rate to 20% of income",
                "target_amount": 0,
                "current_amount": 0,
                "timeline_months": 6,
                "monthly_target": 0,
                "priority": "MEDIUM",
                "action_steps": ["Track expenses", "Reduce discretionary spending", "Automate savings"]
            })
        
        return goals

# Global instance of the financial insights engine
_insights_engine = None

def get_insights_engine():
    """Get or create the global insights engine instance"""
    global _insights_engine
    if _insights_engine is None:
        _insights_engine = FinancialInsightsEngine()
    return _insights_engine

# Wrapper functions for backward compatibility with existing imports

def analyze_transactions(transactions: List[Dict], user_profile: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Wrapper function to analyze transactions using the FinancialInsightsEngine
    """
    engine = get_insights_engine()
    return engine.analyze_transactions(transactions, user_profile)

def identify_tax_deductions(transactions: List[Dict], receipts: Optional[List[Dict]] = None) -> List[Dict]:
    """
    Wrapper function to identify tax deductions using the FinancialInsightsEngine
    """
    engine = get_insights_engine()
    return engine.identify_tax_deductions(transactions, receipts)

def suggest_financial_goals(transactions: List[Dict], user_id: str) -> List[Dict]:
    """
    Wrapper function to suggest financial goals using the FinancialInsightsEngine
    """
    engine = get_insights_engine()
    return engine.suggest_financial_goals(transactions, user_id)

def generate_financial_report(user_id: str, transactions: List[Dict], period: str = "monthly") -> Dict[str, Any]:
    """
    Wrapper function to generate financial report using the FinancialInsightsEngine
    """
    engine = get_insights_engine()
    return engine.generate_financial_report(user_id, transactions, period) 