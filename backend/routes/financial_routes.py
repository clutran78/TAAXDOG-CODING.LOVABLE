from flask import Blueprint, request, jsonify
import sys
import os

# Add parent directory to path for cross-module imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from firebase_config import db
from basiq_api import get_user_transactions
from ai.financial_insights import (
    analyze_transactions,
    identify_tax_deductions,
    generate_financial_report,
    suggest_financial_goals
)
from .utils import api_error, login_required, logger
from australian_tax_categorizer import categorize_transaction, get_all_categories, TaxCategory
from australian_business_compliance import AustralianBusinessCompliance, BASQuarterData
from datetime import datetime, timedelta

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

# Add these new endpoints for transaction categorization

@financial_routes.route('/transactions/categorize', methods=['POST'])
@login_required
def categorize_transactions_bulk():
    """
    Categorize multiple transactions using the Australian tax categorization engine.
    Supports both single transaction and bulk processing.
    """
    try:
        firebase_user_id = request.user_id
        data = request.get_json()
        
        if not data:
            return api_error('Request data is required', status=400)
        
        transactions = data.get('transactions', [])
        if not transactions:
            return api_error('Transactions array is required', status=400)
        
        # Fetch user's tax profile for intelligent categorization
        user_tax_profile = None
        try:
            from firebase_config import db
            tax_profile_ref = db.collection('taxProfiles').where('userId', '==', firebase_user_id).get()
            if tax_profile_ref:
                user_tax_profile = tax_profile_ref[0].to_dict()
        except Exception as profile_error:
            logger.warning(f"Could not fetch tax profile for transaction categorization: {profile_error}")
        
        categorized_transactions = []
        
        for transaction in transactions:
            try:
                # Apply categorization
                categorization_result = categorize_transaction(transaction, user_tax_profile)
                
                # Create response for this transaction
                categorized_transaction = {
                    'transaction_id': transaction.get('id', ''),
                    'original_description': transaction.get('description', ''),
                    'amount': transaction.get('amount', 0),
                    'categorization': {
                        'category': categorization_result.category.name,
                        'category_description': categorization_result.category.value,
                        'confidence': categorization_result.confidence,
                        'deductibility_percentage': categorization_result.deductibility,
                        'requires_verification': categorization_result.requires_verification,
                        'reasoning': categorization_result.reasoning,
                        'suggested_evidence': categorization_result.suggested_evidence,
                        'alternative_categories': [
                            {
                                'category': alt_cat.name,
                                'description': alt_cat.value,
                                'confidence': alt_conf
                            }
                            for alt_cat, alt_conf in categorization_result.alternative_categories
                        ]
                    }
                }
                
                categorized_transactions.append(categorized_transaction)
                
            except Exception as e:
                # Continue with other transactions if one fails
                logger.error(f"Failed to categorize transaction {transaction.get('id', 'unknown')}: {str(e)}")
                categorized_transactions.append({
                    'transaction_id': transaction.get('id', ''),
                    'original_description': transaction.get('description', ''),
                    'amount': transaction.get('amount', 0),
                    'categorization': {
                        'category': 'PERSONAL',
                        'category_description': 'Categorization failed',
                        'confidence': 0.0,
                        'deductibility_percentage': 0.0,
                        'requires_verification': True,
                        'reasoning': f'Categorization error: {str(e)}',
                        'suggested_evidence': [],
                        'alternative_categories': []
                    },
                    'error': str(e)
                })
        
        # Calculate summary statistics
        total_transactions = len(categorized_transactions)
        high_confidence_count = sum(1 for t in categorized_transactions 
                                  if t['categorization']['confidence'] >= 0.8)
        potential_deductions = sum(1 for t in categorized_transactions 
                                 if t['categorization']['category'] != 'PERSONAL')
        
        return jsonify({
            'success': True,
            'summary': {
                'total_transactions': total_transactions,
                'high_confidence_categorizations': high_confidence_count,
                'potential_tax_deductions': potential_deductions,
                'requires_review': total_transactions - high_confidence_count
            },
            'categorized_transactions': categorized_transactions
        })
        
    except Exception as e:
        return api_error('Failed to categorize transactions', status=500, details=str(e))


