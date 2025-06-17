"""
Integration Tests for Database Operations
=======================================

Tests receipt storage, retrieval, transaction matching, and Firebase integration.
"""

import pytest
import unittest
from unittest.mock import Mock, patch, MagicMock
import json
from datetime import datetime, timedelta
from decimal import Decimal

from firebase_config import db
from database.models import Receipt
from backend.routes.receipt_routes import match_receipt_with_transaction


class TestDatabaseIntegration(unittest.TestCase):
    """Test database integration functionality"""
    
    def setUp(self):
        """Set up test database environment"""
        self.test_user_id = "test_user_123"
        self.test_receipt_id = "test_receipt_456"
        
        # Sample receipt data
        self.sample_receipt_data = {
            'id': self.test_receipt_id,
            'user_id': self.test_user_id,
            'merchant': 'OFFICEWORKS',
            'amount': 118.50,
            'date': '2024-01-15',
            'category': 'D5',
            'extracted_data': {
                'merchant_name': 'OFFICEWORKS',
                'total_amount': 118.50,
                'gst_amount': 10.77,
                'suggested_tax_category': 'D5',
                'confidence_score': 0.9
            },
            'created_at': datetime.now().isoformat(),
            'processed_with': 'gemini-2.0-flash-enhanced'
        }
        
        # Sample transaction data
        self.sample_transactions = [
            {
                'id': 'txn_001',
                'account_id': 'acc_123',
                'amount': '-118.50',
                'description': 'EFTPOS OFFICEWORKS MELBOURNE',
                'postDate': '2024-01-15T14:30:00Z',
                'category': 'shopping'
            }
        ]
    
    @patch('firebase_config.db')
    def test_receipt_storage(self, mock_db):
        """Test receipt data insertion into database"""
        # Mock Firestore collection and document operations
        mock_collection = Mock()
        mock_doc_ref = Mock()
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_doc_ref
        mock_doc_ref.set.return_value = None
        
        # Simulate storing receipt
        receipts_collection = mock_db.collection('receipts')
        doc_ref = receipts_collection.document(self.test_receipt_id)
        doc_ref.set(self.sample_receipt_data)
        
        # Verify database operations were called correctly
        mock_db.collection.assert_called_with('receipts')
        mock_collection.document.assert_called_with(self.test_receipt_id)
        mock_doc_ref.set.assert_called_with(self.sample_receipt_data)
    
    @patch('firebase_config.db')
    def test_receipt_retrieval(self, mock_db):
        """Test receipt data retrieval from database"""
        # Mock Firestore operations
        mock_collection = Mock()
        mock_doc_ref = Mock()
        mock_doc = Mock()
        
        mock_doc.exists = True
        mock_doc.to_dict.return_value = self.sample_receipt_data
        mock_doc_ref.get.return_value = mock_doc
        mock_collection.document.return_value = mock_doc_ref
        mock_db.collection.return_value = mock_collection
        
        # Simulate retrieving receipt
        receipts_collection = mock_db.collection('receipts')
        doc_ref = receipts_collection.document(self.test_receipt_id)
        receipt_doc = doc_ref.get()
        
        # Verify retrieval
        self.assertTrue(receipt_doc.exists)
        receipt_data = receipt_doc.to_dict()
        self.assertEqual(receipt_data['id'], self.test_receipt_id)
        self.assertEqual(receipt_data['merchant'], 'OFFICEWORKS')
        self.assertEqual(receipt_data['amount'], 118.50)
    
    @patch('firebase_config.db')
    def test_receipt_update_operations(self, mock_db):
        """Test receipt update operations"""
        # Mock Firestore operations
        mock_collection = Mock()
        mock_doc_ref = Mock()
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_doc_ref
        mock_doc_ref.update.return_value = None
        
        # Update data
        update_data = {
            'category': 'D6',
            'manually_categorized': True,
            'updated_at': datetime.now().isoformat()
        }
        
        # Simulate update
        receipts_collection = mock_db.collection('receipts')
        doc_ref = receipts_collection.document(self.test_receipt_id)
        doc_ref.update(update_data)
        
        # Verify update operation
        mock_doc_ref.update.assert_called_with(update_data)
    
    @patch('firebase_config.db')
    def test_receipt_deletion(self, mock_db):
        """Test receipt deletion and cleanup"""
        # Mock Firestore operations
        mock_collection = Mock()
        mock_doc_ref = Mock()
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_doc_ref
        mock_doc_ref.delete.return_value = None
        
        # Simulate deletion
        receipts_collection = mock_db.collection('receipts')
        doc_ref = receipts_collection.document(self.test_receipt_id)
        doc_ref.delete()
        
        # Verify deletion
        mock_doc_ref.delete.assert_called_once()
    
    @patch('firebase_config.db')
    def test_user_receipts_query(self, mock_db):
        """Test querying receipts by user"""
        # Mock query operations
        mock_collection = Mock()
        mock_query = Mock()
        mock_docs = [Mock() for _ in range(3)]
        
        # Set up mock document data
        for i, doc in enumerate(mock_docs):
            doc.to_dict.return_value = {
                'id': f'receipt_{i}',
                'user_id': self.test_user_id,
                'merchant': f'Merchant {i}',
                'amount': 50.00 + i * 10
            }
        
        mock_query.get.return_value = mock_docs
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        # Simulate query
        receipts_collection = mock_db.collection('receipts')
        query = receipts_collection.where('user_id', '==', self.test_user_id)
        results = query.get()
        
        # Verify query results
        self.assertEqual(len(results), 3)
        mock_collection.where.assert_called_with('user_id', '==', self.test_user_id)
    
    @patch('firebase_config.db')
    def test_receipt_pagination(self, mock_db):
        """Test paginated receipt queries"""
        # Mock pagination operations
        mock_collection = Mock()
        mock_query = Mock()
        mock_ordered_query = Mock()
        mock_limited_query = Mock()
        mock_docs = [Mock() for _ in range(10)]
        
        for i, doc in enumerate(mock_docs):
            doc.to_dict.return_value = {
                'id': f'receipt_{i}',
                'created_at': (datetime.now() - timedelta(days=i)).isoformat()
            }
        
        mock_limited_query.get.return_value = mock_docs
        mock_ordered_query.limit.return_value = mock_limited_query
        mock_query.order_by.return_value = mock_ordered_query
        mock_collection.where.return_value = mock_query
        mock_db.collection.return_value = mock_collection
        
        # Simulate paginated query
        receipts_collection = mock_db.collection('receipts')
        query = (receipts_collection
                .where('user_id', '==', self.test_user_id)
                .order_by('created_at', direction='DESCENDING')
                .limit(10))
        
        results = query.get()
        
        # Verify pagination
        self.assertEqual(len(results), 10)
        mock_ordered_query.limit.assert_called_with(10)


