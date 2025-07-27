# Database Migration Guide

This guide covers the comprehensive database migration system for TAAXDOG, including data validation, safe migrations, and rollback capabilities.

## Overview

The migration system provides:
- **Safe Production Migrations**: With validation and rollback support
- **Data Integrity Checks**: Before and after migrations
- **Dry-Run Capability**: Preview changes before applying
- **Automatic Backups**: Before any data modifications
- **Migration Tracking**: Complete history and audit trail
- **Interactive Runner**: User-friendly CLI interface

## Quick Start

### Interactive Migration Runner

The easiest way to run migrations is using the interactive runner:

```bash
npm run migrate:interactive
# or
tsx scripts/run-migrations.ts
```

This provides a menu-driven interface to:
- Select and run migrations
- View migration history
- Validate database integrity
- Create backups
- Run in dry-run or live mode

### Command Line Usage

For automated deployments, use the CLI directly:

```bash
# Run a specific migration
npm run migrate:data -- --type=encrypt-user-data

# Dry run mode (preview changes)
npm run migrate:data -- --type=cleanup-orphaned --dry-run

# Skip backup creation (not recommended)
npm run migrate:data -- --type=normalize-phones --skip-backup

# Force re-run a migration
npm run migrate:data -- --type=set-tax-residency --force

# Custom batch size
npm run migrate:data -- --type=merge-duplicates --batch-size=50
```

## Available Migrations

### Core Migrations

1. **encrypt-user-data** - Encrypt sensitive user data fields (TFN, mobile numbers)
2. **cleanup-orphaned** - Remove orphaned records from the database

### User Data Migrations

1. **normalize-phones** - Normalize phone numbers to Australian E.164 format
2. **migrate-passwords** - Update legacy password hashes to bcrypt
3. **populate-metadata** - Fill missing user metadata with defaults
4. **merge-duplicates** - Merge duplicate user accounts by email
5. **set-tax-residency** - Set default tax residency for users

### Database Cleanup Migrations

1. **cleanup-audit-logs** - Archive and remove old audit logs (>90 days)
2. **cleanup-orphaned-data** - Remove records with broken relationships
3. **cleanup-sessions** - Remove expired user sessions
4. **cleanup-payments** - Archive old failed payment records
5. **cleanup-soft-deleted** - Permanently remove soft-deleted records
6. **optimize-database** - Run VACUUM and ANALYZE for performance

## Migration Safety Features

### 1. Pre-Migration Validation

Before running any migration, the system performs:
- Referential integrity checks
- Data consistency validation
- Business rule verification
- Australian compliance checks
- Encrypted field validation

### 2. Automatic Backups

Unless explicitly skipped, migrations create:
- Full table backups before modifications
- Compressed archives with checksums
- Metadata including row counts and timestamps

### 3. Dry-Run Mode

Test migrations without making changes:
- See affected record counts
- Preview validation results
- Review execution plan
- No database modifications

### 4. Migration Tracking

All migrations are tracked with:
- Unique migration IDs
- Start/completion timestamps
- Affected record counts
- Success/failure status
- Error messages if failed
- Rollback data references

### 5. Rollback Support

Where possible, migrations support rollback:
- Automatic rollback on failure
- Stored rollback data
- Manual rollback instructions
- Archive restoration guides

## Data Validation

### Running Validation

```bash
# Full database validation
npm run db:validate

# Validate specific user
npm run db:validate -- --user-id=<uuid>

# Generate integrity checksums
npm run db:checksum
```

### Validation Checks

1. **Referential Integrity**
   - Orphaned transactions
   - Missing user relationships
   - Broken foreign keys

2. **Data Consistency**
   - Goal progress logic
   - Transaction amounts
   - Account balances

3. **Business Rules**
   - Subscription validity
   - User role constraints
   - Email verification

4. **Australian Compliance**
   - ABN format validation
   - GST calculation checks
   - Tax category validation

5. **Security**
   - Encrypted field verification
   - Password hash formats
   - Sensitive data protection

## Backup Management

### Creating Backups

```bash
# Manual backup
npm run db:backup

# Backup specific tables
npm run db:backup -- --tables=users,transactions

# Compressed backup
npm run db:backup -- --compress

# List backups
npm run db:backup:list

# Clean old backups (>30 days)
npm run db:backup:clean
```

### Restoring from Backup

