"""
Spending Pattern Analysis for TAAXDOG Finance Application

This module analyzes user spending patterns using machine learning to identify:
- Spending trends and behaviors
- Category-specific patterns
- Seasonal variations
- Budget adherence
"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
from typing import Dict, List, Any
import logging
import os
import sys

# Add project paths
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from .data_models import SpendingPattern

logger = logging.getLogger(__name__)

class SpendingPatternAnalyzer:
    """Machine learning-powered spending pattern analysis"""
    
    def __init__(self):
        """Initialize the analyzer with ML models"""
        self.scaler = StandardScaler()
        self.kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
        self.model_path = 'backend/models/spending_patterns/'
        os.makedirs(self.model_path, exist_ok=True)
    
    def analyze_user_spending(self, user_id: str, months_back: int = 6) -> Dict[str, Any]:
        """
        Analyze user spending patterns and generate insights
        
        Args:
            user_id: Firebase user ID
            months_back: Number of months to analyze
        
        Returns:
            Analysis results with patterns and recommendations
        """
        try:
            logger.info(f"Starting spending analysis for user {user_id}")
            
            # Get user data (mock data for now)
            transactions = self._get_mock_transactions(user_id, months_back)
            user_profile = self._get_mock_user_profile(user_id)
            
            if not transactions:
                return {'error': 'No transaction data available'}
            
            # Extract features from transactions
            features_df = self._extract_features(transactions, user_profile)
            
            if features_df.empty:
                return {'error': 'Unable to extract features'}
            
            # Perform ML clustering
            clusters = self._perform_clustering(features_df)
            
            # Identify patterns
            patterns = self._identify_patterns(features_df, clusters, user_id)
            
            # Generate insights and recommendations
            insights = self._generate_insights(patterns, user_profile)
            recommendations = self._generate_recommendations(patterns)
            
            result = {
                'user_id': user_id,
                'analysis_date': datetime.now().isoformat(),
                'patterns': [p.to_dict() for p in patterns],
                'insights': insights,
                'recommendations': recommendations,
                'data_period': f'{months_back} months',
                'transaction_count': len(transactions)
            }
            
            logger.info(f"Analysis complete for user {user_id}")
            return result
            
        except Exception as e:
            logger.error(f"Analysis error for user {user_id}: {str(e)}")
            return {'error': f'Analysis failed: {str(e)}'}
    
    def _extract_features(self, transactions: List[Dict], user_profile: Dict) -> pd.DataFrame:
        """Extract ML features from transaction data"""
        try:
            df = pd.DataFrame(transactions)
            if df.empty:
                return pd.DataFrame()
            
            # Process transaction data
            df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
            df['amount_abs'] = df['amount'].abs()
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df['category'] = df['category'].fillna('Other')
            
            # Only analyze spending (negative amounts)
            df = df[df['amount'] < 0]
            
            # Group by category and extract features
            features = []
            for category in df['category'].unique():
                cat_data = df[df['category'] == category]
                
                feature = {
                    'category': category,
                    'avg_amount': cat_data['amount_abs'].mean(),
                    'total_amount': cat_data['amount_abs'].sum(),
                    'transaction_count': len(cat_data),
                    'amount_variance': cat_data['amount_abs'].var(),
                    'max_amount': cat_data['amount_abs'].max(),
                    'min_amount': cat_data['amount_abs'].min(),
                    'monthly_frequency': len(cat_data) / 6,  # Assuming 6 months
                    'consistency_score': self._calc_consistency(cat_data),
                    'trend_score': self._calc_trend(cat_data)
                }
                features.append(feature)
            
            return pd.DataFrame(features)
            
        except Exception as e:
            logger.error(f"Feature extraction error: {str(e)}")
            return pd.DataFrame()
    
    def _perform_clustering(self, features_df: pd.DataFrame) -> np.ndarray:
        """Perform K-means clustering on spending features"""
        try:
            if features_df.empty:
                return np.array([])
            
            # Select numeric features
            numeric_cols = features_df.select_dtypes(include=[np.number]).columns
            features = features_df[numeric_cols].fillna(0)
            
            # Scale features
            features_scaled = self.scaler.fit_transform(features)
            
            # Adjust cluster count for small datasets
            n_clusters = min(5, len(features_df))
            if n_clusters < 2:
                return np.array([0] * len(features_df))
            
            self.kmeans.n_clusters = n_clusters
            clusters = self.kmeans.fit_predict(features_scaled)
            
            return clusters
            
        except Exception as e:
            logger.error(f"Clustering error: {str(e)}")
            return np.array([])
    
    def _identify_patterns(self, features_df: pd.DataFrame, clusters: np.ndarray, 
                          user_id: str) -> List[SpendingPattern]:
        """Identify spending patterns from clusters"""
        patterns = []
        
        try:
            if features_df.empty or len(clusters) == 0:
                return patterns
            
            features_df['cluster'] = clusters
            
            for cluster_id in np.unique(clusters):
                cluster_data = features_df[features_df['cluster'] == cluster_id]
                
                # Get dominant category
                dominant_idx = cluster_data['total_amount'].idxmax()
                dominant_category = cluster_data.loc[dominant_idx, 'category']
                
                # Classify pattern
                pattern_type = self._classify_pattern(cluster_data)
                frequency = self._classify_frequency(cluster_data['monthly_frequency'].mean())
                trend = self._classify_trend(cluster_data['trend_score'].mean())
                
                pattern = SpendingPattern(
                    user_id=user_id,
                    pattern_type=pattern_type,
                    category=dominant_category,
                    frequency=frequency,
                    average_amount=cluster_data['avg_amount'].mean(),
                    trend=trend,
                    confidence_score=cluster_data['consistency_score'].mean(),
                    recommendations=self._get_pattern_recommendations(pattern_type, dominant_category),
                    analysis_period="6 months",
                    created_at=datetime.now()
                )
                
                patterns.append(pattern)
            
            return patterns
            
        except Exception as e:
            logger.error(f"Pattern identification error: {str(e)}")
            return []
    
    def _calc_consistency(self, cat_data: pd.DataFrame) -> float:
        """Calculate spending consistency score"""
        try:
            if len(cat_data) < 2:
                return 1.0
            
            amounts = cat_data['amount_abs']
            cv = amounts.std() / amounts.mean() if amounts.mean() > 0 else 0
            return max(0, 1 - cv)
        except Exception:
            return 0.5
    
    def _calc_trend(self, cat_data: pd.DataFrame) -> float:
        """Calculate spending trend score"""
        try:
            if len(cat_data) < 3:
                return 0.0
            
            # Simple linear trend calculation
            x = np.arange(len(cat_data))
            y = cat_data['amount_abs'].values
            slope = np.polyfit(x, y, 1)[0]
            
            return slope / y.mean() if y.mean() > 0 else 0
        except Exception:
            return 0.0
    
    def _classify_pattern(self, cluster_data: pd.DataFrame) -> str:
        """Classify spending pattern type"""
        try:
            consistency = cluster_data['consistency_score'].mean()
            trend = cluster_data['trend_score'].mean()
            
            if consistency > 0.8:
                return 'consistent'
            elif abs(trend) > 0.2:
                return 'growing' if trend > 0 else 'declining'
            else:
                return 'irregular'
        except Exception:
            return 'unknown'
    
    def _classify_frequency(self, monthly_freq: float) -> str:
        """Classify spending frequency"""
        if monthly_freq >= 20:
            return 'daily'
        elif monthly_freq >= 4:
            return 'weekly'
        elif monthly_freq >= 1:
            return 'monthly'
        else:
            return 'irregular'
    
    def _classify_trend(self, trend_score: float) -> str:
        """Classify trend direction"""
        if trend_score > 0.1:
            return 'increasing'
        elif trend_score < -0.1:
            return 'decreasing'
        else:
            return 'stable'
    
    def _get_pattern_recommendations(self, pattern_type: str, category: str) -> List[str]:
        """Generate recommendations based on pattern"""
        recommendations = []
        
        if pattern_type == 'growing':
            recommendations.append(f"Monitor {category} spending - it's increasing")
            recommendations.append("Consider setting a monthly budget limit")
        elif pattern_type == 'irregular':
            recommendations.append(f"Stabilize your {category} spending patterns")
            recommendations.append("Track expenses more regularly")
        elif pattern_type == 'consistent':
            recommendations.append(f"Great job maintaining consistent {category} spending")
            recommendations.append("Look for optimization opportunities")
        
        return recommendations
    
    def _generate_insights(self, patterns: List[SpendingPattern], user_profile: Dict) -> List[Dict]:
        """Generate financial insights from patterns"""
        insights = []
        
        for pattern in patterns:
            if pattern.trend == 'increasing':
                insights.append({
                    'type': 'warning',
                    'title': f'{pattern.category} spending is increasing',
                    'description': f'Your {pattern.category} expenses have grown by an average of ${pattern.average_amount:.2f}',
                    'impact': 'medium'
                })
            elif pattern.confidence_score > 0.8:
                insights.append({
                    'type': 'positive',
                    'title': f'Consistent {pattern.category} spending',
                    'description': f'You maintain steady spending of ${pattern.average_amount:.2f} in {pattern.category}',
                    'impact': 'low'
                })
        
        return insights
    
    def _generate_recommendations(self, patterns: List[SpendingPattern]) -> List[Dict]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Find highest spending category
        if patterns:
            highest_spending = max(patterns, key=lambda p: p.average_amount)
            recommendations.append({
                'priority': 'high',
                'action': 'Review largest expense category',
                'description': f'Focus on optimizing {highest_spending.category} spending (${highest_spending.average_amount:.2f} average)',
                'category': highest_spending.category
            })
        
        # Find irregular patterns
        irregular_patterns = [p for p in patterns if p.pattern_type == 'irregular']
        if irregular_patterns:
            recommendations.append({
                'priority': 'medium',
                'action': 'Stabilize irregular spending',
                'description': f'Consider budgets for: {", ".join([p.category for p in irregular_patterns])}',
                'category': 'budgeting'
            })
        
        return recommendations
    
    # Mock data methods (replace with real data integration)
    def _get_mock_transactions(self, user_id: str, months_back: int) -> List[Dict]:
        """Generate mock transaction data for testing"""
        transactions = []
        base_date = datetime.now() - timedelta(days=months_back * 30)
        
        categories = ['Groceries', 'Transport', 'Entertainment', 'Utilities', 'Shopping']
        
        for i in range(100):  # Generate 100 mock transactions
            transaction = {
                'id': f'txn_{i}',
                'amount': -np.random.uniform(10, 500),  # Negative for spending
                'date': (base_date + timedelta(days=np.random.randint(0, months_back * 30))).isoformat(),
                'category': np.random.choice(categories),
                'description': f'Mock transaction {i}',
                'merchant': f'Merchant {i % 20}'
            }
            transactions.append(transaction)
        
        return transactions
    
    def _get_mock_user_profile(self, user_id: str) -> Dict:
        """Generate mock user profile for testing"""
        return {
            'user_id': user_id,
            'monthly_income': 5000,
            'budgets': {
                'Groceries': 400,
                'Transport': 200,
                'Entertainment': 300
            },
            'financial_goals': ['Emergency Fund', 'Vacation Savings']
        } 