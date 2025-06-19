"""
TAAXDOG Insights API Routes
Provides comprehensive financial analysis and insights endpoints
"""

import sys
import os
from pathlib import Path

# Add project paths for imports
project_root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "src"))
sys.path.insert(0, str(project_root / "backend"))
sys.path.insert(0, str(project_root / "database"))

from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import logging
from datetime import datetime
from typing import Dict, Any

# Import insights service
try:
    from backend.insights_service import FinancialInsightsService, InsightRequest
    insights_service = FinancialInsightsService()
except ImportError as e:
    logging.warning(f"Could not import insights service: {e}")
    insights_service = None

# Import authentication middleware
try:
    from backend.utils.auth_middleware import require_auth
except ImportError:
    # Fallback for auth
    def require_auth(f):
        return f

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create blueprint
insights_bp = Blueprint('insights', __name__)

def handle_insights_request(func_name: str, user_id: str, **kwargs) -> Dict[str, Any]:
    """
    Generic handler for insights requests with error handling
    """
    try:
        if not insights_service:
            return {
                'success': False,
                'error': 'Insights service not available',
                'data': None
            }
        
        # Get the function from insights service
        func = getattr(insights_service, func_name, None)
        if not func:
            return {
                'success': False,
                'error': f'Function {func_name} not found',
                'data': None
            }
        
        # Call the function with provided kwargs
        if 'user_id' in kwargs:
            result = func(**kwargs)
        else:
            result = func(user_id, **kwargs)
        
        return {
            'success': True,
            'error': None,
            'data': result
        }
        
    except Exception as e:
        logger.error(f"Error in {func_name}: {e}")
        return {
            'success': False,
            'error': str(e),
            'data': None
        }

