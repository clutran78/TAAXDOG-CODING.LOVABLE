#!/bin/bash

echo "🔄 Rolling back RLS migrations..."
echo "================================"

# Counter for tracking
rolled_back=0
failed=0

# Find all backup files
for backup_file in $(find pages/api -name "*.ts.backup" -type f); do
    # Get the original file name
    original_file="${backup_file/.backup/}"
    
    echo -n "Rolling back: $(basename $original_file)... "
    
    # Restore from backup
    if [ -f "$backup_file" ]; then
        mv "$backup_file" "$original_file"
        echo "✅ Restored"
        ((rolled_back++))
    else
        echo "❌ Backup not found"
        ((failed++))
    fi
done

echo ""
echo "Summary:"
echo "========"
echo "✅ Rolled back: $rolled_back"
echo "❌ Failed: $failed"