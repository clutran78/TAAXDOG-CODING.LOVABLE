#!/usr/bin/env python3
"""
Production Database Verification
Checks actual Prisma schema tables
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

# Production database URL
DATABASE_URL = os.environ.get('DATABASE_URL', 
    'postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require'
)

def verify_production():
    """Verify production database state"""
    
    try:
        # Connect to database
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        print("🔍 PRODUCTION DATABASE VERIFICATION")
        print("=" * 60)
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Database: taaxdog-production")
        print("=" * 60)
        
        # Get all tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        
        tables = [row['table_name'] for row in cursor.fetchall()]
        print(f"\n📋 Found {len(tables)} tables:")
        for table in tables:
            print(f"  - {table}")
        
        # Check record counts
        print("\n📊 RECORD COUNTS:")
        print("-" * 40)
        
        total_records = 0
        table_stats = {}
        
        for table in tables:
            if table == '_prisma_migrations':
                continue
                
            cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
            count = cursor.fetchone()['count']
            total_records += count
            table_stats[table] = count
            
            if count > 0:
                print(f"✅ {table}: {count:,} records")
            else:
                print(f"⚪ {table}: {count} records")
        
        print(f"\n📈 Total Data Records: {total_records:,}")
        
        # If we have data, do detailed checks
        if total_records > 0:
            print("\n🔍 DETAILED DATA ANALYSIS:")
            print("-" * 40)
            
            # Check users
            if table_stats.get('users', 0) > 0:
                cursor.execute("SELECT * FROM users LIMIT 1")
                user = cursor.fetchone()
                if user:
                    print(f"\n👤 Sample User:")
                    print(f"  Email: {user.get('email', 'N/A')}")
                    print(f"  Name: {user.get('name', 'N/A')}")
                    print(f"  Phone: {user.get('phone', 'N/A')}")
                    print(f"  Created: {user.get('createdAt', 'N/A')}")
                    
                    # Check user's related data
                    user_id = user['id']
                    
                    # Check receipts
                    cursor.execute('SELECT COUNT(*) FROM receipts WHERE "userId" = %s', (user_id,))
                    receipt_count = cursor.fetchone()['count']
                    print(f"  Receipts: {receipt_count}")
                    
                    # Check budgets
                    cursor.execute('SELECT COUNT(*) FROM budgets WHERE user_id = %s', (user_id,))
                    budget_count = cursor.fetchone()['count']
                    print(f"  Budgets: {budget_count}")
            
            # Check receipts details
            if table_stats.get('receipts', 0) > 0:
                print("\n🧾 Receipt Analysis:")
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN "gst_amount" IS NOT NULL THEN 1 END) as with_gst,
                        AVG("total_amount") as avg_amount,
                        MIN(date) as earliest,
                        MAX(date) as latest
                    FROM receipts
                """)
                receipt_stats = cursor.fetchone()
                print(f"  Total: {receipt_stats['total']}")
                print(f"  With GST: {receipt_stats['with_gst']}")
                print(f"  Average Amount: ${receipt_stats['avg_amount']:.2f}" if receipt_stats['avg_amount'] else "  Average Amount: N/A")
                print(f"  Date Range: {receipt_stats['earliest']} to {receipt_stats['latest']}")
            
            # Check financial insights
            if table_stats.get('financial_insights', 0) > 0:
                print("\n💡 Financial Insights:")
                cursor.execute("""
                    SELECT insight_type, COUNT(*) as count
                    FROM financial_insights
                    GROUP BY insight_type
                    ORDER BY count DESC
                """)
                insights = cursor.fetchall()
                for insight in insights:
                    print(f"  {insight['insight_type']}: {insight['count']}")
        
        else:
            print("\n⚠️  DATABASE IS EMPTY")
            print("The database has no data records. Migration may not have been completed.")
            
            # Check if this is the right database
            cursor.execute("SELECT current_database()")
            db_name = cursor.fetchone()['current_database']
            print(f"\nConnected to database: {db_name}")
            
            # Check Firebase exports
            firebase_dir = '/Users/genesis/TAAXDOG-CODING/firebase-exports'
            if os.path.exists(firebase_dir):
                print(f"\n📁 Firebase exports directory exists: {firebase_dir}")
                files = [f for f in os.listdir(firebase_dir) if f.endswith('.json')]
                if files:
                    print("Found export files:")
                    for f in files:
                        print(f"  - {f}")
                else:
                    print("  ⚠️  No JSON export files found")
            else:
                print(f"\n❌ Firebase exports directory not found: {firebase_dir}")
        
        print("\n" + "=" * 60)
        print("✅ VERIFICATION COMPLETE")
        print("=" * 60)
        
        cursor.close()
        conn.close()
        
        return total_records > 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = verify_production()
    exit(0 if success else 1)