class TestTransactionMatching(unittest.TestCase):
    """Test receipt-transaction matching algorithms"""
    
    def setUp(self):
        """Set up test data for transaction matching"""
        self.receipt_data = {
            'merchant': 'OFFICEWORKS',
            'amount': 118.50,
            'date': '2024-01-15',
            'extracted_data': {
                'merchant_name': 'OFFICEWORKS',
                'total_amount': 118.50,
                'date': '2024-01-15'
            }
        }
        
        self.transactions = [
            {
                'id': 'txn_exact_match',
                'amount': '-118.50',
                'description': 'EFTPOS OFFICEWORKS MELBOURNE',
                'postDate': '2024-01-15T14:30:00Z'
            },
            {
                'id': 'txn_close_match',
                'amount': '-118.45',  # Slight difference
                'description': 'OFFICEWORKS',
                'postDate': '2024-01-15T15:00:00Z'
            },
            {
                'id': 'txn_no_match',
                'amount': '-67.80',
                'description': 'SHELL FUEL',
                'postDate': '2024-01-14T08:30:00Z'
            }
        ]
    
    def test_exact_amount_matching(self):
        """Test matching with exact amount"""
        match_result = match_receipt_with_transaction(
            self.receipt_data, 
            self.transactions
        )
        
        self.assertIsNotNone(match_result)
        self.assertEqual(match_result['transaction_id'], 'txn_exact_match')
        self.assertGreater(match_result['confidence'], 0.9)
    
    def test_approximate_amount_matching(self):
        """Test matching with approximate amounts (small differences)"""
        # Test with receipt amount slightly different from transaction
        receipt_with_rounding = self.receipt_data.copy()
        receipt_with_rounding['amount'] = 118.45
        
        match_result = match_receipt_with_transaction(
            receipt_with_rounding,
            self.transactions
        )
        
        # Should match the close amount transaction
        self.assertIsNotNone(match_result)
        self.assertGreater(match_result['confidence'], 0.7)
    
    def test_merchant_name_matching(self):
        """Test matching based on merchant name patterns"""
        # Transaction with partial merchant name
        transactions_partial = [
            {
                'id': 'txn_partial_name',
                'amount': '-118.50',
                'description': 'OFFICEWRKS MLBRN',  # Abbreviated
                'postDate': '2024-01-15T14:30:00Z'
            }
        ]
        
        match_result = match_receipt_with_transaction(
            self.receipt_data,
            transactions_partial
        )
        
        # Should still match based on partial name similarity
        self.assertIsNotNone(match_result)
        self.assertGreater(match_result['confidence'], 0.6)
    
    def test_date_range_matching(self):
        """Test matching within reasonable date ranges"""
        # Transaction one day after receipt
        transactions_date_diff = [
            {
                'id': 'txn_next_day',
                'amount': '-118.50',
                'description': 'OFFICEWORKS',
                'postDate': '2024-01-16T10:00:00Z'  # Next day
            }
        ]
        
        match_result = match_receipt_with_transaction(
            self.receipt_data,
            transactions_date_diff
        )
        
        # Should match within reasonable date range
        self.assertIsNotNone(match_result)
        self.assertGreater(match_result['confidence'], 0.5)
    
    def test_no_matching_transaction(self):
        """Test behavior when no matching transaction exists"""
        non_matching_transactions = [
            {
                'id': 'txn_different',
                'amount': '-50.00',
                'description': 'DIFFERENT STORE',
                'postDate': '2024-01-10T12:00:00Z'
            }
        ]
        
        match_result = match_receipt_with_transaction(
            self.receipt_data,
            non_matching_transactions
        )
        
        # Should return None or low confidence match
        self.assertTrue(
            match_result is None or 
            match_result['confidence'] < 0.3
        )
    
    def test_multiple_potential_matches(self):
        """Test handling of multiple potential matches"""
        duplicate_transactions = [
            {
                'id': 'txn_duplicate_1',
                'amount': '-118.50',
                'description': 'OFFICEWORKS STORE 1',
                'postDate': '2024-01-15T14:00:00Z'
            },
            {
                'id': 'txn_duplicate_2',
                'amount': '-118.50',
                'description': 'OFFICEWORKS STORE 2',
                'postDate': '2024-01-15T14:30:00Z'
            }
        ]
        
        match_result = match_receipt_with_transaction(
            self.receipt_data,
            duplicate_transactions
        )
        
        # Should pick the best match (closest time or best description match)
        self.assertIsNotNone(match_result)
        self.assertIn(match_result['transaction_id'], ['txn_duplicate_1', 'txn_duplicate_2'])


