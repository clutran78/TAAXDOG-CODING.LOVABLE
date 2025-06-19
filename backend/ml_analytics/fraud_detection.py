"""
Fraud Detection System for TAAXDOG Finance Application

Detects suspicious transactions using statistical and ML methods.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta
from typing import Dict, List
import logging

from .data_models import AnomalyAlert

logger = logging.getLogger(__name__)

class FraudDetectionSystem:
    """ML-powered fraud detection system"""
    
    def __init__(self):
        """Initialize fraud detection models"""
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
        self.scaler = StandardScaler()
        self.anomaly_threshold = -0.5
    
    def detect_anomalies(self, user_id: str) -> List[AnomalyAlert]:
        """Detect fraudulent transactions and anomalies"""
        try:
            logger.info(f"Running fraud detection for user {user_id}")
            
            # Get transaction data
            transactions = self._get_mock_transactions(user_id)
            
            if not transactions:
                return []
            
            # Process transactions
            df = self._process_transactions(transactions)
            
            if df.empty:
                return []
            
            # Detect different types of anomalies
            anomalies = []
            anomalies.extend(self._detect_amount_anomalies(df, user_id))
            anomalies.extend(self._detect_time_anomalies(df, user_id))
            anomalies.extend(self._detect_ml_anomalies(df, user_id))
            anomalies.extend(self._detect_pattern_anomalies(df, user_id))
            
            # Remove duplicates and sort by risk
            unique_anomalies = self._deduplicate_anomalies(anomalies)
            return sorted(unique_anomalies, key=lambda x: x.risk_score, reverse=True)
            
        except Exception as e:
            logger.error(f"Fraud detection error for user {user_id}: {str(e)}")
            return []
    
    def _process_transactions(self, transactions: List[Dict]) -> pd.DataFrame:
        """Process raw transactions for analysis"""
        try:
            df = pd.DataFrame(transactions)
            
            # Basic data processing
            df['amount'] = pd.to_numeric(df['amount'], errors='coerce')
            df['amount_abs'] = df['amount'].abs()
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df['hour'] = df['date'].dt.hour
            df['day_of_week'] = df['date'].dt.dayofweek
            df['is_weekend'] = df['day_of_week'] >= 5
            
            # Add fraud detection features
            df['is_large'] = df['amount_abs'] > df['amount_abs'].quantile(0.95)
            df['is_unusual_hour'] = (df['hour'] < 6) | (df['hour'] > 22)
            df['is_round_number'] = (df['amount_abs'] % 100 == 0) & (df['amount_abs'] >= 100)
            
            # Time between transactions
            df = df.sort_values('date')
            df['time_diff_hours'] = df['date'].diff().dt.total_seconds() / 3600
            df['is_rapid'] = df['time_diff_hours'] < 1
            
            return df
            
        except Exception as e:
            logger.error(f"Error processing transactions: {str(e)}")
            return pd.DataFrame()
    
    def _detect_amount_anomalies(self, df: pd.DataFrame, user_id: str) -> List[AnomalyAlert]:
        """Detect unusual transaction amounts"""
        anomalies = []
        
        try:
            # Use IQR method for outlier detection
            Q1 = df['amount_abs'].quantile(0.25)
            Q3 = df['amount_abs'].quantile(0.75)
            IQR = Q3 - Q1
            upper_bound = Q3 + 2.5 * IQR
            
            outliers = df[df['amount_abs'] > upper_bound]
            
            for _, row in outliers.iterrows():
                risk_score = min(0.9, (row['amount_abs'] - upper_bound) / max(upper_bound, 1))
                
                anomaly = AnomalyAlert(
                    user_id=user_id,
                    transaction_id=row['id'],
                    anomaly_type='unusual_amount',
                    risk_score=risk_score,
                    description=f"Unusually large transaction: ${row['amount_abs']:.2f}",
                    detected_at=datetime.now(),
                    recommended_action='Verify transaction amount and authorization'
                )
                anomalies.append(anomaly)
            
        except Exception as e:
            logger.error(f"Amount anomaly detection error: {str(e)}")
        
        return anomalies
    
    def _detect_time_anomalies(self, df: pd.DataFrame, user_id: str) -> List[AnomalyAlert]:
        """Detect unusual transaction timing"""
        anomalies = []
        
        try:
            # Unusual hours with significant amounts
            unusual_time = df[df['is_unusual_hour'] & (df['amount_abs'] > 100)]
            
            for _, row in unusual_time.iterrows():
                anomaly = AnomalyAlert(
                    user_id=user_id,
                    transaction_id=row['id'],
                    anomaly_type='unusual_time',
                    risk_score=0.6,
                    description=f"Transaction at {row['hour']:02d}:00 (${row['amount_abs']:.2f})",
                    detected_at=datetime.now(),
                    recommended_action='Verify transaction timing'
                )
                anomalies.append(anomaly)
            
            # Rapid consecutive transactions
            rapid_transactions = df[df['is_rapid'] & df['is_large']]
            
            for _, row in rapid_transactions.iterrows():
                anomaly = AnomalyAlert(
                    user_id=user_id,
                    transaction_id=row['id'],
                    anomaly_type='rapid_transactions',
                    risk_score=0.8,
                    description=f"Rapid large transaction: ${row['amount_abs']:.2f}",
                    detected_at=datetime.now(),
                    recommended_action='Check for unauthorized access'
                )
                anomalies.append(anomaly)
            
        except Exception as e:
            logger.error(f"Time anomaly detection error: {str(e)}")
        
        return anomalies
    
    def _detect_ml_anomalies(self, df: pd.DataFrame, user_id: str) -> List[AnomalyAlert]:
        """Detect anomalies using machine learning"""
        anomalies = []
        
        try:
            if len(df) < 10:
                return anomalies
            
            # Select features for ML model
            features = df[['amount_abs', 'hour', 'day_of_week']].fillna(0)
            
            # Scale features
            features_scaled = self.scaler.fit_transform(features)
            
            # Detect anomalies
            outlier_labels = self.isolation_forest.fit_predict(features_scaled)
            outlier_scores = self.isolation_forest.score_samples(features_scaled)
            
            # Find anomalous transactions
            anomaly_indices = np.where(outlier_labels == -1)[0]
            
            for idx in anomaly_indices:
                if outlier_scores[idx] < self.anomaly_threshold:
                    row = df.iloc[idx]
                    
                    anomaly = AnomalyAlert(
                        user_id=user_id,
                        transaction_id=row['id'],
                        anomaly_type='ml_anomaly',
                        risk_score=min(0.95, abs(outlier_scores[idx])),
                        description=f"ML detected anomaly: ${row['amount_abs']:.2f}",
                        detected_at=datetime.now(),
                        recommended_action='Investigate transaction pattern'
                    )
                    anomalies.append(anomaly)
            
        except Exception as e:
            logger.error(f"ML anomaly detection error: {str(e)}")
        
        return anomalies
    
    def _detect_pattern_anomalies(self, df: pd.DataFrame, user_id: str) -> List[AnomalyAlert]:
        """Detect pattern-based anomalies"""
        anomalies = []
        
        try:
            # Round number transactions (potential fraud)
            round_transactions = df[df['is_round_number']]
            
            for _, row in round_transactions.iterrows():
                anomaly = AnomalyAlert(
                    user_id=user_id,
                    transaction_id=row['id'],
                    anomaly_type='round_number',
                    risk_score=0.5,
                    description=f"Round number transaction: ${row['amount_abs']:.0f}",
                    detected_at=datetime.now(),
                    recommended_action='Monitor for card testing patterns'
                )
                anomalies.append(anomaly)
            
        except Exception as e:
            logger.error(f"Pattern anomaly detection error: {str(e)}")
        
        return anomalies
    
    def _deduplicate_anomalies(self, anomalies: List[AnomalyAlert]) -> List[AnomalyAlert]:
        """Remove duplicate anomalies"""
        unique = {}
        
        for anomaly in anomalies:
            key = f"{anomaly.transaction_id}_{anomaly.anomaly_type}"
            if key not in unique or anomaly.risk_score > unique[key].risk_score:
                unique[key] = anomaly
        
        return list(unique.values())
    
    def _get_mock_transactions(self, user_id: str) -> List[Dict]:
        """Generate mock transaction data with anomalies"""
        transactions = []
        base_date = datetime.now() - timedelta(days=30)
        
        # Normal transactions
        for i in range(50):
            transactions.append({
                'id': f'txn_{i}',
                'amount': -np.random.uniform(10, 200),
                'date': (base_date + timedelta(
                    days=np.random.randint(0, 30),
                    hours=np.random.randint(8, 20)
                )).isoformat(),
                'category': np.random.choice(['Groceries', 'Transport', 'Entertainment']),
                'merchant': f'Store {i % 10}'
            })
        
        # Add anomalous transactions
        # Large amount
        transactions.append({
            'id': 'anomaly_1',
            'amount': -1500.0,  # Large amount
            'date': (base_date + timedelta(days=15, hours=14)).isoformat(),
            'category': 'Shopping',
            'merchant': 'Expensive Store'
        })
        
        # Unusual time
        transactions.append({
            'id': 'anomaly_2',
            'amount': -150.0,
            'date': (base_date + timedelta(days=20, hours=2)).isoformat(),  # 2 AM
            'category': 'Entertainment',
            'merchant': 'Late Night Service'
        })
        
        # Round number
        transactions.append({
            'id': 'anomaly_3',
            'amount': -500.0,  # Round number
            'date': (base_date + timedelta(days=25, hours=16)).isoformat(),
            'category': 'Shopping',
            'merchant': 'Online Store'
        })
        
        return transactions 