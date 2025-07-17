#!/bin/bash

echo "🚀 Applying all RLS migrations..."
echo "================================"

# Counter for tracking
applied=0
failed=0

# Find all migrated files
for migrated_file in $(find pages/api -name "*-rls-migrated.ts" -type f); do
    # Get the original file name
    original_file="${migrated_file/-rls-migrated.ts/.ts}"
    backup_file="${original_file}.backup"
    
    echo -n "Processing: $(basename $original_file)... "
    
    # Check if original exists
    if [ -f "$original_file" ]; then
        # Create backup
        cp "$original_file" "$backup_file"
        
        # Apply migration
        cp "$migrated_file" "$original_file"
        
        # Remove migrated file
        rm "$migrated_file"
        
        echo "✅ Applied"
        ((applied++))
    else
        echo "❌ Original file not found"
        ((failed++))
    fi
done

echo ""
echo "Summary:"
echo "========"
echo "✅ Applied: $applied"
echo "❌ Failed: $failed"
echo ""
echo "⚠️  Important:"
echo "1. Original files are backed up with .backup extension"
echo "2. Test all endpoints before deploying to production"
echo "3. To rollback: ./scripts/rollback-migrations.sh"