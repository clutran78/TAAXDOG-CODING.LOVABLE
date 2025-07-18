# Disaster Recovery Procedures

## Overview

This document outlines the disaster recovery procedures for TAAXDOG, designed to meet our Recovery Time Objective (RTO) of 4 hours and Recovery Point Objective (RPO) of 1 hour.

## Key Metrics

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Backup Retention**: 30 days (full), 7 days (incremental)
- **Archive Retention**: 7 years (Australian tax law compliance)

## Backup Schedule

### Automated Backups
- **Full Backup**: Daily at 2:00 AM AEST
- **Incremental Backup**: Hourly during business hours (8 AM - 8 PM AEST)
- **Verification**: Daily at 4:00 AM AEST
- **Archival**: Weekly on Sundays at 3:00 AM AEST

### Storage Locations
- **Primary**: AWS S3 (Sydney region)
- **Storage Classes**: 
  - STANDARD_IA for full backups
  - STANDARD for incremental backups
  - GLACIER_IR for archives

## Recovery Procedures

### 1. Immediate Response (0-15 minutes)

1. **Assess the Situation**
   ```bash
   # Check system status
   npm run backup:monitor -- --dashboard
   
   # Verify database connectivity
   psql $DATABASE_URL -c "SELECT 1;"
   ```

2. **Notify Stakeholders**
   - Email: ops-team@taxreturnpro.com.au
   - Slack: #incidents channel
   - Update status page

3. **Initiate Recovery Mode**
   ```bash
   # Set maintenance mode
   echo "true" > /tmp/maintenance-mode
   ```

### 2. Recovery Execution (15 minutes - 2 hours)

#### Option A: Point-in-Time Recovery
```bash
# Recover to specific time (e.g., 1 hour ago)
npm run backup:recover -- --time="2024-01-18T10:00:00Z"
```

#### Option B: Latest Backup Recovery
```bash
# Recover from latest backup
npm run backup:recover
```

#### Option C: Specific Backup Recovery
```bash
# Recover from specific backup
npm run backup:recover -- --backup="backups/full/2024-01-18-020000/taaxdog-full-20240118-020000.sql.gz.enc"
```

### 3. Verification (2-3 hours)

1. **Run Recovery Verification**
   ```bash
   # Verify recovered database
   npm run backup:recover -- --verify
   ```

2. **Check Data Integrity**
   ```bash
   # Run integrity checks
   psql $DATABASE_URL -f scripts/backup/integrity-checks.sql
   ```

3. **Test Critical Functions**
   - User authentication
   - Payment processing
   - Tax calculations
   - Banking connections

### 4. Restoration (3-4 hours)

1. **Switch to Recovered Database**
   ```bash
   # Update connection strings
   export DATABASE_URL="postgresql://[recovered-database-url]"
   ```

2. **Clear Caches**
   ```bash
   # Clear all application caches
   redis-cli FLUSHALL
   ```

3. **Restart Services**
   ```bash
   # Restart application
   pm2 restart ecosystem.config.js
   ```

4. **Remove Maintenance Mode**
   ```bash
   rm /tmp/maintenance-mode
   ```

## Emergency Contacts

### Technical Team
- Lead Engineer: +61 4XX XXX XXX
- Database Admin: +61 4XX XXX XXX
- Security Lead: +61 4XX XXX XXX

### Business Contacts
- CEO: +61 4XX XXX XXX
- CTO: +61 4XX XXX XXX
- Customer Support Lead: +61 4XX XXX XXX

### Third-Party Support
- DigitalOcean Support: 24/7 via dashboard
- AWS Support: +1-206-266-4064
- Stripe Support: support@stripe.com

## Recovery Testing

### Monthly Test Procedure
1. Create test environment
2. Simulate failure scenario
3. Execute recovery procedure
4. Verify data integrity
5. Document results and improvements

### Test Scenarios
- Complete database failure
- Partial data corruption
- Ransomware attack
- Natural disaster
- Human error (accidental deletion)

## Backup Verification

### Daily Checks
```bash
# Verify latest backups
npm run backup:verify:latest
```

### Weekly Audit
```bash
# Full backup audit
npm run backup:audit
```

## Data Archival and Retrieval

### Archive Old Data
```bash
# Archive data older than 7 years
npm run backup:archive
```

### Retrieve Archived Data
```bash
# Restore specific year's data
npm run backup:restore-archive -- --table=transactions --year=2017
```

## Monitoring and Alerts

### Backup Monitoring Dashboard
```bash
# View backup system status
npm run backup:monitor -- --dashboard
```

### Alert Channels
- Email: Immediate for critical failures
- Slack: All backup events
- PagerDuty: Critical failures outside business hours

## Security Considerations

### Encryption
- All backups encrypted with AES-256
- Encryption keys stored separately
- Key rotation every 90 days

### Access Control
- Backup access limited to ops team
- MFA required for all backup operations
- Audit logging for all access

## Compliance

### Australian Tax Law
- 7-year retention for financial records
- Encrypted storage for sensitive data
- Data residency in Australian regions

### Recovery Documentation
- All recovery operations logged
- Compliance reports generated monthly
- Annual DR drill mandatory

## Troubleshooting

### Common Issues

1. **Backup Failure**
   ```bash
   # Check logs
   tail -f logs/backup-cron.log
   
   # Retry backup
   npm run backup:full
   ```

2. **Verification Failure**
   ```bash
   # Check specific backup
   npm run backup:verify -- [s3-key]
   ```

3. **Storage Issues**
   ```bash
   # Check S3 connectivity
   aws s3 ls s3://taaxdog-backups/
   ```

## Appendix

### NPM Scripts
```json
{
  "backup:full": "tsx scripts/backup/database-backup.ts full",
  "backup:incremental": "tsx scripts/backup/database-backup.ts incremental",
  "backup:verify": "tsx scripts/backup/backup-verification.ts",
  "backup:verify:latest": "tsx scripts/backup/backup-verification.ts --latest",
  "backup:recover": "tsx scripts/backup/disaster-recovery.ts",
  "backup:test-restore": "tsx scripts/backup/disaster-recovery.ts --verify",
  "backup:archive": "tsx scripts/backup/data-archival.ts",
  "backup:restore-archive": "tsx scripts/backup/data-archival.ts --restore",
  "backup:monitor": "tsx scripts/backup/backup-monitoring.ts",
  "backup:audit": "tsx scripts/backup/backup-audit.ts",
  "backup:setup-cron": "bash scripts/backup/setup-backup-cron.sh"
}
```

### Environment Variables
```bash
# Backup Configuration
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=[STORED IN ENVIRONMENT]
AWS_SECRET_ACCESS_KEY=[STORED IN ENVIRONMENT]
BACKUP_BUCKET=taaxdog-backups
ARCHIVE_BUCKET=taaxdog-archives
BACKUP_ENCRYPTION_KEY=[STORED IN ENVIRONMENT]
WAL_ARCHIVE_DIR=/var/lib/postgresql/wal_archive
```