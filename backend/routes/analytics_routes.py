"""
Analytics Routes for TAAXDOG Finance Application

This module provides API endpoints for machine learning analytics including:
- Spending pattern analysis
- Fraud detection
- Budget predictions
- User behavior insights
"""

from flask import Blueprint, request, jsonify
import sys
import os

# Add project paths for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from .utils import api_error, login_required, logger
from backend.ml_analytics import create_analytics_suite

# Create analytics blueprint
analytics_routes = Blueprint('analytics', __name__, url_prefix='/api/analytics')

# Initialize ML analytics suite
analytics_suite = create_analytics_suite()

@analytics_routes.route('/spending-patterns', methods=['GET'])
@login_required
def analyze_spending_patterns():
    """
    Analyze user spending patterns using machine learning
    
    Query Parameters:
    - months_back: Number of months to analyze (default: 6)
    
    Returns:
    - Spending patterns, insights, and recommendations
    """
    try:
        user_id = request.user_id
        months_back = int(request.args.get('months_back', 6))
        
        logger.info(f"Analyzing spending patterns for user {user_id}")
        
        # Get spending pattern analyzer
        analyzer = analytics_suite['spending_analyzer']
        
        # Perform analysis
        analysis_result = analyzer.analyze_user_spending(user_id, months_back)
        
        if 'error' in analysis_result:
            return api_error(analysis_result['error'], status=400)
        
        return jsonify({
            'success': True,
            'analysis': analysis_result,
            'message': f'Analyzed {analysis_result.get("transaction_count", 0)} transactions'
        })
        
    except ValueError as e:
        return api_error('Invalid months_back parameter', status=400)
    except Exception as e:
        logger.error(f"Error in spending pattern analysis: {str(e)}")
        return api_error('Failed to analyze spending patterns', status=500, details=str(e))

@analytics_routes.route('/fraud-detection', methods=['GET'])
@login_required
def detect_fraud():
    """
    Detect fraudulent transactions and anomalies
    
    Returns:
    - List of anomalies with risk scores and recommendations
    """
    try:
        user_id = request.user_id
        
        logger.info(f"Running fraud detection for user {user_id}")
        
        # Get fraud detection system
        fraud_detector = analytics_suite['fraud_detector']
        
        # Detect anomalies
        anomalies = fraud_detector.detect_anomalies(user_id)
        
        # Convert to JSON format
        anomaly_data = [anomaly.to_dict() for anomaly in anomalies]
        
        # Calculate risk summary
        risk_summary = {
            'total_anomalies': len(anomalies),
            'high_risk_count': len([a for a in anomalies if a.risk_score > 0.7]),
            'medium_risk_count': len([a for a in anomalies if 0.4 <= a.risk_score <= 0.7]),
            'low_risk_count': len([a for a in anomalies if a.risk_score < 0.4])
        }
        
        return jsonify({
            'success': True,
            'anomalies': anomaly_data,
            'risk_summary': risk_summary,
            'message': f'Detected {len(anomalies)} potential anomalies'
        })
        
    except Exception as e:
        logger.error(f"Error in fraud detection: {str(e)}")
        return api_error('Failed to detect fraud', status=500, details=str(e))

