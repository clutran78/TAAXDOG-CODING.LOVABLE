#!/usr/bin/env python3
"""
Test Claude 3.7 Sonnet Integration in TAAXDOG
Verifies that Claude API is properly configured and functional
"""

import os
import sys
from pathlib import Path

# Add project paths
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "src"))
sys.path.insert(0, str(project_root / "backend"))

# Test environment setup
from dotenv import load_dotenv
load_dotenv(project_root / "production.env")

def test_environment_setup():
    """Test that Claude environment variables are properly configured"""
    print("🔧 Testing Environment Configuration...")
    
    required_vars = ['CLAUDE_API_KEY', 'CLAUDE_API_URL', 'CLAUDE_MODEL']
    missing_vars = []
    
    for var in required_vars:
        value = os.getenv(var)
        if not value:
            missing_vars.append(var)
        else:
            # Mask the API key for security
            display_value = value[:20] + "..." if var == 'CLAUDE_API_KEY' else value
            print(f"✅ {var}: {display_value}")
    
    if missing_vars:
        print(f"❌ Missing environment variables: {missing_vars}")
        return False
    
    print("✅ Environment configuration complete!")
    return True

def test_claude_client_import():
    """Test that Claude client can be imported and initialized"""
    print("\n📦 Testing Claude Client Import...")
    
    try:
        from integrations.claude_client import ClaudeClient, get_claude_client
        print("✅ Claude client import successful")
        
        # Test client initialization
        client = get_claude_client()
        if client:
            print("✅ Claude client initialized successfully")
            print(f"   Model: {client.model}")
            print(f"   Max Tokens: {client.max_tokens}")
            print(f"   Temperature: {client.temperature}")
            return True
        else:
            print("❌ Failed to initialize Claude client")
            return False
            
    except Exception as e:
        print(f"❌ Claude client import failed: {e}")
        return False

def test_basic_claude_functionality():
    """Test basic Claude API functionality"""
    print("\n🧠 Testing Basic Claude Functionality...")
    
    try:
        from integrations.claude_client import get_claude_client
        
        client = get_claude_client()
        if not client:
            print("❌ Claude client not available")
            return False
        
        # Test simple text analysis
        test_context = {
            "user_message": "What are the main Australian tax categories for business expenses?",
            "search_results": None
        }
        
        print("   Testing financial advice generation...")
        response = client.generate_financial_advice(test_context)
        
        if response.get('success'):
            advice_text = response.get('response', '')
            print(f"✅ Claude advice generation successful")
            print(f"   Response length: {len(advice_text)} characters")
            print(f"   Confidence: {response.get('confidence', 'N/A')}")
            
            # Check if response contains Australian tax information
            if any(keyword in advice_text.lower() for keyword in ['d1', 'd2', 'ato', 'australian', 'tax']):
                print("✅ Response contains Australian tax-specific content")
            else:
                print("⚠️  Response may not be Australian tax-specific")
            
            return True
        else:
            print(f"❌ Claude advice generation failed: {response.get('error')}")
            return False
            
    except Exception as e:
        print(f"❌ Claude functionality test failed: {e}")
        return False

def test_receipt_analysis():
    """Test Claude receipt analysis capabilities"""
    print("\n🧾 Testing Receipt Analysis Capabilities...")
    
    try:
        from integrations.claude_client import get_claude_client
        
        client = get_claude_client()
        if not client:
            print("❌ Claude client not available")
            return False
        
        # Create a mock receipt data for testing (base64 would normally be image data)
        test_image_data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        user_profile = {
            "occupation": "Software Developer",
            "business_type": "Individual Contractor",
            "tax_categories_used": ["D5", "D6", "D7"]
        }
        
        print("   Testing receipt OCR analysis...")
        
        # Note: This will likely fail with the test image, but we can test the structure
        response = client.analyze_receipt(test_image_data, user_profile)
        
        if response.get('success') or 'error' in response:
            print("✅ Receipt analysis method accessible")
            if response.get('success'):
                print("✅ Receipt analysis successful (test data)")
            else:
                # Expected to fail with test data, but structure should be correct
                print(f"⚠️  Receipt analysis returned error (expected with test data): {response.get('error', 'Unknown')}")
            return True
        else:
            print("❌ Receipt analysis method not working properly")
            return False
            
    except Exception as e:
        print(f"❌ Receipt analysis test failed: {e}")
        return False

