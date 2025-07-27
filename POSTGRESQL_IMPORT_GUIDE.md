# PostgreSQL Import System Documentation

## Overview

This comprehensive PostgreSQL import system is designed specifically for the
Taaxdog-coding project, featuring dependency-ordered imports, Australian
compliance validation, and performance optimization for large datasets.

## System Architecture

### 1. **Standard Import System** (`postgresql-import-system.js`)

- Handles imports with full validation and error tracking
- Maintains foreign key relationships through dependency ordering
- Provides detailed error reporting for each record
- Best for smaller datasets or when detailed validation is needed

### 2. **Optimized Import System** (`postgresql-import-optimized.js`)

- Uses PostgreSQL COPY command for ultra-fast bulk inserts
- Implements parallel processing with worker threads
- Temporarily drops indexes for better performance
- Automatically manages memory usage and garbage collection
- Best for large datasets (>10,000 records)

### 3. **Import Orchestrator** (`postgresql-import-orchestrator.js`)

- Automatically chooses between standard and optimized importers
- Provides interactive and batch modes
- Performs pre-import checks and validation
- Generates comprehensive reports

## Import Order (Critical)

The system enforces this dependency order to maintain referential integrity:

1. **Users** (no dependencies)
2. **BASIQ Users** (depends on Users)
3. **Bank Accounts** (depends on BASIQ Users)
4. **Receipts** (depends on Users)
5. **Bank Transactions** (depends on Bank Accounts and Receipts)
6. **Budgets** (depends on Users)
7. **Budget Tracking** (depends on Budgets and Users)
8. **Financial Insights** (depends on Users)
9. **AI Conversations** (depends on Users)
10. **AI Usage Tracking** (depends on Users)

## Quick Start

### Prerequisites

```bash
# Ensure dependencies are installed
npm install pg uuid date-fns

# Set database connection (or use default)
export DATABASE_URL="postgresql://taaxdog-admin:password@host:port/database?sslmode=require"
```

### Basic Usage

```bash
# Interactive mode (recommended)
npm run db:import

# Batch mode (no prompts)
npm run postgres:import-batch

# Standard import only
npm run postgres:import firebase-transformed

# With custom connection string
npm run db:import firebase-transformed "postgresql://..."
```

## Features

### Australian Compliance Validation

- **BSB Format**: Validates 6-digit format (XXX-XXX) with range checking
- **Phone Numbers**: Validates Australian mobile and landline formats
- **GST Validation**: Ensures GST amounts match 10% calculation
- **ABN/TFN**: Validates format and checksums

### Performance Optimization

1. **Automatic Method Selection**
   - Small datasets (<10,000): Standard method with full validation
   - Large datasets (>10,000): Optimized method with bulk operations

2. **Bulk Insert Optimizations**
   - PostgreSQL COPY command for fastest imports
   - Temporary index removal during import
   - Parallel processing with worker threads
   - Connection pooling for efficiency

3. **Memory Management**
   - Automatic batch size calculation
   - Garbage collection monitoring
   - Memory usage limits (80% max)

### Error Handling

1. **Validation Errors**
   - Required field validation
   - Foreign key constraint checking
   - Data type validation
   - Format validation

2. **Recovery Mechanisms**
   - Transaction-based imports with rollback
   - Individual record retry on batch failure
   - Detailed error logging per record
   - Continue processing after errors

3. **Duplicate Detection**
   - Checks unique constraints before insert
   - Uses ON CONFLICT for upsert operations
   - Tracks and reports duplicates

## Import Process

### 1. Pre-Import Phase

```
📊 Analyzing data for import...
   - Counts records in each collection
   - Calculates optimal batch sizes
   - Determines import method per collection
   - Estimates import time

🔍 Performing pre-import checks...
   ✅ Database connection verified
   ✅ All required tables exist
   ✅ Database permissions OK
   ✅ Disk space OK
```

### 2. Import Phase

```
🚀 Starting import process...

🔄 Importing users into users...
   Found 5,000 records to import
   Progress: 100% (✓ 4,950 | ✗ 0 | ⚡ 50 duplicates)
   ✅ Completed in 2.3s
   📊 Results: 4,950 imported, 0 failed, 50 duplicates skipped

[Continues for each collection in order...]
```

### 3. Post-Import Phase

```
🔍 Verifying imported data...
   - Checking record counts
   - Validating foreign key integrity
   - Running data integrity checks

📄 Generating import report...
   ✅ Reports saved to import-reports/
```

## Reports

### Import Summary Report

Generated after each import with:

- Collection-by-collection results
- Performance metrics
- Error details
- Data verification results
- Recommendations

### Report Locations

```
firebase-transformed/
└── import-reports/
    ├── import_report_[timestamp].json    # Detailed JSON report
    └── import_report_[timestamp].md      # Human-readable report
```

## Performance Tuning

### For Large Imports

1. **Increase Database Resources**

   ```sql
   -- Temporarily increase work_mem
   SET work_mem = '256MB';

   -- Increase maintenance_work_mem for index creation
   SET maintenance_work_mem = '512MB';
   ```

2. **Use Batch Mode**

   ```bash
   npm run postgres:import-batch -- --skip-checks
   ```

3. **Monitor Progress**
   - Watch for memory usage warnings
   - Check connection pool statistics
   - Monitor import speed (records/second)

### Optimization Tips

- Run imports during off-peak hours
- Ensure sufficient disk space (2x data size)
- Consider disabling application access during import
- Run VACUUM ANALYZE after large imports

## Troubleshooting

### Common Issues

1. **Connection Errors**

   ```
   ❌ Database connection failed: ENOTFOUND
   ```

   - Verify hostname and port
   - Check network connectivity
   - Ensure SSL mode matches server config

2. **Missing Dependencies**

   ```
   ⚠️ Skipping bankAccounts: Unmet dependencies [basiqUsers]
   ```

   - Check if dependent collections were imported
   - Verify data files exist for dependencies

3. **Validation Failures**

   ```
   Record 123: bsb: Invalid BSB format (must be 6 digits)
   ```

   - Review transformation output
   - Fix data issues and re-run import

4. **Performance Issues**
   - Reduce batch size for memory constraints
   - Use optimized importer for large datasets
   - Check database server resources

### Debug Mode

```bash
# Enable detailed logging
DEBUG=* npm run db:import

# Test mode (rolls back all changes)
npm run db:import -- --test
```

## Best Practices

1. **Before Import**
   - Backup existing database
   - Verify transformed data quality
   - Test on staging environment first
   - Check available disk space

2. **During Import**
   - Monitor system resources
   - Keep import logs for reference
   - Don't interrupt the process

3. **After Import**
   - Verify data integrity
   - Run application tests
   - Update database statistics
   - Create new backup

## Security Considerations

- Connection strings are never logged
- Sensitive data is preserved during import
- SSL connections required for production
- Audit trail maintained in reports

## Command Reference

```bash
# Interactive import with analysis
npm run db:import

# Batch import (no prompts)
npm run postgres:import-batch

# Skip pre-import checks
npm run db:import -- --skip-checks

# Test mode (rollback after import)
npm run db:import -- --test

# Custom data directory
npm run db:import /path/to/data

# Custom connection string
npm run db:import /path/to/data "postgresql://..."
```

## Support

For issues:

1. Check import reports for specific errors
2. Review transformation logs
3. Verify database connectivity
4. Ensure all dependencies are installed
