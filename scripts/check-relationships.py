#!/usr/bin/env python3
"""Check relationships between tables"""
import os
import psycopg2

DATABASE_URL = os.environ.get('DATABASE_URL', 
    'postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require'
)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Get first user
    cursor.execute("SELECT id, email FROM users LIMIT 1")
    user = cursor.fetchone()
    
    if user:
        user_id, email = user
        print(f"Checking relationships for user: {email}")
        print("-" * 50)
        
        # Check bank accounts
        cursor.execute("SELECT COUNT(*) FROM bank_accounts WHERE user_id = %s", (user_id,))
        bank_accounts = cursor.fetchone()[0]
        print(f"User {email} has {bank_accounts} bank accounts")
        
        # Check transactions
        cursor.execute("SELECT COUNT(*) FROM bank_transactions WHERE user_id = %s", (user_id,))
        transactions = cursor.fetchone()[0]
        print(f"User {email} has {transactions} transactions")
        
        # Check receipts
        cursor.execute("SELECT COUNT(*) FROM receipts WHERE user_id = %s", (user_id,))
        receipts = cursor.fetchone()[0]
        print(f"User {email} has {receipts} receipts")
        
        # Check budgets
        cursor.execute("SELECT COUNT(*) FROM budgets WHERE user_id = %s", (user_id,))
        budgets = cursor.fetchone()[0]
        print(f"User {email} has {budgets} budgets")
        
        # Check if bank accounts have transactions
        if bank_accounts > 0:
            cursor.execute("""
                SELECT ba.account_name, COUNT(bt.id) as transaction_count
                FROM bank_accounts ba
                LEFT JOIN bank_transactions bt ON ba.id = bt.bank_account_id
                WHERE ba.user_id = %s
                GROUP BY ba.id, ba.account_name
                LIMIT 5
            """, (user_id,))
            
            print("\nBank Account Transaction Counts:")
            for account_name, trans_count in cursor.fetchall():
                print(f"  - {account_name}: {trans_count} transactions")
    else:
        print("No users found in database")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")