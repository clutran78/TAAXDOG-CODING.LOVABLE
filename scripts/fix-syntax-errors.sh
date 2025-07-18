#!/bin/bash

echo "🔧 Fixing syntax errors in RLS-migrated files..."

# Fix sessions-rls-migrated.ts - missing closing parenthesis
echo "Fixing sessions-rls-migrated.ts..."
sed -i '' 's/});[[:space:]]*} catch (error) {/});\n    });\n  } catch (error) {/g' pages/api/auth/sessions-rls-migrated.ts

# Fix two-factor-rls-migrated.ts - Date.now() syntax
echo "Fixing two-factor-rls-migrated.ts..."
sed -i '' 's/expires: new Date(Date.now();/expires: new Date(Date.now()/g' pages/api/auth/two-factor-rls-migrated.ts

# Fix budgets/[id]/index-rls-migrated.ts - semicolon instead of comma
echo "Fixing budgets/[id]/index-rls-migrated.ts..."
sed -i '' 's/updatedAt: new Date();/updatedAt: new Date(),/g' pages/api/budgets/[id]/index-rls-migrated.ts

# Fix goals/[id]-rls-migrated.ts - extra closing parenthesis
echo "Fixing goals/[id]-rls-migrated.ts..."
sed -i '' '/return handleRLSError(error, res);/{n;/^[[:space:]]*});/d;}' pages/api/goals/[id]-rls-migrated.ts

# Fix goals/[id]/progress-rls-migrated.ts - extra closing parenthesis
echo "Fixing goals/[id]/progress-rls-migrated.ts..."
sed -i '' '/return handleRLSError(error, res);/{n;/^[[:space:]]*});/d;}' pages/api/goals/[id]/progress-rls-migrated.ts

echo "✅ Syntax errors fixed!"