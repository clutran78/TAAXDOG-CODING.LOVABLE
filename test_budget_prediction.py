#!/usr/bin/env python3
"""
Test script for the Budget Prediction Module

This script tests the budget prediction functionality with sample data
to ensure the AI module is working correctly.
"""

import sys
import os
from datetime import datetime, timedelta
import json

# Add project root to path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'ai'))

try:
    from ai.budget_predictor import (
        predict_future_budget,
        analyze_spending_patterns,
        detect_budget_anomalies,
        create_budget_plan
    )
    print("✅ Successfully imported budget prediction module")
except ImportError as e:
    print(f"❌ Failed to import budget prediction module: {e}")
    sys.exit(1)


def generate_sample_transactions():
    """Generate sample transaction data for testing."""
    print("📊 Generating sample transaction data...")
    
    # Create sample transactions over the last 6 months
    transactions = []
    base_date = datetime.now() - timedelta(days=180)
    
    # Sample categories and spending patterns
    categories = {
        'Groceries': {'min': 80, 'max': 150, 'frequency': 8},
        'Restaurants': {'min': 25, 'max': 80, 'frequency': 6},
        'Transport': {'min': 15, 'max': 45, 'frequency': 10},
        'Utilities': {'min': 120, 'max': 200, 'frequency': 1},
        'Entertainment': {'min': 20, 'max': 100, 'frequency': 4},
        'Shopping': {'min': 50, 'max': 300, 'frequency': 3},
        'Healthcare': {'min': 30, 'max': 150, 'frequency': 2}
    }
    
    transaction_id = 1
    
    # Generate transactions for each month
    for month in range(6):
        month_start = base_date + timedelta(days=30 * month)
        month_end = month_start + timedelta(days=30)
        
        for category, config in categories.items():
            # Generate transactions for this category this month
            for _ in range(config['frequency']):
                # Random amount within range
                import random
                amount = random.uniform(config['min'], config['max'])
                
                # Random date within month
                days_offset = random.randint(0, 29)
                trans_date = month_start + timedelta(days=days_offset)
                
                transaction = {
                    'id': f'trans_{transaction_id}',
                    'amount': round(amount, 2),
                    'description': f'{category} purchase',
                    'postDate': trans_date.isoformat(),
                    'category': category,
                    'direction': 'debit',
                    'merchant': f'{category} Store'
                }
                
                transactions.append(transaction)
                transaction_id += 1
    
    print(f"📈 Generated {len(transactions)} sample transactions")
    return transactions


def test_spending_analysis(transactions):
    """Test the spending pattern analysis function."""
    print("\n🔍 Testing spending pattern analysis...")
    
    try:
        analysis = analyze_spending_patterns(transactions)
        
        if analysis.get('error'):
            print(f"❌ Analysis failed: {analysis['error']}")
            return False
        
        print("✅ Spending analysis completed successfully")
        
        # Print summary
        if analysis.get('summary_statistics'):
            stats = analysis['summary_statistics']
            print(f"   • Total transactions: {stats.get('total_transactions', 'N/A')}")
            print(f"   • Total amount: ${stats.get('total_amount', 0):.2f}")
            print(f"   • Average transaction: ${stats.get('average_transaction', 0):.2f}")
        
        if analysis.get('trend_analysis'):
            trend = analysis['trend_analysis']
            print(f"   • Spending trend: {trend.get('trend', 'Unknown')}")
            print(f"   • Trend description: {trend.get('description', 'N/A')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Analysis test failed with exception: {e}")
        return False


def test_budget_predictions(transactions):
    """Test the budget prediction function."""
    print("\n🔮 Testing budget predictions...")
    
    try:
        predictions = predict_future_budget(transactions, prediction_months=3)
        
        if predictions.get('error'):
            print(f"❌ Predictions failed: {predictions['error']}")
            return False
        
        print("✅ Budget predictions completed successfully")
        
        # Print summary
        if predictions.get('analysis_summary'):
            summary = predictions['analysis_summary']
            print(f"   • Analyzed {summary.get('transaction_count', 0)} transactions")
            print(f"   • Analysis period: {summary.get('analysis_period_days', 0)} days")
            print(f"   • Avg monthly spending: ${summary.get('average_monthly_spending', 0):.2f}")
        
        if predictions.get('confidence_scores'):
            confidence = predictions['confidence_scores']
            print(f"   • Overall confidence: {confidence.get('overall', 0) * 100:.1f}%")
        
        if predictions.get('predictions'):
            print("   • Monthly predictions:")
            for month, pred in predictions['predictions'].items():
                print(f"     - {month}: ${pred.get('predicted_total', 0):.2f} (confidence: {pred.get('confidence', 0) * 100:.1f}%)")
        
        return True
        
    except Exception as e:
        print(f"❌ Predictions test failed with exception: {e}")
        return False


def test_anomaly_detection(transactions):
    """Test the anomaly detection function."""
    print("\n🚨 Testing anomaly detection...")
    
    try:
        anomalies = detect_budget_anomalies(transactions)
        
        if anomalies.get('error'):
            print(f"❌ Anomaly detection failed: {anomalies['error']}")
            return False
        
        print("✅ Anomaly detection completed successfully")
        
        # Print summary
        if anomalies.get('risk_assessment'):
            risk = anomalies['risk_assessment']
            print(f"   • Risk level: {risk.get('risk_level', 'Unknown')}")
            print(f"   • Risk score: {risk.get('risk_score', 0):.2f}")
            print(f"   • Anomalies found: {risk.get('anomaly_count', 0)}")
        
        if anomalies.get('anomalies'):
            for i, anomaly in enumerate(anomalies['anomalies'][:3]):  # Show first 3
                print(f"   • Anomaly {i+1}: {anomaly.get('type', 'Unknown')} - {anomaly.get('description', 'N/A')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Anomaly detection test failed with exception: {e}")
        return False


def test_budget_plan_creation(transactions):
    """Test the budget plan creation function."""
    print("\n📋 Testing budget plan creation...")
    
    try:
        budget_plan = create_budget_plan(
            transactions, 
            target_savings=500.0, 
            income=4000.0
        )
        
        if budget_plan.get('error'):
            print(f"❌ Budget plan creation failed: {budget_plan['error']}")
            return False
        
        print("✅ Budget plan creation completed successfully")
        
        # Print summary
        if budget_plan.get('monthly_budget'):
            print(f"   • Recommended monthly budget: ${budget_plan['monthly_budget']:.2f}")
        
        if budget_plan.get('target_savings'):
            print(f"   • Target savings: ${budget_plan['target_savings']:.2f}")
        
        if budget_plan.get('recommendations'):
            print(f"   • Recommendations provided: {len(budget_plan['recommendations'])}")
        
        return True
        
    except Exception as e:
        print(f"❌ Budget plan creation test failed with exception: {e}")
        return False


def main():
    """Run all budget prediction tests."""
    print("🎯 TAAXDOG Budget Prediction Module Test Suite")
    print("=" * 50)
    
    # Generate sample data
    transactions = generate_sample_transactions()
    
    if not transactions:
        print("❌ Failed to generate sample transactions")
        return False
    
    # Run all tests
    tests = [
        ("Spending Analysis", test_spending_analysis),
        ("Budget Predictions", test_budget_predictions),
        ("Anomaly Detection", test_anomaly_detection),
        ("Budget Plan Creation", test_budget_plan_creation)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🧪 Running {test_name} test...")
        try:
            result = test_func(transactions)
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Print final results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Budget prediction module is working correctly.")
        return True
    else:
        print("⚠️ Some tests failed. Please check the implementation.")
        return False


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1) 