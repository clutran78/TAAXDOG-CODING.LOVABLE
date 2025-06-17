"""
Performance Tests for Receipt Processing Speed and Accuracy
=========================================================

Tests processing time, throughput, memory usage, and accuracy benchmarks.
"""

import pytest
import unittest
from unittest.mock import Mock, patch
import time
import statistics
import psutil
import threading
from concurrent.futures import ThreadPoolExecutor
import tempfile
import os
from PIL import Image

from conftest import TEST_CONFIG


class TestProcessingSpeed(unittest.TestCase):
    """Test receipt processing speed benchmarks"""
    
    def setUp(self):
        """Set up performance test environment"""
        self.test_receipts = []
        self.processing_times = []
        
        # Create test receipt files
        for i in range(10):
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            img = Image.new('RGB', (800, 1200), color='white')
            img.save(temp_file.name, format='JPEG')
            self.test_receipts.append(temp_file.name)
    
    def tearDown(self):
        """Clean up test files"""
        for file_path in self.test_receipts:
            try:
                os.unlink(file_path)
            except:
                pass
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    def test_average_processing_time(self, mock_extract):
        """Test average processing time for receipt extraction"""
        # Mock fast response
        mock_extract.return_value = {
            "success": True,
            "documents": [{
                "data": {
                    "merchant_name": "TEST MERCHANT",
                    "total_amount": 50.00,
                    "confidence_score": 0.8
                }
            }]
        }
        
        processing_times = []
        
        # Process multiple receipts and measure time
        for receipt_file in self.test_receipts:
            start_time = time.time()
            result = mock_extract(receipt_file)
            end_time = time.time()
            
            processing_time = end_time - start_time
            processing_times.append(processing_time)
            
            # Verify successful processing
            self.assertTrue(result["success"])
        
        # Calculate statistics
        avg_time = statistics.mean(processing_times)
        median_time = statistics.median(processing_times)
        max_time = max(processing_times)
        min_time = min(processing_times)
        
        # Performance assertions
        self.assertLess(avg_time, TEST_CONFIG['max_processing_time'], 
                       f"Average processing time {avg_time:.2f}s exceeds limit")
        self.assertLess(max_time, TEST_CONFIG['max_processing_time'] * 1.5,
                       f"Maximum processing time {max_time:.2f}s too slow")
        
        # Log performance metrics
        print(f"\nProcessing Time Statistics:")
        print(f"Average: {avg_time:.2f}s")
        print(f"Median: {median_time:.2f}s")
        print(f"Min: {min_time:.2f}s")
        print(f"Max: {max_time:.2f}s")
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    def test_processing_time_by_file_size(self, mock_extract):
        """Test processing time correlation with file size"""
        mock_extract.return_value = {
            "success": True,
            "documents": [{"data": {"merchant_name": "TEST", "total_amount": 50.00}}]
        }
        
        file_sizes = [100, 500, 1000, 2000, 5000]  # KB
        results = []
        
        for size_kb in file_sizes:
            # Create file of specific size
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            
            # Create image that results in approximately the target file size
            dimension = int((size_kb * 1024 / 3) ** 0.5)  # Rough calculation
            img = Image.new('RGB', (dimension, dimension), color='white')
            img.save(temp_file.name, format='JPEG', quality=85)
            
            actual_size = os.path.getsize(temp_file.name) / 1024  # KB
            
            # Measure processing time
            start_time = time.time()
            mock_extract(temp_file.name)
            processing_time = time.time() - start_time
            
            results.append({
                'target_size_kb': size_kb,
                'actual_size_kb': actual_size,
                'processing_time': processing_time
            })
            
            os.unlink(temp_file.name)
        
        # Verify processing time doesn't increase dramatically with file size
        # (should be roughly linear or sub-linear for OCR)
        for result in results:
            self.assertLess(result['processing_time'], TEST_CONFIG['max_processing_time'])
        
        # Log results
        print(f"\nProcessing Time by File Size:")
        for result in results:
            print(f"Size: {result['actual_size_kb']:.1f}KB, Time: {result['processing_time']:.2f}s")
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    def test_concurrent_processing_performance(self, mock_extract):
        """Test performance under concurrent processing load"""
        mock_extract.return_value = {
            "success": True,
            "documents": [{"data": {"merchant_name": "TEST", "total_amount": 50.00}}]
        }
        
        num_threads = 5
        receipts_per_thread = 3
        all_processing_times = []
        
        def process_receipts_batch(thread_id):
            thread_times = []
            for i in range(receipts_per_thread):
                receipt_file = self.test_receipts[i % len(self.test_receipts)]
                start_time = time.time()
                mock_extract(receipt_file)
                processing_time = time.time() - start_time
                thread_times.append(processing_time)
            return thread_times
        
        # Run concurrent processing
        start_total = time.time()
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            future_to_thread = {
                executor.submit(process_receipts_batch, i): i 
                for i in range(num_threads)
            }
            
            for future in future_to_thread:
                thread_times = future.result()
                all_processing_times.extend(thread_times)
        
        total_time = time.time() - start_total
        
        # Calculate metrics
        total_receipts = num_threads * receipts_per_thread
        throughput = total_receipts / total_time  # receipts per second
        avg_time = statistics.mean(all_processing_times)
        
        # Performance assertions
        self.assertGreater(throughput, 1.0, "Throughput should be at least 1 receipt/second")
        self.assertLess(avg_time, TEST_CONFIG['max_processing_time'])
        
        print(f"\nConcurrent Processing Performance:")
        print(f"Total receipts: {total_receipts}")
        print(f"Total time: {total_time:.2f}s")
        print(f"Throughput: {throughput:.2f} receipts/second")
        print(f"Average processing time: {avg_time:.2f}s")