@financial_routes.route('/transactions/categorize/summary', methods=['POST'])
@login_required
def get_categorization_summary():
    """
    Get a summary of categorization results for a set of transactions.
    Useful for tax planning and deduction analysis.
    """
    try:
        firebase_user_id = request.user_id
        data = request.get_json()
        
        if not data:
            return api_error('Request data is required', status=400)
        
        transactions = data.get('transactions', [])
        date_range = data.get('date_range', {})
        
        if not transactions:
            return api_error('Transactions array is required', status=400)
        
        # Fetch user's tax profile
        user_tax_profile = None
        try:
            from ..firebase_config import db
            tax_profile_ref = db.collection('taxProfiles').where('userId', '==', firebase_user_id).get()
            if tax_profile_ref:
                user_tax_profile = tax_profile_ref[0].to_dict()
        except Exception as profile_error:
            logger.warning(f"Could not fetch tax profile: {profile_error}")
        
        # Categorize and analyze
        category_totals = {}
        total_potential_deductions = 0.0
        total_amount = 0.0
        transactions_requiring_review = []
        
        for transaction in transactions:
            try:
                amount = abs(float(transaction.get('amount', 0)))
                total_amount += amount
                
                categorization_result = categorize_transaction(transaction, user_tax_profile)
                category = categorization_result.category.name
                
                # Track category totals
                if category not in category_totals:
                    category_totals[category] = {
                        'total_amount': 0.0,
                        'transaction_count': 0,
                        'description': categorization_result.category.value,
                        'deductibility': categorization_result.deductibility
                    }
                
                category_totals[category]['total_amount'] += amount
                category_totals[category]['transaction_count'] += 1
                
                # Calculate potential deductions
                if category != 'PERSONAL':
                    deductible_amount = amount * categorization_result.deductibility
                    total_potential_deductions += deductible_amount
                
                # Track transactions needing review
                if categorization_result.requires_verification or categorization_result.confidence < 0.8:
                    transactions_requiring_review.append({
                        'transaction_id': transaction.get('id', ''),
                        'description': transaction.get('description', ''),
                        'amount': amount,
                        'suggested_category': category,
                        'confidence': categorization_result.confidence,
                        'reasoning': categorization_result.reasoning
                    })
                    
            except Exception as e:
                logger.error(f"Failed to analyze transaction: {str(e)}")
                continue
        
        # Calculate percentages and insights
        deduction_percentage = (total_potential_deductions / total_amount * 100) if total_amount > 0 else 0
        
        # Sort categories by total amount
        sorted_categories = sorted(category_totals.items(), 
                                 key=lambda x: x[1]['total_amount'], 
                                 reverse=True)
        
        return jsonify({
            'success': True,
            'summary': {
                'total_transactions': len(transactions),
                'total_amount': total_amount,
                'total_potential_deductions': total_potential_deductions,
                'deduction_percentage': round(deduction_percentage, 2),
                'transactions_requiring_review': len(transactions_requiring_review)
            },
            'category_breakdown': [
                {
                    'category': cat,
                    'category_description': details['description'],
                    'total_amount': details['total_amount'],
                    'transaction_count': details['transaction_count'],
                    'percentage_of_total': round((details['total_amount'] / total_amount * 100), 2) if total_amount > 0 else 0,
                    'deductibility': details['deductibility']
                }
                for cat, details in sorted_categories
            ],
            'requires_review': transactions_requiring_review[:10],  # Limit to top 10 for UI
            'date_range': date_range,
            'user_has_tax_profile': user_tax_profile is not None
        })
        
    except Exception as e:
        return api_error('Failed to generate categorization summary', status=500, details=str(e))


@financial_routes.route('/tax-insights', methods=['GET'])
@login_required
def get_tax_insights():
    """
    Get comprehensive tax insights based on transaction categorization and user profile.
    Provides personalized recommendations based on occupation and financial patterns.
    """
    try:
        firebase_user_id = request.user_id
        
        # Fetch user's tax profile
        user_tax_profile = None
        try:
            from firebase_config import db
            tax_profile_ref = db.collection('taxProfiles').where('userId', '==', firebase_user_id).get()
            if tax_profile_ref:
                user_tax_profile = tax_profile_ref[0].to_dict()
        except Exception as profile_error:
            logger.warning(f"Could not fetch tax profile: {profile_error}")
        
        if not user_tax_profile:
            return jsonify({
                'success': True,
                'insights': {
                    'message': 'Complete your tax profile to get personalized insights',
                    'action_required': 'setup_profile'
                }
            })
        
        # Extract user information
        personal_info = user_tax_profile.get('personalInfo', {})
        income_info = user_tax_profile.get('income', {})
        deductions_info = user_tax_profile.get('deductions', {})
        
        # Generate occupation-specific insights
        occupations = []
        if income_info.get('employers'):
            for employer in income_info['employers']:
                if employer.get('occupation'):
                    occupations.append(employer['occupation'])
        
        insights = {
            'profile_completeness': _calculate_profile_completeness(user_tax_profile),
            'occupation_insights': _get_occupation_insights(occupations),
            'deduction_opportunities': _identify_deduction_opportunities(user_tax_profile),
            'missing_information': _identify_missing_information(user_tax_profile),
            'recommended_actions': _get_recommended_actions(user_tax_profile)
        }
        
        return jsonify({
            'success': True,
            'insights': insights,
            'user_profile_summary': {
                'name': f"{personal_info.get('firstName', '')} {personal_info.get('familyName', '')}".strip(),
                'has_abn': bool(personal_info.get('abn')),
                'occupation_count': len(occupations),
                'primary_occupation': occupations[0] if occupations else None
            }
        })
        
    except Exception as e:
        return api_error('Failed to generate tax insights', status=500, details=str(e))


