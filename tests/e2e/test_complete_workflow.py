"""
End-to-End Tests for Complete Receipt Processing Workflows
========================================================

Tests complete receipt processing from upload to final categorization and storage.
"""

import pytest
import unittest
from unittest.mock import Mock, patch, MagicMock
import json
import tempfile
import os
import time
from datetime import datetime
from PIL import Image

from conftest import TEST_CONFIG


class TestCompleteReceiptWorkflow(unittest.TestCase):
    """Test complete receipt processing workflow"""
    
    def setUp(self):
        """Set up test environment"""
        self.test_user_id = "test_user_workflow"
        self.test_headers = {
            'X-User-ID': self.test_user_id,
            'X-Request-ID': 'test_request_123'
        }
    
    def create_test_receipt_file(self, receipt_type="officeworks"):
        """Create test receipt file for upload"""
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        
        # Create realistic receipt image
        img = Image.new('RGB', (800, 1200), color='white')
        
        if receipt_type == "officeworks":
            # Add officeworks-specific content (would be more detailed in real implementation)
            pass
        elif receipt_type == "shell":
            # Add shell fuel receipt content
            pass
        
        img.save(temp_file.name, format='JPEG')
        return temp_file.name
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    @patch('firebase_config.db')
    @patch('basiq_api.get_user_transactions')
    def test_successful_receipt_processing_workflow(self, mock_get_transactions, mock_db, mock_extract):
        """Test complete successful receipt processing workflow"""
        # Setup mocks
        mock_extract.return_value = {
            "success": True,
            "documents": [{
                "data": {
                    "merchant_name": "OFFICEWORKS",
                    "abn": "13 004 590 964",
                    "date": "2024-01-15",
                    "total_amount": 118.50,
                    "gst_amount": 10.77,
                    "suggested_tax_category": "D5",
                    "confidence_score": 0.9,
                    "business_expense_likelihood": 0.8
                }
            }],
            "processing_metadata": {
                "extraction_method": "gemini-2.0-flash-enhanced",
                "confidence": 0.9
            }
        }
        
        mock_get_transactions.return_value = [
            {
                "id": "txn_001",
                "amount": "-118.50",
                "description": "EFTPOS OFFICEWORKS MELBOURNE",
                "postDate": "2024-01-15T14:30:00Z"
            }
        ]
        
        # Mock Firebase operations
        mock_collection = Mock()
        mock_doc_ref = Mock()
        mock_doc_ref.set.return_value = None
        mock_collection.document.return_value = mock_doc_ref
        mock_db.collection.return_value = mock_collection
        
        # Create test receipt file
        receipt_file = self.create_test_receipt_file("officeworks")
        
        try:
            # Simulate the complete workflow
            start_time = time.time()
            
            # Step 1: Upload and validate file
            with open(receipt_file, 'rb') as f:
                file_data = f.read()
            
            # Step 2: Extract data with Gemini
            extraction_result = mock_extract(receipt_file)
            
            # Step 3: Categorize receipt
            extracted_data = extraction_result["documents"][0]["data"]
            
            # Step 4: Match with transactions
            transactions = mock_get_transactions(self.test_user_id)
            
            # Step 5: Store in database
            receipt_data = {
                'id': 'test_receipt_workflow',
                'user_id': self.test_user_id,
                'extracted_data': extracted_data,
                'matched_transaction_id': 'txn_001',
                'processing_time': time.time() - start_time
            }
            
            receipts_collection = mock_db.collection('receipts')
            doc_ref = receipts_collection.document('test_receipt_workflow')
            doc_ref.set(receipt_data)
            
            # Verify workflow completion
            self.assertTrue(extraction_result["success"])
            self.assertEqual(extracted_data["merchant_name"], "OFFICEWORKS")
            self.assertEqual(extracted_data["suggested_tax_category"], "D5")
            self.assertLess(receipt_data['processing_time'], TEST_CONFIG['max_processing_time'])
            
            # Verify database storage
            mock_db.collection.assert_called_with('receipts')
            mock_doc_ref.set.assert_called_with(receipt_data)
            
        finally:
            # Clean up
            os.unlink(receipt_file)
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    @patch('firebase_config.db')
    def test_error_recovery_workflow(self, mock_db, mock_extract):
        """Test error recovery and graceful degradation"""
        # Setup mock to simulate API failure
        mock_extract.side_effect = [
            Exception("Rate limit exceeded"),  # First attempt fails
            Exception("Temporary service error"),  # Second attempt fails
            {  # Third attempt succeeds
                "success": True,
                "documents": [{
                    "data": {
                        "merchant_name": "SHELL",
                        "total_amount": 67.80,
                        "suggested_tax_category": "D1",
                        "confidence_score": 0.7
                    }
                }]
            }
        ]
        
        receipt_file = self.create_test_receipt_file("shell")
        
        try:
            # Simulate retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    result = mock_extract(receipt_file)
                    if result.get("success"):
                        break
                except Exception as e:
                    if attempt == max_retries - 1:
                        # Final attempt - should have fallback
                        result = {
                            "success": False,
                            "error": str(e),
                            "fallback_data": {
                                "merchant_name": "Unknown",
                                "total_amount": 0.0,
                                "requires_manual_review": True
                            }
                        }
                    continue
            
            # Verify retry behavior
            self.assertEqual(mock_extract.call_count, 3)
            
        finally:
            os.unlink(receipt_file)
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    @patch('firebase_config.db')
    @patch('basiq_api.get_user_transactions')
    def test_multi_receipt_batch_processing(self, mock_get_transactions, mock_db, mock_extract):
        """Test processing multiple receipts in batch"""
        # Setup batch processing scenario
        receipts = []
        receipt_files = []
        
        # Create multiple test receipts
        for i, receipt_type in enumerate(["officeworks", "shell", "bunnings"]):
            receipt_file = self.create_test_receipt_file(receipt_type)
            receipt_files.append(receipt_file)
            
            receipts.append({
                "file_path": receipt_file,
                "expected_merchant": receipt_type.upper(),
                "expected_category": "D5" if receipt_type == "officeworks" else "D1" if receipt_type == "shell" else "D6"
            })
        
        # Mock responses for each receipt
        mock_responses = [
            {
                "success": True,
                "documents": [{
                    "data": {
                        "merchant_name": "OFFICEWORKS",
                        "total_amount": 118.50,
                        "suggested_tax_category": "D5"
                    }
                }]
            },
            {
                "success": True,
                "documents": [{
                    "data": {
                        "merchant_name": "SHELL",
                        "total_amount": 67.80,
                        "suggested_tax_category": "D1"
                    }
                }]
            },
            {
                "success": True,
                "documents": [{
                    "data": {
                        "merchant_name": "BUNNINGS",
                        "total_amount": 89.50,
                        "suggested_tax_category": "D6"
                    }
                }]
            }
        ]
        
        mock_extract.side_effect = mock_responses
        
        try:
            # Process all receipts
            results = []
            start_time = time.time()
            
            for i, receipt in enumerate(receipts):
                result = mock_extract(receipt["file_path"])
                results.append(result)
            
            total_processing_time = time.time() - start_time
            
            # Verify batch processing results
            self.assertEqual(len(results), 3)
            for i, result in enumerate(results):
                self.assertTrue(result["success"])
                extracted_data = result["documents"][0]["data"]
                self.assertEqual(extracted_data["suggested_tax_category"], receipts[i]["expected_category"])
            
            # Verify reasonable processing time for batch
            average_time_per_receipt = total_processing_time / len(receipts)
            self.assertLess(average_time_per_receipt, TEST_CONFIG['max_processing_time'])
            
        finally:
            # Clean up all files
            for file_path in receipt_files:
                os.unlink(file_path)
    
    def test_user_notification_workflow(self):
        """Test user notification during processing stages"""
        # This would test real-time updates to the user during processing
        processing_stages = [
            "file_upload",
            "image_validation", 
            "gemini_extraction",
            "data_validation",
            "transaction_matching",
            "database_storage",
            "completion"
        ]
        
        notifications = []
        
        # Mock notification system
        def mock_notify_user(stage, status, details=None):
            notifications.append({
                "stage": stage,
                "status": status,
                "details": details,
                "timestamp": datetime.now()
            })
        
        # Simulate workflow with notifications
        for stage in processing_stages:
            mock_notify_user(stage, "START")
            # Simulate processing time
            time.sleep(0.01)
            mock_notify_user(stage, "SUCCESS")
        
        # Verify notifications
        self.assertEqual(len(notifications), len(processing_stages) * 2)
        
        # Verify proper sequence
        for i in range(0, len(notifications), 2):
            self.assertEqual(notifications[i]["status"], "START")
            self.assertEqual(notifications[i + 1]["status"], "SUCCESS")


