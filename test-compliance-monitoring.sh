#!/bin/bash

# Test Compliance Monitoring Scripts
# Run this to verify all monitoring scripts work before setting up cron

echo "🧪 Testing TAAXDOG Compliance Monitoring Scripts"
echo "=============================================="
echo
echo "This will run each monitoring script to ensure they work correctly."
echo "Check the logs directory for output."
echo

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to run and check a script
test_script() {
    local name=$1
    local script=$2
    
    echo -n "Testing $name... "
    
    if npm run $script > /tmp/test-$script.log 2>&1; then
        echo "✅ Success"
        echo "  Output saved to: logs/${script#compliance:}-monitoring.log"
    else
        echo "❌ Failed"
        echo "  Error output:"
        tail -10 /tmp/test-$script.log
    fi
    echo
}

# Test each monitoring script
echo "1. Testing AML Monitoring"
test_script "AML Monitoring" "compliance:aml"

echo "2. Testing Privacy Monitoring"
test_script "Privacy Monitoring" "compliance:privacy"

echo "3. Testing APRA Monitoring"
test_script "APRA Monitoring" "compliance:apra"

echo "4. Testing Alert Checking"
test_script "Alert Checking" "compliance:check-alerts"

echo "5. Testing Comprehensive Monitoring"
echo "   Note: This runs all checks and may take longer"
test_script "All Compliance Checks" "compliance:all"

# Check if logs were created
echo "Checking log files..."
echo "===================="
if [ -d "logs" ]; then
    echo "Log files created:"
    ls -la logs/*.log 2>/dev/null | tail -5
else
    echo "❌ No logs directory found"
fi

echo
echo "Testing complete!"
echo
echo "Next steps:"
echo "1. Review any errors above"
echo "2. Check log files in the 'logs' directory"
echo "3. If all tests pass, set up cron jobs or PM2"
echo
echo "To set up cron jobs:"
echo "  crontab -e"
echo "  # Then paste the cron entries from ./scripts/compliance-cron-manual.sh"
echo
echo "To use PM2 instead:"
echo "  npm install -g pm2"
echo "  pm2 start ecosystem.config.js"
echo "  pm2 save"
echo "  pm2 startup"