def _calculate_profile_completeness(profile):
    """Calculate how complete the user's tax profile is"""
    required_fields = [
        'personalInfo.firstName',
        'personalInfo.familyName', 
        'personalInfo.tfn',
        'personalInfo.residencyStatus',
        'income.employers'
    ]
    
    completed = 0
    for field_path in required_fields:
        keys = field_path.split('.')
        value = profile
        try:
            for key in keys:
                value = value[key]
            if value:
                completed += 1
        except (KeyError, TypeError):
            continue
    
    return round((completed / len(required_fields)) * 100)


def _get_occupation_insights(occupations):
    """Get insights specific to user's occupation"""
    if not occupations:
        return {'message': 'Add employment information to get occupation-specific insights'}
    
    insights = []
    for occupation in occupations:
        occupation_lower = occupation.lower()
        
        if any(keyword in occupation_lower for keyword in ['doctor', 'nurse', 'medical', 'health']):
            insights.append({
                'category': 'Healthcare Professional',
                'deductions': ['Medical equipment', 'Professional registration', 'Uniforms', 'Medical journals'],
                'tips': ['Keep receipts for protective equipment', 'Professional development courses may be deductible']
            })
        elif any(keyword in occupation_lower for keyword in ['teacher', 'educator', 'professor']):
            insights.append({
                'category': 'Education Professional', 
                'deductions': ['Classroom supplies', 'Educational resources', 'Professional development'],
                'tips': ['Classroom decorations may be deductible', 'Union fees are deductible']
            })
        elif any(keyword in occupation_lower for keyword in ['engineer', 'developer', 'it', 'software']):
            insights.append({
                'category': 'IT/Engineering Professional',
                'deductions': ['Software subscriptions', 'Training courses', 'Professional equipment'],
                'tips': ['Home office expenses if working from home', 'Certification costs are deductible']
            })
    
    return insights if insights else [{'message': 'General deduction rules apply to your occupation'}]


def _identify_deduction_opportunities(profile):
    """Identify potential deduction opportunities based on profile"""
    opportunities = []
    
    deductions = profile.get('deductions', {})
    
    if deductions.get('useCarForWork'):
        opportunities.append({
            'category': 'Car Expenses',
            'description': 'Work-related car expenses detected',
            'action': 'Ensure you have a logbook or use cents per km method'
        })
    
    if profile.get('personalInfo', {}).get('abn'):
        opportunities.append({
            'category': 'Business Expenses',
            'description': 'ABN holder detected',
            'action': 'Consider P8 category for business-related expenses'
        })
    
    return opportunities


def _identify_missing_information(profile):
    """Identify missing information that could help with deductions"""
    missing = []
    
    personal_info = profile.get('personalInfo', {})
    deductions = profile.get('deductions', {})
    
    if not personal_info.get('abn') and not deductions.get('useCarForWork'):
        missing.append('Car usage information for work')
    
    if not deductions.get('homeOffice'):
        missing.append('Home office usage information')
    
    return missing


def _get_recommended_actions(profile):
    """Get recommended actions to optimize tax position"""
    actions = []
    
    if _calculate_profile_completeness(profile) < 80:
        actions.append({
            'priority': 'high',
            'action': 'Complete your tax profile',
            'description': 'A complete profile enables better categorization and insights'
        })
    
    deductions = profile.get('deductions', {})
    if not any(deductions.values()):
        actions.append({
            'priority': 'medium', 
            'action': 'Review potential deductions',
            'description': 'You may be missing out on legitimate tax deductions'
        })
    
    return actions


