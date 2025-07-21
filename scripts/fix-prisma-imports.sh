#!/bin/bash

echo "🔧 Fixing Prisma import paths..."
echo "================================"

# Count files before fix
BEFORE_COUNT=$(grep -r "generated/prisma" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next" | wc -l | tr -d ' ')
echo "Found $BEFORE_COUNT files with incorrect imports"

# Fix all variations of the import
echo ""
echo "Updating imports..."

# Fix relative imports like ../generated/prisma, ../../generated/prisma, ./generated/prisma
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "./node_modules/*" -not -path "./.next/*" -exec sed -i '' 's|from ["'"'"']\.\./\.\./generated/prisma["'"'"']|from "@prisma/client"|g' {} \;
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "./node_modules/*" -not -path "./.next/*" -exec sed -i '' 's|from ["'"'"']\.\./generated/prisma["'"'"']|from "@prisma/client"|g' {} \;
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "./node_modules/*" -not -path "./.next/*" -exec sed -i '' 's|from ["'"'"']\./generated/prisma["'"'"']|from "@prisma/client"|g' {} \;

# Fix alias imports like @/generated/prisma
find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "./node_modules/*" -not -path "./.next/*" -exec sed -i '' 's|from ["'"'"']@/generated/prisma["'"'"']|from "@prisma/client"|g' {} \;

# Count files after fix
AFTER_COUNT=$(grep -r "generated/prisma" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next" | wc -l | tr -d ' ')

echo ""
echo "✅ Import paths updated!"
echo "Files with incorrect imports: $BEFORE_COUNT → $AFTER_COUNT"
echo ""

# Show any remaining files (for manual review)
if [ "$AFTER_COUNT" -gt 0 ]; then
    echo "⚠️  Some files may still need manual review:"
    grep -r "generated/prisma" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next" | head -10
fi

echo ""
echo "Done! Remember to test the build locally before pushing."