"""
Financial insights module using Claude 3.7 for generating financial insights.

This module provides functions to analyze financial data and generate insights
using Claude 3.7 AI model. It processes transaction data, identifies patterns,
and provides recommendations for tax optimization and financial management.
"""

import os
import json
import requests
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

# Claude API configuration
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY')
CLAUDE_API_URL = os.environ.get('CLAUDE_API_URL', 'https://api.anthropic.com/v1/messages')
CLAUDE_MODEL = os.environ.get('CLAUDE_MODEL', 'claude-3-7-sonnet-20240307')

def analyze_transactions(transactions, user_profile=None):
    """
    Analyze transactions to identify spending patterns and provide insights.
    
    Args:
        transactions (list): List of transaction objects from Basiq API
        user_profile (dict, optional): User profile information for personalized insights
        
    Returns:
        dict: Analysis results including spending patterns, recommendations, etc.
    """
    if not CLAUDE_API_KEY:
        return {"error": "Claude API key is not set in environment variables"}
    
    # Prepare transaction data for Claude
    # Format Basiq transaction data appropriately
    transaction_data = []
    
    for t in transactions:
        if isinstance(t, dict):
            # Extract relevant transaction fields for analysis
            transaction = {
                'id': t.get('id'),
                'amount': t.get('amount'),
                'description': t.get('description'),
                'postDate': t.get('postDate'),
                'category': t.get('category'),
                'direction': t.get('direction', 'debit'),
                'account': t.get('account', {}).get('id') if isinstance(t.get('account'), dict) else t.get('account')
            }
            transaction_data.append(transaction)
        elif hasattr(t, 'to_dict'):
            transaction_data.append(t.to_dict())
        else:
            transaction_data.append({'error': 'Unknown transaction format'})
    
    # Create prompt for Claude
    prompt = f"""
    I need you to analyze the following financial transactions and provide detailed insights:
    
    Transaction Data:
    {json.dumps(transaction_data, indent=2)}
    
    User Profile:
    {json.dumps(user_profile, indent=2) if user_profile else 'No profile provided'}
    
    Please provide the following analysis:
    1. Spending patterns and trends
    2. Top spending categories
    3. Unusual transactions or potential issues
    4. Recommendations for saving money
    5. Potential tax deductions based on Australian tax law
    6. Monthly budget suggestions
    
    Format your response as a JSON object with the following structure:
    {{
        "spending_patterns": [
            {{ "pattern": "...", "description": "...", "amount": "..." }}
        ],
        "top_categories": [
            {{ "category": "...", "amount": "...", "percentage": "..." }}
        ],
        "unusual_transactions": [
            {{ "description": "...", "amount": "...", "date": "...", "reason": "..." }}
        ],
        "saving_recommendations": [
            {{ "recommendation": "...", "potential_saving": "...", "difficulty": "..." }}
        ],
        "tax_deductions": [
            {{ "category": "...", "amount": "...", "description": "..." }}
        ],
        "budget_suggestions": [
            {{ "category": "...", "current_spending": "...", "suggested_limit": "...", "rationale": "..." }}
        ]
    }}
    """
    
    try:
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
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 4000
            },
            timeout=30  # Add timeout to prevent hanging indefinitely
        )
        
        response.raise_for_status()
        result = response.json()
        
        # Extract and parse the JSON response from Claude
        content = result.get('content', [])
        if content and isinstance(content, list):
            for item in content:
                if item.get('type') == 'text':
                    text = item.get('text', '')
                    # Extract JSON from the response
                    try:
                        start_idx = text.find('{')
                        end_idx = text.rfind('}') + 1
                        if start_idx >= 0 and end_idx > start_idx:
                            json_str = text[start_idx:end_idx]
                            return json.loads(json_str)
                    except json.JSONDecodeError:
                        pass
        
        # If we couldn't parse JSON, return the raw response
        return {"error": "Could not parse JSON from Claude response", "raw_response": str(result)}
    
    except requests.exceptions.Timeout:
        return {"error": "Request to Claude API timed out"}
    except requests.exceptions.ConnectionError:
        return {"error": "Connection error when calling Claude API"}
    except requests.exceptions.RequestException as e:
        return {"error": f"Error calling Claude API: {str(e)}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}


def identify_tax_deductions(transactions, receipts=None):
    """
    Identify potential tax deductions from transactions and receipts.
    
    Args:
        transactions (list): List of transaction objects
        receipts (list, optional): List of receipt objects with detailed item information
        
    Returns:
        list: Potential tax deductions with confidence scores
    """
    if not CLAUDE_API_KEY:
        return {"error": "Claude API key is not set in environment variables"}
    
    # Prepare transaction and receipt data
    transaction_data = []
    receipt_data = []
    
    for t in transactions:
        if isinstance(t, dict):
            trans = {
                'id': t.get('id'),
                'amount': t.get('amount'),
                'description': t.get('description'),
                'postDate': t.get('postDate'),
                'category': t.get('category')
            }
            transaction_data.append(trans)
        elif hasattr(t, 'to_dict'):
            transaction_data.append(t.to_dict())
    
    if receipts:
        for r in receipts:
            if isinstance(r, dict):
                receipt_data.append(r)
            elif hasattr(r, 'to_dict'):
                receipt_data.append(r.to_dict())
    
    # Create prompt for Claude
    prompt = f"""
    I need you to identify potential tax deductions from the following financial data according to Australian tax law:
    
    Transaction Data:
    {json.dumps(transaction_data, indent=2)}
    
    Receipt Data:
    {json.dumps(receipt_data, indent=2) if receipt_data else 'No receipts provided'}
    
    Please identify potential tax deductions and provide the following for each:
    1. Category of deduction
    2. Amount that may be deductible
    3. Confidence level (high, medium, low)
    4. Explanation of why it might be deductible
    5. Any documentation requirements
    
    Format your response as a JSON array of deduction objects.
    """
    
    try:
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
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 4000
            },
            timeout=30
        )
        
        response.raise_for_status()
        result = response.json()
        
        # Extract and parse the JSON response
        content = result.get('content', [])
        if content and isinstance(content, list):
            for item in content:
                if item.get('type') == 'text':
                    text = item.get('text', '')
                    # Extract JSON from the response
                    try:
                        start_idx = text.find('[')
                        end_idx = text.rfind(']') + 1
                        if start_idx >= 0 and end_idx > start_idx:
                            json_str = text[start_idx:end_idx]
                            return json.loads(json_str)
                    except json.JSONDecodeError:
                        pass
        
        return {"error": "Could not parse JSON from Claude response"}
    
    except Exception as e:
        return {"error": str(e)}