# New Business Compliance Endpoints for BAS Preparation

@financial_routes.route('/bas/quarter-data', methods=['POST'])
@login_required
def prepare_bas_quarter():
    """
    Prepare BAS (Business Activity Statement) data for a specific quarter.
    """
    try:
        user_id = request.user_id
        data = request.get_json()
        
        if not data:
            return api_error('Request data is required', status=400)
        
        quarter = data.get('quarter')  # e.g., "2024-Q1"
        year = data.get('year', 2024)
        quarter_num = data.get('quarter_num', 1)  # 1, 2, 3, or 4
        
        # Calculate quarter dates
        if quarter_num == 1:
            quarter_start = datetime(year, 1, 1)
            quarter_end = datetime(year, 3, 31)
        elif quarter_num == 2:
            quarter_start = datetime(year, 4, 1)
            quarter_end = datetime(year, 6, 30)
        elif quarter_num == 3:
            quarter_start = datetime(year, 7, 1)
            quarter_end = datetime(year, 9, 30)
        else:  # Q4
            quarter_start = datetime(year, 10, 1)
            quarter_end = datetime(year, 12, 31)
        
        # Get user's transactions from Basiq
        filter_str = f"transaction.postDate.gte('{quarter_start.isoformat()}')"
        filter_str += f"&transaction.postDate.lte('{quarter_end.isoformat()}')"
        
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return api_error('Failed to get transactions', status=400, details=transactions_result.get('error'))
        
        transactions = transactions_result.get('transactions', {}).get('data', [])
        
        # Get user's receipts for the quarter
        receipts = []
        if db:
            try:
                receipts_ref = db.collection('users').document(user_id).collection('receipts')
                receipts_docs = receipts_ref.where('date', '>=', quarter_start.strftime('%Y-%m-%d')).where('date', '<=', quarter_end.strftime('%Y-%m-%d')).get()
                for doc in receipts_docs:
                    receipt = doc.to_dict()
                    receipt['id'] = doc.id
                    receipts.append(receipt)
            except Exception as e:
                logger.error(f"Error fetching receipts: {e}")
        
        # Get user profile
        user_profile = None
        if db:
            try:
                tax_profile_ref = db.collection('taxProfiles').where('userId', '==', user_id).get()
                if tax_profile_ref:
                    user_profile = tax_profile_ref[0].to_dict()
            except Exception as e:
                logger.error(f"Error fetching user profile: {e}")
        
        if not user_profile:
            return api_error('Tax profile required for BAS preparation', status=400)
        
        # Initialize business compliance engine
        compliance = AustralianBusinessCompliance()
        
        # Prepare BAS data
        bas_data = compliance.prepare_bas_quarter_data(
            transactions=transactions,
            receipts=receipts,
            user_profile=user_profile,
            quarter_start=quarter_start,
            quarter_end=quarter_end
        )
        
        # Generate summary
        bas_summary = compliance.generate_bas_summary(bas_data)
        
        return jsonify({
            'success': True,
            'bas_quarter_data': {
                'period': bas_summary['period'],
                'gst_summary': bas_summary['gst_summary'],
                'payg_summary': bas_summary['payg_summary'],
                'total_refund_payable': bas_summary['total_refund_payable'],
                'processing_stats': {
                    'transactions_processed': bas_summary['transactions_processed'],
                    'receipts_processed': len(receipts),
                    'line_items_count': bas_summary['line_items_count']
                }
            }
        })
        
    except Exception as e:
        return api_error('Failed to prepare BAS quarter data', status=500, details=str(e))


