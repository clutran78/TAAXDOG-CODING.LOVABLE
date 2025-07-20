#!/bin/bash

# TAAXDOG Compliance Monitoring - Manual Cron Setup
# 
# Since automatic cron installation failed, here are the steps to set up manually:

echo "📅 TAAXDOG Compliance Cron Jobs - Manual Setup"
echo "============================================="
echo
echo "To install the cron jobs manually, follow these steps:"
echo
echo "1. First, determine your TAAXDOG application directory:"
echo "   - If you cloned to your home directory: $HOME/TAAXDOG-CODING"
echo "   - Or use your actual installation path"
echo
echo "2. Open your crontab for editing:"
echo "   crontab -e"
echo
echo "3. Add these lines to your crontab, replacing [YOUR_APP_DIR] with your actual path:"
echo
cat << 'EOF'
# TAAXDOG Compliance Monitoring
# IMPORTANT: Replace [YOUR_APP_DIR] with your actual TAAXDOG installation path
# Example: APP_DIR=$HOME/TAAXDOG-CODING
# Example: APP_DIR=/opt/taaxdog
# Example: APP_DIR=/var/www/taaxdog
APP_DIR=[YOUR_APP_DIR]

# AML/CTF Transaction Monitoring (every 4 hours)
0 */4 * * * cd $APP_DIR && npm run compliance:aml >> logs/aml-monitoring.log 2>&1

# Privacy Compliance Monitoring (daily at 2 AM)
0 2 * * * cd $APP_DIR && npm run compliance:privacy >> logs/privacy-monitoring.log 2>&1

# APRA Compliance Monitoring (twice daily at 6 AM and 6 PM)
0 6,18 * * * cd $APP_DIR && npm run compliance:apra >> logs/apra-monitoring.log 2>&1

# Comprehensive Daily Monitoring (daily at 3 AM)
0 3 * * * cd $APP_DIR && npm run compliance:all >> logs/compliance-all.log 2>&1

# Monthly Compliance Report (1st of each month at 12:05 AM)
5 0 1 * * cd $APP_DIR && npm run compliance:monthly-report >> logs/monthly-report.log 2>&1

# Check for critical alerts (every hour)
0 * * * * cd $APP_DIR && npm run compliance:check-alerts >> logs/compliance-alerts.log 2>&1

# Clean up old logs (weekly on Sunday at 4 AM)
0 4 * * 0 find $APP_DIR/logs -name "*.log" -mtime +90 -delete

# Backup compliance reports (weekly on Sunday at 1 AM)
0 1 * * 0 cd $APP_DIR && npm run compliance:backup-reports >> logs/backup-reports.log 2>&1

# Health check (every 30 minutes)
*/30 * * * * echo "Compliance monitoring healthy at $(date)" > $APP_DIR/logs/cron-health.txt
EOF

echo
echo "4. Important Notes:"
echo "   - Remember to replace [YOUR_APP_DIR] with your actual path"
echo "   - Ensure the logs directory exists: mkdir -p [YOUR_APP_DIR]/logs"
echo "   - Verify npm scripts exist: npm run | grep compliance"
echo
echo "5. Save and exit the crontab editor"
echo
echo "Alternative: Set APP_DIR as an environment variable"
echo "You can also add this to your shell profile (.bashrc, .zshrc, etc.):"
echo "   export TAAXDOG_DIR=\"$HOME/TAAXDOG-CODING\""
echo "Then use \$TAAXDOG_DIR in your crontab instead"
echo
echo "6. Verify the cron jobs were added:"
echo "   crontab -l | grep compliance"
echo
echo "Alternative: Use a process manager like PM2"
echo "==========================================="
echo
echo "For production environments, consider using PM2:"
echo
echo "1. Install PM2:"
echo "   npm install -g pm2"
echo
echo "2. Create ecosystem file:"
echo "   pm2 init"
echo
echo "3. Configure scheduled tasks in ecosystem.config.js"
echo
echo "4. Start PM2:"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"