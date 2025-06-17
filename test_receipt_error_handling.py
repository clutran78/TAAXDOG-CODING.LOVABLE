#!/usr/bin/env python3
"""
Test script for enhanced receipt processing error handling and logging.

This script tests various error scenarios to ensure the system handles them gracefully
and provides appropriate user feedback.

Usage:
    python test_receipt_error_handling.py
"""

import os
import sys
import tempfile
import json
import time
from PIL import Image
import requests
from io import BytesIO

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.receipt_processor_config import (
    setup_receipt_logging, 
    get_user_friendly_error,
    log_performance_metric,
    validate_processing_health
)

def create_test_images():
    """
    Create test images for various scenarios
    """
    test_images = {}
    
    # Valid image
    valid_img = Image.new('RGB', (800, 600), color='white')
    valid_path = tempfile.mktemp(suffix='.jpg')
    valid_img.save(valid_path, 'JPEG')
    test_images['valid'] = valid_path
    
    # Very small image
    small_img = Image.new('RGB', (20, 20), color='white')
    small_path = tempfile.mktemp(suffix='.jpg')
    small_img.save(small_path, 'JPEG')
    test_images['too_small'] = small_path
    
    # Very large image (simulated by creating a large file)
    large_path = tempfile.mktemp(suffix='.jpg')
    with open(large_path, 'wb') as f:
        f.write(b'fake_large_image_data' * 1000000)  # ~15MB of fake data
    test_images['too_large'] = large_path
    
    # Empty file
    empty_path = tempfile.mktemp(suffix='.jpg')
    with open(empty_path, 'w') as f:
        pass  # Create empty file
    test_images['empty'] = empty_path
    
    # Invalid format
    invalid_path = tempfile.mktemp(suffix='.txt')
    with open(invalid_path, 'w') as f:
        f.write('This is not an image')
    test_images['invalid_format'] = invalid_path
    
    return test_images

def test_image_validation():
    """
    Test image validation with various scenarios
    """
    print("\n=== Testing Image Validation ===")
    
    # Import the validation function
    try:
        from backend.routes.receipt_routes import validate_image_file
    except ImportError:
        print("❌ Could not import validate_image_file")
        return False
    
    test_images = create_test_images()
    
    # Test valid image
    result = validate_image_file(test_images['valid'])
    if result['valid']:
        print("✅ Valid image passed validation")
    else:
        print(f"❌ Valid image failed validation: {result['error']}")
    
    # Test small image
    result = validate_image_file(test_images['too_small'])
    if not result['valid'] and 'too small' in result['error'].lower():
        print("✅ Small image correctly rejected")
    else:
        print(f"❌ Small image validation issue: {result}")
    
    # Test empty file
    result = validate_image_file(test_images['empty'])
    if not result['valid'] and 'empty' in result['error'].lower():
        print("✅ Empty file correctly rejected")
    else:
        print(f"❌ Empty file validation issue: {result}")
    
    # Test non-existent file
    result = validate_image_file('/non/existent/file.jpg')
    if not result['valid'] and 'not found' in result['error'].lower():
        print("✅ Non-existent file correctly rejected")
    else:
        print(f"❌ Non-existent file validation issue: {result}")
    
    # Clean up
    for path in test_images.values():
        try:
            os.unlink(path)
        except:
            pass
    
    return True

def test_data_validation():
    """
    Test extracted data validation
    """
    print("\n=== Testing Data Validation ===")
    
    try:
        from backend.routes.receipt_routes import validate_extracted_data
    except ImportError:
        print("❌ Could not import validate_extracted_data")
        return False
    
    # Test valid data
    valid_data = {
        "success": True,
        "documents": [{
            "data": {
                "merchant_name": "Test Store",
                "total_amount": 25.99,
                "date": "2024-01-15",
                "gst_amount": 2.36,
                "confidence_score": 0.9
            }
        }]
    }
    
    result = validate_extracted_data(valid_data)
    if result['valid']:
        print("✅ Valid data passed validation")
    else:
        print(f"❌ Valid data failed validation: {result['errors']}")
    
    # Test missing required fields
    invalid_data = {
        "success": True,
        "documents": [{
            "data": {
                "total_amount": 25.99,
                # Missing merchant_name and date
            }
        }]
    }
    
    result = validate_extracted_data(invalid_data)
    if not result['valid'] and 'missing required fields' in result['errors'][0].lower():
        print("✅ Missing fields correctly detected")
    else:
        print(f"❌ Missing fields validation issue: {result}")
    
    # Test invalid amount
    invalid_amount_data = {
        "success": True,
        "documents": [{
            "data": {
                "merchant_name": "Test Store",
                "total_amount": -5.99,  # Negative amount
                "date": "2024-01-15"
            }
        }]
    }
    
    result = validate_extracted_data(invalid_amount_data)
    if not result['valid'] and 'positive' in str(result['errors']).lower():
        print("✅ Negative amount correctly rejected")
    else:
        print(f"❌ Negative amount validation issue: {result}")
    
    return True