@financial_routes.route('/bas/annual-summary', methods=['GET'])
@login_required
def get_annual_bas_summary():
    """
    Get annual BAS summary across all quarters for the year.
    """
    try:
        user_id = request.user_id
        year = request.args.get('year', datetime.now().year, type=int)
        
        # Get user profile
        user_profile = None
        if db:
            try:
                tax_profile_ref = db.collection('taxProfiles').where('userId', '==', user_id).get()
                if tax_profile_ref:
                    user_profile = tax_profile_ref[0].to_dict()
            except Exception as e:
                logger.error(f"Error fetching user profile: {e}")
        
        if not user_profile:
            return api_error('Tax profile required for BAS analysis', status=400)
        
        # Initialize business compliance engine
        compliance = AustralianBusinessCompliance()
        
        # Process each quarter
        annual_summary = {
            'year': year,
            'quarters': [],
            'annual_totals': {
                'sales_gst': 0,
                'input_tax_credits': 0,
                'net_gst': 0,
                'payg_withholding': 0,
                'payg_instalment': 0,
                'total_refund_payable': 0
            }
        }
        
        for quarter_num in range(1, 5):
            # Calculate quarter dates
            if quarter_num == 1:
                quarter_start = datetime(year, 1, 1)
                quarter_end = datetime(year, 3, 31)
            elif quarter_num == 2:
                quarter_start = datetime(year, 4, 1)
                quarter_end = datetime(year, 6, 30)
            elif quarter_num == 3:
                quarter_start = datetime(year, 7, 1)
                quarter_end = datetime(year, 9, 30)
            else:  # Q4
                quarter_start = datetime(year, 10, 1)
                quarter_end = datetime(year, 12, 31)
            
            # Get transactions for quarter
            filter_str = f"transaction.postDate.gte('{quarter_start.isoformat()}')"
            filter_str += f"&transaction.postDate.lte('{quarter_end.isoformat()}')"
            
            transactions_result = get_user_transactions(user_id, filter_str)
            
            if transactions_result.get('success'):
                transactions = transactions_result.get('transactions', {}).get('data', [])
                
                # Get receipts for quarter
                receipts = []
                if db:
                    try:
                        receipts_ref = db.collection('users').document(user_id).collection('receipts')
                        receipts_docs = receipts_ref.where('date', '>=', quarter_start.strftime('%Y-%m-%d')).where('date', '<=', quarter_end.strftime('%Y-%m-%d')).get()
                        for doc in receipts_docs:
                            receipt = doc.to_dict()
                            receipt['id'] = doc.id
                            receipts.append(receipt)
                    except Exception as e:
                        logger.error(f"Error fetching receipts for Q{quarter_num}: {e}")
                
                # Prepare BAS data for quarter
                bas_data = compliance.prepare_bas_quarter_data(
                    transactions=transactions,
                    receipts=receipts,
                    user_profile=user_profile,
                    quarter_start=quarter_start,
                    quarter_end=quarter_end
                )
                
                # Generate quarter summary
                quarter_summary = compliance.generate_bas_summary(bas_data)
                annual_summary['quarters'].append({
                    'quarter': f"Q{quarter_num}",
                    'quarter_num': quarter_num,
                    **quarter_summary
                })
                
                # Add to annual totals
                annual_summary['annual_totals']['sales_gst'] += quarter_summary['gst_summary']['sales_gst']
                annual_summary['annual_totals']['input_tax_credits'] += quarter_summary['gst_summary']['input_tax_credits']
                annual_summary['annual_totals']['net_gst'] += quarter_summary['gst_summary']['net_gst']
                annual_summary['annual_totals']['payg_withholding'] += quarter_summary['payg_summary']['withholding']
                annual_summary['annual_totals']['payg_instalment'] += quarter_summary['payg_summary']['instalment']
                annual_summary['annual_totals']['total_refund_payable'] += quarter_summary['total_refund_payable']
        
        return jsonify({
            'success': True,
            'annual_bas_summary': annual_summary
        })
        
    except Exception as e:
        return api_error('Failed to generate annual BAS summary', status=500, details=str(e))


@financial_routes.route('/business/abn-status', methods=['GET'])
@login_required
def get_business_abn_status():
    """
    Get business ABN status and GST registration details.
    """
    try:
        user_id = request.user_id
        
        # Get user profile
        user_profile = None
        if db:
            try:
                tax_profile_ref = db.collection('taxProfiles').where('userId', '==', user_id).get()
                if tax_profile_ref:
                    user_profile = tax_profile_ref[0].to_dict()
            except Exception as e:
                logger.error(f"Error fetching user profile: {e}")
        
        if not user_profile:
            return api_error('Tax profile not found', status=404)
        
        abn = user_profile.get('personalInfo', {}).get('abn', '')
        
        if not abn:
            return jsonify({
                'success': True,
                'business_status': {
                    'has_abn': False,
                    'abn': None,
                    'gst_registered': False,
                    'entity_type': 'Individual',
                    'bas_required': False,
                    'message': 'No ABN registered. Individual taxpayer.'
                }
            })
        
        # Verify ABN if available
        compliance = AustralianBusinessCompliance()
        abn_details = compliance.verify_abn(abn)
        
        # Determine BAS requirements
        gst_registered = user_profile.get('tax_settings', {}).get('gst_registered', False)
        annual_turnover = user_profile.get('income', {}).get('businessIncome', 0)
        
        bas_required = gst_registered or annual_turnover > 75000  # GST threshold
        
        return jsonify({
            'success': True,
            'business_status': {
                'has_abn': True,
                'abn': abn_details.abn,
                'abn_valid': abn_details.is_valid,
                'entity_name': abn_details.entity_name,
                'entity_type': abn_details.entity_type.value,
                'gst_registered': abn_details.gst_registered,
                'gst_from_date': abn_details.gst_from_date,
                'bas_required': bas_required,
                'annual_turnover': annual_turnover,
                'gst_threshold_exceeded': annual_turnover > 75000
            }
        })
        
    except Exception as e:
        return api_error('Failed to get business ABN status', status=500, details=str(e))