def generate_financial_report(user_id, transactions, time_period="monthly"):
    """
    Generate a comprehensive financial report for a user.
    
    Args:
        user_id (str): User ID to generate report for
        transactions (list): User's transactions to analyze
        time_period (str): Time period for the report (daily, weekly, monthly, yearly)
        
    Returns:
        dict: Financial report data
    """
    if not transactions:
        return {
            "user_id": user_id,
            "time_period": time_period,
            "error": "No transactions available for analysis"
        }
    
    # Get financial insights using Claude
    insights = analyze_transactions(transactions)
    
    # Create comprehensive report
    report = {
        "user_id": user_id,
        "time_period": time_period,
        "report_date": datetime.now().isoformat(),
        "insights": insights,
        "summary": {
            "total_income": sum([t.get('amount', 0) for t in transactions if t.get('direction') == 'credit']),
            "total_expenses": sum([t.get('amount', 0) for t in transactions if t.get('direction') == 'debit']),
            "transaction_count": len(transactions)
        }
    }
    
    return report


def suggest_financial_goals(user_id, transactions=None):
    """
    Suggest personalized financial goals based on user's transaction history.
    
    Args:
        user_id (str): User ID to generate goals for
        transactions (list, optional): List of transaction objects
        
    Returns:
        list: Suggested financial goals
    """
    if not CLAUDE_API_KEY:
        return {"error": "Claude API key is not set in environment variables"}
    
    if not transactions:
        return {"error": "No transactions provided for analysis"}
    
    # Prepare transaction data
    transaction_data = []
    for t in transactions:
        if isinstance(t, dict):
            trans = {
                'amount': t.get('amount'),
                'description': t.get('description'),
                'postDate': t.get('postDate'),
                'category': t.get('category'),
                'direction': t.get('direction', 'debit')
            }
            transaction_data.append(trans)
        elif hasattr(t, 'to_dict'):
            transaction_data.append(t.to_dict())
    
    # Create prompt for Claude
    prompt = f"""
    I need you to suggest personalized financial goals based on the following transaction history:
    
    Transaction Data:
    {json.dumps(transaction_data, indent=2)}
    
    Please suggest 3-5 SMART financial goals that would be appropriate for this user based on their spending patterns.
    For each goal, provide:
    1. Goal title
    2. Description
    3. Target amount (if applicable)
    4. Suggested timeframe
    5. Priority (high, medium, low)
    6. Steps to achieve
    
    Format your response as a JSON array of goal objects.
    """
    
    try:
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
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 4000
            },
            timeout=30
        )
        
        response.raise_for_status()
        result = response.json()
        
        # Extract and parse the JSON response
        content = result.get('content', [])
        if content and isinstance(content, list):
            for item in content:
                if item.get('type') == 'text':
                    text = item.get('text', '')
                    # Extract JSON from the response
                    try:
                        start_idx = text.find('[')
                        end_idx = text.rfind(']') + 1
                        if start_idx >= 0 and end_idx > start_idx:
                            json_str = text[start_idx:end_idx]
                            return json.loads(json_str)
                    except json.JSONDecodeError:
                        pass
        
        return {"error": "Could not parse JSON from Claude response"}
    
    except Exception as e:
        return {"error": str(e)} 