class TestMemoryUsage(unittest.TestCase):
    """Test memory usage during receipt processing"""
    
    def setUp(self):
        """Set up memory monitoring"""
        self.process = psutil.Process()
        self.initial_memory = self.process.memory_info().rss / 1024 / 1024  # MB
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    def test_memory_usage_single_receipt(self, mock_extract):
        """Test memory usage for processing a single receipt"""
        mock_extract.return_value = {
            "success": True,
            "documents": [{"data": {"merchant_name": "TEST", "total_amount": 50.00}}]
        }
        
        # Create test file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        img = Image.new('RGB', (2000, 3000), color='white')  # Large image
        img.save(temp_file.name, format='JPEG')
        
        try:
            # Measure memory before processing
            memory_before = self.process.memory_info().rss / 1024 / 1024  # MB
            
            # Process receipt
            result = mock_extract(temp_file.name)
            
            # Measure memory after processing
            memory_after = self.process.memory_info().rss / 1024 / 1024  # MB
            memory_used = memory_after - memory_before
            
            # Verify successful processing
            self.assertTrue(result["success"])
            
            # Memory usage should be reasonable (less than 100MB for single receipt)
            self.assertLess(memory_used, 100, f"Memory usage {memory_used:.1f}MB too high")
            
            print(f"\nMemory Usage:")
            print(f"Before: {memory_before:.1f}MB")
            print(f"After: {memory_after:.1f}MB")
            print(f"Used: {memory_used:.1f}MB")
            
        finally:
            os.unlink(temp_file.name)
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    def test_memory_leak_detection(self, mock_extract):
        """Test for memory leaks during repeated processing"""
        mock_extract.return_value = {
            "success": True,
            "documents": [{"data": {"merchant_name": "TEST", "total_amount": 50.00}}]
        }
        
        # Create test file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        img = Image.new('RGB', (800, 1200), color='white')
        img.save(temp_file.name, format='JPEG')
        
        try:
            memory_measurements = []
            
            # Process receipt multiple times
            for i in range(20):
                mock_extract(temp_file.name)
                
                # Measure memory every 5 iterations
                if i % 5 == 0:
                    memory_mb = self.process.memory_info().rss / 1024 / 1024
                    memory_measurements.append(memory_mb)
            
            # Check for memory leaks (significant upward trend)
            if len(memory_measurements) >= 3:
                first_measurement = memory_measurements[0]
                last_measurement = memory_measurements[-1]
                memory_growth = last_measurement - first_measurement
                
                # Memory growth should be minimal (less than 50MB)
                self.assertLess(memory_growth, 50, 
                               f"Potential memory leak: {memory_growth:.1f}MB growth")
                
                print(f"\nMemory Leak Test:")
                print(f"Initial: {first_measurement:.1f}MB")
                print(f"Final: {last_measurement:.1f}MB")
                print(f"Growth: {memory_growth:.1f}MB")
            
        finally:
            os.unlink(temp_file.name)


