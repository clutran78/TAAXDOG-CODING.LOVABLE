#!/usr/bin/env python3
"""
Migration Verification Script
Checks record counts, relationships, and Australian compliance
"""

import os
import sys
import re
from datetime import datetime
from decimal import Decimal
import psycopg2
from psycopg2.extras import RealDictCursor
import json

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 
    'postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require'
)

class MigrationVerifier:
    def __init__(self):
        self.conn = None
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'record_counts': {},
            'relationships': {},
            'compliance': {},
            'issues': []
        }
    
    def connect(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = psycopg2.connect(DATABASE_URL)
            print("✅ Connected to PostgreSQL database")
            return True
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            return False
    
    def check_record_counts(self):
        """Check record counts for all tables"""
        print("\n📊 Checking Record Counts...")
        print("-" * 40)
        
        tables = [
            ('users', 'Users'),
            ('bank_accounts', 'Bank Accounts'),
            ('bank_transactions', 'Transactions'),
            ('receipts', 'Receipts'),
            ('budgets', 'Budgets'),
            ('budget_tracking', 'Budget Tracking'),
            ('financial_insights', 'Financial Insights'),
            ('basiq_users', 'BASIQ Users'),
            ('ai_conversations', 'AI Conversations'),
            ('ai_usage_tracking', 'AI Usage Tracking')
        ]
        
        with self.conn.cursor() as cursor:
            for table, display_name in tables:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    self.results['record_counts'][table] = count
                    print(f"{display_name}: {count:,}")
                except Exception as e:
                    print(f"{display_name}: Error - {e}")
                    self.results['record_counts'][table] = f"Error: {e}"
    
    def verify_relationships(self):
        """Verify foreign key relationships"""
        print("\n🔗 Verifying Relationships...")
        print("-" * 40)
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Check a sample user's relationships
            cursor.execute("SELECT * FROM users LIMIT 1")
            user = cursor.fetchone()
            
            if user:
                user_id = user['id']
                email = user['email']
                
                # Count related records
                relationships = [
                    ('bank_accounts', 'bank accounts', 'user_id'),
                    ('bank_transactions', 'transactions', 'user_id'),
                    ('receipts', 'receipts', 'user_id'),
                    ('budgets', 'budgets', 'user_id'),
                    ('financial_insights', 'insights', 'user_id')
                ]
                
                print(f"Sample User: {email}")
                for table, name, field in relationships:
                    cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE {field} = %s", (user_id,))
                    count = cursor.fetchone()['count']
                    print(f"  - Has {count} {name}")
                    self.results['relationships'][f"user_{table}"] = count
            
            # Check orphaned records
            print("\n🔍 Checking for orphaned records...")
            orphan_checks = [
                ("Bank Accounts without Users", 
                 "SELECT COUNT(*) FROM bank_accounts ba LEFT JOIN users u ON ba.user_id = u.id WHERE ba.user_id IS NOT NULL AND u.id IS NULL"),
                ("Transactions without Bank Accounts",
                 "SELECT COUNT(*) FROM bank_transactions bt LEFT JOIN bank_accounts ba ON bt.bank_account_id = ba.id WHERE bt.bank_account_id IS NOT NULL AND ba.id IS NULL"),
                ("Budget Tracking without Budgets",
                 "SELECT COUNT(*) FROM budget_tracking bt LEFT JOIN budgets b ON bt.budget_id = b.id WHERE bt.budget_id IS NOT NULL AND b.id IS NULL")
            ]
            
            for check_name, query in orphan_checks:
                cursor.execute(query)
                orphans = cursor.fetchone()['count']
                status = "✅" if orphans == 0 else "❌"
                print(f"{status} {check_name}: {orphans} orphaned records")
                self.results['relationships'][check_name] = orphans
    
    def test_australian_compliance(self):
        """Test Australian compliance requirements"""
        print("\n🇦🇺 Testing Australian Compliance...")
        print("-" * 40)
        
        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # BSB Format Validation
            print("\n📍 BSB Format Validation:")
            cursor.execute("""
                SELECT bsb, COUNT(*) as count 
                FROM bank_accounts 
                WHERE bsb IS NOT NULL 
                GROUP BY bsb 
                LIMIT 5
            """)
            
            bsb_samples = cursor.fetchall()
            valid_bsbs = 0
            total_bsbs = 0
            
            for sample in bsb_samples:
                bsb = sample['bsb']
                count = sample['count']
                total_bsbs += count
                
                # Check BSB format (XXX-XXX)
                if re.match(r'^\d{3}-\d{3}$', bsb):
                    valid_bsbs += count
                    print(f"  ✅ {bsb} ({count} accounts) - Valid format")
                else:
                    print(f"  ❌ {bsb} ({count} accounts) - Invalid format")
                    self.results['issues'].append(f"Invalid BSB format: {bsb}")
            
            # Phone Number Validation
            print("\n📱 Phone Number Validation:")
            cursor.execute("""
                SELECT phone, COUNT(*) as count 
                FROM users 
                WHERE phone IS NOT NULL 
                GROUP BY phone 
                LIMIT 5
            """)
            
            phone_samples = cursor.fetchall()
            valid_phones = 0
            total_phones = 0
            
            for sample in phone_samples:
                phone = sample['phone']
                count = sample['count']
                total_phones += count
                
                # Check Australian phone format
                if re.match(r'^\+61[0-9]{9}$', phone):
                    valid_phones += count
                    print(f"  ✅ {phone} ({count} users) - Valid Australian format")
                else:
                    print(f"  ❌ {phone} ({count} users) - Invalid format")
                    self.results['issues'].append(f"Invalid phone format: {phone}")
            
            # GST Validation
            print("\n💰 GST Calculation Validation:")
            cursor.execute("""
                SELECT 
                    id,
                    total_amount,
                    gst_amount,
                    ROUND(total_amount::numeric / 11, 2) as expected_gst
                FROM receipts 
                WHERE total_amount > 0 AND gst_amount > 0
                LIMIT 5
            """)
            
            gst_samples = cursor.fetchall()
            gst_accurate = 0
            
            for sample in gst_samples:
                total = float(sample['total_amount'])
                gst = float(sample['gst_amount'])
                expected = float(sample['expected_gst'])
                diff = abs(gst - expected)
                
                if diff <= 0.01:  # 1 cent tolerance
                    gst_accurate += 1
                    print(f"  ✅ Receipt {sample['id']}: Total=${total:.2f}, GST=${gst:.2f} - Accurate")
                else:
                    print(f"  ❌ Receipt {sample['id']}: Total=${total:.2f}, GST=${gst:.2f}, Expected=${expected:.2f}")
                    self.results['issues'].append(f"GST mismatch: Receipt {sample['id']}")
            
            # Tax Category Validation
            print("\n📋 Tax Category Validation:")
            cursor.execute("""
                SELECT tax_category, COUNT(*) as count 
                FROM bank_transactions 
                GROUP BY tax_category 
                ORDER BY count DESC 
                LIMIT 10
            """)
            
            categories = cursor.fetchall()
            valid_categories = [
                'INCOME', 'BUSINESS_EXPENSE', 'PERSONAL', 'INVESTMENT',
                'GST_PAYABLE', 'GST_RECEIVABLE', 'CAPITAL', 'DEPRECIATION',
                'DEDUCTIBLE', 'NON_DEDUCTIBLE', 'UNCATEGORIZED'
            ]
            
            for cat in categories:
                category = cat['tax_category']
                count = cat['count']
                
                if category in valid_categories:
                    print(f"  ✅ {category}: {count:,} transactions")
                else:
                    print(f"  ❌ {category}: {count:,} transactions - Invalid ATO category")
                    self.results['issues'].append(f"Invalid tax category: {category}")
            
            # Currency Precision
            print("\n💵 Currency Precision Check:")
            cursor.execute("""
                SELECT 
                    'transactions' as source,
                    COUNT(*) as invalid_count
                FROM bank_transactions 
                WHERE amount::numeric % 0.01 != 0
                UNION ALL
                SELECT 
                    'receipts' as source,
                    COUNT(*) as invalid_count
                FROM receipts 
                WHERE total_amount::numeric % 0.01 != 0
                UNION ALL
                SELECT 
                    'budgets' as source,
                    COUNT(*) as invalid_count
                FROM budgets 
                WHERE monthly_budget::numeric % 0.01 != 0
            """)
            
            precision_results = cursor.fetchall()
            for result in precision_results:
                source = result['source']
                invalid = result['invalid_count']
                
                if invalid == 0:
                    print(f"  ✅ {source}: All amounts have correct precision")
                else:
                    print(f"  ❌ {source}: {invalid} records with incorrect precision")
                    self.results['issues'].append(f"Currency precision error in {source}")
            
            self.results['compliance'] = {
                'bsb_validation': f"{valid_bsbs}/{total_bsbs} valid",
                'phone_validation': f"{valid_phones}/{total_phones} valid",
                'gst_accuracy': f"{gst_accurate}/{len(gst_samples)} accurate",
                'tax_categories': f"{len([c for c in categories if c['tax_category'] in valid_categories])}/{len(categories)} valid"
            }
    
    def check_data_integrity(self):
        """Additional data integrity checks"""
        print("\n🔐 Data Integrity Checks...")
        print("-" * 40)
        
        with self.conn.cursor() as cursor:
            # Check for duplicate emails
            cursor.execute("""
                SELECT email, COUNT(*) as count 
                FROM users 
                GROUP BY email 
                HAVING COUNT(*) > 1
            """)
            
            duplicates = cursor.fetchall()
            if duplicates:
                print("❌ Duplicate emails found:")
                for email, count in duplicates:
                    print(f"  - {email}: {count} occurrences")
                    self.results['issues'].append(f"Duplicate email: {email}")
            else:
                print("✅ No duplicate emails found")
            
            # Check required fields
            required_checks = [
                ("Users without email", "SELECT COUNT(*) FROM users WHERE email IS NULL OR email = ''"),
                ("Users without name", "SELECT COUNT(*) FROM users WHERE name IS NULL OR name = ''"),
                ("Bank accounts without BSB", "SELECT COUNT(*) FROM bank_accounts WHERE bsb IS NULL OR bsb = ''"),
                ("Transactions without amount", "SELECT COUNT(*) FROM bank_transactions WHERE amount IS NULL")
            ]
            
            for check_name, query in required_checks:
                cursor.execute(query)
                count = cursor.fetchone()[0]
                if count > 0:
                    print(f"❌ {check_name}: {count} records")
                    self.results['issues'].append(f"{check_name}: {count} records")
                else:
                    print(f"✅ {check_name}: None found")
    
    def generate_report(self):
        """Generate final report"""
        print("\n" + "=" * 50)
        print("📄 MIGRATION VERIFICATION SUMMARY")
        print("=" * 50)
        
        # Overall status
        issues_count = len(self.results['issues'])
        if issues_count == 0:
            print("\n✅ MIGRATION VERIFIED SUCCESSFULLY!")
            print("All checks passed with no issues found.")
        else:
            print(f"\n⚠️  MIGRATION COMPLETED WITH {issues_count} ISSUES")
            print("\nIssues found:")
            for issue in self.results['issues'][:10]:  # Show first 10 issues
                print(f"  - {issue}")
            if issues_count > 10:
                print(f"  ... and {issues_count - 10} more issues")
        
        # Save detailed report
        report_path = f"migration_verification_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        
        print(f"\n📁 Detailed report saved to: {report_path}")
        
        return issues_count == 0
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            print("\n🔌 Database connection closed")
    
    def run(self):
        """Run all verification checks"""
        if not self.connect():
            return False
        
        try:
            self.check_record_counts()
            self.verify_relationships()
            self.test_australian_compliance()
            self.check_data_integrity()
            return self.generate_report()
        finally:
            self.close()


def main():
    """Main entry point"""
    print("🔍 Firebase to PostgreSQL Migration Verification")
    print("=" * 50)
    
    verifier = MigrationVerifier()
    success = verifier.run()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()