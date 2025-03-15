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
        transactions (list): List of transaction objects
        user_profile (dict, optional): User profile information for personalized insights
        
    Returns:
        dict: Analysis results including spending patterns, recommendations, etc.
    """
    if not CLAUDE_API_KEY:
        raise ValueError("Claude API key is not set in environment variables")
    
    # Prepare transaction data for Claude
    transaction_data = [t.to_dict() if hasattr(t, 'to_dict') else t for t in transactions]
    
    # Create prompt for Claude
    prompt = f"""
    I need you to analyze the following financial transactions and provide insights:
    
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
    
    Format your response as a JSON object with the following structure:
    {
        "spending_patterns": [...],
        "top_categories": [...],
        "unusual_transactions": [...],
        "saving_recommendations": [...],
        "tax_deductions": [...]
    }
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
            }
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
        return {"error": "Could not parse JSON from Claude response", "raw_response": result}
    
    except Exception as e:
        return {"error": str(e)}


def identify_tax_deductions(transactions, receipts=None):
    """
    Identify potential tax deductions from transactions and receipts.
    
    Args:
        transactions (list): List of transaction objects
        receipts (list, optional): List of receipt objects with detailed item information
        
    Returns:
        list: Potential tax deductions with confidence scores
    """
    # Similar implementation to analyze_transactions, but focused on tax deductions
    # This is a placeholder for the actual implementation
    return []


def generate_financial_report(user_id, time_period="monthly"):
    """
    Generate a comprehensive financial report for a user.
    
    Args:
        user_id (str): User ID to generate report for
        time_period (str): Time period for the report (daily, weekly, monthly, yearly)
        
    Returns:
        dict: Financial report data
    """
    # This is a placeholder for the actual implementation
    # In a real implementation, this would:
    # 1. Fetch user's transactions from the database
    # 2. Analyze the transactions
    # 3. Generate a comprehensive report
    return {
        "user_id": user_id,
        "time_period": time_period,
        "report_data": {}
    }


def suggest_financial_goals(user_id, transactions=None):
    """
    Suggest personalized financial goals based on user's transaction history.
    
    Args:
        user_id (str): User ID to generate goals for
        transactions (list, optional): List of transaction objects
        
    Returns:
        list: Suggested financial goals
    """
    # This is a placeholder for the actual implementation
    return [] 