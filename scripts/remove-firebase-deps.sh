#!/bin/bash

# Script to remove all Firebase dependencies and clean up

echo "🔥 Removing Firebase dependencies..."

# Remove firebase_config.py and its compiled version
rm -f firebase_config.py
rm -rf __pycache__/firebase_config.*

# Remove Firebase-related scripts
echo "📄 Removing Firebase migration scripts..."
rm -f scripts/migrate-firebase-users.ts
rm -f scripts/check-migration-status.ts
rm -f scripts/firebase-*.js
rm -f scripts/prepare-firebase-migration.js

# Clean up node_modules if it exists
if [ -d "node_modules" ]; then
    echo "🧹 Cleaning node_modules..."
    rm -rf node_modules
fi

# Remove package-lock.json to ensure clean dependency tree
if [ -f "package-lock.json" ]; then
    echo "🔒 Removing package-lock.json..."
    rm -f package-lock.json
fi

# Install fresh dependencies
echo "📦 Installing fresh dependencies..."
npm install

echo "✅ Firebase dependencies removed successfully!"
echo ""
echo "Next steps:"
echo "1. Commit the updated package.json and package-lock.json"
echo "2. Update any remaining imports in the codebase"
echo "3. Test the application to ensure everything works"