#!/bin/bash

# Apply Row Level Security Migration Script
# This script applies the RLS policies to the PostgreSQL database

set -e

echo "🔐 Applying Row Level Security Migration"
echo "========================================"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Parse DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not found in environment"
    exit 1
fi

# Extract connection details from DATABASE_URL
# Format: postgresql://username:password@host:port/database?sslmode=require
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)"

if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo "❌ Error: Could not parse DATABASE_URL"
    exit 1
fi

MIGRATION_FILE="migrations/add_row_level_security.sql"

echo "📋 Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "🚀 Applying RLS migration..."
echo ""

# Apply the migration using psql
PGPASSWORD="$DB_PASS" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$MIGRATION_FILE" \
    --set ON_ERROR_STOP=on \
    --echo-all

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ RLS migration applied successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Update your API routes to use the RLS middleware"
    echo "2. Test the policies with: npm run test-rls"
    echo "3. Monitor for any access issues in your logs"
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi