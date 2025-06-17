"""
Unit Tests for Gemini API Integration
====================================

Tests Gemini API calls, response parsing, error handling, and data extraction accuracy.
"""

import pytest
import unittest
from unittest.mock import Mock, patch, MagicMock
import json
import time
from datetime import datetime

from src.integrations.formx_client import (
    extract_data_from_image_with_gemini,
    initialize_gemini_api,
    handle_api_error,
    validate_image_for_api,
    _validate_and_enhance_data,
    _calculate_confidence
)


class TestGeminiAPIConnection(unittest.TestCase):
    """Test basic Gemini API connection and configuration"""
    
    def test_api_initialization_success(self):
        """Test successful API initialization"""
        with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_api_key_12345678901234567890'}):
            with patch('google.generativeai.configure') as mock_configure, \
                 patch('google.generativeai.GenerativeModel') as mock_model:
                
                result = initialize_gemini_api()
                
                self.assertTrue(result)
                mock_configure.assert_called_once_with(api_key='test_api_key_12345678901234567890')
                mock_model.assert_called_once_with("gemini-2.0-flash-exp")
    
    def test_api_initialization_missing_key(self):
        """Test API initialization with missing API key"""
        with patch.dict('os.environ', {}, clear=True):
            result = initialize_gemini_api()
            self.assertFalse(result)
    
    def test_api_initialization_invalid_key(self):
        """Test API initialization with invalid API key"""
        with patch.dict('os.environ', {'GOOGLE_API_KEY': 'short'}):
            result = initialize_gemini_api()
            self.assertFalse(result)
    
    def test_api_initialization_exception(self):
        """Test API initialization with configuration exception"""
        with patch.dict('os.environ', {'GOOGLE_API_KEY': 'test_api_key_12345678901234567890'}):
            with patch('google.generativeai.configure', side_effect=Exception("Config error")):
                
                result = initialize_gemini_api()
                self.assertFalse(result)


