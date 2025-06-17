"""
TAAXDOG Smart Insights Routes
API endpoints for advanced financial insights and business intelligence.
"""

from flask import Blueprint, request, jsonify
import asyncio
import logging
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path for cross-module imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

try:
    from smart_insights import smart_insights_engine, InsightType, InsightPriority
    from subscription_manager import subscription_manager, FeatureAccess
    from utils.auth_middleware import require_auth
    from utils.validators import validate_json
except ImportError:
    # Fallback for development mode
    smart_insights_engine = None
    subscription_manager = None
    class InsightType: pass
    class InsightPriority: pass  
    class FeatureAccess: pass
    def require_auth(func): return func
    def validate_json(*args): return lambda func: func

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

insights_bp = Blueprint('insights', __name__)

@insights_bp.route('/api/insights', methods=['GET'])
@require_auth
def get_user_insights():
    """Get comprehensive financial insights for the user"""
    try:
        user_id = request.user_id
        period_months = int(request.args.get('period_months', 6))
        
        # Check feature access
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            has_access = loop.run_until_complete(
                subscription_manager.check_feature_access(user_id, FeatureAccess.TAX_INSIGHTS)
            )
            
            if not has_access:
                return jsonify({
                    'success': False,
                    'error': 'Premium subscription required for advanced insights',
                    'upgrade_required': True
                }), 403
            
            # Generate insights
            insights = loop.run_until_complete(
                smart_insights_engine.generate_comprehensive_insights(user_id, period_months)
            )
            
            # Convert insights to JSON-serializable format
            insights_data = []
            for insight in insights:
                insight_dict = {
                    'id': insight.id,
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
                insights_data.append(insight_dict)
            
            return jsonify({
                'success': True,
                'insights': insights_data,
                'total_insights': len(insights_data),
                'period_months': period_months,
                'generated_at': datetime.now().isoformat()
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting insights for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate insights'
        }), 500

@insights_bp.route('/api/insights/spending-patterns', methods=['GET'])
@require_auth
def get_spending_patterns():
    """Get detailed spending pattern analysis"""
    try:
        user_id = request.user_id
        period_months = int(request.args.get('period_months', 6))
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Get user data
            user_data = loop.run_until_complete(
                smart_insights_engine._get_user_data(user_id, period_months)
            )
            
            # Generate spending pattern insights specifically
            pattern_insights = loop.run_until_complete(
                smart_insights_engine._analyze_spending_patterns(user_id, user_data)
            )
            
            patterns_data = []
            for insight in pattern_insights:
                insight_dict = {
                    'id': insight.id,
                    'title': insight.title,
                    'description': insight.description,
                    'recommendation': insight.recommendation,
                    'potential_savings': insight.potential_savings,
                    'confidence_score': insight.confidence_score,
                    'data': insight.data,
                    'action_items': insight.action_items or []
                }
                patterns_data.append(insight_dict)
            
            return jsonify({
                'success': True,
                'spending_patterns': patterns_data,
                'period_months': period_months
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting spending patterns for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to analyze spending patterns'
        }), 500

@insights_bp.route('/api/insights/tax-optimization', methods=['GET'])
@require_auth
def get_tax_optimization():
    """Get tax optimization recommendations"""
    try:
        user_id = request.user_id
        period_months = int(request.args.get('period_months', 12))  # Tax insights need full year
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Check premium access
            has_access = loop.run_until_complete(
                subscription_manager.check_feature_access(user_id, FeatureAccess.TAX_INSIGHTS)
            )
            
            if not has_access:
                return jsonify({
                    'success': False,
                    'error': 'Premium subscription required for tax optimization insights',
                    'upgrade_required': True
                }), 403
            
            # Get user data
            user_data = loop.run_until_complete(
                smart_insights_engine._get_user_data(user_id, period_months)
            )
            
            # Generate tax optimization insights
            tax_insights = loop.run_until_complete(
                smart_insights_engine._generate_tax_optimization_insights(user_id, user_data)
            )
            
            tax_data = []
            total_potential_savings = 0
            
            for insight in tax_insights:
                insight_dict = {
                    'id': insight.id,
                    'title': insight.title,
                    'description': insight.description,
                    'recommendation': insight.recommendation,
                    'potential_savings': insight.potential_savings,
                    'confidence_score': insight.confidence_score,
                    'data': insight.data,
                    'action_items': insight.action_items or []
                }
                tax_data.append(insight_dict)
                total_potential_savings += insight.potential_savings
            
            return jsonify({
                'success': True,
                'tax_insights': tax_data,
                'total_potential_savings': total_potential_savings,
                'period_months': period_months
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting tax optimization for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate tax optimization insights'
        }), 500

@insights_bp.route('/api/insights/budget-recommendations', methods=['GET'])
@require_auth
def get_budget_recommendations():
    """Get intelligent budget recommendations"""
    try:
        user_id = request.user_id
        period_months = int(request.args.get('period_months', 6))
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Get user data
            user_data = loop.run_until_complete(
                smart_insights_engine._get_user_data(user_id, period_months)
            )
            
            # Generate budget recommendations
            budget_insights = loop.run_until_complete(
                smart_insights_engine._create_budget_recommendations(user_id, user_data)
            )
            
            budget_data = []
            for insight in budget_insights:
                insight_dict = {
                    'id': insight.id,
                    'title': insight.title,
                    'description': insight.description,
                    'recommendation': insight.recommendation,
                    'potential_savings': insight.potential_savings,
                    'confidence_score': insight.confidence_score,
                    'data': insight.data,
                    'action_items': insight.action_items or []
                }
                budget_data.append(insight_dict)
            
            return jsonify({
                'success': True,
                'budget_recommendations': budget_data,
                'period_months': period_months
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting budget recommendations for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate budget recommendations'
        }), 500

@insights_bp.route('/api/insights/cash-flow-prediction', methods=['GET'])
@require_auth
def get_cash_flow_prediction():
    """Get cash flow predictions and projections"""
    try:
        user_id = request.user_id
        period_months = int(request.args.get('period_months', 6))
        prediction_months = int(request.args.get('prediction_months', 3))
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Check business feature access
            has_access = loop.run_until_complete(
                subscription_manager.check_feature_access(user_id, FeatureAccess.ADVANCED_REPORTS)
            )
            
            if not has_access:
                return jsonify({
                    'success': False,
                    'error': 'Business subscription required for cash flow predictions',
                    'upgrade_required': True
                }), 403
            
            # Get user data
            user_data = loop.run_until_complete(
                smart_insights_engine._get_user_data(user_id, period_months)
            )
            
            # Generate cash flow predictions
            cashflow_insights = loop.run_until_complete(
                smart_insights_engine._predict_cash_flow(user_id, user_data)
            )
            
            cashflow_data = []
            for insight in cashflow_insights:
                insight_dict = {
                    'id': insight.id,
                    'title': insight.title,
                    'description': insight.description,
                    'recommendation': insight.recommendation,
                    'potential_savings': insight.potential_savings,
                    'confidence_score': insight.confidence_score,
                    'data': insight.data,
                    'action_items': insight.action_items or []
                }
                cashflow_data.append(insight_dict)
            
            return jsonify({
                'success': True,
                'cashflow_predictions': cashflow_data,
                'period_months': period_months,
                'prediction_months': prediction_months
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting cash flow prediction for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate cash flow predictions'
        }), 500

@insights_bp.route('/api/insights/savings-opportunities', methods=['GET'])
@require_auth
def get_savings_opportunities():
    """Get personalized savings opportunities"""
    try:
        user_id = request.user_id
        period_months = int(request.args.get('period_months', 6))
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Get user data
            user_data = loop.run_until_complete(
                smart_insights_engine._get_user_data(user_id, period_months)
            )
            
            # Generate savings opportunities
            savings_insights = loop.run_until_complete(
                smart_insights_engine._identify_savings_opportunities(user_id, user_data)
            )
            
            # Also get subscription efficiency insights
            subscription_insights = loop.run_until_complete(
                smart_insights_engine._analyze_subscription_efficiency(user_id, user_data)
            )
            
            all_savings = savings_insights + subscription_insights
            
            savings_data = []
            total_savings_potential = 0
            
            for insight in all_savings:
                insight_dict = {
                    'id': insight.id,
                    'type': insight.type.value,
                    'title': insight.title,
                    'description': insight.description,
                    'recommendation': insight.recommendation,
                    'potential_savings': insight.potential_savings,
                    'confidence_score': insight.confidence_score,
                    'data': insight.data,
                    'action_items': insight.action_items or []
                }
                savings_data.append(insight_dict)
                total_savings_potential += insight.potential_savings
            
            return jsonify({
                'success': True,
                'savings_opportunities': savings_data,
                'total_savings_potential': total_savings_potential,
                'period_months': period_months
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting savings opportunities for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to identify savings opportunities'
        }), 500

@insights_bp.route('/api/insights/audit-risk', methods=['GET'])
@require_auth
def get_audit_risk_assessment():
    """Get audit risk assessment and compliance insights"""
    try:
        user_id = request.user_id
        period_months = int(request.args.get('period_months', 12))
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Check business feature access
            has_access = loop.run_until_complete(
                subscription_manager.check_feature_access(user_id, FeatureAccess.ADVANCED_REPORTS)
            )
            
            if not has_access:
                return jsonify({
                    'success': False,
                    'error': 'Business subscription required for audit risk assessment',
                    'upgrade_required': True
                }), 403
            
            # Get user data
            user_data = loop.run_until_complete(
                smart_insights_engine._get_user_data(user_id, period_months)
            )
            
            # Generate audit risk insights
            audit_insights = loop.run_until_complete(
                smart_insights_engine._assess_audit_risks(user_id, user_data)
            )
            
            audit_data = []
            max_risk_score = 0
            
            for insight in audit_insights:
                insight_dict = {
                    'id': insight.id,
                    'title': insight.title,
                    'description': insight.description,
                    'recommendation': insight.recommendation,
                    'confidence_score': insight.confidence_score,
                    'data': insight.data,
                    'action_items': insight.action_items or []
                }
                audit_data.append(insight_dict)
                
                # Track maximum risk score
                risk_score = insight.data.get('risk_score', 0)
                max_risk_score = max(max_risk_score, risk_score)
            
            # Determine overall risk level
            if max_risk_score < 10:
                risk_level = "low"
            elif max_risk_score < 25:
                risk_level = "medium"
            else:
                risk_level = "high"
            
            return jsonify({
                'success': True,
                'audit_risk_assessment': audit_data,
                'overall_risk_score': max_risk_score,
                'risk_level': risk_level,
                'period_months': period_months
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting audit risk assessment for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to assess audit risk'
        }), 500

@insights_bp.route('/api/insights/summary', methods=['GET'])
@require_auth
def get_insights_summary():
    """Get a summary of all insights for dashboard display"""
    try:
        user_id = request.user_id
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Generate basic insights (available to all users)
            user_data = loop.run_until_complete(
                smart_insights_engine._get_user_data(user_id, 3)  # Last 3 months
            )
            
            # Get different types of insights
            spending_insights = loop.run_until_complete(
                smart_insights_engine._analyze_spending_patterns(user_id, user_data)
            )
            
            budget_insights = loop.run_until_complete(
                smart_insights_engine._create_budget_recommendations(user_id, user_data)
            )
            
            savings_insights = loop.run_until_complete(
                smart_insights_engine._identify_savings_opportunities(user_id, user_data)
            )
            
            # Calculate summary statistics
            total_insights = len(spending_insights) + len(budget_insights) + len(savings_insights)
            total_potential_savings = sum(i.potential_savings for i in spending_insights + budget_insights + savings_insights)
            
            high_priority_count = sum(1 for i in spending_insights + budget_insights + savings_insights 
                                    if i.priority in [InsightPriority.HIGH, InsightPriority.URGENT])
            
            # Get top 3 insights by priority and savings potential
            all_insights = spending_insights + budget_insights + savings_insights
            all_insights.sort(key=lambda x: (x.priority.value, -x.potential_savings), reverse=True)
            top_insights = all_insights[:3]
            
            top_insights_data = []
            for insight in top_insights:
                insight_dict = {
                    'id': insight.id,
                    'type': insight.type.value,
                    'priority': insight.priority.value,
                    'title': insight.title,
                    'description': insight.description,
                    'potential_savings': insight.potential_savings,
                    'confidence_score': insight.confidence_score
                }
                top_insights_data.append(insight_dict)
            
            return jsonify({
                'success': True,
                'summary': {
                    'total_insights': total_insights,
                    'total_potential_savings': total_potential_savings,
                    'high_priority_count': high_priority_count,
                    'top_insights': top_insights_data
                },
                'generated_at': datetime.now().isoformat()
            })
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting insights summary for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to generate insights summary'
        }), 500 