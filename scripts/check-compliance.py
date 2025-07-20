#!/usr/bin/env python3
"""Check Australian compliance requirements"""
import os
import re
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable is not set.")
    print("Please set the DATABASE_URL before running this script.")
    exit(1)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    print("Australian Compliance Checks")
    print("=" * 50)
    
    # Check BSB format
    print("\n1. BSB Format Validation:")
    cursor.execute("""
        SELECT bsb, COUNT(*) as count 
        FROM bank_accounts 
        WHERE bsb IS NOT NULL 
        GROUP BY bsb 
        ORDER BY count DESC
        LIMIT 5
    """)
    
    for bsb, count in cursor.fetchall():
        if re.match(r'^\d{3}-\d{3}$', bsb):
            print(f"  ✅ {bsb} ({count} accounts) - Valid format")
        else:
            print(f"  ❌ {bsb} ({count} accounts) - Invalid format (should be XXX-XXX)")
    
    # Check phone numbers
    print("\n2. Phone Number Format:")
    cursor.execute("""
        SELECT phone, COUNT(*) as count 
        FROM users 
        WHERE phone IS NOT NULL 
        GROUP BY phone 
        ORDER BY count DESC
        LIMIT 5
    """)
    
    for phone, count in cursor.fetchall():
        if re.match(r'^\+61[0-9]{9}$', phone):
            print(f"  ✅ {phone} ({count} users) - Valid Australian format")
        else:
            print(f"  ❌ {phone} ({count} users) - Invalid format (should be +61XXXXXXXXX)")
    
    # Check GST calculations
    print("\n3. GST Calculation Check (10%):")
    cursor.execute("""
        SELECT 
            id,
            total_amount,
            gst_amount,
            ROUND(total_amount::numeric / 11, 2) as expected_gst,
            ABS(gst_amount - ROUND(total_amount::numeric / 11, 2)) as difference
        FROM receipts 
        WHERE total_amount > 0 AND gst_amount > 0
        ORDER BY difference DESC
        LIMIT 5
    """)
    
    results = cursor.fetchall()
    for receipt_id, total, gst, expected, diff in results:
        if diff <= 0.01:  # 1 cent tolerance
            print(f"  ✅ Receipt {receipt_id}: Total=${total}, GST=${gst} - Accurate")
        else:
            print(f"  ❌ Receipt {receipt_id}: Total=${total}, GST=${gst}, Expected=${expected} (diff=${diff})")
    
    # Check tax categories
    print("\n4. ATO Tax Categories:")
    valid_categories = [
        'INCOME', 'BUSINESS_EXPENSE', 'PERSONAL', 'INVESTMENT',
        'GST_PAYABLE', 'GST_RECEIVABLE', 'CAPITAL', 'DEPRECIATION',
        'DEDUCTIBLE', 'NON_DEDUCTIBLE', 'UNCATEGORIZED'
    ]
    
    cursor.execute("""
        SELECT tax_category, COUNT(*) as count 
        FROM bank_transactions 
        WHERE tax_category IS NOT NULL
        GROUP BY tax_category 
        ORDER BY count DESC
        LIMIT 10
    """)
    
    for category, count in cursor.fetchall():
        if category in valid_categories:
            print(f"  ✅ {category}: {count} transactions")
        else:
            print(f"  ❌ {category}: {count} transactions - Not a valid ATO category")
    
    # Check currency precision
    print("\n5. Currency Precision (2 decimal places):")
    
    # Check transactions
    cursor.execute("""
        SELECT COUNT(*) 
        FROM bank_transactions 
        WHERE amount::numeric % 0.01 != 0
    """)
    invalid_trans = cursor.fetchone()[0]
    
    # Check receipts
    cursor.execute("""
        SELECT COUNT(*) 
        FROM receipts 
        WHERE total_amount::numeric % 0.01 != 0
    """)
    invalid_receipts = cursor.fetchone()[0]
    
    # Check budgets
    cursor.execute("""
        SELECT COUNT(*) 
        FROM budgets 
        WHERE monthly_budget::numeric % 0.01 != 0
    """)
    invalid_budgets = cursor.fetchone()[0]
    
    print(f"  Transactions: {'✅ All valid' if invalid_trans == 0 else f'❌ {invalid_trans} invalid'}")
    print(f"  Receipts: {'✅ All valid' if invalid_receipts == 0 else f'❌ {invalid_receipts} invalid'}")
    print(f"  Budgets: {'✅ All valid' if invalid_budgets == 0 else f'❌ {invalid_budgets} invalid'}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")