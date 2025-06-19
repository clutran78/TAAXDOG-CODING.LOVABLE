"""
Advanced Machine Learning Analytics System for TAAXDOG Finance Application

This module provides comprehensive data analytics and machine learning features including:
- Spending pattern analysis and prediction models
- Intelligent receipt categorization learning
- Fraud detection and anomaly detection
- Personalized financial recommendations
- User behavior analytics
- Predictive budgeting and expense forecasting

Integrates with existing Firebase data structure and Basiq API transactions.
"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict
import logging
import joblib
import os
from fuzzywuzzy import fuzz
import warnings
warnings.filterwarnings('ignore')

# Firebase and existing integrations
from firebase_config import db
from basiq_api import get_user_transactions

logger = logging.getLogger(__name__)

@dataclass
class SpendingPattern:
    """Data class for spending pattern analysis results"""
    user_id: str
    pattern_type: str
    category: str
    frequency: str
    average_amount: float
    trend: str
    confidence_score: float
    recommendations: List[str]

@dataclass
class AnomalyAlert:
    """Data class for anomaly detection alerts"""
    user_id: str
    transaction_id: str
    anomaly_type: str
    risk_score: float
    description: str
    detected_at: datetime
    recommended_action: str

@dataclass
class BudgetPrediction:
    """Data class for budget predictions"""
    user_id: str
    category: str
    predicted_amount: float
    confidence_interval: Tuple[float, float]
    trend_direction: str
    factors: List[str]
    recommendation: str

class SpendingPatternAnalyzer:
    """Advanced spending pattern analysis using machine learning"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.kmeans = KMeans(n_clusters=5, random_state=42)
        self.pattern_models = {}
        self.model_path = 'backend/models/spending_patterns/'
        os.makedirs(self.model_path, exist_ok=True)
    
    def analyze_user_spending(self, user_id: str, months_back: int = 6) -> Dict[str, Any]:
        """
        Comprehensive spending pattern analysis for a user
        
        Args:
            user_id: Firebase user ID
            months_back: Number of months of data to analyze
            
        Returns:
            Dictionary containing spending patterns, insights, and recommendations
        """
        try:
            # Get user transaction and receipt data
            transactions = self._get_user_transactions(user_id, months_back)
            receipts = self._get_user_receipts(user_id, months_back)
            user_profile = self._get_user_profile(user_id)
            
            if not transactions:
                return {'error': 'No transaction data available for analysis'}
            
            # Create comprehensive feature matrix
            features_df = self._extract_spending_features(transactions, receipts, user_profile)
            
            # Perform clustering analysis
            spending_clusters = self._perform_clustering_analysis(features_df)
            
            # Identify spending patterns
            patterns = self._identify_spending_patterns(features_df, spending_clusters)
            
            # Generate insights and recommendations
            insights = self._generate_pattern_insights(patterns, user_profile)
            recommendations = self._generate_spending_recommendations(patterns, insights)
            
            # Calculate spending scores
            scores = self._calculate_spending_scores(features_df, patterns)
            
            result = {
                'user_id': user_id,
                'analysis_date': datetime.now().isoformat(),
                'spending_patterns': patterns,
                'insights': insights,
                'recommendations': recommendations,
                'spending_scores': scores,
                'data_period': f'{months_back} months',
                'transaction_count': len(transactions)
            }
            
            # Save patterns for future predictions
            self._save_user_patterns(user_id, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in spending pattern analysis for user {user_id}: {str(e)}")
            return {'error': f'Analysis failed: {str(e)}'}
    
    def _extract_spending_features(self, transactions: List[Dict], receipts: List[Dict], user_profile: Dict) -> pd.DataFrame:
        """Extract comprehensive feature matrix for ML analysis"""
        features = []
        
        # Convert transactions to DataFrame for easier processing
        df = pd.DataFrame(transactions)
        if df.empty:
            return pd.DataFrame()
        
        # Ensure amount is numeric
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
        df['amount_abs'] = df['amount'].abs()
        
        # Parse dates
        df['date'] = pd.to_datetime(df['postDate'], errors='coerce')
        df['month'] = df['date'].dt.month
        df['day_of_week'] = df['date'].dt.dayofweek
        df['hour'] = df['date'].dt.hour
        
        # Group by category for analysis
        categories = df['category'].fillna('Other').unique()
        
        for category in categories:
            category_data = df[df['category'] == category]
            
            if len(category_data) == 0:
                continue
            
            feature_vector = {
                'category': category,
                'avg_amount': category_data['amount_abs'].mean(),
                'total_amount': category_data['amount_abs'].sum(),
                'transaction_count': len(category_data),
                'frequency_per_week': len(category_data) / max(1, (df['date'].max() - df['date'].min()).days / 7),
                'amount_variance': category_data['amount_abs'].var(),
                'max_amount': category_data['amount_abs'].max(),
                'min_amount': category_data['amount_abs'].min(),
                
                # Time-based patterns
                'weekend_ratio': len(category_data[category_data['day_of_week'] >= 5]) / len(category_data),
                'evening_ratio': len(category_data[category_data['hour'] >= 18]) / len(category_data),
                'morning_ratio': len(category_data[category_data['hour'] < 12]) / len(category_data),
                
                # Merchant diversity
                'unique_merchants': category_data['merchant'].nunique() if 'merchant' in category_data.columns else 0,
                'merchant_concentration': category_data['merchant'].value_counts().iloc[0] / len(category_data) if 'merchant' in category_data.columns and len(category_data) > 0 else 0,
                
                # Monthly trends
                'monthly_growth': self._calculate_monthly_growth(category_data),
                'spending_consistency': self._calculate_consistency_score(category_data),
                
                # User profile integration
                'income_ratio': category_data['amount_abs'].sum() / max(user_profile.get('monthly_income', 5000), 1000),
                'budget_adherence': self._calculate_budget_adherence(category, category_data, user_profile)
            }
            
            features.append(feature_vector)
        
        return pd.DataFrame(features)
    
    def _perform_clustering_analysis(self, features_df: pd.DataFrame) -> np.ndarray:
        """Perform K-means clustering on spending features"""
        if features_df.empty:
            return np.array([])
        
        # Select numeric features for clustering
        numeric_features = features_df.select_dtypes(include=[np.number]).fillna(0)
        
        # Normalize features
        features_scaled = self.scaler.fit_transform(numeric_features)
        
        # Perform clustering
        clusters = self.kmeans.fit_predict(features_scaled)
        
        return clusters
    
    def _identify_spending_patterns(self, features_df: pd.DataFrame, clusters: np.ndarray) -> List[SpendingPattern]:
        """Identify and classify spending patterns"""
        patterns = []
        
        if features_df.empty or len(clusters) == 0:
            return patterns
        
        # Add cluster labels to features
        features_df['cluster'] = clusters
        
        for cluster_id in np.unique(clusters):
            cluster_data = features_df[features_df['cluster'] == cluster_id]
            
            # Analyze cluster characteristics
            pattern_type = self._classify_pattern_type(cluster_data)
            dominant_category = cluster_data.loc[cluster_data['total_amount'].idxmax(), 'category']
            
            # Determine frequency pattern
            avg_frequency = cluster_data['frequency_per_week'].mean()
            frequency = self._classify_frequency(avg_frequency)
            
            # Calculate trend
            trend = self._calculate_cluster_trend(cluster_data)
            
            # Generate recommendations
            recommendations = self._generate_cluster_recommendations(cluster_data, pattern_type)
            
            pattern = SpendingPattern(
                user_id="",  # Will be set by caller
                pattern_type=pattern_type,
                category=dominant_category,
                frequency=frequency,
                average_amount=cluster_data['avg_amount'].mean(),
                trend=trend,
                confidence_score=self._calculate_pattern_confidence(cluster_data),
                recommendations=recommendations
            )
            
            patterns.append(pattern)
        
        return patterns
    
    def _calculate_monthly_growth(self, category_data: pd.DataFrame) -> float:
        """Calculate monthly growth rate for spending category"""
        try:
            monthly_totals = category_data.groupby(category_data['date'].dt.to_period('M'))['amount_abs'].sum()
            if len(monthly_totals) < 2:
                return 0.0
            
            # Calculate simple growth rate
            growth_rates = monthly_totals.pct_change().dropna()
            return growth_rates.mean()
        except:
            return 0.0
    
    def _calculate_consistency_score(self, category_data: pd.DataFrame) -> float:
        """Calculate spending consistency score (lower variance = higher consistency)"""
        try:
            monthly_totals = category_data.groupby(category_data['date'].dt.to_period('M'))['amount_abs'].sum()
            if len(monthly_totals) < 2:
                return 1.0
            
            # Coefficient of variation (lower = more consistent)
            cv = monthly_totals.std() / monthly_totals.mean()
            consistency = max(0, 1 - cv)  # Convert to 0-1 scale
            return consistency
        except:
            return 0.5
    
    def _calculate_budget_adherence(self, category: str, category_data: pd.DataFrame, user_profile: Dict) -> float:
        """Calculate budget adherence score"""
        try:
            budgets = user_profile.get('budgets', {})
            if category not in budgets:
                return 0.5  # Neutral score if no budget set
            
            budget_amount = budgets[category]
            actual_spending = category_data['amount_abs'].sum()
            
            if budget_amount <= 0:
                return 0.5
            
            adherence = min(1.0, budget_amount / actual_spending) if actual_spending > 0 else 1.0
            return adherence
        except:
            return 0.5

class FraudDetectionSystem:
    """Advanced fraud detection and anomaly detection system"""
    
    def __init__(self):
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
        self.scaler = StandardScaler()
        self.model_path = 'backend/models/fraud_detection/'
        os.makedirs(self.model_path, exist_ok=True)
        self.anomaly_threshold = -0.5
    
    def detect_anomalies(self, user_id: str, real_time: bool = False) -> List[AnomalyAlert]:
        """
        Detect fraudulent transactions and spending anomalies
        
        Args:
            user_id: Firebase user ID
            real_time: Whether to perform real-time detection on latest transactions
            
        Returns:
            List of anomaly alerts
        """
        try:
            # Get transaction data
            months_back = 1 if real_time else 6
            transactions = self._get_user_transactions(user_id, months_back)
            
            if not transactions:
                return []
            
            # Extract features for anomaly detection
            features_df = self._extract_fraud_features(transactions, user_id)
            
            if features_df.empty:
                return []
            
            # Detect anomalies using multiple methods
            anomalies = []
            
            # 1. Statistical anomaly detection
            statistical_anomalies = self._detect_statistical_anomalies(features_df)
            anomalies.extend(statistical_anomalies)
            
            # 2. Machine learning anomaly detection
            ml_anomalies = self._detect_ml_anomalies(features_df)
            anomalies.extend(ml_anomalies)
            
            # 3. Rule-based fraud detection
            rule_based_anomalies = self._detect_rule_based_fraud(features_df)
            anomalies.extend(rule_based_anomalies)
            
            # 4. Behavioral anomaly detection
            behavioral_anomalies = self._detect_behavioral_anomalies(features_df, user_id)
            anomalies.extend(behavioral_anomalies)
            
            # Remove duplicates and rank by risk score
            unique_anomalies = self._deduplicate_anomalies(anomalies)
            ranked_anomalies = sorted(unique_anomalies, key=lambda x: x.risk_score, reverse=True)
            
            # Log anomalies for monitoring
            if ranked_anomalies:
                logger.warning(f"Detected {len(ranked_anomalies)} anomalies for user {user_id}")
            
            return ranked_anomalies
            
        except Exception as e:
            logger.error(f"Error in fraud detection for user {user_id}: {str(e)}")
            return []
    
    def _extract_fraud_features(self, transactions: List[Dict], user_id: str) -> pd.DataFrame:
        """Extract features relevant for fraud detection"""
        df = pd.DataFrame(transactions)
        if df.empty:
            return pd.DataFrame()
        
        # Basic preprocessing
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
        df['amount_abs'] = df['amount'].abs()
        df['date'] = pd.to_datetime(df['postDate'], errors='coerce')
        df['hour'] = df['date'].dt.hour
        df['day_of_week'] = df['date'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'] >= 5
        
        # Calculate user's historical patterns
        user_stats = self._get_user_historical_stats(user_id)
        
        # Add fraud-relevant features
        df['amount_zscore'] = (df['amount_abs'] - df['amount_abs'].mean()) / (df['amount_abs'].std() + 1e-6)
        df['is_unusual_hour'] = (df['hour'] < 6) | (df['hour'] > 22)
        df['is_large_amount'] = df['amount_abs'] > user_stats.get('avg_amount', 0) * 3
        df['merchant_frequency'] = df.groupby('merchant')['merchant'].transform('count')
        df['is_new_merchant'] = df['merchant_frequency'] == 1
        
        # Time-based features
        df['time_since_last'] = df['date'].diff().dt.total_seconds() / 3600  # hours
        df['is_rapid_transaction'] = df['time_since_last'] < 1  # Less than 1 hour
        
        # Location-based features (if available)
        df['location_risk'] = 0  # Placeholder for location-based risk scoring
        
        return df
    
    def _detect_statistical_anomalies(self, df: pd.DataFrame) -> List[AnomalyAlert]:
        """Detect anomalies using statistical methods"""
        anomalies = []
        
        # Amount-based anomalies (using IQR method)
        Q1 = df['amount_abs'].quantile(0.25)
        Q3 = df['amount_abs'].quantile(0.75)
        IQR = Q3 - Q1
        upper_bound = Q3 + 2.5 * IQR
        
        amount_anomalies = df[df['amount_abs'] > upper_bound]
        
        for _, row in amount_anomalies.iterrows():
            anomaly = AnomalyAlert(
                user_id="",  # Will be set by caller
                transaction_id=row.get('id', 'unknown'),
                anomaly_type='unusual_amount',
                risk_score=min(0.9, (row['amount_abs'] - upper_bound) / upper_bound),
                description=f"Unusually large transaction: ${row['amount_abs']:.2f}",
                detected_at=datetime.now(),
                recommended_action='Review transaction details and verify authenticity'
            )
            anomalies.append(anomaly)
        
        return anomalies
    
    def _detect_ml_anomalies(self, df: pd.DataFrame) -> List[AnomalyAlert]:
        """Detect anomalies using machine learning models"""
        anomalies = []
        
        try:
            # Select features for ML model
            feature_columns = ['amount_abs', 'hour', 'day_of_week', 'merchant_frequency', 'is_weekend']
            features = df[feature_columns].fillna(0)
            
            if len(features) < 10:  # Need minimum data for ML
                return anomalies
            
            # Normalize features
            features_scaled = self.scaler.fit_transform(features)
            
            # Detect anomalies
            anomaly_scores = self.isolation_forest.fit_predict(features_scaled)
            scores = self.isolation_forest.score_samples(features_scaled)
            
            # Identify anomalous transactions
            anomalous_indices = np.where(anomaly_scores == -1)[0]
            
            for idx in anomalous_indices:
                if scores[idx] < self.anomaly_threshold:
                    row = df.iloc[idx]
                    anomaly = AnomalyAlert(
                        user_id="",
                        transaction_id=row.get('id', 'unknown'),
                        anomaly_type='ml_detected_anomaly',
                        risk_score=abs(scores[idx]),
                        description=f"ML model detected unusual transaction pattern",
                        detected_at=datetime.now(),
                        recommended_action='Investigate transaction context and verify legitimacy'
                    )
                    anomalies.append(anomaly)
            
        except Exception as e:
            logger.error(f"Error in ML anomaly detection: {str(e)}")
        
        return anomalies
    
    def _detect_rule_based_fraud(self, df: pd.DataFrame) -> List[AnomalyAlert]:
        """Detect fraud using rule-based approaches"""
        anomalies = []
        
        # Rule 1: Multiple large transactions in short time window
        df_sorted = df.sort_values('date')
        for i in range(len(df_sorted) - 1):
            current = df_sorted.iloc[i]
            next_trans = df_sorted.iloc[i + 1]
            
            time_diff = (next_trans['date'] - current['date']).total_seconds() / 60  # minutes
            
            if (time_diff < 30 and  # Within 30 minutes
                current['amount_abs'] > 500 and  # Large amounts
                next_trans['amount_abs'] > 500):
                
                anomaly = AnomalyAlert(
                    user_id="",
                    transaction_id=f"{current.get('id', 'unknown')},{next_trans.get('id', 'unknown')}",
                    anomaly_type='rapid_large_transactions',
                    risk_score=0.8,
                    description=f"Multiple large transactions within 30 minutes",
                    detected_at=datetime.now(),
                    recommended_action='Verify both transactions and check for unauthorized access'
                )
                anomalies.append(anomaly)
        
        # Rule 2: Unusual time patterns
        unusual_time = df[df['is_unusual_hour'] & (df['amount_abs'] > 200)]
        for _, row in unusual_time.iterrows():
            anomaly = AnomalyAlert(
                user_id="",
                transaction_id=row.get('id', 'unknown'),
                anomaly_type='unusual_time_pattern',
                risk_score=0.6,
                description=f"Large transaction at unusual hour: {row['hour']}:00",
                detected_at=datetime.now(),
                recommended_action='Verify transaction timing and authorization'
            )
            anomalies.append(anomaly)
        
        return anomalies

class IntelligentCategorizationEngine:
    """Machine learning-powered transaction categorization with continuous learning"""
    
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.vectorizer = None
        self.label_encoder = LabelEncoder()
        self.model_path = 'backend/models/categorization/'
        os.makedirs(self.model_path, exist_ok=True)
        self.feature_columns = []
    
    def train_categorization_model(self, user_id: str = None) -> Dict[str, Any]:
        """
        Train or update the categorization model using user transaction data
        
        Args:
            user_id: Specific user ID for personalized model, or None for global model
            
        Returns:
            Training results and model performance metrics
        """
        try:
            # Get training data
            training_data = self._prepare_training_data(user_id)
            
            if len(training_data) < 50:  # Need minimum data for training
                return {'error': 'Insufficient training data'}
            
            # Extract features and labels
            X, y = self._extract_categorization_features(training_data)
            
            if len(X) == 0:
                return {'error': 'No features extracted'}
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            
            # Train model
            self.model.fit(X_train, y_train)
            
            # Evaluate model
            y_pred = self.model.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)
            
            # Save model
            model_filename = f'categorization_model_{"global" if not user_id else user_id}.joblib'
            joblib.dump(self.model, os.path.join(self.model_path, model_filename))
            
            # Feature importance
            feature_importance = dict(zip(self.feature_columns, self.model.feature_importances_))
            
            results = {
                'training_samples': len(training_data),
                'accuracy': accuracy,
                'feature_importance': feature_importance,
                'model_saved': True,
                'trained_at': datetime.now().isoformat()
            }
            
            logger.info(f"Categorization model trained with {accuracy:.2f} accuracy")
            return results
            
        except Exception as e:
            logger.error(f"Error training categorization model: {str(e)}")
            return {'error': f'Training failed: {str(e)}'}
    
    def predict_transaction_category(self, transaction: Dict, user_id: str = None) -> Dict[str, Any]:
        """
        Predict category for a new transaction using trained model
        
        Args:
            transaction: Transaction data
            user_id: User ID for personalized prediction
            
        Returns:
            Predicted category with confidence scores
        """
        try:
            # Load appropriate model
            model_filename = f'categorization_model_{"global" if not user_id else user_id}.joblib'
            model_path = os.path.join(self.model_path, model_filename)
            
            if not os.path.exists(model_path):
                # Fallback to rule-based categorization
                return self._rule_based_categorization(transaction)
            
            model = joblib.load(model_path)
            
            # Extract features for prediction
            features = self._extract_single_transaction_features(transaction)
            
            if not features:
                return self._rule_based_categorization(transaction)
            
            # Make prediction
            prediction = model.predict([features])[0]
            probabilities = model.predict_proba([features])[0]
            confidence = max(probabilities)
            
            # Get top alternative categories
            class_names = model.classes_
            prob_dict = dict(zip(class_names, probabilities))
            top_alternatives = sorted(prob_dict.items(), key=lambda x: x[1], reverse=True)[:3]
            
            result = {
                'predicted_category': prediction,
                'confidence': confidence,
                'alternatives': [{'category': cat, 'probability': prob} for cat, prob in top_alternatives],
                'method': 'ml_prediction'
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error in ML categorization: {str(e)}")
            return self._rule_based_categorization(transaction)
    
    def learn_from_correction(self, transaction: Dict, correct_category: str, user_id: str = None):
        """
        Learn from user corrections to improve model accuracy
        
        Args:
            transaction: Transaction that was corrected
            correct_category: User-provided correct category
            user_id: User ID for personalized learning
        """
        try:
            # Store correction for retraining
            correction_data = {
                'transaction': transaction,
                'correct_category': correct_category,
                'corrected_at': datetime.now().isoformat(),
                'user_id': user_id
            }
            
            # Save to corrections database
            if db:
                corrections_ref = db.collection('ml_corrections')
                corrections_ref.add(correction_data)
            
            # If we have enough corrections, trigger retraining
            correction_count = self._get_correction_count(user_id)
            if correction_count % 10 == 0:  # Retrain every 10 corrections
                self.train_categorization_model(user_id)
            
            logger.info(f"Learned from categorization correction: {correct_category}")
            
        except Exception as e:
            logger.error(f"Error learning from correction: {str(e)}")

class PredictiveBudgetingEngine:
    """Advanced predictive budgeting and expense forecasting system"""
    
    def __init__(self):
        self.regression_models = {}
        self.scaler = StandardScaler()
        self.model_path = 'backend/models/budgeting/'
        os.makedirs(self.model_path, exist_ok=True)
    
    def generate_budget_predictions(self, user_id: str, months_ahead: int = 3) -> List[BudgetPrediction]:
        """
        Generate predictive budget recommendations for future months
        
        Args:
            user_id: Firebase user ID
            months_ahead: Number of months to predict
            
        Returns:
            List of budget predictions by category
        """
        try:
            # Get historical data
            transactions = self._get_user_transactions(user_id, 12)  # 12 months of data
            user_profile = self._get_user_profile(user_id)
            
            if not transactions:
                return []
            
            # Prepare time series data by category
            category_predictions = []
            spending_by_category = self._prepare_time_series_data(transactions)
            
            for category, data in spending_by_category.items():
                if len(data) < 3:  # Need minimum data points
                    continue
                
                # Generate prediction for this category
                prediction = self._predict_category_spending(
                    category, data, months_ahead, user_profile
                )
                
                if prediction:
                    category_predictions.append(prediction)
            
            # Sort by predicted amount (highest first)
            category_predictions.sort(key=lambda x: x.predicted_amount, reverse=True)
            
            return category_predictions
            
        except Exception as e:
            logger.error(f"Error generating budget predictions for user {user_id}: {str(e)}")
            return []
    
    def _predict_category_spending(self, category: str, historical_data: List[Dict], 
                                  months_ahead: int, user_profile: Dict) -> Optional[BudgetPrediction]:
        """Predict spending for a specific category"""
        try:
            # Prepare data for regression
            df = pd.DataFrame(historical_data)
            df['month_num'] = range(len(df))
            
            # Features: month number, seasonal factors, external factors
            X = self._create_prediction_features(df, user_profile)
            y = df['amount'].values
            
            # Train simple linear regression model
            model = LinearRegression()
            model.fit(X, y)
            
            # Predict future months
            future_X = self._create_future_features(len(df), months_ahead, user_profile)
            predictions = model.predict(future_X)
            
            # Calculate prediction statistics
            avg_prediction = np.mean(predictions)
            std_prediction = np.std(predictions)
            
            # Create confidence intervals
            confidence_interval = (
                max(0, avg_prediction - 1.96 * std_prediction),
                avg_prediction + 1.96 * std_prediction
            )
            
            # Determine trend
            recent_trend = np.polyfit(range(len(y[-3:])), y[-3:], 1)[0]
            trend_direction = 'increasing' if recent_trend > 0 else 'decreasing' if recent_trend < 0 else 'stable'
            
            # Identify influencing factors
            factors = self._identify_prediction_factors(df, user_profile, category)
            
            # Generate recommendation
            recommendation = self._generate_budget_recommendation(
                category, avg_prediction, trend_direction, factors, user_profile
            )
            
            prediction = BudgetPrediction(
                user_id="",  # Will be set by caller
                category=category,
                predicted_amount=avg_prediction,
                confidence_interval=confidence_interval,
                trend_direction=trend_direction,
                factors=factors,
                recommendation=recommendation
            )
            
            return prediction
            
        except Exception as e:
            logger.error(f"Error predicting spending for category {category}: {str(e)}")
            return None

    # Helper methods for all classes
    def _get_user_transactions(self, user_id: str, months_back: int) -> List[Dict]:
        """Get user transactions from Basiq API"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=months_back * 30)
            filter_str = f"transaction.postDate.gte={start_date.isoformat()}&transaction.postDate.lte={end_date.isoformat()}"
            
            result = get_user_transactions(user_id, filter_str)
            if result.get('success'):
                return result.get('transactions', {}).get('data', [])
            return []
        except Exception as e:
            logger.error(f"Error getting transactions for user {user_id}: {str(e)}")
            return []
    
    def _get_user_receipts(self, user_id: str, months_back: int) -> List[Dict]:
        """Get user receipts from Firebase"""
        try:
            if not db:
                return []
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=months_back * 30)
            
            receipts_ref = db.collection('receipts').where('user_id', '==', user_id)
            receipts = []
            
            for doc in receipts_ref.get():
                receipt = doc.to_dict()
                receipt_date = datetime.fromisoformat(receipt.get('date', '2020-01-01'))
                if start_date <= receipt_date <= end_date:
                    receipts.append(receipt)
            
            return receipts
        except Exception as e:
            logger.error(f"Error getting receipts for user {user_id}: {str(e)}")
            return []
    
    def _get_user_profile(self, user_id: str) -> Dict:
        """Get user profile from Firebase"""
        try:
            if not db:
                return {}
            
            user_ref = db.collection('users').document(user_id)
            user_doc = user_ref.get()
            
            if user_doc.exists:
                return user_doc.to_dict()
            return {}
        except Exception as e:
            logger.error(f"Error getting user profile for {user_id}: {str(e)}")
            return {}

# Factory function to create analytics instances
def create_analytics_suite() -> Dict[str, Any]:
    """Create complete analytics suite for TAAXDOG"""
    return {
        'spending_analyzer': SpendingPatternAnalyzer(),
        'fraud_detector': FraudDetectionSystem(),
        'categorization_engine': IntelligentCategorizationEngine(),
        'budget_predictor': PredictiveBudgetingEngine()
    } 