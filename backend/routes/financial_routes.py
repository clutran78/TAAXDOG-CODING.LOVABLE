from flask import Blueprint, request, jsonify
from firebase_config import db
from basiq_api import get_user_transactions
from ai.financial_insights import (
    analyze_transactions,
    identify_tax_deductions,
    generate_financial_report,
    suggest_financial_goals
)
from .utils import api_error, login_required, logger

financial_routes = Blueprint('financial', __name__, url_prefix='/api/financial')

# API endpoint for financial insights
@financial_routes.route('/insights', methods=['GET'])
@login_required
def get_financial_insights():
    """
    Get AI-powered financial insights based on user's transactions
    """
    try:
        # Get user ID from request
        user_id = request.user_id
        
        # Get filter parameters from request
        filter_str = request.args.get('filter')
        
        # Get user's transactions from Basiq
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return api_error('Failed to get transactions', status=400, details=transactions_result.get('error'))
        
        # Get user profile
        user_profile = None
        if db:
            try:
                user_ref = db.collection('users').document(user_id)
                user_doc = user_ref.get()
                if user_doc.exists:
                    user_profile = user_doc.to_dict()
            except Exception as e:
                logger.error(f"Error fetching user profile: {e}")
        
        # Analyze transactions with Claude 3.7
        insights = analyze_transactions(
            transactions_result.get('transactions', {}).get('data', []),
            user_profile
        )
        
        if insights.get('error'):
            return api_error('Failed to analyze transactions', status=500, details=insights.get('error'))
        
        return jsonify({
            'success': True,
            'insights': insights
        })
        
    except Exception as e:
        return api_error('Server error occurred', status=500, details=str(e))
    

# API endpoint for tax deductions
@financial_routes.route('/tax-deductions', methods=['GET'])
@login_required
def get_tax_deductions():
    """
    Get potential tax deductions based on user's transactions and receipts
    """
    try:
        # Get user ID from request
        user_id = request.user_id
        
        # Get filter parameters from request
        filter_str = request.args.get('filter')
        
        # Get user's transactions from Basiq
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return api_error('Failed to get transactions', status=400, details=transactions_result.get('error'))
        
        # Get user's receipts
        receipts = []
        if db:
            try:
                receipts_ref = db.collection('users').document(user_id).collection('receipts')
                receipts_docs = receipts_ref.get()
                for doc in receipts_docs:
                    receipt = doc.to_dict()
                    receipt['id'] = doc.id
                    receipts.append(receipt)
            except Exception as e:
                logger.error(f"Error fetching receipts: {e}")
        
        # Identify tax deductions with Claude 3.7
        deductions = identify_tax_deductions(
            transactions_result.get('transactions', {}).get('data', []),
            receipts
        )
        
        if isinstance(deductions, dict) and deductions.get('error'):
            return api_error('Failed to identify tax deductions', status=500, details=deductions.get('error'))
        
        return jsonify({
            'success': True,
            'deductions': deductions
        })
        
    except Exception as e:
        return api_error('Server error occurred', status=500, details=str(e))
    
# API endpoint for financial reports
@financial_routes.route('/reports', methods=['GET'])
@login_required
def get_financial_report():
    """
    Generate a comprehensive financial report
    """
    try:
        # Get user ID from request
        user_id = request.user_id
        
        # Get time period from request
        time_period = request.args.get('period', 'monthly')
        
        # Get filter parameters from request
        filter_str = request.args.get('filter')
        
        # Get user's transactions from Basiq
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return api_error('Failed to get transactions', status=400, details=transactions_result.get('error'))
        
        # Generate financial report with Claude 3.7
        report = generate_financial_report(
            user_id,
            transactions_result.get('transactions', {}).get('data', []),
            time_period
        )
        
        if report.get('error'):
            return api_error('Failed to generate financial report', status=500, details=report.get('error'))
        
        return jsonify({
            'success': True,
            'report': report
        })
        
    except Exception as e:
        return api_error('Server error occurred', status=500, details=str(e))
    
# API endpoint for financial goals
@financial_routes.route('/goals', methods=['GET'])
@login_required
def get_financial_goals():
    """
    Get AI-suggested financial goals based on user's transactions
    """
    try:
        # Get user ID from request
        user_id = request.user_id
        
        # Get filter parameters from request
        filter_str = request.args.get('filter')
        
        # Get user's transactions from Basiq
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return api_error('Failed to get transactions', status=400, details=transactions_result.get('error'))
        
        # Generate financial goals with Claude 3.7
        goals = suggest_financial_goals(
            user_id,
            transactions_result.get('transactions', {}).get('data', [])
        )
        
        if isinstance(goals, dict) and goals.get('error'):
            return api_error('Failed to suggest financial goals', status=500, details=goals.get('error'))
        
        return jsonify({
            'success': True,
            'goals': goals
        })
        
    except Exception as e:
        return api_error('Server error occurred', status=500, details=str(e))