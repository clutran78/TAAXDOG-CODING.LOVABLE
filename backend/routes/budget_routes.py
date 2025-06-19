"""
Budget Prediction API Routes for TAAXDOG Application

This module provides REST API endpoints for budget prediction functionality,
including budget forecasting, spending analysis, anomaly detection, and
budget plan creation.
"""

from flask import Blueprint, request, jsonify
import sys
import os
from datetime import datetime, timedelta
import uuid

# Add project paths for imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'backend'))
sys.path.insert(0, os.path.join(project_root, 'database'))

try:
    from backend.firebase_config import db
    from backend.basiq_api import get_user_transactions
    from ai.budget_predictor import (
        predict_future_budget,
        analyze_spending_patterns,
        detect_budget_anomalies,
        create_budget_plan
    )
    from backend.routes.utils import api_error, login_required, logger
    from database.models import Budget, BudgetTracking
except ImportError as e:
    # Fallback imports for development
    print(f"Import warning: {e}")
    from firebase_config import db
    from basiq_api import get_user_transactions
    from routes.utils import api_error, login_required, logger

# Create blueprint for budget routes
budget_routes = Blueprint('budget', __name__, url_prefix='/api/budget')


@budget_routes.route('/predict', methods=['GET'])
@login_required
def get_budget_predictions():
    """
    Get AI-powered budget predictions based on user's transaction history.
    
    Query Parameters:
        - months: Number of months to predict (default: 3, max: 12)
        - filter: Transaction filter for Basiq API
        
    Returns:
        JSON response with budget predictions, confidence scores, and recommendations
    """
    try:
        # Get user ID from the authenticated request
        user_id = request.user_id
        
        # Get prediction parameters
        prediction_months = min(int(request.args.get('months', 3)), 12)
        filter_str = request.args.get('filter')
        
        # Fetch user's transaction data from Basiq API
        logger.info(f"Fetching transactions for user {user_id}")
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return api_error(
                'Failed to fetch transactions', 
                status=400, 
                details=transactions_result.get('error')
            )
        
        # Extract transaction data
        transactions = transactions_result.get('transactions', {}).get('data', [])
        
        if not transactions:
            return api_error(
                'No transaction data available for predictions',
                status=400,
                details='Need at least some transaction history to generate predictions'
            )
        
        # Generate budget predictions using AI
        logger.info(f"Generating {prediction_months}-month budget predictions")
        predictions = predict_future_budget(transactions, prediction_months)
        
        if predictions.get('error'):
            return api_error(
                'Failed to generate budget predictions',
                status=500,
                details=predictions.get('error')
            )
        
        # Return successful response
        return jsonify({
            'success': True,
            'data': {
                'predictions': predictions.get('predictions', {}),
                'confidence_scores': predictions.get('confidence_scores', {}),
                'recommendations': predictions.get('recommendations', []),
                'analysis_summary': predictions.get('analysis_summary', {}),
                'prediction_period': f"{prediction_months} months",
                'generated_at': datetime.now().isoformat()
            }
        })
        
    except ValueError as e:
        return api_error('Invalid request parameters', status=400, details=str(e))
    except Exception as e:
        logger.error(f"Error generating budget predictions: {str(e)}")
        return api_error('Server error occurred', status=500, details=str(e))