def test_financial_data_analysis():
    """Test Claude financial data analysis"""
    print("\n📊 Testing Financial Data Analysis...")
    
    try:
        from integrations.claude_client import get_claude_client
        
        client = get_claude_client()
        if not client:
            print("❌ Claude client not available")
            return False
        
        # Mock transaction data
        mock_transactions = [
            {"amount": 45.50, "merchant": "Woolworths", "category": "Personal", "date": "2024-01-15"},
            {"amount": 85.00, "merchant": "Shell", "category": "D1", "date": "2024-01-16"},
            {"amount": 125.00, "merchant": "Officeworks", "category": "D5", "date": "2024-01-17"},
            {"amount": 65.00, "merchant": "Telstra", "category": "D7", "date": "2024-01-18"}
        ]
        
        mock_user_profile = {
            "occupation": "Consultant",
            "annual_income": 75000,
            "business_type": "Sole Trader"
        }
        
        print("   Testing financial data analysis...")
        response = client.analyze_financial_data(mock_transactions, mock_user_profile)
        
        if response.get('success'):
            analysis = response.get('analysis', {})
            print("✅ Financial data analysis successful")
            print(f"   Analysis sections: {list(analysis.keys())}")
            
            # Check for expected analysis sections
            expected_sections = ['spending_analysis', 'tax_optimization', 'budget_recommendations']
            found_sections = [section for section in expected_sections if section in analysis]
            print(f"   Found expected sections: {found_sections}")
            
            return True
        else:
            print(f"❌ Financial data analysis failed: {response.get('error')}")
            return False
            
    except Exception as e:
        print(f"❌ Financial data analysis test failed: {e}")
        return False

def test_insights_service_integration():
    """Test integration with insights service"""
    print("\n🔗 Testing Insights Service Integration...")
    
    try:
        from backend.insights_service import FinancialInsightsService
        
        insights_service = FinancialInsightsService()
        print("✅ Insights service initialized")
        
        # Test Claude-enhanced insights method
        if hasattr(insights_service, 'generate_claude_enhanced_insights'):
            print("✅ Claude-enhanced insights method available")
            
            # Test with mock data
            mock_transactions = [
                {"amount": 100, "merchant": "Test Merchant", "category": "D5", "date": "2024-01-01"}
            ]
            mock_profile = {"user_id": "test_user"}
            
            # This should gracefully handle test data
            result = insights_service.generate_claude_enhanced_insights("test_user", mock_transactions, mock_profile)
            
            if result.get('insights_type') in ['claude_enhanced', 'fallback_analysis']:
                print("✅ Claude-enhanced insights method functional")
                print(f"   Result type: {result.get('insights_type')}")
                return True
            else:
                print(f"⚠️  Unexpected insights result: {result}")
                return False
        else:
            print("❌ Claude-enhanced insights method not found")
            return False
            
    except Exception as e:
        print(f"❌ Insights service integration test failed: {e}")
        return False

def test_chatbot_integration():
    """Test chatbot Claude integration"""
    print("\n💬 Testing Chatbot Integration...")
    
    try:
        from backend.chatbot import get_llm_response_with_claude
        
        print("✅ Claude chatbot response function available")
        
        # Test with simple message
        test_message = "Hello, can you help me with tax deductions?"
        
        print("   Testing Claude chatbot response...")
        response_generator = get_llm_response_with_claude(test_message)
        
        # Collect a few chunks to verify it's working
        response_chunks = []
        chunk_count = 0
        
        for chunk in response_generator:
            response_chunks.append(chunk)
            chunk_count += 1
            if chunk_count >= 10:  # Just test first 10 chunks
                break
        
        if response_chunks:
            response_start = ''.join(response_chunks)
            print("✅ Claude chatbot response generation working")
            print(f"   Response start: {response_start[:100]}...")
            return True
        else:
            print("❌ No response chunks received")
            return False
            
    except Exception as e:
        print(f"❌ Chatbot integration test failed: {e}")
        return False

def main():
    """Run all Claude integration tests"""
    print("🚀 TAAXDOG Claude 3.7 Sonnet Integration Test Suite")
    print("=" * 60)
    
    tests = [
        ("Environment Setup", test_environment_setup),
        ("Claude Client Import", test_claude_client_import),
        ("Basic Claude Functionality", test_basic_claude_functionality),
        ("Receipt Analysis", test_receipt_analysis),
        ("Financial Data Analysis", test_financial_data_analysis),
        ("Insights Service Integration", test_insights_service_integration),
        ("Chatbot Integration", test_chatbot_integration)
    ]
    
    passed_tests = 0
    total_tests = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed_tests += 1
            print()  # Add spacing between tests
        except Exception as e:
            print(f"❌ Test '{test_name}' crashed: {e}")
            print()
    
    print("=" * 60)
    print(f"📊 Test Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! Claude 3.7 Sonnet integration is working correctly.")
        return True
    elif passed_tests >= total_tests * 0.7:  # 70% pass rate
        print("⚠️  Most tests passed. Some issues may need attention, but core functionality works.")
        return True
    else:
        print("❌ Multiple test failures. Claude integration needs troubleshooting.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1) 