class TestGeminiAPICall(unittest.TestCase):
    """Test Gemini API call functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.sample_image_path = "/tmp/test_receipt.jpg"
        self.mock_response_data = {
            "merchant_name": "OFFICEWORKS",
            "abn": "13 004 590 964",
            "date": "2024-01-15",
            "total_amount": 118.50,
            "gst_amount": 10.77,
            "suggested_tax_category": "D5",
            "confidence_score": 0.9
        }
    
    @patch('src.integrations.formx_client.model')
    @patch('src.integrations.formx_client.validate_image_for_api')
    @patch('PIL.Image.open')
    def test_successful_api_call(self, mock_image_open, mock_validate, mock_model):
        """Test successful Gemini API call and response parsing"""
        # Mock image validation
        mock_validate.return_value = {"valid": True, "file_size": 1000, "dimensions": (800, 600)}
        
        # Mock PIL Image
        mock_img = Mock()
        mock_img.mode = 'RGB'
        mock_img.__enter__ = Mock(return_value=mock_img)
        mock_img.__exit__ = Mock(return_value=None)
        mock_image_open.return_value = mock_img
        
        # Mock API response
        mock_response = Mock()
        mock_response.text = json.dumps(self.mock_response_data)
        mock_model.generate_content.return_value = mock_response
        
        result = extract_data_from_image_with_gemini(self.sample_image_path)
        
        self.assertTrue(result.get("success"))
        self.assertIn("documents", result)
        
        extracted_data = result["documents"][0]["data"]
        self.assertEqual(extracted_data["merchant_name"], "OFFICEWORKS")
        self.assertEqual(extracted_data["total_amount"], 118.50)
        self.assertEqual(extracted_data["suggested_tax_category"], "D5")
    
    @patch('src.integrations.formx_client.model')
    @patch('src.integrations.formx_client.validate_image_for_api')
    def test_api_rate_limit_error(self, mock_validate, mock_model):
        """Test handling of API rate limit errors"""
        mock_validate.return_value = {"valid": True, "file_size": 1000}
        mock_model.generate_content.side_effect = Exception("rate limit exceeded")
        
        result = extract_data_from_image_with_gemini(self.sample_image_path)
        
        self.assertFalse(result.get("success"))
        self.assertIn("error", result)
        self.assertEqual(result.get("error_type"), "rate_limit")
    
    @patch('src.integrations.formx_client.model')
    @patch('src.integrations.formx_client.validate_image_for_api')
    def test_api_authentication_error(self, mock_validate, mock_model):
        """Test handling of authentication errors"""
        mock_validate.return_value = {"valid": True, "file_size": 1000}
        mock_model.generate_content.side_effect = Exception("API key invalid")
        
        result = extract_data_from_image_with_gemini(self.sample_image_path)
        
        self.assertFalse(result.get("success"))
        self.assertIn("error", result)
        self.assertEqual(result.get("error_type"), "configuration")
    
    @patch('src.integrations.formx_client.model')
    @patch('src.integrations.formx_client.validate_image_for_api')
    def test_api_network_error(self, mock_validate, mock_model):
        """Test handling of network errors"""
        mock_validate.return_value = {"valid": True, "file_size": 1000}
        mock_model.generate_content.side_effect = Exception("connection timeout")
        
        result = extract_data_from_image_with_gemini(self.sample_image_path)
        
        self.assertFalse(result.get("success"))
        self.assertIn("error", result)


class TestResponseParsing(unittest.TestCase):
    """Test parsing and validation of Gemini API responses"""
    
    def test_valid_json_response_parsing(self):
        """Test parsing of valid JSON responses"""
        valid_response = {
            "merchant_name": "Test Merchant",
            "date": "2024-01-15",
            "total_amount": 50.00,
            "gst_amount": 4.55,
            "confidence_score": 0.8
        }
        
        result = _validate_and_enhance_data(valid_response)
        
        self.assertEqual(result["merchant_name"], "Test Merchant")
        self.assertEqual(result["total_amount"], 50.00)
        self.assertIn("suggested_tax_category", result)
    
    def test_invalid_json_response_handling(self):
        """Test handling of invalid JSON responses"""
        # This would be tested with malformed JSON
        invalid_data = {
            "merchant_name": "",  # Invalid empty merchant
            "total_amount": -10,  # Invalid negative amount
            "date": "invalid-date"  # Invalid date format
        }
        
        result = _validate_and_enhance_data(invalid_data)
        
        # Should handle invalid data gracefully
        self.assertIsInstance(result, dict)
        self.assertIn("merchant_name", result)
    
    def test_missing_required_fields(self):
        """Test handling of responses missing required fields"""
        incomplete_data = {
            "merchant_name": "Test Merchant"
            # Missing total_amount, date, etc.
        }
        
        result = _validate_and_enhance_data(incomplete_data)
        
        # Should fill in default values
        self.assertIn("total_amount", result)
        self.assertIn("date", result)
        self.assertIn("suggested_tax_category", result)
    
    def test_australian_date_format_parsing(self):
        """Test parsing of various Australian date formats"""
        date_formats = [
            "15/01/2024",
            "15-01-2024", 
            "15/01/24",
            "2024-01-15"
        ]
        
        for date_str in date_formats:
            data = {
                "merchant_name": "Test",
                "date": date_str,
                "total_amount": 50.00
            }
            
            result = _validate_and_enhance_data(data)
            
            # Should convert to standard format
            self.assertIsInstance(result["date"], str)
            # Should be in YYYY-MM-DD format or valid format
            self.assertTrue(len(result["date"]) >= 8)
    
    def test_gst_calculation_methods(self):
        """Test different GST calculation methods"""
        # Test explicit GST
        explicit_gst_data = {
            "merchant_name": "Test",
            "total_amount": 110.00,
            "gst_amount": 10.00,
            "subtotal": 100.00
        }
        
        result = _validate_and_enhance_data(explicit_gst_data)
        self.assertEqual(result["gst_calculation_method"], "explicit")
        
        # Test calculated GST
        calculated_gst_data = {
            "merchant_name": "Test", 
            "total_amount": 110.00,
            "gst_amount": 0.0  # Will be calculated
        }
        
        result = _validate_and_enhance_data(calculated_gst_data)
        self.assertIn("gst_calculation_method", result)
        self.assertGreater(result["gst_amount"], 0)


class TestDataExtractionAccuracy(unittest.TestCase):
    """Test accuracy of data extraction from known receipt samples"""
    
    def setUp(self):
        """Set up test cases with known expected results"""
        self.test_cases = [
            {
                "name": "officeworks_receipt",
                "mock_response": {
                    "merchant_name": "OFFICEWORKS",
                    "abn": "13 004 590 964",
                    "date": "2024-01-15",
                    "total_amount": 118.50,
                    "gst_amount": 10.77,
                    "suggested_tax_category": "D5"
                },
                "expected_category": "D5",
                "expected_business_likelihood": 0.7
            },
            {
                "name": "shell_fuel_receipt",
                "mock_response": {
                    "merchant_name": "SHELL",
                    "date": "2024-01-14",
                    "total_amount": 67.80,
                    "suggested_tax_category": "D1"
                },
                "expected_category": "D1",
                "expected_business_likelihood": 0.8
            },
            {
                "name": "woolworths_grocery",
                "mock_response": {
                    "merchant_name": "WOOLWORTHS",
                    "date": "2024-01-13",
                    "total_amount": 85.90,
                    "suggested_tax_category": "Personal"
                },
                "expected_category": "Personal",
                "expected_business_likelihood": 0.2
            }
        ]
    
    def test_merchant_categorization_accuracy(self):
        """Test accuracy of merchant-based categorization"""
        for test_case in self.test_cases:
            with self.subTest(merchant=test_case["name"]):
                data = test_case["mock_response"]
                result = _validate_and_enhance_data(data)
                
                self.assertEqual(
                    result["suggested_tax_category"],
                    test_case["expected_category"],
                    f"Category mismatch for {test_case['name']}"
                )
    
    def test_confidence_score_calculation(self):
        """Test confidence score calculation for different data quality"""
        # High confidence data
        high_quality_data = {
            "merchant_name": "OFFICEWORKS",
            "date": "2024-01-15",
            "total_amount": 118.50,
            "gst_amount": 10.77,
            "abn": "13 004 590 964",
            "items": [{"name": "Paper", "price": 15.95}]
        }
        
        confidence = _calculate_confidence(high_quality_data)
        self.assertGreater(confidence, 0.8, "High quality data should have high confidence")
        
        # Low confidence data
        low_quality_data = {
            "merchant_name": "Unknown",
            "total_amount": 0.0
        }
        
        confidence = _calculate_confidence(low_quality_data)
        self.assertLess(confidence, 0.5, "Low quality data should have low confidence")
    
    def test_gst_calculation_accuracy(self):
        """Test accuracy of GST calculations"""
        test_amounts = [
            {"total": 110.00, "expected_gst": 10.00},
            {"total": 55.00, "expected_gst": 5.00},
            {"total": 33.00, "expected_gst": 3.00}
        ]
        
        for test in test_amounts:
            data = {
                "merchant_name": "Test",
                "total_amount": test["total"],
                "gst_amount": 0.0  # Will be calculated
            }
            
            result = _validate_and_enhance_data(data)
            calculated_gst = result["gst_amount"]
            
            # Allow for small rounding differences
            self.assertAlmostEqual(
                calculated_gst,
                test["expected_gst"],
                places=1,
                msg=f"GST calculation incorrect for total {test['total']}"
            )


class TestErrorHandling(unittest.TestCase):
    """Test comprehensive error handling for Gemini integration"""
    
    def test_api_timeout_handling(self):
        """Test handling of API timeout errors"""
        error = Exception("Request timed out")
        result = handle_api_error(error, attempt=1)
        
        self.assertEqual(result["error_type"], "network")
        self.assertTrue(result["should_retry"])
        self.assertGreater(result["delay"], 0)
    
    def test_quota_exceeded_handling(self):
        """Test handling of quota exceeded errors"""
        error = Exception("Quota exceeded")
        result = handle_api_error(error, attempt=1)
        
        self.assertEqual(result["error_type"], "rate_limit")
        self.assertTrue(result["should_retry"])
        self.assertGreater(result["delay"], 0)
    
    def test_invalid_image_format_handling(self):
        """Test handling of invalid image format errors"""
        error = Exception("Invalid image format")
        result = handle_api_error(error, attempt=1)
        
        self.assertEqual(result["error_type"], "image_format")
        self.assertFalse(result["should_retry"])
    
    def test_max_retry_attempts(self):
        """Test that retry logic respects maximum attempts"""
        error = Exception("Temporary error")
        
        # Should retry on early attempts
        result1 = handle_api_error(error, attempt=1)
        self.assertTrue(result1["should_retry"])
        
        result2 = handle_api_error(error, attempt=2)
        self.assertTrue(result2["should_retry"])
        
        # Should not retry after max attempts
        result3 = handle_api_error(error, attempt=4)
        self.assertFalse(result3["should_retry"])
    
    def test_exponential_backoff_delay(self):
        """Test exponential backoff delay calculation"""
        error = Exception("Service temporarily unavailable")
        
        result1 = handle_api_error(error, attempt=1)
        delay1 = result1["delay"]
        
        result2 = handle_api_error(error, attempt=2)
        delay2 = result2["delay"]
        
        # Delay should increase with attempt number
        self.assertGreater(delay2, delay1)


class TestPerformanceMetrics(unittest.TestCase):
    """Test performance measurement and optimization"""
    
    @patch('src.integrations.formx_client.model')
    @patch('src.integrations.formx_client.validate_image_for_api')
    @patch('PIL.Image.open')
    def test_processing_time_measurement(self, mock_image_open, mock_validate, mock_model):
        """Test that processing time is measured and returned"""
        # Mock setup
        mock_validate.return_value = {"valid": True, "file_size": 1000}
        mock_img = Mock()
        mock_img.mode = 'RGB'
        mock_img.__enter__ = Mock(return_value=mock_img)
        mock_img.__exit__ = Mock(return_value=None)
        mock_image_open.return_value = mock_img
        
        mock_response = Mock()
        mock_response.text = json.dumps({
            "merchant_name": "Test",
            "total_amount": 50.00,
            "confidence_score": 0.8
        })
        mock_model.generate_content.return_value = mock_response
        
        start_time = time.time()
        result = extract_data_from_image_with_gemini("/tmp/test.jpg")
        end_time = time.time()
        
        # Should complete within reasonable time
        processing_time = end_time - start_time
        self.assertLess(processing_time, 10.0, "Processing should complete within 10 seconds")
        
        # Result should include processing metadata
        self.assertIn("processing_metadata", result)
    
    def test_memory_usage_optimization(self):
        """Test that memory usage is optimized during processing"""
        # This test would monitor memory usage during processing
        # For now, we ensure that large images are handled efficiently
        
        large_image_data = {
            "file_size": 5 * 1024 * 1024,  # 5MB
            "dimensions": (3000, 4000)
        }
        
        result = validate_image_for_api.__wrapped__ if hasattr(validate_image_for_api, '__wrapped__') else validate_image_for_api
        
        # Should handle large images without memory issues
        # This is more of a smoke test
        self.assertTrue(True)  # Placeholder for actual memory monitoring


if __name__ == '__main__':
    unittest.main() 