"""
Intelligent Transaction Categorization Engine for TAAXDOG

This module provides ML-powered transaction categorization with continuous learning.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from datetime import datetime
from typing import Dict, List, Any
from fuzzywuzzy import fuzz
import logging
import os

from .data_models import CategoryPrediction

logger = logging.getLogger(__name__)

class IntelligentCategorizationEngine:
    """ML-powered transaction categorization with continuous learning"""
    
    def __init__(self):
        """Initialize the categorization engine"""
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        self.label_encoder = LabelEncoder()
        self.model_path = 'backend/models/categorization/'
        os.makedirs(self.model_path, exist_ok=True)
        self.is_trained = False
        
        # Common category mappings
        self.category_keywords = {
            'Groceries': ['grocery', 'supermarket', 'food', 'coles', 'woolworths', 'aldi'],
            'Transport': ['fuel', 'gas', 'petrol', 'uber', 'taxi', 'train', 'bus'],
            'Entertainment': ['movie', 'cinema', 'restaurant', 'cafe', 'bar', 'netflix'],
            'Utilities': ['electricity', 'gas', 'water', 'phone', 'internet', 'telstra'],
            'Shopping': ['store', 'shop', 'retail', 'amazon', 'ebay', 'clothing'],
            'Healthcare': ['doctor', 'pharmacy', 'medical', 'hospital', 'dental'],
            'Education': ['school', 'university', 'course', 'training', 'education']
        }
    
    def predict_transaction_category(self, transaction: Dict, user_id: str = None) -> Dict[str, Any]:
        """
        Predict category for a transaction
        
        Args:
            transaction: Transaction data
            user_id: User ID for personalized prediction
            
        Returns:
            Prediction with confidence and alternatives
        """
        try:
            # Try ML prediction first if model is trained
            if self.is_trained:
                ml_prediction = self._ml_predict(transaction)
                if ml_prediction['confidence'] > 0.7:
                    return ml_prediction
            
            # Fall back to rule-based categorization
            rule_prediction = self._rule_based_categorization(transaction)
            
            # Combine with fuzzy matching
            fuzzy_prediction = self._fuzzy_match_categorization(transaction)
            
            # Choose best prediction
            if rule_prediction['confidence'] >= fuzzy_prediction['confidence']:
                return rule_prediction
            else:
                return fuzzy_prediction
                
        except Exception as e:
            logger.error(f"Error in categorization prediction: {str(e)}")
            return self._default_categorization(transaction)
    
    def train_categorization_model(self, user_id: str = None) -> Dict[str, Any]:
        """
        Train or update the categorization model
        
        Args:
            user_id: Specific user ID for personalized model
            
        Returns:
            Training results and performance metrics
        """
        try:
            # Get training data (mock for now)
            training_data = self._get_mock_training_data()
            
            if len(training_data) < 20:
                return {'error': 'Insufficient training data'}
            
            # Prepare features and labels
            X, y = self._prepare_training_features(training_data)
            
            if len(X) == 0:
                return {'error': 'No features extracted'}
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            
            # Train model
            self.model.fit(X_train, y_train)
            self.is_trained = True
            
            # Evaluate
            y_pred = self.model.predict(X_test)
            accuracy = accuracy_score(y_test, y_pred)
            
            logger.info(f"Categorization model trained with {accuracy:.2f} accuracy")
            
            return {
                'training_samples': len(training_data),
                'accuracy': accuracy,
                'model_trained': True,
                'trained_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error training categorization model: {str(e)}")
            return {'error': f'Training failed: {str(e)}'}
    
    def learn_from_correction(self, transaction: Dict, correct_category: str, user_id: str = None):
        """
        Learn from user corrections to improve accuracy
        
        Args:
            transaction: Transaction that was corrected
            correct_category: User-provided correct category
            user_id: User ID for personalized learning
        """
        try:
            # Store correction for future training
            correction_data = {
                'transaction': transaction,
                'correct_category': correct_category,
                'corrected_at': datetime.now().isoformat(),
                'user_id': user_id
            }
            
            # In a real implementation, this would save to database
            logger.info(f"Learned correction: {correct_category} for transaction")
            
            # Could trigger incremental learning here
            
        except Exception as e:
            logger.error(f"Error learning from correction: {str(e)}")
    
    def _ml_predict(self, transaction: Dict) -> Dict[str, Any]:
        """Make ML prediction for transaction"""
        try:
            # Extract features for ML prediction
            features = self._extract_transaction_features(transaction)
            
            # Make prediction
            prediction = self.model.predict([features])[0]
            probabilities = self.model.predict_proba([features])[0]
            confidence = max(probabilities)
            
            # Get alternatives
            class_names = self.model.classes_
            prob_dict = dict(zip(class_names, probabilities))
            top_alternatives = sorted(prob_dict.items(), key=lambda x: x[1], reverse=True)[:3]
            
            return {
                'predicted_category': prediction,
                'confidence': confidence,
                'alternatives': [{'category': cat, 'probability': prob} for cat, prob in top_alternatives],
                'method': 'ml_prediction'
            }
            
        except Exception as e:
            logger.error(f"ML prediction error: {str(e)}")
            return self._default_categorization(transaction)
    
    def _rule_based_categorization(self, transaction: Dict) -> Dict[str, Any]:
        """Rule-based categorization using keyword matching"""
        try:
            description = transaction.get('description', '').lower()
            merchant = transaction.get('merchant', '').lower()
            combined_text = f"{description} {merchant}"
            
            best_category = 'Other'
            best_score = 0
            
            for category, keywords in self.category_keywords.items():
                score = 0
                for keyword in keywords:
                    if keyword in combined_text:
                        score += 1
                
                if score > best_score:
                    best_score = score
                    best_category = category
            
            confidence = min(0.9, best_score / 3)  # Max confidence from rule-based is 0.9
            
            return {
                'predicted_category': best_category,
                'confidence': confidence,
                'alternatives': [{'category': best_category, 'probability': confidence}],
                'method': 'rule_based'
            }
            
        except Exception as e:
            logger.error(f"Rule-based categorization error: {str(e)}")
            return self._default_categorization(transaction)
    
    def _fuzzy_match_categorization(self, transaction: Dict) -> Dict[str, Any]:
        """Fuzzy string matching categorization"""
        try:
            description = transaction.get('description', '').lower()
            merchant = transaction.get('merchant', '').lower()
            combined_text = f"{description} {merchant}"
            
            best_category = 'Other'
            best_score = 0
            
            for category, keywords in self.category_keywords.items():
                category_score = 0
                for keyword in keywords:
                    # Use fuzzy matching for partial matches
                    desc_score = fuzz.partial_ratio(keyword, description) / 100
                    merchant_score = fuzz.partial_ratio(keyword, merchant) / 100
                    keyword_score = max(desc_score, merchant_score)
                    category_score = max(category_score, keyword_score)
                
                if category_score > best_score:
                    best_score = category_score
                    best_category = category
            
            confidence = best_score * 0.8  # Fuzzy matching gets lower confidence
            
            return {
                'predicted_category': best_category,
                'confidence': confidence,
                'alternatives': [{'category': best_category, 'probability': confidence}],
                'method': 'fuzzy_match'
            }
            
        except Exception as e:
            logger.error(f"Fuzzy match categorization error: {str(e)}")
            return self._default_categorization(transaction)
    
    def _default_categorization(self, transaction: Dict) -> Dict[str, Any]:
        """Default categorization when other methods fail"""
        amount = abs(float(transaction.get('amount', 0)))
        
        # Simple amount-based categorization
        if amount < 20:
            category = 'Miscellaneous'
        elif amount < 100:
            category = 'Shopping'
        else:
            category = 'Other'
        
        return {
            'predicted_category': category,
            'confidence': 0.3,
            'alternatives': [{'category': category, 'probability': 0.3}],
            'method': 'default'
        }
    
    def _extract_transaction_features(self, transaction: Dict) -> List[float]:
        """Extract numerical features for ML model"""
        try:
            features = []
            
            # Amount-based features
            amount = abs(float(transaction.get('amount', 0)))
            features.extend([
                amount,
                np.log1p(amount),  # Log transform
                1 if amount > 100 else 0,  # Large transaction flag
                1 if amount < 20 else 0,   # Small transaction flag
            ])
            
            # Text-based features (simplified)
            description = transaction.get('description', '').lower()
            merchant = transaction.get('merchant', '').lower()
            
            # Keyword presence features
            for category, keywords in self.category_keywords.items():
                has_keyword = any(keyword in f"{description} {merchant}" for keyword in keywords)
                features.append(1 if has_keyword else 0)
            
            return features
            
        except Exception as e:
            logger.error(f"Feature extraction error: {str(e)}")
            return [0] * 20  # Return default features
    
    def _prepare_training_features(self, training_data: List[Dict]) -> tuple:
        """Prepare features and labels for training"""
        try:
            features = []
            labels = []
            
            for item in training_data:
                transaction = item['transaction']
                category = item['category']
                
                feature_vector = self._extract_transaction_features(transaction)
                features.append(feature_vector)
                labels.append(category)
            
            return np.array(features), np.array(labels)
            
        except Exception as e:
            logger.error(f"Training feature preparation error: {str(e)}")
            return np.array([]), np.array([])
    
    def _get_mock_training_data(self) -> List[Dict]:
        """Generate mock training data for the categorization model"""
        training_data = [
            # Groceries
            {'transaction': {'description': 'COLES SUPERMARKET', 'merchant': 'Coles', 'amount': -85.50}, 'category': 'Groceries'},
            {'transaction': {'description': 'WOOLWORTHS', 'merchant': 'Woolworths', 'amount': -120.30}, 'category': 'Groceries'},
            {'transaction': {'description': 'ALDI STORES', 'merchant': 'ALDI', 'amount': -65.20}, 'category': 'Groceries'},
            
            # Transport
            {'transaction': {'description': 'SHELL FUEL', 'merchant': 'Shell', 'amount': -75.00}, 'category': 'Transport'},
            {'transaction': {'description': 'UBER TRIP', 'merchant': 'Uber', 'amount': -25.50}, 'category': 'Transport'},
            {'transaction': {'description': 'PETROL STATION', 'merchant': 'BP', 'amount': -80.00}, 'category': 'Transport'},
            
            # Entertainment
            {'transaction': {'description': 'NETFLIX SUBSCRIPTION', 'merchant': 'Netflix', 'amount': -15.99}, 'category': 'Entertainment'},
            {'transaction': {'description': 'CINEMA TICKETS', 'merchant': 'Event Cinemas', 'amount': -45.00}, 'category': 'Entertainment'},
            {'transaction': {'description': 'RESTAURANT DINNER', 'merchant': 'Local Restaurant', 'amount': -85.50}, 'category': 'Entertainment'},
            
            # Utilities
            {'transaction': {'description': 'ELECTRICITY BILL', 'merchant': 'Energy Australia', 'amount': -185.50}, 'category': 'Utilities'},
            {'transaction': {'description': 'TELSTRA MOBILE', 'merchant': 'Telstra', 'amount': -65.00}, 'category': 'Utilities'},
            {'transaction': {'description': 'WATER BILL', 'merchant': 'Sydney Water', 'amount': -95.20}, 'category': 'Utilities'},
            
            # Shopping
            {'transaction': {'description': 'AMAZON PURCHASE', 'merchant': 'Amazon', 'amount': -125.00}, 'category': 'Shopping'},
            {'transaction': {'description': 'CLOTHING STORE', 'merchant': 'Target', 'amount': -85.50}, 'category': 'Shopping'},
            {'transaction': {'description': 'ELECTRONICS STORE', 'merchant': 'JB Hi-Fi', 'amount': -299.00}, 'category': 'Shopping'},
            
            # Healthcare
            {'transaction': {'description': 'DOCTOR VISIT', 'merchant': 'Medical Centre', 'amount': -85.00}, 'category': 'Healthcare'},
            {'transaction': {'description': 'PHARMACY', 'merchant': 'Chemist Warehouse', 'amount': -25.50}, 'category': 'Healthcare'},
            {'transaction': {'description': 'DENTAL CHECKUP', 'merchant': 'Dental Clinic', 'amount': -165.00}, 'category': 'Healthcare'},
            
            # Education
            {'transaction': {'description': 'COURSE FEE', 'merchant': 'University', 'amount': -450.00}, 'category': 'Education'},
            {'transaction': {'description': 'BOOK PURCHASE', 'merchant': 'Book Store', 'amount': -65.00}, 'category': 'Education'},
        ]
        
        return training_data 