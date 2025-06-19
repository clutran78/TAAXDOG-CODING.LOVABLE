"""
Budget Prediction Module for TAAXDOG Finance Application

This module provides AI-powered budget predictions by analyzing
historical transaction data and using Claude AI for intelligent forecasting.
"""

import os
import json
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from collections import defaultdict
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Claude API configuration
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')
CLAUDE_API_URL = os.environ.get('CLAUDE_API_URL', 'https://api.anthropic.com/v1/messages')
CLAUDE_MODEL = os.environ.get('CLAUDE_MODEL', 'claude-3-7-sonnet-20240307')


def predict_future_budget(transactions: List[Dict], prediction_months: int = 3) -> Dict:
    """
    Predict future budget based on historical transaction data.
    
    This function analyzes spending patterns from historical transactions
    and uses AI to predict future budget requirements for the specified period.
    
    Args:
        transactions: List of transaction dictionaries from Basiq API
        prediction_months: Number of months to predict ahead (default: 3)
        
    Returns:
        Dictionary containing budget predictions, confidence scores, and recommendations
    """
    try:
        if not transactions:
            return {"error": "No transaction data provided for prediction"}
        
        # Process and analyze transaction data
        processed_data = _process_transaction_data(transactions)
        
        # Calculate spending patterns and statistics
        spending_patterns = _calculate_spending_patterns(processed_data)
        
        # Generate AI-powered predictions using Claude
        if CLAUDE_API_KEY:
            predictions = _generate_ai_predictions(spending_patterns, prediction_months)
        else:
            predictions = _generate_basic_predictions(spending_patterns, prediction_months)
        
        # Calculate confidence scores based on data quality
        confidence_scores = _calculate_confidence_scores(processed_data)
        
        # Generate budget recommendations
        recommendations = _generate_budget_recommendations(predictions, spending_patterns)
        
        return {
            "success": True,
            "predictions": predictions,
            "confidence_scores": confidence_scores,
            "recommendations": recommendations,
            "analysis_summary": {
                "transaction_count": len(processed_data),
                "analysis_period_days": _get_analysis_period_days(processed_data),
                "average_monthly_spending": spending_patterns.get("monthly_average", 0)
            }
        }
        
    except Exception as e:
        logger.error(f"Error predicting future budget: {str(e)}")
        return {"error": f"Failed to predict budget: {str(e)}"}


def analyze_spending_patterns(transactions: List[Dict]) -> Dict:
    """
    Analyze historical spending patterns to identify trends and categories.
    
    Args:
        transactions: List of transaction dictionaries
        
    Returns:
        Dictionary containing detailed spending pattern analysis
    """
    try:
        if not transactions:
            return {"error": "No transaction data provided for analysis"}
        
        # Process transaction data
        processed_data = _process_transaction_data(transactions)
        
        # Calculate various spending metrics
        monthly_spending = _group_by_month(processed_data)
        category_spending = _group_by_category(processed_data)
        trend_analysis = _analyze_spending_trends(monthly_spending)
        seasonal_patterns = _identify_seasonal_patterns(monthly_spending)
        
        return {
            "success": True,
            "monthly_spending": monthly_spending,
            "category_spending": category_spending,
            "trend_analysis": trend_analysis,
            "seasonal_patterns": seasonal_patterns,
            "summary_statistics": _calculate_summary_stats(processed_data)
        }
        
    except Exception as e:
        logger.error(f"Error analyzing spending patterns: {str(e)}")
        return {"error": f"Failed to analyze spending patterns: {str(e)}"}


def detect_budget_anomalies(transactions: List[Dict]) -> Dict:
    """
    Detect unusual spending patterns that may indicate budget risks.
    
    Args:
        transactions: List of transaction dictionaries
        
    Returns:
        Dictionary containing detected anomalies and risk assessment
    """
    try:
        if not transactions:
            return {"error": "No transaction data provided for anomaly detection"}
        
        # Process data and analyze patterns
        processed_data = _process_transaction_data(transactions)
        spending_patterns = _calculate_spending_patterns(processed_data)
        
        # Detect statistical anomalies
        anomalies = _detect_statistical_anomalies(processed_data, spending_patterns)
        
        # Assess risk levels
        risk_assessment = _assess_budget_risks(anomalies)
        
        # Generate recommendations for anomalies
        anomaly_recommendations = _generate_anomaly_recommendations(anomalies)
        
        return {
            "success": True,
            "anomalies": anomalies,
            "risk_assessment": risk_assessment,
            "recommendations": anomaly_recommendations
        }
        
    except Exception as e:
        logger.error(f"Error detecting budget anomalies: {str(e)}")
        return {"error": f"Failed to detect anomalies: {str(e)}"}