@analytics_routes.route('/budget-predictions', methods=['GET'])
@login_required
def predict_budget():
    """
    Generate predictive budget recommendations
    
    Query Parameters:
    - months_ahead: Number of months to predict (default: 3)
    
    Returns:
    - Budget predictions by category with confidence intervals
    """
    try:
        user_id = request.user_id
        months_ahead = int(request.args.get('months_ahead', 3))
        
        logger.info(f"Generating budget predictions for user {user_id}")
        
        # Get budget predictor
        budget_predictor = analytics_suite['budget_predictor']
        
        # Generate predictions
        predictions = budget_predictor.generate_budget_predictions(user_id, months_ahead)
        
        # Convert to JSON format
        prediction_data = [prediction.to_dict() for prediction in predictions]
        
        # Calculate prediction summary
        total_predicted = sum(p.predicted_amount for p in predictions)
        summary = {
            'total_predicted_spending': total_predicted,
            'categories_analyzed': len(predictions),
            'prediction_period': f'{months_ahead} months'
        }
        
        return jsonify({
            'success': True,
            'predictions': prediction_data,
            'summary': summary,
            'message': f'Generated predictions for {len(predictions)} categories'
        })
        
    except ValueError as e:
        return api_error('Invalid months_ahead parameter', status=400)
    except Exception as e:
        logger.error(f"Error in budget prediction: {str(e)}")
        return api_error('Failed to generate budget predictions', status=500, details=str(e))

@analytics_routes.route('/transaction/categorize', methods=['POST'])
@login_required
def categorize_transaction():
    """
    Predict category for a transaction using ML
    
    Request Body:
    {
        "transaction": {
            "description": "Transaction description",
            "merchant": "Merchant name",
            "amount": 150.00
        }
    }
    
    Returns:
    - Predicted category with confidence score and alternatives
    """
    try:
        user_id = request.user_id
        data = request.get_json()
        
        if not data or 'transaction' not in data:
            return api_error('Transaction data is required', status=400)
        
        transaction = data['transaction']
        
        logger.info(f"Categorizing transaction for user {user_id}")
        
        # Get categorization engine
        categorization_engine = analytics_suite['categorization_engine']
        
        # Predict category
        prediction = categorization_engine.predict_transaction_category(transaction, user_id)
        
        return jsonify({
            'success': True,
            'prediction': prediction,
            'message': f'Predicted category: {prediction.get("predicted_category", "unknown")}'
        })
        
    except Exception as e:
        logger.error(f"Error in transaction categorization: {str(e)}")
        return api_error('Failed to categorize transaction', status=500, details=str(e))

@analytics_routes.route('/insights/dashboard', methods=['GET'])
@login_required
def get_analytics_dashboard():
    """
    Get comprehensive analytics dashboard data
    
    Returns:
    - Combined insights from all analytics modules
    """
    try:
        user_id = request.user_id
        
        logger.info(f"Generating analytics dashboard for user {user_id}")
        
        # Get analyzers
        spending_analyzer = analytics_suite['spending_analyzer']
        fraud_detector = analytics_suite['fraud_detector']
        
        # Get spending patterns (limited analysis)
        spending_result = spending_analyzer.analyze_user_spending(user_id, 3)  # 3 months
        
        # Get recent anomalies
        anomalies = fraud_detector.detect_anomalies(user_id)
        
        # Create dashboard summary
        dashboard = {
            'spending_summary': {
                'patterns_found': len(spending_result.get('patterns', [])),
                'insights_count': len(spending_result.get('insights', [])),
                'recommendations_count': len(spending_result.get('recommendations', []))
            },
            'security_summary': {
                'anomalies_detected': len(anomalies),
                'high_risk_alerts': len([a for a in anomalies if a.risk_score > 0.7]),
                'last_scan': anomalies[0].detected_at.isoformat() if anomalies else None
            },
            'recent_insights': spending_result.get('insights', [])[:5],  # Top 5 insights
            'recent_anomalies': [a.to_dict() for a in anomalies[:3]],  # Top 3 anomalies
            'spending_patterns': spending_result.get('patterns', [])
        }
        
        return jsonify({
            'success': True,
            'dashboard': dashboard,
            'last_updated': spending_result.get('analysis_date'),
            'message': 'Dashboard data loaded successfully'
        })
        
    except Exception as e:
        logger.error(f"Error generating analytics dashboard: {str(e)}")
        return api_error('Failed to generate dashboard', status=500, details=str(e))

