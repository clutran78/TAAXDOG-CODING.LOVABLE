#!/bin/bash

# TAAXDOG Production Deployment Checklist
# This script runs all validation checks for production deployment

set -e

echo "======================================================================"
echo "🚀 TAAXDOG PRODUCTION DEPLOYMENT CHECKLIST"
echo "======================================================================"
echo ""
echo "Starting comprehensive deployment validation..."
echo "Date: $(date)"
echo "Environment: $NODE_ENV"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
DEPLOYMENT_READY=true
WARNINGS=0
ERRORS=0

# Function to run a check safely without eval
# Usage: run_check "Check Name" command_function [critical]
#   where command_function is a function that executes the check
run_check() {
    local name=$1
    local command_function=$2
    local critical=${3:-true}
    
    echo -n "Running $name... "
    
    # Execute the command function directly
    if $command_function > /tmp/deployment-check.log 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        return 0
    else
        if [ "$critical" = true ]; then
            echo -e "${RED}❌ FAILED${NC}"
            DEPLOYMENT_READY=false
            ((ERRORS++))
        else
            echo -e "${YELLOW}⚠️  WARNING${NC}"
            ((WARNINGS++))
        fi
        echo "  See /tmp/deployment-check.log for details"
        return 1
    fi
}

# Helper functions for each check to avoid eval
check_env_vars() {
    npx tsx scripts/deployment/environment-validation.ts
}

check_node_version() {
    node -v | grep -E 'v(18|19|20)'
}

check_npm_deps() {
    npm ls --depth=0
}

check_build() {
    npm run build
}

check_performance() {
    npx tsx scripts/deployment/performance-validation.ts
}

check_db_indexes() {
    npx tsx scripts/check-pg-stats.ts
}

check_query_optimization() {
    npx tsx scripts/apply-query-optimizations.ts --dry-run
}

check_security_checklist() {
    npx tsx scripts/deployment/security-checklist.ts
}

check_security_validation() {
    npx tsx scripts/security/security-validation.ts
}

check_compliance() {
    npx tsx scripts/security/compliance-verification.ts
}

check_vulnerability_scan() {
    npm audit --production
}

check_operational_readiness() {
    npx tsx scripts/deployment/operational-readiness.ts
}

check_documentation() {
    test -f README.md && test -f docs/DEPLOYMENT.md
}

check_backup_verification() {
    npx tsx scripts/backup/backup-verification.ts --latest
}

check_monitoring_setup() {
    test -f scripts/security/security-monitoring.ts
}

check_go_live() {
    npx tsx scripts/deployment/go-live-validation.ts "$PRODUCTION_URL"
}

check_db_connection() {
    npx tsx scripts/test-db-connection.ts
}

check_migration_status() {
    npx prisma migrate status
}

check_db_backup() {
    test -f logs/backup-metadata.json
}

check_stripe_config() {
    test -n "$STRIPE_SECRET_KEY"
}

check_sendgrid_config() {
    test -n "$SENDGRID_API_KEY"
}

check_ai_service_config() {
    test -n "$ANTHROPIC_API_KEY" -o -n "$OPENROUTER_API_KEY"
}

echo "======================================================================"
echo "1. ENVIRONMENT CONFIGURATION"
echo "======================================================================"

run_check "Environment Variables" check_env_vars true
run_check "Node.js Version" check_node_version true
run_check "NPM Dependencies" check_npm_deps true
run_check "Build Process" check_build true

echo ""
echo "======================================================================"
echo "2. PERFORMANCE VALIDATION"
echo "======================================================================"

run_check "Performance Tests" check_performance false
run_check "Database Indexes" check_db_indexes false
run_check "Query Optimization" check_query_optimization false

echo ""
echo "======================================================================"
echo "3. SECURITY VERIFICATION"
echo "======================================================================"

run_check "Security Checklist" check_security_checklist true
run_check "Security Validation" check_security_validation true
run_check "Compliance Check" check_compliance true
run_check "Vulnerability Scan" check_vulnerability_scan false

echo ""
echo "======================================================================"
echo "4. OPERATIONAL READINESS"
echo "======================================================================"

run_check "Operational Readiness" check_operational_readiness false
run_check "Documentation Check" check_documentation true
run_check "Backup Verification" check_backup_verification true
run_check "Monitoring Setup" check_monitoring_setup true

echo ""
echo "======================================================================"
echo "5. GO-LIVE VALIDATION"
echo "======================================================================"

if [ -z "$PRODUCTION_URL" ]; then
    echo -e "${YELLOW}⚠️  Skipping go-live validation (PRODUCTION_URL not set)${NC}"
else
    run_check "Go-Live Tests" check_go_live true
fi

echo ""
echo "======================================================================"
echo "6. DATABASE CHECKS"
echo "======================================================================"

run_check "Database Connection" check_db_connection true
run_check "Migration Status" check_migration_status true
run_check "Database Backup" check_db_backup true

echo ""
echo "======================================================================"
echo "7. INTEGRATION CHECKS"
echo "======================================================================"

run_check "Stripe Configuration" check_stripe_config true
run_check "SendGrid Configuration" check_sendgrid_config true
run_check "AI Service Configuration" check_ai_service_config true

echo ""
echo "======================================================================"
echo "8. FINAL CHECKS"
echo "======================================================================"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Uncommitted changes detected${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ No uncommitted changes${NC}"
fi

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Not on main branch (current: $CURRENT_BRANCH)${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ On main branch${NC}"
fi

# Generate deployment report
echo ""
echo "======================================================================"
echo "GENERATING DEPLOYMENT REPORT"
echo "======================================================================"

REPORT_FILE="logs/deployment-report-$(date +%Y%m%d-%H%M%S).json"
mkdir -p logs

cat > $REPORT_FILE << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${NODE_ENV:-development}",
  "deploymentReady": $( [ "$DEPLOYMENT_READY" = true ] && echo "true" || echo "false" ),
  "errors": $ERRORS,
  "warnings": $WARNINGS,
  "checks": {
    "environment": "completed",
    "performance": "completed",
    "security": "completed",
    "operational": "completed",
    "database": "completed",
    "integrations": "completed"
  },
  "gitInfo": {
    "branch": "$CURRENT_BRANCH",
    "commit": "$(git rev-parse HEAD)",
    "uncommittedChanges": $( [ -n "$(git status --porcelain)" ] && echo "true" || echo "false" )
  }
}
EOF

echo "Report saved to: $REPORT_FILE"

# Final summary
echo ""
echo "======================================================================"
echo "DEPLOYMENT CHECKLIST SUMMARY"
echo "======================================================================"
echo ""

if [ "$DEPLOYMENT_READY" = true ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "System is ready for production deployment."
    echo ""
    echo "Next steps:"
    echo "1. Review the deployment report: $REPORT_FILE"
    echo "2. Create a deployment tag: git tag -a v1.0.0 -m 'Production release'"
    echo "3. Push to production: git push origin main --tags"
    echo "4. Monitor deployment: npm run security:monitor"
    exit 0
elif [ "$DEPLOYMENT_READY" = true ] && [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  PASSED WITH WARNINGS${NC}"
    echo ""
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo ""
    echo "System can be deployed, but review warnings first."
    exit 0
else
    echo -e "${RED}❌ DEPLOYMENT BLOCKED${NC}"
    echo ""
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo ""
    echo "Critical issues must be resolved before deployment."
    echo "Review the logs and fix all errors marked with ❌"
    exit 1
fi