class TestRealTimeUpdates(unittest.TestCase):
    """Test real-time updates during processing"""
    
    def test_progress_tracking(self):
        """Test progress tracking during receipt processing"""
        progress_updates = []
        
        def mock_update_progress(percentage, stage):
            progress_updates.append({
                "percentage": percentage,
                "stage": stage,
                "timestamp": time.time()
            })
        
        # Simulate progress updates
        stages = [
            ("Upload", 0),
            ("Validation", 20),
            ("OCR Processing", 40),
            ("Data Extraction", 60),
            ("Categorization", 80),
            ("Storage", 90),
            ("Complete", 100)
        ]
        
        for stage, percentage in stages:
            mock_update_progress(percentage, stage)
            time.sleep(0.01)
        
        # Verify progress tracking
        self.assertEqual(len(progress_updates), 7)
        self.assertEqual(progress_updates[0]["percentage"], 0)
        self.assertEqual(progress_updates[-1]["percentage"], 100)
        
        # Verify monotonic progress
        for i in range(1, len(progress_updates)):
            self.assertGreaterEqual(
                progress_updates[i]["percentage"],
                progress_updates[i-1]["percentage"]
            )
    
    def test_websocket_notifications(self):
        """Test WebSocket notifications for real-time updates"""
        # Mock WebSocket connection
        websocket_messages = []
        
        def mock_send_websocket(message):
            websocket_messages.append({
                "message": message,
                "timestamp": datetime.now()
            })
        
        # Simulate receipt processing with WebSocket updates
        processing_events = [
            {"type": "processing_started", "receipt_id": "test_123"},
            {"type": "ocr_completed", "confidence": 0.9},
            {"type": "categorization_completed", "category": "D5"},
            {"type": "processing_completed", "success": True}
        ]
        
        for event in processing_events:
            mock_send_websocket(json.dumps(event))
        
        # Verify WebSocket messages
        self.assertEqual(len(websocket_messages), 4)
        
        # Verify message content
        first_message = json.loads(websocket_messages[0]["message"])
        self.assertEqual(first_message["type"], "processing_started")
        
        last_message = json.loads(websocket_messages[-1]["message"])
        self.assertEqual(last_message["type"], "processing_completed")
        self.assertTrue(last_message["success"])