def create_budget_plan(transactions: List[Dict], target_savings: float = None,
                      income: float = None) -> Dict:
    """
    Create a comprehensive budget plan based on spending history and goals.
    
    Args:
        transactions: Historical transaction data
        target_savings: Monthly target savings amount
        income: Monthly income amount
        
    Returns:
        Dictionary containing detailed budget plan
    """
    try:
        if not transactions:
            return {"error": "No transaction data provided for budget planning"}
        
        # Analyze current spending patterns
        analysis = analyze_spending_patterns(transactions)
        if "error" in analysis:
            return analysis
        
        # Get future predictions
        predictions = predict_future_budget(transactions, 6)  # 6-month predictions
        if "error" in predictions:
            return predictions
        
        # Create budget plan using AI if available
        if CLAUDE_API_KEY:
            budget_plan = _generate_ai_budget_plan(analysis, predictions, target_savings, income)
        else:
            budget_plan = _generate_basic_budget_plan(analysis, predictions, target_savings, income)
        
        return budget_plan
        
    except Exception as e:
        logger.error(f"Error creating budget plan: {str(e)}")
        return {"error": f"Failed to create budget plan: {str(e)}"}


# Private helper functions
def _process_transaction_data(transactions: List[Dict]) -> List[Dict]:
    """Process and normalize transaction data for analysis."""
    processed = []
    
    for transaction in transactions:
        # Handle different transaction formats from Basiq API
        if not isinstance(transaction, dict):
            continue
            
        # Extract and normalize transaction data
        amount = abs(float(transaction.get('amount', 0)))
        direction = transaction.get('direction', 'debit')
        
        # Only include debit transactions (expenses) for budget analysis
        if direction == 'debit' and amount > 0:
            processed_transaction = {
                'id': transaction.get('id', ''),
                'amount': amount,
                'description': transaction.get('description', ''),
                'date': _parse_date(transaction.get('postDate') or transaction.get('date')),
                'category': transaction.get('category', 'Other').title(),
                'merchant': transaction.get('merchant', '')
            }
            processed.append(processed_transaction)
    
    # Sort by date for trend analysis
    processed.sort(key=lambda x: x['date'])
    return processed


def _parse_date(date_str: str) -> datetime:
    """Parse date string to datetime object with error handling."""
    if not date_str:
        return datetime.now()
    
    try:
        # Handle ISO format with timezone
        if 'T' in date_str:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        # Handle simple date format
        else:
            return datetime.strptime(date_str, '%Y-%m-%d')
    except (ValueError, TypeError):
        # Return current date if parsing fails
        return datetime.now()


def _group_by_month(transactions: List[Dict]) -> Dict:
    """Group transactions by month and calculate totals."""
    monthly_data = defaultdict(lambda: {'total': 0, 'count': 0, 'categories': defaultdict(float)})
    
    for transaction in transactions:
        month_key = transaction['date'].strftime('%Y-%m')
        monthly_data[month_key]['total'] += transaction['amount']
        monthly_data[month_key]['count'] += 1
        monthly_data[month_key]['categories'][transaction['category']] += transaction['amount']
    
    # Convert to regular dict and sort by month
    return dict(sorted(monthly_data.items()))


def _group_by_category(transactions: List[Dict]) -> Dict:
    """Group transactions by category and calculate statistics."""
    category_data = defaultdict(lambda: {'total': 0, 'count': 0, 'average': 0, 'percentage': 0})
    total_amount = sum(t['amount'] for t in transactions)
    
    for transaction in transactions:
        category = transaction['category']
        category_data[category]['total'] += transaction['amount']
        category_data[category]['count'] += 1
    
    # Calculate averages and percentages
    for category, data in category_data.items():
        data['average'] = data['total'] / data['count'] if data['count'] > 0 else 0
        data['percentage'] = (data['total'] / total_amount * 100) if total_amount > 0 else 0
    
    # Sort by total spending
    return dict(sorted(category_data.items(), key=lambda x: x[1]['total'], reverse=True))