@insights_bp.route('/comprehensive', methods=['GET'])
@cross_origin()
@require_auth
def get_comprehensive_insights():
    """
    Get comprehensive financial insights for a user
    Combines AI analysis, smart insights, and ML predictions
    """
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        period = request.args.get('period', 'monthly')
        include_receipts = request.args.get('include_receipts', 'true').lower() == 'true'
        include_tax = request.args.get('include_tax_analysis', 'true').lower() == 'true'
        include_ml = request.args.get('include_ml_predictions', 'true').lower() == 'true'
        
        # Create insight request
        insight_request = InsightRequest(
            user_id=user_id,
            period=period,
            include_receipts=include_receipts,
            include_tax_analysis=include_tax,
            include_ml_predictions=include_ml
        )
        
        # Generate comprehensive insights
        result = insights_service.generate_comprehensive_insights(insight_request)
        
        return jsonify({
            'success': True,
            'error': None,
            'data': result.__dict__ if hasattr(result, '__dict__') else result
        })
        
    except Exception as e:
        logger.error(f"Error generating comprehensive insights: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@insights_bp.route('/spending', methods=['GET'])
@cross_origin()
@require_auth
def get_spending_insights():
    """
    Get detailed spending pattern analysis
    """
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        period = request.args.get('period', 'monthly')
        
        result = handle_insights_request('get_spending_insights', user_id, period=period)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting spending insights: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@insights_bp.route('/tax-optimization', methods=['GET'])
@cross_origin()
@require_auth
def get_tax_optimization():
    """
    Get comprehensive tax optimization recommendations
    """
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        tax_year = request.args.get('tax_year')
        
        result = handle_insights_request('get_tax_optimization_insights', user_id, tax_year=tax_year)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting tax optimization: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@insights_bp.route('/budget-recommendations', methods=['GET'])
@cross_origin()
@require_auth
def get_budget_recommendations():
    """
    Generate personalized budget recommendations
    """
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        result = handle_insights_request('get_budget_recommendations', user_id)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting budget recommendations: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@insights_bp.route('/financial-goals', methods=['GET'])
@cross_origin()
@require_auth
def get_financial_goals():
    """
    Generate SMART financial goals based on user's financial situation
    """
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        result = handle_insights_request('get_financial_goals_suggestions', user_id)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting financial goals: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@insights_bp.route('/risk-assessment', methods=['GET'])
@cross_origin()
@require_auth
def get_risk_assessment():
    """
    Assess financial risks and provide alerts
    """
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        result = handle_insights_request('get_risk_assessment', user_id)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error getting risk assessment: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@insights_bp.route('/claude-enhanced', methods=['GET'])
@cross_origin()
@require_auth
def get_claude_enhanced_insights():
    """
    Get Claude 3.7 Sonnet powered financial insights with advanced AI analysis
    This endpoint provides the most sophisticated financial analysis available in TAAXDOG
    """
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        if not insights_service:
            return jsonify({
                'success': False,
                'error': 'Insights service not available'
            }), 503
        
        # Get user data for Claude analysis
        try:
            # Import database and user data fetching (basic implementation)
            from backend.firebase_config import db
            
            # Fetch user transactions (simplified - in production would use BASIQ API)
            user_doc = db.collection('users').document(user_id).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
            
            # Fetch user's receipts for analysis
            receipts_ref = db.collection('users').document(user_id).collection('receipts')
            receipts = [doc.to_dict() for doc in receipts_ref.stream()]
            
            # Convert receipts to transaction-like format for analysis
            transactions = []
            for receipt in receipts:
                extracted_data = receipt.get('extracted_data', {})
                transactions.append({
                    'id': receipt.get('id'),
                    'amount': abs(float(extracted_data.get('total_amount', 0))),
                    'date': extracted_data.get('date', ''),
                    'merchant': extracted_data.get('merchant_name', ''),
                    'category': extracted_data.get('suggested_tax_category', 'Personal'),
                    'description': f"Receipt from {extracted_data.get('merchant_name', 'Unknown')}",
                    'type': 'expense'
                })
            
            # Get user profile for better analysis
            tax_profile_ref = db.collection('taxProfiles').where('userId', '==', user_id).get()
            user_profile = tax_profile_ref[0].to_dict() if tax_profile_ref else {}
            
            # Add user basic data to profile
            user_profile.update({
                'user_id': user_id,
                'total_receipts': len(receipts),
                'account_created': user_data.get('created_at', ''),
                'preferences': user_data.get('preferences', {})
            })
            
        except Exception as e:
            logger.warning(f"Error fetching user data for Claude analysis: {e}")
            transactions = []
            user_profile = {'user_id': user_id}
        
        if not transactions:
            return jsonify({
                'success': True,
                'data': {
                    'insights_type': 'no_data',
                    'message': 'No transaction data available for analysis. Upload some receipts to get AI-powered insights.',
                    'user_id': user_id,
                    'generated_at': datetime.now().isoformat()
                }
            })
        
        # Generate Claude-enhanced insights
        logger.info(f"Generating Claude-enhanced insights for user: {user_id} with {len(transactions)} transactions")
        
        claude_insights = insights_service.generate_claude_enhanced_insights(
            user_id=user_id,
            transactions=transactions,
            user_profile=user_profile
        )
        
        return jsonify({
            'success': True,
            'error': None,
            'data': claude_insights,
            'metadata': {
                'analysis_method': 'claude-3.7-sonnet',
                'transactions_analyzed': len(transactions),
                'enhanced_features': True,
                'australian_tax_optimized': True
            }
        })
        
    except Exception as e:
        logger.error(f"Error generating Claude-enhanced insights: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to generate Claude-enhanced insights: {str(e)}',
            'fallback_available': True,
            'fallback_endpoint': '/api/insights/comprehensive'
        }), 500