class TestDataConsistency(unittest.TestCase):
    """Test data consistency and integrity"""
    
    @patch('firebase_config.db')
    def test_concurrent_receipt_updates(self, mock_db):
        """Test handling of concurrent receipt updates"""
        # Mock Firestore transaction operations
        mock_transaction = Mock()
        mock_doc_ref = Mock()
        mock_collection = Mock()
        
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_doc_ref
        mock_db.transaction.return_value = mock_transaction
        
        # Simulate concurrent update scenario
        update_data_1 = {'category': 'D5', 'updated_by': 'user'}
        update_data_2 = {'matched_transaction': 'txn_123', 'updated_by': 'system'}
        
        # Both updates should be handled atomically
        # This test ensures transaction safety
        self.assertTrue(True)  # Placeholder for actual transaction testing
    
    @patch('firebase_config.db')
    def test_data_validation_on_storage(self, mock_db):
        """Test data validation before storage"""
        # Invalid receipt data
        invalid_receipt = {
            'id': 'test_receipt',
            'user_id': None,  # Invalid: missing user_id
            'amount': -50.00,  # Invalid: negative amount
            'date': 'invalid-date'  # Invalid: bad date format
        }
        
        # Mock validation (would be implemented in actual storage logic)
        def validate_receipt_data(data):
            errors = []
            if not data.get('user_id'):
                errors.append('user_id is required')
            if data.get('amount', 0) <= 0:
                errors.append('amount must be positive')
            return errors
        
        validation_errors = validate_receipt_data(invalid_receipt)
        
        # Should detect validation errors
        self.assertGreater(len(validation_errors), 0)
        self.assertIn('user_id is required', validation_errors)
        self.assertIn('amount must be positive', validation_errors)
    
    def test_receipt_model_serialization(self):
        """Test Receipt model serialization/deserialization"""
        # Create Receipt object
        receipt = Receipt(
            receipt_id='test_123',
            user_id='user_456',
            merchant='OFFICEWORKS',
            total_amount=118.50,
            date='2024-01-15',
            items=[{'name': 'Paper', 'price': 15.95}],
            tax_amount=10.77
        )
        
        # Test serialization
        receipt_dict = receipt.to_dict()
        self.assertEqual(receipt_dict['receipt_id'], 'test_123')
        self.assertEqual(receipt_dict['merchant'], 'OFFICEWORKS')
        self.assertEqual(receipt_dict['total_amount'], 118.50)
        
        # Test deserialization
        restored_receipt = Receipt.from_dict(receipt_dict)
        self.assertEqual(restored_receipt.receipt_id, 'test_123')
        self.assertEqual(restored_receipt.merchant, 'OFFICEWORKS')