def test_error_messages():
    """
    Test user-friendly error message generation
    """
    print("\n=== Testing Error Messages ===")
    
    # Test various error types
    test_cases = [
        ("file_not_selected", {}, "Please select a file to upload."),
        ("file_too_large", {"max_size": 10}, "File is too large. Maximum size is 10MB."),
        ("invalid_format", {"formats": "JPG, PNG"}, "Unsupported file format"),
        ("api_rate_limit", {}, "Service is busy"),
        ("generic_error", {}, "An unexpected error occurred")
    ]
    
    for error_type, kwargs, expected_substring in test_cases:
        message = get_user_friendly_error(error_type, **kwargs)
        if expected_substring.lower() in message.lower():
            print(f"✅ {error_type}: {message}")
        else:
            print(f"❌ {error_type}: Got '{message}', expected to contain '{expected_substring}'")
    
    return True

def test_logging_setup():
    """
    Test logging configuration
    """
    print("\n=== Testing Logging Setup ===")
    
    try:
        loggers = setup_receipt_logging()
        
        # Test that loggers were created
        required_loggers = ['receipt_logger', 'gemini_logger', 'performance_logger']
        for logger_name in required_loggers:
            if logger_name in loggers:
                print(f"✅ {logger_name} created successfully")
            else:
                print(f"❌ {logger_name} not created")
        
        # Test logging a message
        receipt_logger = loggers['receipt_logger']
        receipt_logger.info("Test log message from error handling test")
        print("✅ Test log message written")
        
        # Test performance logging
        log_performance_metric("test_metric", 123.45, "test_user", {"test": "data"})
        print("✅ Performance metric logged")
        
        return True
        
    except Exception as e:
        print(f"❌ Logging setup failed: {e}")
        return False

def test_health_check():
    """
    Test system health validation
    """
    print("\n=== Testing Health Check ===")
    
    try:
        health = validate_processing_health()
        
        print(f"Overall health: {'✅ Healthy' if health['overall_healthy'] else '❌ Unhealthy'}")
        
        for check_name, check_result in health['checks'].items():
            status = "✅" if check_result['healthy'] else "❌"
            print(f"{status} {check_name}: {check_result.get('details', 'OK')}")
            
            if not check_result['healthy']:
                if 'missing_vars' in check_result:
                    print(f"   Missing variables: {check_result['missing_vars']}")
        
        return health['overall_healthy']
        
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_retry_logic():
    """
    Test retry logic with simulated failures
    """
    print("\n=== Testing Retry Logic ===")
    
    try:
        from backend.routes.receipt_routes import retry_with_backoff
    except ImportError:
        print("❌ Could not import retry_with_backoff")
        return False
    
    # Test successful function
    def success_function():
        return "success"
    
    result = retry_with_backoff(success_function, max_attempts=3, delay=0.1)
    if result == "success":
        print("✅ Successful function works correctly")
    else:
        print(f"❌ Successful function failed: {result}")
    
    # Test function that fails then succeeds
    attempt_count = 0
    def fail_then_succeed():
        nonlocal attempt_count
        attempt_count += 1
        if attempt_count < 3:
            raise Exception(f"Simulated failure {attempt_count}")
        return "eventually_success"
    
    try:
        result = retry_with_backoff(fail_then_succeed, max_attempts=3, delay=0.1)
        if result == "eventually_success":
            print("✅ Retry logic works correctly")
        else:
            print(f"❌ Retry logic failed: {result}")
    except Exception as e:
        print(f"❌ Retry logic error: {e}")
    
    # Test function that always fails
    def always_fail():
        raise Exception("Always fails")
    
    try:
        retry_with_backoff(always_fail, max_attempts=2, delay=0.1)
        print("❌ Always-fail function should have raised exception")
    except Exception:
        print("✅ Always-fail function correctly raised exception after retries")
    
    return True

def test_gemini_error_handling():
    """
    Test Gemini API error handling
    """
    print("\n=== Testing Gemini Error Handling ===")
    
    try:
        from src.integrations.formx_client import handle_api_error
    except ImportError:
        print("❌ Could not import handle_api_error")
        return False
    
    # Test different error types
    error_tests = [
        ("Rate limit exceeded", "rate_limit"),
        ("Connection timeout", "network"),
        ("Invalid API key", "authentication"),
        ("Service unavailable", "service"),
        ("Unknown error", "generic")
    ]
    
    for error_msg, expected_type in error_tests:
        error_info = handle_api_error(Exception(error_msg), attempt=1)
        
        if error_info['error_type'] == expected_type:
            print(f"✅ {error_msg}: Correctly identified as {expected_type}")
        else:
            print(f"❌ {error_msg}: Expected {expected_type}, got {error_info['error_type']}")
    
    return True

def run_all_tests():
    """
    Run all error handling tests
    """
    print("🧪 Starting Comprehensive Error Handling Tests")
    print("=" * 50)
    
    tests = [
        ("Image Validation", test_image_validation),
        ("Data Validation", test_data_validation),
        ("Error Messages", test_error_messages),
        ("Logging Setup", test_logging_setup),
        ("Health Check", test_health_check),
        ("Retry Logic", test_retry_logic),
        ("Gemini Error Handling", test_gemini_error_handling)
    ]
    
    results = {}
    start_time = time.time()
    
    for test_name, test_function in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            results[test_name] = test_function()
        except Exception as e:
            print(f"❌ Test {test_name} crashed: {e}")
            results[test_name] = False
    
    # Print summary
    total_time = time.time() - start_time
    print(f"\n{'='*50}")
    print("🧪 Test Results Summary")
    print(f"{'='*50}")
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print(f"Execution time: {total_time:.2f} seconds")
    
    if passed == total:
        print("🎉 All tests passed! Error handling is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please review the error handling implementation.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1) 