@insights_bp.route('/claude-status', methods=['GET'])
@cross_origin()
def get_claude_status():
    """
    Check Claude integration status and capabilities
    """
    try:
        from integrations.claude_client import get_claude_client, claude_available
        
        claude_client = get_claude_client() if claude_available else None
        
        status = {
            'claude_available': claude_available,
            'client_initialized': claude_client is not None,
            'capabilities': [
                'Receipt OCR analysis',
                'Financial data analysis', 
                'Tax optimization advice',
                'Budget recommendations',
                'Risk assessment',
                'Conversational financial advice'
            ] if claude_client else [],
            'model': 'claude-3.7-sonnet' if claude_client else 'not_available',
            'australian_tax_optimized': True if claude_client else False,
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'data': status
        })
        
    except Exception as e:
        logger.error(f"Error checking Claude status: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': {
                'claude_available': False,
                'error_details': str(e)
            }
        })

@insights_bp.route('/report', methods=['GET'])
@cross_origin()
@require_auth
def generate_financial_report():
    """
    Generate comprehensive financial report
    """
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        period = request.args.get('period', 'monthly')
        
        # Generate comprehensive report combining all insights
        insights_request = InsightRequest(
            user_id=user_id,
            period=period,
            include_receipts=True,
            include_tax_analysis=True,
            include_ml_predictions=True
        )
        
        comprehensive_insights = insights_service.generate_comprehensive_insights(insights_request)
        spending_insights = insights_service.get_spending_insights(user_id, period)
        tax_insights = insights_service.get_tax_optimization_insights(user_id)
        budget_insights = insights_service.get_budget_recommendations(user_id)
        goals_insights = insights_service.get_financial_goals_suggestions(user_id)
        risk_assessment = insights_service.get_risk_assessment(user_id)
        
        # Combine all insights into comprehensive report
        report = {
            'user_id': user_id,
            'period': period,
            'generated_at': datetime.now().isoformat(),
            'comprehensive_analysis': comprehensive_insights.__dict__ if hasattr(comprehensive_insights, '__dict__') else comprehensive_insights,
            'spending_analysis': spending_insights,
            'tax_optimization': tax_insights,
            'budget_recommendations': budget_insights,
            'financial_goals': goals_insights,
            'risk_assessment': risk_assessment,
            'summary': {
                'total_insights': len(comprehensive_insights.insights) if hasattr(comprehensive_insights, 'insights') else 0,
                'high_priority_insights': len([i for i in (comprehensive_insights.insights if hasattr(comprehensive_insights, 'insights') else []) if i.get('priority') == 'high']),
                'potential_savings': sum([i.get('potential_savings', 0) for i in (comprehensive_insights.insights if hasattr(comprehensive_insights, 'insights') else [])]),
                'data_quality_score': comprehensive_insights.summary.get('data_quality_score', 0) if hasattr(comprehensive_insights, 'summary') else 0
            }
        }
        
        return jsonify({
            'success': True,
            'error': None,
            'data': report
        })
        
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@insights_bp.route('/refresh', methods=['POST'])
@cross_origin()
@require_auth
def refresh_insights():
    """
    Refresh all insights data for a user
    """
    try:
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User authentication required'
            }), 401
        
        data = request.get_json() or {}
        period = data.get('period', 'monthly')
        
        # Create insight request for refresh
        insight_request = InsightRequest(
            user_id=user_id,
            period=period,
            include_receipts=True,
            include_tax_analysis=True,
            include_ml_predictions=True
        )
        
        # Generate fresh comprehensive insights
        result = insights_service.generate_comprehensive_insights(insight_request)
        
        return jsonify({
            'success': True,
            'error': None,
            'data': result.__dict__ if hasattr(result, '__dict__') else result
        })
        
    except Exception as e:
        logger.error(f"Error refreshing insights: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@insights_bp.route('/health', methods=['GET'])
@cross_origin()
def health_check():
    """
    Health check endpoint for insights service
    """
    service_status = "available" if insights_service else "unavailable"
    
    return jsonify({
        'success': True,
        'service': 'insights',
        'status': service_status,
        'timestamp': datetime.now().isoformat()
    })

# Error handlers
@insights_bp.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Insights endpoint not found'
    }), 404

@insights_bp.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error in insights service'
    }), 500 