def _calculate_spending_patterns(transactions: List[Dict]) -> Dict:
    """Calculate comprehensive spending patterns and statistics."""
    if not transactions:
        return {}
    
    # Group data
    monthly_spending = _group_by_month(transactions)
    category_spending = _group_by_category(transactions)
    
    # Calculate basic statistics
    amounts = [t['amount'] for t in transactions]
    monthly_totals = [data['total'] for data in monthly_spending.values()]
    
    return {
        'monthly_spending': monthly_spending,
        'category_spending': category_spending,
        'total_spending': sum(amounts),
        'monthly_average': sum(monthly_totals) / len(monthly_totals) if monthly_totals else 0,
        'transaction_average': sum(amounts) / len(amounts),
        'highest_month': max(monthly_totals) if monthly_totals else 0,
        'lowest_month': min(monthly_totals) if monthly_totals else 0
    }


def _analyze_spending_trends(monthly_spending: Dict) -> Dict:
    """Analyze spending trends over time."""
    if len(monthly_spending) < 2:
        return {'trend': 'insufficient_data', 'description': 'Need at least 2 months of data'}
    
    # Get monthly amounts in chronological order
    sorted_months = sorted(monthly_spending.keys())
    amounts = [monthly_spending[month]['total'] for month in sorted_months]
    
    # Calculate trend direction
    if len(amounts) >= 3:
        recent_avg = sum(amounts[-3:]) / 3
        earlier_avg = sum(amounts[:-3]) / len(amounts[:-3]) if len(amounts) > 3 else amounts[0]
        
        if recent_avg > earlier_avg * 1.1:
            trend = 'increasing'
            description = 'Spending has been increasing in recent months'
        elif recent_avg < earlier_avg * 0.9:
            trend = 'decreasing'
            description = 'Spending has been decreasing in recent months'
        else:
            trend = 'stable'
            description = 'Spending has been relatively stable'
    else:
        trend = 'stable'
        description = 'Limited data available for trend analysis'
    
    return {
        'trend': trend,
        'description': description,
        'monthly_amounts': amounts,
        'recent_average': sum(amounts[-3:]) / min(3, len(amounts)),
        'overall_average': sum(amounts) / len(amounts)
    }


def _identify_seasonal_patterns(monthly_spending: Dict) -> Dict:
    """Identify seasonal spending patterns by month."""
    seasonal_data = defaultdict(list)
    
    # Group spending by calendar month
    for month_key, data in monthly_spending.items():
        month_num = int(month_key.split('-')[1])
        seasonal_data[month_num].append(data['total'])
    
    # Calculate seasonal averages
    seasonal_averages = {}
    for month, amounts in seasonal_data.items():
        seasonal_averages[month] = sum(amounts) / len(amounts) if amounts else 0
    
    # Identify high and low spending months
    if seasonal_averages:
        high_months = sorted(seasonal_averages.keys(), 
                           key=lambda x: seasonal_averages[x], reverse=True)[:3]
        low_months = sorted(seasonal_averages.keys(), 
                          key=lambda x: seasonal_averages[x])[:3]
    else:
        high_months = []
        low_months = []
    
    return {
        'monthly_averages': seasonal_averages,
        'high_spending_months': high_months,
        'low_spending_months': low_months,
        'seasonal_variation': max(seasonal_averages.values()) - min(seasonal_averages.values()) 
                             if seasonal_averages else 0
    }


