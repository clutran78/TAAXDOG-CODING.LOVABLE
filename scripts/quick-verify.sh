#!/bin/bash
# Quick verification script for migration

echo "🔍 Quick Migration Verification"
echo "=============================="
echo

# Set database URL if not already set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL with your PostgreSQL connection string"
    exit 1
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