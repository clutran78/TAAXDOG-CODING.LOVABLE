#!/bin/bash

# Script to install compliance monitoring cron jobs

echo "📅 Installing TAAXDOG Compliance Cron Jobs"
echo "========================================="
echo

# Get the application directory
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Application directory: $APP_DIR"
echo

# Check if cron file exists
CRON_FILE="$APP_DIR/cron/compliance-monitoring.cron"
if [ ! -f "$CRON_FILE" ]; then
    echo "❌ Cron file not found: $CRON_FILE"
    exit 1
fi

# Create a temporary cron file with updated paths
TEMP_CRON="/tmp/taaxdog-compliance.cron"
sed "s|APP_DIR=.*|APP_DIR=$APP_DIR|g" "$CRON_FILE" > "$TEMP_CRON"

echo "Cron jobs to be installed:"
echo "--------------------------"
grep -E "^[0-9*]" "$TEMP_CRON" | while read -r line; do
    echo "  $line" | cut -d' ' -f1-5,7- | sed 's/cd \$APP_DIR && //'
done
echo

# Backup existing crontab
echo "Backing up existing crontab..."
crontab -l > /tmp/crontab.backup.$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
echo "✅ Backup saved"
echo

# Ask for confirmation
read -p "Do you want to install these cron jobs? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Installation cancelled"
    rm "$TEMP_CRON"
    exit 0
fi

# Install the cron jobs
echo "Installing cron jobs..."
crontab "$TEMP_CRON"

if [ $? -eq 0 ]; then
    echo "✅ Cron jobs installed successfully!"
    echo
    echo "Verify installation with: crontab -l"
    echo
    echo "📋 Installed jobs:"
    crontab -l | grep -E "compliance|TAAXDOG" | head -5
else
    echo "❌ Failed to install cron jobs"
    exit 1
fi

# Cleanup
rm "$TEMP_CRON"

echo
echo "🎉 Cron job installation complete!"
echo
echo "Monitoring schedule:"
echo "- AML monitoring: Every 4 hours"
echo "- Privacy monitoring: Daily at 2 AM"
echo "- APRA monitoring: Twice daily (6 AM, 6 PM)"
echo "- Comprehensive check: Daily at 3 AM"
echo "- Monthly report: 1st of each month"
echo
echo "Logs will be written to: $APP_DIR/logs/"