# Migration Validation System Documentation

## Overview

This comprehensive validation system ensures 100% data integrity for the
Firebase to PostgreSQL migration, with specific focus on Australian compliance
requirements and complete data verification.

## System Components

### 1. **Migration Validator** (`migration-validator.js`)

- Comprehensive data validation across all aspects
- Record count verification
- Relationship integrity checks
- Australian compliance validation
- Performance testing
- Detailed issue tracking

### 2. **Rollback Manager** (`migration-rollback.js`)

- Safe rollback procedures
- Backup creation before rollback
- Dry-run mode for testing
- Granular rollback options
- Recovery utilities

## Validation Process

### Quick Validation

```bash
# Run complete validation
npm run migration:validate

# Validate with custom paths
npm run migration:validate firebase-exports "postgresql://..." validation-reports
```

### Complete Migration with Validation

```bash
# Run entire migration pipeline with validation
npm run migration:complete
```

## Validation Checks

### 1. Record Count Validation

Verifies that all records were successfully migrated:

- Compares Firebase export counts with PostgreSQL counts
- Detects any missing records
- Identifies duplicate records
- Checks each collection/table

### 2. Relationship Validation

Ensures all foreign key relationships are intact:

- Users → Bank Accounts
- Bank Accounts → BASIQ Users
- Transactions → Bank Accounts
- Transactions → Receipts
- Budget Tracking → Budgets
- Financial Insights → Users

### 3. Data Integrity Validation

Samples records for detailed comparison:

- Field-by-field comparison
- Data type conversion verification
- Timestamp accuracy checks
- JSON field validation
- Decimal precision verification

### 4. Australian Compliance

Validates all Australian-specific requirements:

| Check            | Description                  | Format                        |
| ---------------- | ---------------------------- | ----------------------------- |
| BSB Numbers      | 6-digit bank codes           | XXX-XXX                       |
| Phone Numbers    | Australian mobiles/landlines | +61XXXXXXXXX                  |
| GST Calculations | 10% GST rate                 | Amount/11                     |
| ATO Categories   | Valid tax categories         | INCOME, BUSINESS_EXPENSE, etc |
| Currency         | AUD with 2 decimals          | X.XX                          |

### 5. Table-Specific Validations

#### Users Table

- Email uniqueness and format
- Phone number validation
- Required fields (email, name)
- Timestamp conversions

#### Bank Accounts

- BSB format (XXX-XXX)
- Account number format
- Balance precision
- Institution consistency

#### Transactions

- Amount precision
- Date range validation
- Tax category mapping
- Receipt linkages

#### Receipts

- GST calculation accuracy (10%)
- Image URL accessibility
- AI metadata integrity
- Merchant consistency

#### Budgets & Tracking

- Amount precision
- Variance calculations
- Australian tax year
- AI predictions

#### Financial Insights

- Confidence scores (0-1)
- JSONB structure
- Expiration logic
- AI metadata

### 6. Performance Validation

Tests query performance and database efficiency:

- User lookup by email
- Transaction aggregation
- Budget tracking queries
- Connection pooling
- Query response times

## Validation Report

### Report Contents

1. **Summary Section**
   - Overall pass/fail status
   - Success rate percentage
   - Total issues found
   - Critical issue count

2. **Detailed Results**
   - Record count comparisons
   - Relationship integrity
   - Data integrity findings
   - Compliance violations
   - Performance metrics

3. **Issues List**
   - Categorized by severity
   - Specific error details
   - Affected records
   - Resolution suggestions

### Report Locations

```
validation-reports/
├── validation_report_[timestamp].json    # Detailed JSON data
├── validation_report_[timestamp].md      # Human-readable report
└── rollback_script_[timestamp].sql      # Generated if critical issues found
```

## Rollback Procedures

### When to Rollback

Rollback is recommended when:

- Critical validation issues are found
- Data integrity is compromised
- Foreign key relationships are broken
- Significant data loss detected

### Rollback Options

```bash
# Preview rollback (dry run)
npm run migration:rollback:dry

# Execute full rollback
npm run migration:rollback

# Rollback specific timestamp
npm run migration:rollback rollback "2024-01-01 00:00:00"

# Skip confirmation prompt
npm run migration:rollback rollback --no-confirm

# Skip backup creation
npm run migration:rollback rollback --no-backup
```

### Rollback Process

1. **Pre-rollback Checks**
   - Database connection verification
   - Current record counts
   - Migration tracking

2. **Backup Creation**
   - Exports all tables to CSV
   - Stores in timestamped directory
   - Preserves current state

3. **User Confirmation**
   - Displays affected tables
   - Requires "ROLLBACK" confirmation
   - Can be skipped with --no-confirm

4. **Execution**
   - Disables foreign keys
   - Deletes in reverse order
   - Resets sequences
   - Re-enables constraints

5. **Verification**
   - Checks final record counts
   - Verifies cleanup success
   - Generates report

### Recovery from Backup

```bash
# Restore from specific backup
npm run migration:rollback restore rollback-backups/backup_1234567890
```

## Issue Resolution

### Common Issues and Fixes

#### Record Count Mismatch

```sql
-- Check for duplicates
SELECT id, COUNT(*) FROM table_name GROUP BY id HAVING COUNT(*) > 1;

-- Find missing records
SELECT f.id FROM firebase_export f
LEFT JOIN postgresql_table p ON f.id = p.id
WHERE p.id IS NULL;
```

#### BSB Format Issues

```sql
-- Fix BSB format
UPDATE bank_accounts
SET bsb = SUBSTRING(bsb FROM 1 FOR 3) || '-' || SUBSTRING(bsb FROM 4 FOR 3)
WHERE bsb ~ '^[0-9]{6}$';
```

#### Phone Number Format

```sql
-- Fix Australian phone numbers
UPDATE users
SET phone = '+61' || SUBSTRING(phone FROM 2)
WHERE phone ~ '^0[0-9]{9}$';
```

#### GST Calculations

```sql
-- Recalculate GST
UPDATE receipts
SET gst_amount = ROUND(total_amount / 11 * 100) / 100
WHERE total_amount > 0;
```

## Best Practices

### Before Migration

1. Create full database backup
2. Test on staging environment
3. Verify Firebase export completeness
4. Check available disk space

### During Migration

1. Monitor system resources
2. Keep detailed logs
3. Run in off-peak hours
4. Use batch mode for automation

### After Migration

1. **Always run validation**
2. Review all warnings
3. Test application functionality
4. Create post-migration backup

### Validation Schedule

- Immediate: After initial migration
- Daily: For first week
- Weekly: For first month
- Monthly: Ongoing monitoring

## Troubleshooting

### Validation Fails to Run

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Verify Firebase exports exist
ls -la firebase-exports/

# Check permissions
chmod +x scripts/migration-validator.js
```

### High Number of Issues

1. Review transformation logs
2. Check data quality in source
3. Verify transformation rules
4. Consider re-running specific collections

### Performance Issues

1. Check database indexes
2. Verify connection pooling
3. Review query plans
4. Consider database resources

## Automation

### CI/CD Integration

```yaml
# Example GitHub Action
- name: Validate Migration
  run: |
    npm run migration:validate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Scheduled Validation

```bash
# Add to cron for daily validation
0 2 * * * cd /path/to/project && npm run migration:validate
```

## Summary

The validation system provides:

- ✅ 100% data integrity verification
- 🇦🇺 Complete Australian compliance checking
- 🔄 Safe rollback procedures
- 📊 Comprehensive reporting
- ⚡ Performance validation
- 🛡️ Data protection through backups

Always validate after migration to ensure data integrity and compliance!
