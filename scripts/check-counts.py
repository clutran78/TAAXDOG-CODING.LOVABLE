#!/usr/bin/env python3
"""Quick record count check"""
import os
import psycopg2

# Get database URL from environment
DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable is not set.")
    print("Please set the DATABASE_URL before running this script.")
    exit(1)

try:
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Check counts for each table
    tables = [
        ('users', 'Users'),
        ('bank_accounts', 'Bank Accounts'),
        ('bank_transactions', 'Transactions'),
        ('receipts', 'Receipts'),
        ('budgets', 'Budgets'),
        ('budget_tracking', 'Budget Tracking'),
        ('financial_insights', 'Financial Insights')
    ]
    
    print("Record Counts:")
    print("-" * 30)
    
    for table, name in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"{name}: {count}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")