@analytics_routes.route('/train/categorization', methods=['POST'])
@login_required
def train_categorization_model():
    """
    Train or update the transaction categorization model
    
    Request Body:
    {
        "correction": {
            "transaction": {...},
            "correct_category": "Groceries"
        }
    }
    
    Returns:
    - Training status and model performance
    """
    try:
        user_id = request.user_id
        data = request.get_json()
        
        logger.info(f"Training categorization model for user {user_id}")
        
        # Get categorization engine
        categorization_engine = analytics_suite['categorization_engine']
        
        # If correction provided, learn from it
        if data and 'correction' in data:
            correction = data['correction']
            categorization_engine.learn_from_correction(
                correction['transaction'],
                correction['correct_category'],
                user_id
            )
        
        # Train model
        training_result = categorization_engine.train_categorization_model(user_id)
        
        return jsonify({
            'success': True,
            'training_result': training_result,
            'message': 'Model training completed'
        })
        
    except Exception as e:
        logger.error(f"Error training categorization model: {str(e)}")
        return api_error('Failed to train model', status=500, details=str(e))

@analytics_routes.route('/insights/recommendations', methods=['GET'])
@login_required
def get_recommendations():
    """
    Get personalized financial recommendations
    
    Returns:
    - AI-generated financial recommendations based on user patterns
    """
    try:
        user_id = request.user_id
        
        logger.info(f"Generating recommendations for user {user_id}")
        
        # Get spending analyzer
        spending_analyzer = analytics_suite['spending_analyzer']
        
        # Perform analysis
        analysis_result = spending_analyzer.analyze_user_spending(user_id, 6)
        
        if 'error' in analysis_result:
            return api_error(analysis_result['error'], status=400)
        
        # Extract recommendations
        recommendations = analysis_result.get('recommendations', [])
        insights = analysis_result.get('insights', [])
        
        # Combine and prioritize recommendations
        all_recommendations = []
        
        # Add spending recommendations
        for rec in recommendations:
            all_recommendations.append({
                'type': 'spending',
                'priority': rec.get('priority', 'medium'),
                'title': rec.get('action', 'Financial Tip'),
                'description': rec.get('description', ''),
                'category': rec.get('category', 'general'),
                'impact': 'medium'
            })
        
        # Add insight-based recommendations
        for insight in insights:
            if insight.get('type') == 'warning':
                all_recommendations.append({
                    'type': 'alert',
                    'priority': 'high',
                    'title': insight.get('title', 'Budget Alert'),
                    'description': insight.get('description', ''),
                    'category': 'budgeting',
                    'impact': insight.get('impact', 'medium')
                })
        
        # Sort by priority
        priority_order = {'high': 3, 'medium': 2, 'low': 1}
        all_recommendations.sort(
            key=lambda x: priority_order.get(x['priority'], 1), 
            reverse=True
        )
        
        return jsonify({
            'success': True,
            'recommendations': all_recommendations[:10],  # Top 10 recommendations
            'total_count': len(all_recommendations),
            'message': f'Generated {len(all_recommendations)} recommendations'
        })
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        return api_error('Failed to generate recommendations', status=500, details=str(e))

@analytics_routes.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for analytics service"""
    try:
        # Test analytics suite initialization
        suite_status = {
            'spending_analyzer': analytics_suite['spending_analyzer'] is not None,
            'fraud_detector': analytics_suite['fraud_detector'] is not None,
            'categorization_engine': analytics_suite['categorization_engine'] is not None,
            'budget_predictor': analytics_suite['budget_predictor'] is not None
        }
        
        all_healthy = all(suite_status.values())
        
        return jsonify({
            'success': True,
            'status': 'healthy' if all_healthy else 'degraded',
            'components': suite_status,
            'message': 'Analytics service is operational'
        }), 200 if all_healthy else 503
        
    except Exception as e:
        logger.error(f"Analytics health check failed: {str(e)}")
        return jsonify({
            'success': False,
            'status': 'unhealthy',
            'error': str(e)
        }), 503 