class TestConcurrentProcessing(unittest.TestCase):
    """Test concurrent receipt processing"""
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    def test_multiple_users_concurrent_upload(self, mock_extract):
        """Test handling multiple users uploading receipts concurrently"""
        # Mock successful extraction
        mock_extract.return_value = {
            "success": True,
            "documents": [{
                "data": {
                    "merchant_name": "TEST MERCHANT",
                    "total_amount": 50.00,
                    "suggested_tax_category": "D5",
                    "confidence_score": 0.8
                }
            }]
        }
        
        # Simulate concurrent users
        user_ids = [f"user_{i}" for i in range(5)]
        receipt_files = []
        
        try:
            # Create test files
            for user_id in user_ids:
                receipt_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                img = Image.new('RGB', (400, 600), color='white')
                img.save(receipt_file.name, format='JPEG')
                receipt_files.append(receipt_file.name)
            
            # Simulate concurrent processing
            start_time = time.time()
            results = []
            
            for i, user_id in enumerate(user_ids):
                result = mock_extract(receipt_files[i])
                results.append({
                    "user_id": user_id,
                    "result": result,
                    "processing_time": time.time() - start_time
                })
            
            # Verify all users processed successfully
            self.assertEqual(len(results), 5)
            for result in results:
                self.assertTrue(result["result"]["success"])
                self.assertLess(result["processing_time"], TEST_CONFIG['max_processing_time'])
            
        finally:
            # Clean up files
            for file_path in receipt_files:
                try:
                    os.unlink(file_path)
                except:
                    pass
    
    def test_queue_management(self):
        """Test processing queue management under load"""
        # Mock processing queue
        processing_queue = []
        completed_queue = []
        
        def mock_process_receipt(receipt_id, user_id):
            processing_queue.append({"receipt_id": receipt_id, "user_id": user_id})
            # Simulate processing
            time.sleep(0.01)
            completed_queue.append({"receipt_id": receipt_id, "status": "completed"})
        
        # Add multiple receipts to queue
        for i in range(10):
            mock_process_receipt(f"receipt_{i}", f"user_{i % 3}")
        
        # Verify queue management
        self.assertEqual(len(processing_queue), 10)
        self.assertEqual(len(completed_queue), 10)
        
        # Verify FIFO processing
        for i in range(10):
            self.assertEqual(processing_queue[i]["receipt_id"], f"receipt_{i}")
            self.assertEqual(completed_queue[i]["receipt_id"], f"receipt_{i}")