@budget_routes.route('/analyze', methods=['GET'])
@login_required
def analyze_spending():
    """
    Analyze user's spending patterns and trends.
    
    Query Parameters:
        - filter: Transaction filter for Basiq API
        
    Returns:
        JSON response with detailed spending pattern analysis
    """
    try:
        user_id = request.user_id
        filter_str = request.args.get('filter')
        
        # Fetch transaction data
        logger.info(f"Analyzing spending patterns for user {user_id}")
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return api_error(
                'Failed to fetch transactions',
                status=400,
                details=transactions_result.get('error')
            )
        
        # Extract transactions
        transactions = transactions_result.get('transactions', {}).get('data', [])
        
        if not transactions:
            return api_error(
                'No transaction data available for analysis',
                status=400,
                details='Need transaction history to perform spending analysis'
            )
        
        # Analyze spending patterns
        analysis = analyze_spending_patterns(transactions)
        
        if analysis.get('error'):
            return api_error(
                'Failed to analyze spending patterns',
                status=500,
                details=analysis.get('error')
            )
        
        return jsonify({
            'success': True,
            'data': {
                'monthly_spending': analysis.get('monthly_spending', {}),
                'category_spending': analysis.get('category_spending', {}),
                'trend_analysis': analysis.get('trend_analysis', {}),
                'seasonal_patterns': analysis.get('seasonal_patterns', {}),
                'summary_statistics': analysis.get('summary_statistics', {}),
                'analyzed_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error analyzing spending patterns: {str(e)}")
        return api_error('Server error occurred', status=500, details=str(e))


@budget_routes.route('/anomalies', methods=['GET'])
@login_required
def detect_anomalies():
    """
    Detect unusual spending patterns and budget risks.
    
    Query Parameters:
        - filter: Transaction filter for Basiq API
        
    Returns:
        JSON response with detected anomalies and risk assessment
    """
    try:
        user_id = request.user_id
        filter_str = request.args.get('filter')
        
        # Fetch transaction data
        logger.info(f"Detecting spending anomalies for user {user_id}")
        transactions_result = get_user_transactions(user_id, filter_str)
        
        if not transactions_result.get('success'):
            return api_error(
                'Failed to fetch transactions',
                status=400,
                details=transactions_result.get('error')
            )
        
        # Extract transactions
        transactions = transactions_result.get('transactions', {}).get('data', [])
        
        if not transactions:
            return api_error(
                'No transaction data available for anomaly detection',
                status=400,
                details='Need transaction history to detect anomalies'
            )
        
        # Detect spending anomalies
        anomaly_results = detect_budget_anomalies(transactions)
        
        if anomaly_results.get('error'):
            return api_error(
                'Failed to detect spending anomalies',
                status=500,
                details=anomaly_results.get('error')
            )
        
        return jsonify({
            'success': True,
            'data': {
                'anomalies': anomaly_results.get('anomalies', []),
                'risk_assessment': anomaly_results.get('risk_assessment', {}),
                'recommendations': anomaly_results.get('recommendations', []),
                'detected_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error detecting spending anomalies: {str(e)}")
        return api_error('Server error occurred', status=500, details=str(e))


@budget_routes.route('/plan', methods=['POST'])
@login_required
def create_user_budget_plan():
    """
    Create a comprehensive budget plan for the user.
    
    Request Body:
        - target_savings: Monthly target savings amount (optional)
        - monthly_income: User's monthly income (optional)
        - name: Budget plan name (optional)
        - notes: User notes about the budget (optional)
        
    Returns:
        JSON response with created budget plan
    """
    try:
        user_id = request.user_id
        data = request.get_json() or {}
        
        # Extract request parameters
        target_savings = data.get('target_savings')
        monthly_income = data.get('monthly_income')
        budget_name = data.get('name', f"Budget Plan - {datetime.now().strftime('%B %Y')}")
        notes = data.get('notes')
        
        # Validate numeric inputs
        if target_savings is not None:
            target_savings = float(target_savings)
        if monthly_income is not None:
            monthly_income = float(monthly_income)
        
        # Fetch transaction data
        logger.info(f"Creating budget plan for user {user_id}")
        transactions_result = get_user_transactions(user_id)
        
        if not transactions_result.get('success'):
            return api_error(
                'Failed to fetch transactions',
                status=400,
                details=transactions_result.get('error')
            )
        
        # Extract transactions
        transactions = transactions_result.get('transactions', {}).get('data', [])
        
        if not transactions:
            return api_error(
                'No transaction data available for budget planning',
                status=400,
                details='Need transaction history to create budget plan'
            )
        
        # Create budget plan using AI
        budget_plan = create_budget_plan(transactions, target_savings, monthly_income)
        
        if budget_plan.get('error'):
            return api_error(
                'Failed to create budget plan',
                status=500,
                details=budget_plan.get('error')
            )
        
        # Save budget plan to database if successful
        if budget_plan.get('success') and db:
            try:
                budget_id = str(uuid.uuid4())
                now = datetime.now()
                
                # Create Budget object
                budget = Budget(
                    budget_id=budget_id,
                    user_id=user_id,
                    name=budget_name,
                    created_at=now,
                    updated_at=now,
                    monthly_budget=budget_plan.get('monthly_budget'),
                    target_savings=target_savings,
                    monthly_income=monthly_income,
                    predictions=budget_plan.get('predictions', {}),
                    category_limits=budget_plan.get('spending_categories', {}),
                    confidence_score=budget_plan.get('confidence_scores', {}).get('overall', 0.0),
                    status='active',
                    notes=notes
                )
                
                # Save to Firestore
                db.collection('users').document(user_id).collection('budgets').document(budget_id).set(budget.to_dict())
                
                logger.info(f"Budget plan saved for user {user_id} with ID {budget_id}")
                
            except Exception as e:
                logger.error(f"Error saving budget plan: {str(e)}")
                # Continue without failing - budget plan can still be returned
        
        return jsonify({
            'success': True,
            'data': {
                'budget_plan': budget_plan,
                'budget_id': budget_id if 'budget_id' in locals() else None,
                'created_at': datetime.now().isoformat()
            }
        })
        
    except ValueError as e:
        return api_error('Invalid request parameters', status=400, details=str(e))
    except Exception as e:
        logger.error(f"Error creating budget plan: {str(e)}")
        return api_error('Server error occurred', status=500, details=str(e))


@budget_routes.route('/plans', methods=['GET'])
@login_required
def get_user_budget_plans():
    """
    Get all budget plans for the authenticated user.
    
    Query Parameters:
        - status: Filter by status (active, archived, draft)
        - limit: Maximum number of plans to return (default: 10)
        
    Returns:
        JSON response with list of user's budget plans
    """
    try:
        user_id = request.user_id
        status_filter = request.args.get('status', 'active')
        limit = min(int(request.args.get('limit', 10)), 50)  # Max 50 plans
        
        if not db:
            return api_error('Database not available', status=500)
        
        # Query budget plans from Firestore
        query = db.collection('users').document(user_id).collection('budgets')
        
        if status_filter and status_filter != 'all':
            query = query.where('status', '==', status_filter)
        
        # Order by creation date (newest first) and limit results
        query = query.order_by('created_at', direction='desc').limit(limit)
        
        # Execute query
        budget_docs = query.get()
        
        # Convert to list of dictionaries
        budget_plans = []
        for doc in budget_docs:
            budget_data = doc.to_dict()
            budget_data['id'] = doc.id  # Add document ID
            budget_plans.append(budget_data)
        
        return jsonify({
            'success': True,
            'data': {
                'budget_plans': budget_plans,
                'count': len(budget_plans),
                'retrieved_at': datetime.now().isoformat()
            }
        })
        
    except ValueError as e:
        return api_error('Invalid request parameters', status=400, details=str(e))
    except Exception as e:
        logger.error(f"Error retrieving budget plans: {str(e)}")
        return api_error('Server error occurred', status=500, details=str(e))


@budget_routes.route('/plans/<budget_id>', methods=['GET'])
@login_required
def get_budget_plan(budget_id):
    """
    Get a specific budget plan by ID.
    
    Path Parameters:
        - budget_id: The ID of the budget plan to retrieve
        
    Returns:
        JSON response with the budget plan details
    """
    try:
        user_id = request.user_id
        
        if not db:
            return api_error('Database not available', status=500)
        
        # Retrieve budget plan from Firestore
        budget_ref = db.collection('users').document(user_id).collection('budgets').document(budget_id)
        budget_doc = budget_ref.get()
        
        if not budget_doc.exists:
            return api_error('Budget plan not found', status=404)
        
        # Convert to dictionary
        budget_data = budget_doc.to_dict()
        budget_data['id'] = budget_doc.id
        
        return jsonify({
            'success': True,
            'data': {
                'budget_plan': budget_data,
                'retrieved_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error retrieving budget plan: {str(e)}")
        return api_error('Server error occurred', status=500, details=str(e))


@budget_routes.route('/plans/<budget_id>', methods=['PUT'])
@login_required
def update_budget_plan(budget_id):
    """
    Update an existing budget plan.
    
    Path Parameters:
        - budget_id: The ID of the budget plan to update
        
    Request Body:
        - Any budget fields to update (name, target_savings, etc.)
        
    Returns:
        JSON response with updated budget plan
    """
    try:
        user_id = request.user_id
        data = request.get_json() or {}
        
        if not db:
            return api_error('Database not available', status=500)
        
        # Check if budget exists and belongs to user
        budget_ref = db.collection('users').document(user_id).collection('budgets').document(budget_id)
        budget_doc = budget_ref.get()
        
        if not budget_doc.exists:
            return api_error('Budget plan not found', status=404)
        
        # Prepare update data
        update_data = {}
        allowed_fields = [
            'name', 'target_savings', 'monthly_income', 'monthly_budget',
            'category_limits', 'status', 'notes'
        ]
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        # Always update the timestamp
        update_data['updated_at'] = datetime.now()
        
        # Update in Firestore
        budget_ref.update(update_data)
        
        # Get updated document
        updated_doc = budget_ref.get()
        updated_data = updated_doc.to_dict()
        updated_data['id'] = updated_doc.id
        
        return jsonify({
            'success': True,
            'data': {
                'budget_plan': updated_data,
                'updated_at': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error updating budget plan: {str(e)}")
        return api_error('Server error occurred', status=500, details=str(e))


@budget_routes.route('/plans/<budget_id>', methods=['DELETE'])
@login_required
def delete_budget_plan(budget_id):
    """
    Delete a budget plan.
    
    Path Parameters:
        - budget_id: The ID of the budget plan to delete
        
    Returns:
        JSON response confirming deletion
    """
    try:
        user_id = request.user_id
        
        if not db:
            return api_error('Database not available', status=500)
        
        # Check if budget exists and belongs to user
        budget_ref = db.collection('users').document(user_id).collection('budgets').document(budget_id)
        budget_doc = budget_ref.get()
        
        if not budget_doc.exists:
            return api_error('Budget plan not found', status=404)
        
        # Delete the budget plan
        budget_ref.delete()
        
        # Also delete any associated tracking records
        tracking_query = db.collection('budget_tracking').where('budget_id', '==', budget_id)
        tracking_docs = tracking_query.get()
        
        for doc in tracking_docs:
            doc.reference.delete()
        
        return jsonify({
            'success': True,
            'message': 'Budget plan deleted successfully',
            'deleted_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error deleting budget plan: {str(e)}")
        return api_error('Server error occurred', status=500, details=str(e))


@budget_routes.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for budget prediction service.
    
    Returns:
        JSON response with service status
    """
    try:
        # Check if AI prediction module is available
        from ai.budget_predictor import predict_future_budget
        
        return jsonify({
            'success': True,
            'service': 'Budget Prediction API',
            'status': 'healthy',
            'features': {
                'predictions': True,
                'analysis': True,
                'anomaly_detection': True,
                'budget_planning': True,
                'database_storage': db is not None
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'service': 'Budget Prediction API',
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500 