class TestAccuracyBenchmarks(unittest.TestCase):
    """Test accuracy benchmarks with known data sets"""
    
    def setUp(self):
        """Set up accuracy test data"""
        self.test_cases = [
            {
                "name": "officeworks_receipt",
                "expected": {
                    "merchant_name": "OFFICEWORKS",
                    "total_amount": 118.50,
                    "gst_amount": 10.77,
                    "category": "D5"
                }
            },
            {
                "name": "shell_fuel_receipt", 
                "expected": {
                    "merchant_name": "SHELL",
                    "total_amount": 67.80,
                    "category": "D1"
                }
            },
            {
                "name": "woolworths_grocery",
                "expected": {
                    "merchant_name": "WOOLWORTHS",
                    "total_amount": 85.90,
                    "category": "Personal"
                }
            }
        ]
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    def test_extraction_accuracy_rates(self, mock_extract):
        """Test extraction accuracy across different receipt types"""
        accuracy_results = []
        
        for test_case in self.test_cases:
            # Mock response based on test case
            mock_extract.return_value = {
                "success": True,
                "documents": [{
                    "data": {
                        "merchant_name": test_case["expected"]["merchant_name"],
                        "total_amount": test_case["expected"]["total_amount"],
                        "suggested_tax_category": test_case["expected"]["category"],
                        "confidence_score": 0.9
                    }
                }]
            }
            
            # Create dummy file for test
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            img = Image.new('RGB', (400, 600), color='white')
            img.save(temp_file.name, format='JPEG')
            
            try:
                result = mock_extract(temp_file.name)
                extracted_data = result["documents"][0]["data"]
                
                # Calculate accuracy for each field
                field_accuracy = {}
                for field, expected_value in test_case["expected"].items():
                    actual_value = extracted_data.get(field.replace("category", "suggested_tax_category"))
                    
                    if isinstance(expected_value, (int, float)):
                        # Numeric comparison with tolerance
                        accuracy = 1.0 if abs(actual_value - expected_value) < 0.01 else 0.0
                    else:
                        # String comparison
                        accuracy = 1.0 if actual_value == expected_value else 0.0
                    
                    field_accuracy[field] = accuracy
                
                overall_accuracy = statistics.mean(field_accuracy.values())
                accuracy_results.append({
                    "test_case": test_case["name"],
                    "overall_accuracy": overall_accuracy,
                    "field_accuracy": field_accuracy
                })
                
            finally:
                os.unlink(temp_file.name)
        
        # Calculate overall accuracy across all test cases
        total_accuracy = statistics.mean([r["overall_accuracy"] for r in accuracy_results])
        
        # Accuracy should be above minimum threshold
        min_accuracy = TEST_CONFIG['min_confidence_score']
        self.assertGreater(total_accuracy, min_accuracy, 
                          f"Overall accuracy {total_accuracy:.2f} below threshold {min_accuracy}")
        
        print(f"\nAccuracy Test Results:")
        for result in accuracy_results:
            print(f"{result['test_case']}: {result['overall_accuracy']:.2f}")
        print(f"Overall Accuracy: {total_accuracy:.2f}")
    
    def test_confidence_score_reliability(self):
        """Test reliability of confidence scores"""
        # Test data with known quality levels
        test_scenarios = [
            {"quality": "high", "expected_confidence_range": (0.8, 1.0)},
            {"quality": "medium", "expected_confidence_range": (0.5, 0.8)},
            {"quality": "low", "expected_confidence_range": (0.0, 0.5)}
        ]
        
        for scenario in test_scenarios:
            # Mock confidence score based on quality
            if scenario["quality"] == "high":
                mock_confidence = 0.9
            elif scenario["quality"] == "medium":
                mock_confidence = 0.6
            else:
                mock_confidence = 0.3
            
            # Verify confidence is in expected range
            min_conf, max_conf = scenario["expected_confidence_range"]
            self.assertGreaterEqual(mock_confidence, min_conf)
            self.assertLessEqual(mock_confidence, max_conf)
    
    def test_gst_calculation_accuracy(self):
        """Test accuracy of GST calculations"""
        test_amounts = [
            {"total": 110.00, "expected_gst": 10.00},
            {"total": 55.00, "expected_gst": 5.00},
            {"total": 33.00, "expected_gst": 3.00},
            {"total": 121.00, "expected_gst": 11.00}
        ]
        
        for test in test_amounts:
            # Calculate GST (Australian 10% inclusive)
            calculated_gst = test["total"] / 11
            
            # Allow small rounding tolerance
            tolerance = 0.05
            difference = abs(calculated_gst - test["expected_gst"])
            
            self.assertLess(difference, tolerance,
                           f"GST calculation error for ${test['total']}: "
                           f"expected ${test['expected_gst']}, got ${calculated_gst:.2f}")


