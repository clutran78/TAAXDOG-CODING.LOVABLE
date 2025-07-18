#!/bin/bash

# Setup cron jobs for automated backups

echo "📦 Setting up automated backup cron jobs..."

# Create cron job entries
cat > /tmp/backup-cron-jobs << 'EOF'
# TAAXDOG Automated Backup Schedule

# Daily full backup at 2:00 AM
0 2 * * * cd /Users/genesis/TAAXDOG-CODING && npm run backup:full >> /Users/genesis/TAAXDOG-CODING/logs/backup-cron.log 2>&1

# Hourly incremental backups during business hours (8 AM - 8 PM)
0 8-20 * * * cd /Users/genesis/TAAXDOG-CODING && npm run backup:incremental >> /Users/genesis/TAAXDOG-CODING/logs/backup-cron.log 2>&1

# Daily backup verification at 4:00 AM
0 4 * * * cd /Users/genesis/TAAXDOG-CODING && npm run backup:verify:latest >> /Users/genesis/TAAXDOG-CODING/logs/backup-verification-cron.log 2>&1

# Weekly data archival on Sundays at 3:00 AM
0 3 * * 0 cd /Users/genesis/TAAXDOG-CODING && npm run backup:archive >> /Users/genesis/TAAXDOG-CODING/logs/archival-cron.log 2>&1

# Backup monitoring every 30 minutes
*/30 * * * * cd /Users/genesis/TAAXDOG-CODING && npm run backup:monitor >> /Users/genesis/TAAXDOG-CODING/logs/monitoring-cron.log 2>&1

# Monthly backup test restore on 1st of month at 1:00 AM
0 1 1 * * cd /Users/genesis/TAAXDOG-CODING && npm run backup:test-restore >> /Users/genesis/TAAXDOG-CODING/logs/test-restore-cron.log 2>&1
EOF

# Backup existing crontab
crontab -l > /tmp/existing-cron 2>/dev/null || true

# Remove existing backup jobs if any
grep -v "TAAXDOG Automated Backup" /tmp/existing-cron > /tmp/cleaned-cron || true
grep -v "backup:full\|backup:incremental\|backup:verify\|backup:archive\|backup:monitor\|backup:test-restore" /tmp/cleaned-cron > /tmp/final-cron || true

# Append new backup jobs
cat /tmp/backup-cron-jobs >> /tmp/final-cron

# Install new crontab
crontab /tmp/final-cron

echo "✅ Backup cron jobs installed successfully!"
echo ""
echo "📋 Installed schedule:"
echo "  - Full backup: Daily at 2:00 AM"
echo "  - Incremental backup: Hourly from 8 AM to 8 PM"
echo "  - Verification: Daily at 4:00 AM"
echo "  - Archival: Weekly on Sundays at 3:00 AM"
echo "  - Monitoring: Every 30 minutes"
echo "  - Test restore: Monthly on 1st at 1:00 AM"
echo ""
echo "To view current cron jobs: crontab -l"
echo "To edit cron jobs: crontab -e"
echo "To remove backup cron jobs: crontab -r"

# Create log directory if it doesn't exist
mkdir -p /Users/genesis/TAAXDOG-CODING/logs

# Set proper permissions
chmod +x /Users/genesis/TAAXDOG-CODING/scripts/backup/*.ts

echo ""
echo "📝 Logs will be written to:"
echo "  - /Users/genesis/TAAXDOG-CODING/logs/backup-cron.log"
echo "  - /Users/genesis/TAAXDOG-CODING/logs/backup-verification-cron.log"
echo "  - /Users/genesis/TAAXDOG-CODING/logs/archival-cron.log"
echo "  - /Users/genesis/TAAXDOG-CODING/logs/monitoring-cron.log"
echo "  - /Users/genesis/TAAXDOG-CODING/logs/test-restore-cron.log"