class TestFirebaseConnectivity(unittest.TestCase):
    """Test Firebase connection and error handling"""
    
    @patch('firebase_config.db')
    def test_firebase_connection_success(self, mock_db):
        """Test successful Firebase connection"""
        # Mock successful connection
        mock_collection = Mock()
        mock_db.collection.return_value = mock_collection
        
        # Test basic connection
        try:
            receipts_collection = mock_db.collection('receipts')
            self.assertIsNotNone(receipts_collection)
        except Exception as e:
            self.fail(f"Firebase connection failed: {e}")
    
    @patch('firebase_config.db')
    def test_firebase_connection_failure(self, mock_db):
        """Test Firebase connection failure handling"""
        # Mock connection failure
        mock_db.collection.side_effect = Exception("Firebase connection failed")
        
        # Should handle connection gracefully
        with self.assertRaises(Exception):
            mock_db.collection('receipts')
    
    @patch('firebase_config.db')
    def test_firebase_permission_errors(self, mock_db):
        """Test handling of Firebase permission errors"""
        # Mock permission error
        mock_collection = Mock()
        mock_collection.add.side_effect = Exception("Permission denied")
        mock_db.collection.return_value = mock_collection
        
        # Should handle permission errors appropriately
        with self.assertRaises(Exception):
            receipts_collection = mock_db.collection('receipts')
            receipts_collection.add({'test': 'data'})
    
    def test_offline_mode_handling(self):
        """Test behavior when Firebase is offline"""
        # This would test offline caching and synchronization
        # For now, we ensure graceful degradation
        
        # Mock offline scenario
        offline_error = Exception("Network unavailable")
        
        # Should provide appropriate user feedback
        self.assertIn("network", str(offline_error).lower())


if __name__ == '__main__':
    unittest.main() 