def _calculate_summary_stats(transactions: List[Dict]) -> Dict:
    """Calculate summary statistics for transactions."""
    if not transactions:
        return {}
    
    amounts = [t['amount'] for t in transactions]
    dates = [t['date'] for t in transactions]
    
    return {
        'total_transactions': len(transactions),
        'total_amount': sum(amounts),
        'average_transaction': sum(amounts) / len(amounts),
        'median_transaction': sorted(amounts)[len(amounts) // 2],
        'highest_transaction': max(amounts),
        'lowest_transaction': min(amounts),
        'analysis_start_date': min(dates).isoformat(),
        'analysis_end_date': max(dates).isoformat(),
        'analysis_period_days': (max(dates) - min(dates)).days
    }


def _generate_ai_predictions(patterns: Dict, prediction_months: int) -> Dict:
    """Generate AI-powered predictions using Claude."""
    try:
        # Create prompt for Claude AI
        prompt = _create_prediction_prompt(patterns, prediction_months)
        
        # Call Claude API
        response = requests.post(
            CLAUDE_API_URL,
            headers={
                "x-api-key": CLAUDE_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            },
            json={
                "model": CLAUDE_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4000
            },
            timeout=30
        )
        
        response.raise_for_status()
        result = response.json()
        
        # Extract JSON from Claude's response
        content = result.get('content', [])
        for item in content:
            if item.get('type') == 'text':
                text = item.get('text', '')
                try:
                    # Find and parse JSON in the response
                    start_idx = text.find('{')
                    end_idx = text.rfind('}') + 1
                    if start_idx >= 0 and end_idx > start_idx:
                        json_str = text[start_idx:end_idx]
                        return json.loads(json_str)
                except json.JSONDecodeError:
                    pass
        
        # Fallback to basic predictions if AI fails
        return _generate_basic_predictions(patterns, prediction_months)
        
    except Exception as e:
        logger.error(f"Error calling Claude API: {e}")
        return _generate_basic_predictions(patterns, prediction_months)


def _generate_basic_predictions(patterns: Dict, prediction_months: int) -> Dict:
    """Generate basic statistical predictions without AI."""
    monthly_avg = patterns.get('monthly_average', 0)
    trend = patterns.get('monthly_spending', {})
    
    predictions = {}
    current_date = datetime.now()
    
    # Simple prediction based on historical average with slight trend adjustment
    for i in range(prediction_months):
        future_date = current_date + timedelta(days=30 * (i + 1))
        month_key = future_date.strftime('%Y-%m')
        
        # Basic prediction with small variation
        predicted_amount = monthly_avg * (1 + (i * 0.02))  # 2% growth per month
        
        predictions[month_key] = {
            'predicted_total': round(predicted_amount, 2),
            'confidence': 0.7,  # Basic confidence level
            'method': 'statistical_average'
        }
    
    return predictions


def _create_prediction_prompt(patterns: Dict, prediction_months: int) -> str:
    """Create prompt for Claude AI budget predictions."""
    return f"""
    Analyze the following spending data and predict budget requirements for the next {prediction_months} months.
    
    Spending Patterns:
    {json.dumps(patterns, indent=2, default=str)}
    
    Please provide predictions in this JSON format:
    {{
        "monthly_predictions": {{
            "YYYY-MM": {{
                "predicted_total": <amount>,
                "confidence": <0.0-1.0>,
                "factors": ["list", "of", "factors"],
                "notes": "explanation"
            }}
        }},
        "overall_trend": "description",
        "risk_factors": ["potential", "risks"],
        "recommendations": ["actionable", "advice"]
    }}
    
    Consider Australian financial patterns, seasonal trends, and economic factors.
    """


def _calculate_confidence_scores(transactions: List[Dict]) -> Dict:
    """Calculate prediction confidence based on data quality."""
    if not transactions:
        return {'overall': 0.0}
    
    # Factors affecting confidence
    transaction_count = len(transactions)
    date_range_days = _get_analysis_period_days(transactions)
    
    # More transactions = higher confidence
    count_score = min(1.0, transaction_count / 50)  # Max at 50 transactions
    
    # Longer time period = higher confidence
    time_score = min(1.0, date_range_days / 90)  # Max at 90 days
    
    # Data consistency score (simplified)
    consistency_score = 0.8  # Placeholder for more complex analysis
    
    overall_confidence = (count_score + time_score + consistency_score) / 3
    
    return {
        'overall': round(overall_confidence, 2),
        'data_quantity': round(count_score, 2),
        'time_coverage': round(time_score, 2),
        'data_consistency': round(consistency_score, 2)
    }


def _generate_budget_recommendations(predictions: Dict, patterns: Dict) -> List[Dict]:
    """Generate actionable budget recommendations."""
    recommendations = []
    
    # Monthly budget recommendation
    monthly_avg = patterns.get('monthly_average', 0)
    if monthly_avg > 0:
        recommended_budget = monthly_avg * 1.1  # 10% buffer
        recommendations.append({
            'type': 'monthly_budget',
            'title': 'Monthly Budget Recommendation',
            'description': f'Set aside ${recommended_budget:.2f} per month for expenses',
            'amount': recommended_budget,
            'priority': 'high'
        })
    
    # Category-specific recommendations
    category_spending = patterns.get('category_spending', {})
    top_categories = list(category_spending.items())[:3]  # Top 3 categories
    
    for category, data in top_categories:
        recommendations.append({
            'type': 'category_budget',
            'title': f'{category} Budget',
            'description': f'Allocate ${data["average"]:.2f} monthly for {category}',
            'amount': data['average'],
            'priority': 'medium'
        })
    
    return recommendations


def _get_analysis_period_days(transactions: List[Dict]) -> int:
    """Get the number of days covered by the transaction analysis."""
    if not transactions:
        return 0
    
    dates = [t['date'] for t in transactions]
    return (max(dates) - min(dates)).days


def _detect_statistical_anomalies(transactions: List[Dict], patterns: Dict) -> List[Dict]:
    """Detect statistical anomalies in spending patterns."""
    anomalies = []
    
    monthly_spending = patterns.get('monthly_spending', {})
    monthly_avg = patterns.get('monthly_average', 0)
    
    # Check for months with unusually high spending
    for month, data in monthly_spending.items():
        if data['total'] > monthly_avg * 1.5:  # 50% above average
            anomalies.append({
                'type': 'high_spending_month',
                'month': month,
                'amount': data['total'],
                'threshold': monthly_avg * 1.5,
                'severity': 'medium',
                'description': f'Spending in {month} was ${data["total"]:.2f}, significantly above average'
            })
    
    return anomalies


def _assess_budget_risks(anomalies: List[Dict]) -> Dict:
    """Assess overall budget risk based on detected anomalies."""
    if not anomalies:
        return {'risk_level': 'low', 'risk_score': 0.1}
    
    # Calculate risk score based on number and severity of anomalies
    risk_score = len(anomalies) * 0.2  # Base score per anomaly
    high_severity_count = sum(1 for a in anomalies if a.get('severity') == 'high')
    risk_score += high_severity_count * 0.3  # Additional score for high severity
    
    # Determine risk level
    if risk_score >= 0.7:
        risk_level = 'high'
    elif risk_score >= 0.4:
        risk_level = 'medium' 
    else:
        risk_level = 'low'
    
    return {
        'risk_level': risk_level,
        'risk_score': min(1.0, risk_score),
        'anomaly_count': len(anomalies),
        'high_severity_count': high_severity_count
    }


def _generate_anomaly_recommendations(anomalies: List[Dict]) -> List[Dict]:
    """Generate recommendations based on detected anomalies."""
    recommendations = []
    
    for anomaly in anomalies:
        if anomaly['type'] == 'high_spending_month':
            recommendations.append({
                'type': 'spending_alert',
                'title': 'High Spending Alert',
                'description': f'Review expenses for {anomaly["month"]} - spending was unusually high',
                'action': 'Analyze transactions and identify areas to reduce spending',
                'priority': 'high'
            })
    
    # General recommendations if multiple anomalies
    if len(anomalies) > 2:
        recommendations.append({
            'type': 'budget_review',
            'title': 'Budget Review Needed',
            'description': 'Multiple spending anomalies detected - consider reviewing your budget',
            'action': 'Set stricter spending limits and monitor expenses more closely',
            'priority': 'high'
        })
    
    return recommendations


def _generate_ai_budget_plan(analysis: Dict, predictions: Dict, 
                           target_savings: float = None, income: float = None) -> Dict:
    """Generate comprehensive budget plan using AI."""
    # Placeholder for AI-generated budget plan
    return {
        'success': True,
        'budget_plan': 'AI-generated budget plan would be created here',
        'analysis': analysis,
        'predictions': predictions,
        'target_savings': target_savings,
        'income': income
    }


def _generate_basic_budget_plan(analysis: Dict, predictions: Dict,
                              target_savings: float = None, income: float = None) -> Dict:
    """Generate basic budget plan without AI."""
    monthly_avg = analysis.get('analysis_summary', {}).get('average_monthly_spending', 0)
    
    budget_plan = {
        'success': True,
        'monthly_budget': monthly_avg * 1.1,  # 10% buffer
        'target_savings': target_savings or (income * 0.2 if income else 0),
        'spending_categories': analysis.get('category_spending', {}),
        'recommendations': [
            'Track expenses regularly',
            'Set category-specific spending limits',
            'Review budget monthly and adjust as needed'
        ]
    }
    
    return budget_plan 