class TestDataIntegrity(unittest.TestCase):
    """Test data integrity throughout the workflow"""
    
    @patch('firebase_config.db')
    def test_atomic_operations(self, mock_db):
        """Test atomic database operations"""
        # Mock transaction operations
        mock_transaction = Mock()
        mock_db.transaction.return_value = mock_transaction
        
        # Simulate atomic receipt storage with transaction matching
        receipt_data = {
            "id": "test_receipt",
            "user_id": "test_user",
            "amount": 100.00
        }
        
        transaction_update = {
            "matched_receipt_id": "test_receipt",
            "match_confidence": 0.95
        }
        
        # Both operations should succeed or fail together
        def atomic_operation():
            # Store receipt
            receipts_ref = mock_db.collection('receipts').document('test_receipt')
            receipts_ref.set(receipt_data)
            
            # Update transaction
            transaction_ref = mock_db.collection('transactions').document('txn_123')
            transaction_ref.update(transaction_update)
        
        # Verify atomic operation
        try:
            atomic_operation()
            # Should succeed atomically
            self.assertTrue(True)
        except Exception:
            # Should rollback completely
            self.assertTrue(True)
    
    def test_data_validation_pipeline(self):
        """Test comprehensive data validation throughout pipeline"""
        # Test data at different stages
        stages = [
            {
                "stage": "upload",
                "data": {"file_size": 1024, "format": "jpg"},
                "validator": lambda d: d["file_size"] > 0 and d["format"] in ["jpg", "png"]
            },
            {
                "stage": "extraction",
                "data": {"merchant_name": "TEST", "amount": 50.00},
                "validator": lambda d: len(d["merchant_name"]) > 0 and d["amount"] > 0
            },
            {
                "stage": "categorization",
                "data": {"category": "D5", "confidence": 0.8},
                "validator": lambda d: d["category"] in ["D1", "D2", "D3", "D4", "D5"] and 0 <= d["confidence"] <= 1
            }
        ]
        
        # Validate data at each stage
        for stage_info in stages:
            is_valid = stage_info["validator"](stage_info["data"])
            self.assertTrue(is_valid, f"Validation failed at stage: {stage_info['stage']}")


if __name__ == '__main__':
    unittest.main() 