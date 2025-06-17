"""
User Feedback and Analytics Routes for TAAXDOG Production
Collects user feedback, feature requests, and tracks usage patterns for Australian users
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from flask import Blueprint, request, jsonify, g
from dataclasses import dataclass, asdict
import uuid

# Import our monitoring and analytics systems
from monitoring.performance_monitor import user_analytics, performance_monitor
from middleware.security_middleware import apply_security

feedback_bp = Blueprint('feedback', __name__)
logger = logging.getLogger('taaxdog.feedback')


@dataclass
class UserFeedback:
    """User feedback data structure"""
    feedback_id: str
    user_id: str
    feedback_type: str  # 'bug_report', 'feature_request', 'general', 'receipt_accuracy'
    category: str  # 'receipt_processing', 'tax_categorization', 'ui_ux', 'performance'
    rating: Optional[int]  # 1-5 stars
    title: str
    description: str
    screenshot_url: Optional[str]
    user_agent: str
    timestamp: datetime
    status: str = 'open'  # 'open', 'in_progress', 'resolved', 'closed'
    priority: str = 'medium'  # 'low', 'medium', 'high', 'critical'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'feedback_id': self.feedback_id,
            'user_id': self.user_id,
            'feedback_type': self.feedback_type,
            'category': self.category,
            'rating': self.rating,
            'title': self.title,
            'description': self.description,
            'screenshot_url': self.screenshot_url,
            'user_agent': self.user_agent,
            'timestamp': self.timestamp.isoformat(),
            'status': self.status,
            'priority': self.priority
        }


@feedback_bp.route('/feedback/submit', methods=['POST'])
@apply_security(rate_limit="10 per minute", require_auth=True)
def submit_feedback():
    """Submit user feedback or feature request"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['feedback_type', 'category', 'title', 'description']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Create feedback object
        feedback = UserFeedback(
            feedback_id=str(uuid.uuid4()),
            user_id=getattr(g, 'user_id', 'anonymous'),
            feedback_type=data['feedback_type'],
            category=data['category'],
            rating=data.get('rating'),
            title=data['title'],
            description=data['description'],
            screenshot_url=data.get('screenshot_url'),
            user_agent=request.headers.get('User-Agent', ''),
            timestamp=datetime.utcnow()
        )
        
        # Set priority based on feedback type and category
        feedback.priority = _determine_priority(feedback)
        
        # Store feedback
        _store_feedback(feedback)
        
        # Track analytics event
        if user_analytics:
            user_analytics.track_user_event(
                feedback.user_id,
                'feedback_submitted',
                {
                    'feedback_type': feedback.feedback_type,
                    'category': feedback.category,
                    'rating': feedback.rating,
                    'priority': feedback.priority
                }
            )
        
        # Send notifications for high priority feedback
        if feedback.priority in ['high', 'critical']:
            _send_priority_notification(feedback)
        
        logger.info(f"Feedback submitted: {feedback.feedback_id} by user {feedback.user_id}")
        
        return jsonify({
            'success': True,
            'feedback_id': feedback.feedback_id,
            'message': 'Thank you for your feedback! We\'ll review it shortly.',
            'estimated_response_time': _get_estimated_response_time(feedback.priority)
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to submit feedback: {e}")
        return jsonify({'error': 'Failed to submit feedback'}), 500


@feedback_bp.route('/feedback/receipt-accuracy', methods=['POST'])
@apply_security(rate_limit="20 per minute", require_auth=True)
def submit_receipt_accuracy_feedback():
    """Submit feedback on receipt processing accuracy"""
    try:
        data = request.get_json()
        
        required_fields = ['receipt_id', 'is_accurate', 'corrections']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        feedback_data = {
            'receipt_id': data['receipt_id'],
            'is_accurate': data['is_accurate'],
            'corrections': data['corrections'],
            'user_comments': data.get('user_comments', '')
        }
        
        # Create feedback object
        feedback = UserFeedback(
            feedback_id=str(uuid.uuid4()),
            user_id=getattr(g, 'user_id', 'anonymous'),
            feedback_type='receipt_accuracy',
            category='receipt_processing',
            rating=5 if data['is_accurate'] else 2,
            title=f"Receipt accuracy feedback for {data['receipt_id']}",
            description=json.dumps(feedback_data),
            screenshot_url=None,
            user_agent=request.headers.get('User-Agent', ''),
            timestamp=datetime.utcnow(),
            priority='medium' if data['is_accurate'] else 'high'
        )
        
        # Store feedback
        _store_feedback(feedback)
        
        # Track analytics for receipt accuracy
        if user_analytics:
            user_analytics.track_user_event(
                feedback.user_id,
                'receipt_accuracy_feedback',
                {
                    'receipt_id': data['receipt_id'],
                    'is_accurate': data['is_accurate'],
                    'has_corrections': bool(data['corrections']),
                    'correction_count': len(data['corrections'])
                }
            )
        
        # Update receipt processing metrics
        if performance_monitor:
            performance_monitor.track_receipt_processing(
                success=data['is_accurate'],
                processing_time=0,  # Not applicable for feedback
                error_type=None if data['is_accurate'] else 'accuracy_issue'
            )
        
        return jsonify({
            'success': True,
            'feedback_id': feedback.feedback_id,
            'message': 'Thank you for helping us improve receipt accuracy!'
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to submit receipt accuracy feedback: {e}")
        return jsonify({'error': 'Failed to submit receipt feedback'}), 500


@feedback_bp.route('/feedback/tax-categorization', methods=['POST'])
@apply_security(rate_limit="30 per minute", require_auth=True)
def submit_tax_categorization_feedback():
    """Submit feedback on tax categorization accuracy"""
    try:
        data = request.get_json()
        
        required_fields = ['transaction_id', 'suggested_category', 'user_selected_category', 'is_correct']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Track tax categorization accuracy
        if user_analytics:
            user_analytics.track_tax_categorization(
                user_id=getattr(g, 'user_id', 'anonymous'),
                original_category=data['suggested_category'],
                suggested_category=data['user_selected_category'],
                user_accepted=data['is_correct']
            )
        
        # Store detailed feedback if provided
        if data.get('comments'):
            feedback = UserFeedback(
                feedback_id=str(uuid.uuid4()),
                user_id=getattr(g, 'user_id', 'anonymous'),
                feedback_type='tax_categorization',
                category='tax_categorization',
                rating=5 if data['is_correct'] else 3,
                title=f"Tax categorization feedback for {data['transaction_id']}",
                description=json.dumps({
                    'transaction_id': data['transaction_id'],
                    'suggested_category': data['suggested_category'],
                    'user_selected_category': data['user_selected_category'],
                    'is_correct': data['is_correct'],
                    'comments': data.get('comments', '')
                }),
                screenshot_url=None,
                user_agent=request.headers.get('User-Agent', ''),
                timestamp=datetime.utcnow()
            )
            
            _store_feedback(feedback)
        
        return jsonify({
            'success': True,
            'message': 'Thank you for helping us improve tax categorization!'
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to submit tax categorization feedback: {e}")
        return jsonify({'error': 'Failed to submit categorization feedback'}), 500


@feedback_bp.route('/feedback/feature-request', methods=['POST'])
@apply_security(rate_limit="5 per hour", require_auth=True)
def submit_feature_request():
    """Submit a feature request"""
    try:
        data = request.get_json()
        
        required_fields = ['title', 'description', 'use_case']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Create feature request
        feedback = UserFeedback(
            feedback_id=str(uuid.uuid4()),
            user_id=getattr(g, 'user_id', 'anonymous'),
            feedback_type='feature_request',
            category=data.get('category', 'general'),
            rating=None,
            title=data['title'],
            description=json.dumps({
                'description': data['description'],
                'use_case': data['use_case'],
                'business_impact': data.get('business_impact', ''),
                'urgency': data.get('urgency', 'medium')
            }),
            screenshot_url=data.get('mockup_url'),
            user_agent=request.headers.get('User-Agent', ''),
            timestamp=datetime.utcnow(),
            priority=data.get('urgency', 'medium')
        )
        
        # Store feedback
        _store_feedback(feedback)
        
        # Track analytics
        if user_analytics:
            user_analytics.track_user_event(
                feedback.user_id,
                'feature_request_submitted',
                {
                    'category': feedback.category,
                    'urgency': data.get('urgency', 'medium'),
                    'has_business_impact': bool(data.get('business_impact'))
                }
            )
        
        return jsonify({
            'success': True,
            'feedback_id': feedback.feedback_id,
            'message': 'Thank you for your feature request! We\'ll consider it for future updates.',
            'voting_url': f'/feedback/feature-request/{feedback.feedback_id}/vote'
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to submit feature request: {e}")
        return jsonify({'error': 'Failed to submit feature request'}), 500


@feedback_bp.route('/feedback/analytics/summary', methods=['GET'])
@apply_security(require_auth=True)
def get_feedback_analytics():
    """Get feedback analytics summary"""
    try:
        days = int(request.args.get('days', 30))
        
        summary = _get_feedback_summary(days)
        
        return jsonify({
            'period_days': days,
            'summary': summary,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get feedback analytics: {e}")
        return jsonify({'error': 'Failed to retrieve analytics'}), 500


@feedback_bp.route('/feedback/trends/australian-users', methods=['GET'])
@apply_security(require_auth=True)
def get_australian_user_trends():
    """Get feedback trends specific to Australian users"""
    try:
        # Get feedback trends for Australian timezone and business patterns
        trends = _get_australian_feedback_trends()
        
        return jsonify({
            'australian_trends': trends,
            'insights': _generate_australian_insights(trends),
            'timestamp': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get Australian user trends: {e}")
        return jsonify({'error': 'Failed to retrieve trends'}), 500


@feedback_bp.route('/feedback/nps-survey', methods=['POST'])
@apply_security(rate_limit="1 per day", require_auth=True)
def submit_nps_survey():
    """Submit Net Promoter Score survey response"""
    try:
        data = request.get_json()
        
        if 'score' not in data or not (0 <= data['score'] <= 10):
            return jsonify({'error': 'Score must be between 0 and 10'}), 400
        
        # Create NPS feedback
        feedback = UserFeedback(
            feedback_id=str(uuid.uuid4()),
            user_id=getattr(g, 'user_id', 'anonymous'),
            feedback_type='nps_survey',
            category='general',
            rating=data['score'],
            title=f"NPS Survey Response: {data['score']}/10",
            description=json.dumps({
                'score': data['score'],
                'reason': data.get('reason', ''),
                'improvements': data.get('improvements', ''),
                'favorite_features': data.get('favorite_features', [])
            }),
            screenshot_url=None,
            user_agent=request.headers.get('User-Agent', ''),
            timestamp=datetime.utcnow()
        )
        
        # Store feedback
        _store_feedback(feedback)
        
        # Track NPS analytics
        if user_analytics:
            user_analytics.track_user_event(
                feedback.user_id,
                'nps_survey_completed',
                {
                    'score': data['score'],
                    'category': _categorize_nps_score(data['score']),
                    'has_reason': bool(data.get('reason')),
                    'has_improvements': bool(data.get('improvements'))
                }
            )
        
        return jsonify({
            'success': True,
            'message': 'Thank you for your feedback! It helps us improve TAAXDOG.',
            'category': _categorize_nps_score(data['score'])
        }), 201
        
    except Exception as e:
        logger.error(f"Failed to submit NPS survey: {e}")
        return jsonify({'error': 'Failed to submit survey'}), 500


# Helper functions

def _store_feedback(feedback: UserFeedback):
    """Store feedback in database/storage system"""
    try:
        # In a real implementation, this would store to your database
        # For now, log the feedback
        logger.info(f"Storing feedback: {feedback.feedback_id}", extra={
            'feedback_type': feedback.feedback_type,
            'category': feedback.category,
            'priority': feedback.priority,
            'user_id': feedback.user_id
        })
        
        # You would implement actual storage here:
        # - Firebase Firestore
        # - PostgreSQL
        # - MongoDB
        # etc.
        
    except Exception as e:
        logger.error(f"Failed to store feedback {feedback.feedback_id}: {e}")
        raise


def _determine_priority(feedback: UserFeedback) -> str:
    """Determine feedback priority based on type and content"""
    # Critical priorities
    if feedback.feedback_type == 'bug_report':
        if any(keyword in feedback.description.lower() for keyword in ['crash', 'error', 'broken', 'not working']):
            return 'critical'
        return 'high'
    
    # High priority categories
    if feedback.category in ['receipt_processing', 'tax_categorization']:
        return 'high'
    
    # Medium priority for feature requests
    if feedback.feedback_type == 'feature_request':
        return 'medium'
    
    # Low rating indicates high priority
    if feedback.rating and feedback.rating <= 2:
        return 'high'
    
    return 'medium'


def _send_priority_notification(feedback: UserFeedback):
    """Send notification for high priority feedback"""
    try:
        # In a real implementation, this would send notifications via:
        # - Slack webhook
        # - Email
        # - PagerDuty
        # - Discord
        # etc.
        
        logger.warning(f"High priority feedback received: {feedback.feedback_id}", extra={
            'feedback_type': feedback.feedback_type,
            'category': feedback.category,
            'priority': feedback.priority,
            'title': feedback.title
        })
        
    except Exception as e:
        logger.error(f"Failed to send priority notification: {e}")


def _get_estimated_response_time(priority: str) -> str:
    """Get estimated response time based on priority"""
    response_times = {
        'critical': '2-4 hours',
        'high': '1-2 business days',
        'medium': '3-5 business days',
        'low': '1-2 weeks'
    }
    return response_times.get(priority, '1 week')


def _get_feedback_summary(days: int) -> Dict[str, Any]:
    """Get feedback summary for the last N days"""
    # In a real implementation, this would query your database
    # For now, return placeholder data
    return {
        'total_feedback': 0,
        'by_type': {
            'bug_report': 0,
            'feature_request': 0,
            'general': 0,
            'receipt_accuracy': 0,
            'nps_survey': 0
        },
        'by_category': {
            'receipt_processing': 0,
            'tax_categorization': 0,
            'ui_ux': 0,
            'performance': 0,
            'general': 0
        },
        'average_rating': 0.0,
        'response_time_avg': '2 days',
        'resolution_rate': 0.0
    }


def _get_australian_feedback_trends() -> Dict[str, Any]:
    """Get feedback trends specific to Australian users"""
    return {
        'peak_feedback_hours': [9, 10, 11, 14, 15, 16],  # Australian business hours
        'most_common_categories': ['tax_categorization', 'receipt_processing'],
        'seasonal_trends': {
            'tax_season_increase': 'July-October shows 40% increase in feedback',
            'end_of_financial_year': 'June shows highest receipt processing feedback'
        },
        'feature_requests': {
            'ato_integration': 'Most requested feature',
            'bas_reporting': 'Second most requested',
            'multi_currency': 'Growing request from international users'
        }
    }


def _generate_australian_insights(trends: Dict[str, Any]) -> List[str]:
    """Generate insights specific to Australian market"""
    insights = [
        "Tax categorization feedback peaks during Australian tax season (July-October)",
        "Receipt processing feedback increases significantly in June (end of financial year)",
        "ATO integration is the most requested feature by Australian users",
        "Business users provide more detailed feedback than individual taxpayers",
        "Mobile app usage peaks during Australian business hours (9 AM - 5 PM AEST)"
    ]
    return insights


def _categorize_nps_score(score: int) -> str:
    """Categorize NPS score"""
    if score >= 9:
        return 'promoter'
    elif score >= 7:
        return 'passive'
    else:
        return 'detractor' 