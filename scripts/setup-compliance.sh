#!/bin/bash

# TAAXDOG Compliance Setup Script
# This script helps set up the compliance features

set -e

echo "🚀 TAAXDOG Compliance Setup"
echo "=========================="
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command_exists npx; then
    echo "❌ npm/npx is not installed"
    exit 1
fi

echo "✅ Prerequisites satisfied"
echo

# Step 1: Database Migration
echo "Step 1: Database Migration"
echo "--------------------------"
echo "⚠️  Note: This requires database create permissions."
echo "For production, apply the migration manually using:"
echo "psql -U <user> -h <host> -d <database> -f prisma/migrations/20250118_add_compliance_features/migration.sql"
echo
read -p "Do you want to run the migration now? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running Prisma migration..."
    npx prisma migrate deploy
    echo "✅ Migration completed"
else
    echo "⏭️  Skipping migration (run manually later)"
fi
echo

# Step 2: Generate Prisma Client
echo "Step 2: Generate Prisma Client"
echo "------------------------------"
npx prisma generate
echo "✅ Prisma client generated"
echo

# Step 3: Environment Variables
echo "Step 3: Environment Variables"
echo "----------------------------"
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    echo "Creating .env from template..."
    cp .env.example .env
    echo "✅ Created .env file"
fi

if [ -f .env.compliance.example ]; then
    echo
    echo "📋 Compliance environment variables template available"
    echo "Please add the following to your .env file:"
    echo
    cat .env.compliance.example | grep -E "^[A-Z]" | head -10
    echo "... (see .env.compliance.example for full list)"
else
    echo "⚠️  .env.compliance.example not found"
fi
echo

# Step 4: Create Required Directories
echo "Step 4: Create Required Directories"
echo "----------------------------------"
mkdir -p compliance-reports
mkdir -p backups/compliance
mkdir -p logs
echo "✅ Directories created"
echo

# Step 5: Set Script Permissions
echo "Step 5: Set Script Permissions"
echo "-----------------------------"
chmod +x scripts/compliance/*.ts
chmod +x scripts/setup-compliance.sh
echo "✅ Scripts are executable"
echo

# Step 6: Install Cron Jobs
echo "Step 6: Cron Job Setup"
echo "---------------------"
if [ -f cron/compliance-monitoring.cron ]; then
    echo "📋 Cron configuration available at: cron/compliance-monitoring.cron"
    echo
    echo "To install cron jobs:"
    echo "1. Edit cron file to set correct paths"
    echo "2. Run: crontab cron/compliance-monitoring.cron"
    echo
    read -p "View cron configuration? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cat cron/compliance-monitoring.cron | grep -E "^[^#]" | head -10
        echo "... (truncated)"
    fi
else
    echo "⚠️  Cron configuration not found"
fi
echo

# Step 7: Test Compliance Scripts
echo "Step 7: Test Compliance Scripts"
echo "------------------------------"
echo "Testing script availability..."

SCRIPTS=(
    "compliance:aml"
    "compliance:privacy"
    "compliance:apra"
    "compliance:all"
)

for script in "${SCRIPTS[@]}"; do
    if npm run "$script" -- --help >/dev/null 2>&1; then
        echo "✅ $script available"
    else
        echo "❌ $script not working"
    fi
done
echo

# Step 8: Admin Training
echo "Step 8: Admin Training"
echo "--------------------"
echo "📚 Admin training documentation available at:"
echo "   docs/ADMIN_COMPLIANCE_TRAINING.md"
echo
echo "Please ensure all admins complete training before using compliance features."
echo

# Summary
echo "================================"
echo "🎉 Compliance Setup Complete!"
echo "================================"
echo
echo "Next steps:"
echo "1. ✏️  Configure environment variables in .env"
echo "2. 🗄️  Apply database migration (if skipped)"
echo "3. ⏰ Install cron jobs for monitoring"
echo "4. 🔐 Set up external API integrations"
echo "5. 👥 Train admin staff"
echo "6. 🧪 Test in development environment"
echo
echo "Documentation:"
echo "- Compliance Features: docs/COMPLIANCE.md"
echo "- Environment Setup: docs/COMPLIANCE_ENV_SETUP.md"
echo "- Admin Training: docs/ADMIN_COMPLIANCE_TRAINING.md"
echo
echo "For support: compliance@taxreturnpro.com.au"