@financial_routes.route('/business/compliance-checklist', methods=['GET'])
@login_required
def get_business_compliance_checklist():
    """
    Get business compliance checklist for Australian tax obligations.
    """
    try:
        user_id = request.user_id
        
        # Get user profile
        user_profile = None
        if db:
            try:
                tax_profile_ref = db.collection('taxProfiles').where('userId', '==', user_id).get()
                if tax_profile_ref:
                    user_profile = tax_profile_ref[0].to_dict()
            except Exception as e:
                logger.error(f"Error fetching user profile: {e}")
        
        if not user_profile:
            return api_error('Tax profile not found', status=404)
        
        abn = user_profile.get('personalInfo', {}).get('abn', '')
        gst_registered = user_profile.get('tax_settings', {}).get('gst_registered', False)
        annual_turnover = user_profile.get('income', {}).get('businessIncome', 0)
        
        # Build compliance checklist
        checklist = []
        
        # ABN Registration
        checklist.append({
            'category': 'ABN Registration',
            'completed': bool(abn),
            'required': True,
            'description': 'Australian Business Number registration',
            'action': 'Register for ABN at business.gov.au' if not abn else 'ABN registered'
        })
        
        # GST Registration
        gst_required = annual_turnover > 75000
        checklist.append({
            'category': 'GST Registration',
            'completed': gst_registered,
            'required': gst_required,
            'description': 'Goods and Services Tax registration (required if turnover > $75,000)',
            'action': 'Register for GST' if gst_required and not gst_registered else 'GST registration current'
        })
        
        # Record Keeping
        checklist.append({
            'category': 'Record Keeping',
            'completed': True,  # Assume TAAXDOG handles this
            'required': True,
            'description': 'Maintain business records and receipts',
            'action': 'Continue using TAAXDOG for automated record keeping'
        })
        
        # BAS Lodgment
        if gst_registered:
            checklist.append({
                'category': 'BAS Lodgment',
                'completed': False,  # Would need to check actual lodgment
                'required': True,
                'description': 'Quarterly Business Activity Statement lodgment',
                'action': 'Lodge BAS by quarterly due dates'
            })
        
        # Income Tax Return
        checklist.append({
            'category': 'Income Tax Return',
            'completed': False,  # Would need to check actual lodgment
            'required': True,
            'description': 'Annual income tax return',
            'action': 'Lodge tax return by October 31 (or extended due date with tax agent)'
        })
        
        # PAYG Withholding (if employees)
        has_employees = user_profile.get('business', {}).get('hasEmployees', False)
        if has_employees:
            checklist.append({
                'category': 'PAYG Withholding',
                'completed': False,  # Would need to check compliance
                'required': True,
                'description': 'Pay As You Go withholding for employees',
                'action': 'Ensure PAYG withholding is up to date'
            })
        
        # Calculate completion percentage
        completed_items = sum(1 for item in checklist if item['completed'])
        total_required = sum(1 for item in checklist if item['required'])
        completion_percentage = (completed_items / total_required * 100) if total_required > 0 else 100
        
        return jsonify({
            'success': True,
            'compliance_checklist': {
                'completion_percentage': round(completion_percentage, 1),
                'completed_items': completed_items,
                'total_required_items': total_required,
                'items': checklist,
                'business_type': user_profile.get('personalInfo', {}).get('entity_type', 'Individual'),
                'gst_threshold_status': 'Above threshold' if annual_turnover > 75000 else 'Below threshold'
            }
        })
        
    except Exception as e:
        return api_error('Failed to get compliance checklist', status=500, details=str(e))