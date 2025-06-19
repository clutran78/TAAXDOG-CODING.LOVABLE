"""
Data Models for Machine Learning Analytics System

This module defines data structures used across ML analytics components.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

@dataclass
class SpendingPattern:
    """Data class for spending pattern analysis results"""
    user_id: str
    pattern_type: str  # e.g., 'consistent', 'irregular', 'seasonal', 'growing', 'declining'
    category: str
    frequency: str  # e.g., 'daily', 'weekly', 'monthly', 'irregular'
    average_amount: float
    trend: str  # e.g., 'increasing', 'decreasing', 'stable'
    confidence_score: float  # 0.0 to 1.0
    recommendations: List[str]
    analysis_period: str
    created_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'user_id': self.user_id,
            'pattern_type': self.pattern_type,
            'category': self.category,
            'frequency': self.frequency,
            'average_amount': self.average_amount,
            'trend': self.trend,
            'confidence_score': self.confidence_score,
            'recommendations': self.recommendations,
            'analysis_period': self.analysis_period,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

@dataclass
class AnomalyAlert:
    """Data class for anomaly detection alerts"""
    user_id: str
    transaction_id: str
    anomaly_type: str  # e.g., 'unusual_amount', 'unusual_time', 'unusual_merchant', 'rapid_transactions'
    risk_score: float  # 0.0 to 1.0, higher = more suspicious
    description: str
    detected_at: datetime
    recommended_action: str
    transaction_data: Optional[Dict[str, Any]] = None
    is_resolved: bool = False
    resolution_notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'user_id': self.user_id,
            'transaction_id': self.transaction_id,
            'anomaly_type': self.anomaly_type,
            'risk_score': self.risk_score,
            'description': self.description,
            'detected_at': self.detected_at.isoformat() if self.detected_at else None,
            'recommended_action': self.recommended_action,
            'transaction_data': self.transaction_data,
            'is_resolved': self.is_resolved,
            'resolution_notes': self.resolution_notes
        }

@dataclass
class BudgetPrediction:
    """Data class for budget predictions"""
    user_id: str
    category: str
    predicted_amount: float
    confidence_interval: Tuple[float, float]  # (lower_bound, upper_bound)
    trend_direction: str  # 'increasing', 'decreasing', 'stable'
    factors: List[str]  # Factors influencing the prediction
    recommendation: str
    prediction_period: str  # e.g., 'next_month', 'next_quarter'
    model_accuracy: Optional[float] = None
    created_at: datetime = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'user_id': self.user_id,
            'category': self.category,
            'predicted_amount': self.predicted_amount,
            'confidence_interval': {
                'lower_bound': self.confidence_interval[0],
                'upper_bound': self.confidence_interval[1]
            },
            'trend_direction': self.trend_direction,
            'factors': self.factors,
            'recommendation': self.recommendation,
            'prediction_period': self.prediction_period,
            'model_accuracy': self.model_accuracy,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

@dataclass
class CategoryPrediction:
    """Data class for transaction categorization predictions"""
    transaction_id: str
    predicted_category: str
    confidence: float  # 0.0 to 1.0
    alternatives: List[Dict[str, Any]]  # [{'category': str, 'probability': float}]
    method: str  # 'ml_prediction', 'rule_based', 'fuzzy_match'
    features_used: List[str]
    model_version: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'transaction_id': self.transaction_id,
            'predicted_category': self.predicted_category,
            'confidence': self.confidence,
            'alternatives': self.alternatives,
            'method': self.method,
            'features_used': self.features_used,
            'model_version': self.model_version
        }

@dataclass
class UserBehaviorProfile:
    """Data class for user behavior analytics"""
    user_id: str
    spending_personality: str  # 'conservative', 'moderate', 'aggressive', 'impulsive'
    preferred_categories: List[str]
    peak_spending_times: List[str]  # e.g., ['weekends', 'evenings']
    financial_goals_alignment: float  # 0.0 to 1.0
    risk_tolerance: str  # 'low', 'medium', 'high'
    budget_adherence_score: float  # 0.0 to 1.0
    seasonal_patterns: Dict[str, float]  # {'summer': 1.2, 'winter': 0.8}
    anomaly_history: int  # Number of past anomalies
    last_updated: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'user_id': self.user_id,
            'spending_personality': self.spending_personality,
            'preferred_categories': self.preferred_categories,
            'peak_spending_times': self.peak_spending_times,
            'financial_goals_alignment': self.financial_goals_alignment,
            'risk_tolerance': self.risk_tolerance,
            'budget_adherence_score': self.budget_adherence_score,
            'seasonal_patterns': self.seasonal_patterns,
            'anomaly_history': self.anomaly_history,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }

@dataclass
class FinancialInsight:
    """Data class for AI-generated financial insights"""
    user_id: str
    insight_type: str  # 'spending_tip', 'savings_opportunity', 'budget_warning', 'goal_suggestion'
    title: str
    description: str
    impact_score: float  # 0.0 to 1.0, potential financial impact
    actionable: bool
    action_items: List[str]
    category: Optional[str] = None
    amount_involved: Optional[float] = None
    created_at: datetime = None
    expires_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            'user_id': self.user_id,
            'insight_type': self.insight_type,
            'title': self.title,
            'description': self.description,
            'impact_score': self.impact_score,
            'actionable': self.actionable,
            'action_items': self.action_items,
            'category': self.category,
            'amount_involved': self.amount_involved,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None
        } 