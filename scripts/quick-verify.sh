#!/bin/bash
# Quick verification script for migration

echo "🔍 Quick Migration Verification"
echo "=============================="
echo

# Set database URL if not already set
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require"
fi

# Run Python checks
echo "1️⃣ Checking Record Counts..."
echo "----------------------------"
python3 scripts/check-counts.py
echo

echo "2️⃣ Verifying Relationships..."
echo "-----------------------------"
python3 scripts/check-relationships.py
echo

echo "3️⃣ Testing Australian Compliance..."
echo "----------------------------------"
python3 scripts/check-compliance.py
echo

echo "✅ Quick verification complete!"
echo
echo "For comprehensive validation, run: npm run migration:validate"