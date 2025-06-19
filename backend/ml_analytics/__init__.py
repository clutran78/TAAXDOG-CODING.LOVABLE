"""
Machine Learning Analytics Package for TAAXDOG Finance Application

This package provides comprehensive data analytics and machine learning features:
- Spending pattern analysis and prediction models
- Fraud detection and anomaly detection  
- Intelligent receipt categorization learning
- Personalized financial recommendations
- User behavior analytics
- Predictive budgeting and expense forecasting
"""

from .spending_patterns import SpendingPatternAnalyzer
from .fraud_detection import FraudDetectionSystem  
from .categorization import IntelligentCategorizationEngine
from .budget_prediction import PredictiveBudgetingEngine
from .data_models import SpendingPattern, AnomalyAlert, BudgetPrediction

__version__ = "1.0.0"
__all__ = [
    'SpendingPatternAnalyzer',
    'FraudDetectionSystem', 
    'IntelligentCategorizationEngine',
    'PredictiveBudgetingEngine',
    'SpendingPattern',
    'AnomalyAlert', 
    'BudgetPrediction'
]

def create_analytics_suite():
    """Create complete analytics suite for TAAXDOG"""
    return {
        'spending_analyzer': SpendingPatternAnalyzer(),
        'fraud_detector': FraudDetectionSystem(),
        'categorization_engine': IntelligentCategorizationEngine(),
        'budget_predictor': PredictiveBudgetingEngine()
    } 