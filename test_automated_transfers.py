#!/usr/bin/env python3
"""
Test Script for TAAXDOG Automated Transfer Engine

This script demonstrates and tests the automated transfer engine functionality,
including transfer rule creation, income detection, and transfer execution.
"""

import sys
import os
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Any

# Add project paths
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'backend'))

def test_automated_transfer_engine():
    """
    Comprehensive test of the automated transfer engine.
    
    Tests:
    1. Transfer rule creation
    2. Income analysis
    3. Transfer recommendations
    4. Transfer execution
    5. Transfer history
    """
    
    # Configuration
    BASE_URL = "http://localhost:5000"
    USER_ID = "test-user-123"
    HEADERS = {
        "Content-Type": "application/json",
        "X-User-ID": USER_ID
    }
    
    print("🚀 Testing TAAXDOG Automated Transfer Engine")
    print("=" * 50)
    
    # Test data
    test_account_id = "basiq-account-test-123"
    test_goal_id = "goal-test-456"
    test_subaccount_id = "subaccount-test-789"
    
    # Test 1: Income Analysis
    print("\n📊 Test 1: Income Analysis")
    try:
        response = requests.get(
            f"{BASE_URL}/api/automated-transfers/income-analysis/{test_account_id}",
            headers=HEADERS,
            params={"days": 90}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                income_data = data.get('data', {})
                print(f"✅ Income analysis successful")
                print(f"   Monthly income: ${income_data.get('total_monthly_income', 0):.2f}")
                print(f"   Confidence: {income_data.get('confidence_level', 0) * 100:.1f}%")
                print(f"   Patterns found: {len(income_data.get('income_patterns', []))}")
            else:
                print(f"⚠️ Income analysis returned error: {data.get('error')}")
        else:
            print(f"❌ Income analysis failed: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ Income analysis error: {str(e)}")
    
    # Test 2: Transfer Recommendations
    print("\n💡 Test 2: Transfer Recommendations")
    try:
        response = requests.get(
            f"{BASE_URL}/api/automated-transfers/transfer-recommendations/{test_account_id}",
            headers=HEADERS,
            params={"target_percentage": 20}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                rec_data = data.get('data', {})
                print(f"✅ Transfer recommendations successful")
                print(f"   Recommended monthly: ${rec_data.get('recommended_monthly_amount', 0):.2f}")
                print(f"   Available surplus: ${rec_data.get('available_surplus', 0):.2f}")
                print(f"   Frequency options: {len(rec_data.get('frequency_options', []))}")
            else:
                print(f"⚠️ Recommendations returned error: {data.get('error')}")
        else:
            print(f"❌ Recommendations failed: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ Recommendations error: {str(e)}")
    
    # Test 3: Create Transfer Rule
    print("\n📝 Test 3: Create Transfer Rule")
    transfer_rule_data = {
        "goal_id": test_goal_id,
        "source_account_id": test_account_id,
        "target_subaccount_id": test_subaccount_id,
        "transfer_type": "fixed_amount",
        "amount": 100.0,
        "frequency": "monthly",
        "start_date": datetime.now().isoformat(),
        "income_detection_enabled": True,
        "minimum_income_threshold": 500.0,
        "maximum_transfer_per_period": 1000.0
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/automated-transfers/rules",
            headers=HEADERS,
            json=transfer_rule_data
        )
        
        if response.status_code == 201:
            data = response.json()
            if data.get('success'):
                rule_data = data.get('data', {})
                rule_id = rule_data.get('id')
                print(f"✅ Transfer rule created successfully")
                print(f"   Rule ID: {rule_id}")
                print(f"   Amount: ${rule_data.get('amount', 0)}")
                print(f"   Frequency: {rule_data.get('frequency')}")
                
                # Store rule ID for later tests
                test_rule_id = rule_id
                
            else:
                print(f"⚠️ Rule creation returned error: {data.get('error')}")
                test_rule_id = None
        else:
            print(f"❌ Rule creation failed: HTTP {response.status_code}")
            test_rule_id = None
            
    except Exception as e:
        print(f"❌ Rule creation error: {str(e)}")
        test_rule_id = None
    
    # Test 4: Get Transfer Rules
    print("\n📋 Test 4: Get Transfer Rules")
    try:
        response = requests.get(
            f"{BASE_URL}/api/automated-transfers/rules",
            headers=HEADERS
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                rules = data.get('data', [])
                print(f"✅ Retrieved {len(rules)} transfer rules")
                for rule in rules[:3]:  # Show first 3 rules
                    print(f"   Rule: {rule.get('id')} - ${rule.get('amount')} {rule.get('frequency')}")
            else:
                print(f"⚠️ Get rules returned error: {data.get('error')}")
        else:
            print(f"❌ Get rules failed: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ Get rules error: {str(e)}")
    
    # Test 5: Manual Transfer Execution
    print("\n⚡ Test 5: Manual Transfer Execution")
    try:
        response = requests.post(
            f"{BASE_URL}/api/automated-transfers/execute",
            headers=HEADERS,
            params={"limit": 10}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                exec_data = data.get('data', {})
                print(f"✅ Transfer execution completed")
                print(f"   Processed: {exec_data.get('total_processed', 0)}")
                print(f"   Successful: {exec_data.get('successful', 0)}")
                print(f"   Failed: {exec_data.get('failed', 0)}")
            else:
                print(f"⚠️ Execution returned error: {data.get('error')}")
        else:
            print(f"❌ Execution failed: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ Execution error: {str(e)}")
    
    # Test 6: Transfer History
    print("\n📚 Test 6: Transfer History")
    try:
        response = requests.get(
            f"{BASE_URL}/api/automated-transfers/history",
            headers=HEADERS,
            params={"limit": 10}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                transfers = data.get('data', [])
                print(f"✅ Retrieved {len(transfers)} transfer records")
                for transfer in transfers[:3]:  # Show first 3 transfers
                    status = transfer.get('status')
                    amount = transfer.get('amount', 0)
                    date = transfer.get('scheduled_date', '')[:10]
                    print(f"   Transfer: ${amount:.2f} on {date} - {status}")
            else:
                print(f"⚠️ History returned error: {data.get('error')}")
        else:
            print(f"❌ History failed: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ History error: {str(e)}")
    
    # Test 7: Transfer Statistics
    print("\n📈 Test 7: Transfer Statistics")
    try:
        response = requests.get(
            f"{BASE_URL}/api/automated-transfers/statistics",
            headers=HEADERS,
            params={"period_days": 30}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                stats = data.get('data', {})
                print(f"✅ Transfer statistics retrieved")
                print(f"   Total transfers: {stats.get('total_transfers', 0)}")
                print(f"   Success rate: {stats.get('success_rate', 0):.1f}%")
                print(f"   Total amount: ${stats.get('total_amount_transferred', 0):.2f}")
                print(f"   Average amount: ${stats.get('average_transfer_amount', 0):.2f}")
            else:
                print(f"⚠️ Statistics returned error: {data.get('error')}")
        else:
            print(f"❌ Statistics failed: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"❌ Statistics error: {str(e)}")
    
    # Test 8: Update Transfer Rule (if we created one)
    if test_rule_id:
        print(f"\n✏️ Test 8: Update Transfer Rule")
        update_data = {
            "amount": 150.0,
            "frequency": "bi_weekly"
        }
        
        try:
            response = requests.put(
                f"{BASE_URL}/api/automated-transfers/rules/{test_rule_id}",
                headers=HEADERS,
                json=update_data
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    print(f"✅ Transfer rule updated successfully")
                else:
                    print(f"⚠️ Rule update returned error: {data.get('error')}")
            else:
                print(f"❌ Rule update failed: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ Rule update error: {str(e)}")
    
    print("\n" + "=" * 50)
    print("🎉 Automated Transfer Engine Testing Complete!")
    print("\nNext Steps:")
    print("1. ✅ Start the Flask server: python backend/app.py")
    print("2. ✅ Create a goal and subaccount through the frontend")
    print("3. ✅ Set up your first automated transfer rule")
    print("4. ✅ Monitor transfers in the transfer history")


def test_backend_services():
    """Test backend services directly (without HTTP requests)."""
    
    print("\n🔧 Testing Backend Services Directly")
    print("-" * 40)
    
    try:
        # Test transfer engine import
        from backend.services.transfer_engine import TransferEngine, TransferType, TransferFrequency
        print("✅ Transfer engine import successful")
        
        # Test income detector import
        from backend.services.income_detector import IncomeDetector, IncomeType
        print("✅ Income detector import successful")
        
        # Test transfer processor import
        from backend.jobs.transfer_processor import TransferProcessor
        print("✅ Transfer processor import successful")
        
        # Create instances
        transfer_engine = TransferEngine()
        income_detector = IncomeDetector()
        processor = TransferProcessor()
        
        print("✅ All services initialized successfully")
        
        # Test enum values
        print(f"✅ Transfer types: {[t.value for t in TransferType]}")
        print(f"✅ Transfer frequencies: {[f.value for f in TransferFrequency]}")
        print(f"✅ Income types: {[i.value for i in IncomeType]}")
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
    except Exception as e:
        print(f"❌ Service test error: {e}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Test TAAXDOG Automated Transfer Engine')
    parser.add_argument('--backend-only', action='store_true', 
                       help='Test only backend services (no HTTP requests)')
    parser.add_argument('--server-url', default='http://localhost:5000',
                       help='Server URL for API tests')
    
    args = parser.parse_args()
    
    if args.backend_only:
        test_backend_services()
    else:
        print(f"Testing against server: {args.server_url}")
        test_automated_transfer_engine()
    
    print("\n📖 For detailed documentation, see: AUTOMATED_TRANSFER_ENGINE_SUMMARY.md") 