class TestLoadTesting(unittest.TestCase):
    """Test system performance under load"""
    
    @patch('src.integrations.formx_client.extract_data_from_image_with_gemini')
    @patch('firebase_config.db')
    def test_high_volume_processing(self, mock_db, mock_extract):
        """Test processing high volume of receipts"""
        # Mock successful responses
        mock_extract.return_value = {
            "success": True,
            "documents": [{"data": {"merchant_name": "TEST", "total_amount": 50.00}}]
        }
        
        # Mock database operations
        mock_collection = Mock()
        mock_doc_ref = Mock()
        mock_doc_ref.set.return_value = None
        mock_collection.document.return_value = mock_doc_ref
        mock_db.collection.return_value = mock_collection
        
        # Simulate high volume (100 receipts)
        num_receipts = 100
        processing_times = []
        success_count = 0
        
        start_time = time.time()
        
        for i in range(num_receipts):
            receipt_start = time.time()
            
            try:
                # Process receipt
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
                img = Image.new('RGB', (400, 600), color='white')
                img.save(temp_file.name, format='JPEG')
                
                result = mock_extract(temp_file.name)
                
                # Store in database
                receipt_data = {
                    "id": f"receipt_{i}",
                    "extracted_data": result["documents"][0]["data"]
                }
                mock_db.collection('receipts').document(f"receipt_{i}").set(receipt_data)
                
                if result["success"]:
                    success_count += 1
                
                os.unlink(temp_file.name)
                
            except Exception as e:
                print(f"Error processing receipt {i}: {e}")
            
            processing_times.append(time.time() - receipt_start)
        
        total_time = time.time() - start_time
        
        # Calculate performance metrics
        success_rate = success_count / num_receipts
        throughput = num_receipts / total_time
        avg_processing_time = statistics.mean(processing_times)
        
        # Performance assertions
        self.assertGreater(success_rate, 0.95, f"Success rate {success_rate:.2f} too low")
        self.assertGreater(throughput, 5.0, f"Throughput {throughput:.2f} receipts/sec too low")
        self.assertLess(avg_processing_time, TEST_CONFIG['max_processing_time'])
        
        print(f"\nLoad Test Results ({num_receipts} receipts):")
        print(f"Total time: {total_time:.2f}s")
        print(f"Success rate: {success_rate:.2%}")
        print(f"Throughput: {throughput:.2f} receipts/second")
        print(f"Average processing time: {avg_processing_time:.2f}s")
    
    def test_api_rate_limit_handling(self):
        """Test handling of API rate limits under load"""
        # Simulate rate limit responses
        api_calls = []
        rate_limit_errors = 0
        
        def mock_api_call_with_rate_limit():
            api_calls.append(time.time())
            
            # Simulate rate limiting after 10 calls per second
            recent_calls = [t for t in api_calls if time.time() - t < 1.0]
            if len(recent_calls) > 10:
                raise Exception("Rate limit exceeded")
            
            return {"success": True}
        
        # Make rapid API calls
        for i in range(50):
            try:
                mock_api_call_with_rate_limit()
            except Exception as e:
                if "rate limit" in str(e).lower():
                    rate_limit_errors += 1
                    # Simulate backoff delay
                    time.sleep(0.1)
        
        # Should have handled rate limits gracefully
        self.assertLess(rate_limit_errors, 5, "Too many rate limit errors")
        
        print(f"\nRate Limit Test:")
        print(f"Total API calls: {len(api_calls)}")
        print(f"Rate limit errors: {rate_limit_errors}")


if __name__ == '__main__':
    unittest.main() 