```bash
# Restore full backup
npm run db:restore -- --backup=<backup-id>

# Restore specific tables
npm run db:restore -- --backup=<backup-id> --tables=users

# Dry run restore
npm run db:restore -- --backup=<backup-id> --dry-run
```

## Best Practices

### 1. Production Migrations

Always follow this checklist:

1. **Test in Staging First**
   - Run migration on staging database
   - Verify data integrity
   - Test application functionality

2. **Schedule Maintenance Window**
   - Notify users in advance
   - Run during low-traffic periods
   - Have rollback plan ready

3. **Monitor Execution**
   - Watch migration logs
   - Check error reports
   - Verify completion status

4. **Post-Migration Verification**
   - Run data validation
   - Check application logs
   - Test critical features

### 2. Large Dataset Handling

For migrations affecting many records:

```bash
# Use smaller batch sizes
npm run migrate:data -- --type=<migration> --batch-size=50

# Run in off-peak hours
# Consider splitting into multiple runs
# Monitor database performance
```

### 3. Failed Migrations

If a migration fails:

1. **Check logs**: Review error messages and stack traces
2. **Assess impact**: Determine what changes were applied
3. **Rollback if needed**: Use rollback data or restore backup
4. **Fix issues**: Address the root cause
5. **Retry**: Run migration again with fixes

## Writing Custom Migrations

### Migration Template

```typescript
import { Migration, MigrationContext } from '../migrate-data';

export class CustomMigration extends Migration {
  name = 'custom-migration';
  description = 'Description of what this migration does';
  version = '1.0.0';

  async validate(): Promise<boolean> {
    // Check if migration should run
    // Return true if valid, false otherwise
    return true;
  }

  async estimateAffectedRecords(): Promise<number> {
    // Return count of records that will be modified
    return 0;
  }

  async up(): Promise<void> {
    // Implement forward migration
    // Use this.context.dryRun to check mode
    // Use this.processBatch() for large datasets
  }

  async down(): Promise<void> {
    // Implement rollback logic
    // May throw error if not reversible
  }
}
```

### Best Practices for Custom Migrations

1. **Always validate first**: Check prerequisites
2. **Estimate accurately**: Help users understand impact
3. **Use batch processing**: For large datasets
4. **Store rollback data**: Enable recovery
5. **Log progress**: Provide visibility
6. **Handle errors gracefully**: Clean up on failure

## Troubleshooting

### Common Issues

1. **"Migration already run"**
   - Use `--force` to re-run
   - Check migration history
   - Verify tracking table

2. **"Validation failed"**
   - Review validation errors
   - Fix data issues first
   - Consider running cleanup migrations

3. **"Backup failed"**
   - Check disk space
   - Verify permissions
   - Ensure backup directory exists

4. **"Rollback not available"**
   - Some migrations can't be reversed
   - Restore from backup instead
   - Check rollback data files

### Debug Mode

Enable detailed logging:

```bash
# Set log level
export LOG_LEVEL=debug

# Run with verbose output
npm run migrate:data -- --type=<migration> --verbose
```

## Migration Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "migrate:interactive": "tsx scripts/run-migrations.ts",
    "migrate:data": "tsx scripts/migrate-data.ts",
    "migrate:users": "tsx scripts/migrations/user-data-migrations.ts",
    "migrate:cleanup": "tsx scripts/migrations/database-cleanup.ts",
    "db:validate": "tsx scripts/utils/data-validator.ts",
    "db:backup": "tsx scripts/utils/backup-manager.ts",
    "db:restore": "tsx scripts/utils/backup-manager.ts restore"
  }
}
```

## Security Considerations

1. **Sensitive Data**: All migrations handling sensitive data use encryption
2. **Audit Trail**: All operations are logged for compliance
3. **Access Control**: Migrations require database admin privileges
4. **Backup Encryption**: Consider encrypting backup files
5. **Rollback Data**: Store securely, may contain sensitive information

## Monitoring

### Health Checks

After migrations:
- Monitor application performance
- Check error rates
- Verify data consistency
- Review user feedback

### Alerts

Set up alerts for:
- Failed migrations
- Validation errors
- Unusual data patterns
- Performance degradation

## Support

If you encounter issues:

1. Check this documentation
2. Review migration logs
3. Consult the troubleshooting section
4. Contact the development team

Remember: Always test migrations in a non-production environment first!