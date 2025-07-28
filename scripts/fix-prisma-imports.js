#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to fix - based on the build errors
const filesToFix = [
  'lib/ai/service.ts',
  'lib/basiq/client.ts',
  'lib/goals/goal-service.ts',
  'lib/middleware/auth.ts',
  'pages/api/optimized/user-dashboard.ts',
  'lib/services/tax-calculations.ts',
  'lib/db/query-patterns.ts',
  'lib/ai/base-provider.ts',
  'lib/ai/ai-service.ts',
  'lib/ai/services/financial-insights.ts',
  'lib/ai/services/tax-consultation.ts',
  'lib/ai/services/receipt-processing.ts',
  'lib/ai/error-handler.ts',
  'lib/ai/cost-optimizer.ts',
  'lib/ai/australian-tax-compliance.ts',
  'lib/stripe/subscription-service.ts',
  'lib/stripe/subscription-manager.ts',
  'lib/stripe/service.ts',
  'lib/stripe/payment-service.ts',
  'lib/stripe/invoice-service.ts',
  'lib/services/queryOptimizer.ts',
  'lib/services/insights/insights-service.ts',
  'lib/services/compliance/gstCompliance.ts',
  'lib/security/middleware.ts',
  'lib/repositories/goal-repository.ts',
  'lib/repositories/base-repository.ts',
  'lib/monitoring/api.ts',
  'lib/basiq/service.ts',
  'lib/basiq/security.ts',
  'lib/basiq/middleware.ts',
  'lib/auth-production.ts',
];

// Also find all files in pages/api that might have the issue
const apiFiles = glob.sync('pages/api/**/*.ts', { cwd: process.cwd() });
filesToFix.push(...apiFiles);

let fixedCount = 0;

filesToFix.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix named import from prisma
  if (content.includes("import { prisma } from '../prisma'") || 
      content.includes("import { prisma } from '../../prisma'") ||
      content.includes("import { prisma } from '@/lib/prisma'") ||
      content.includes("import { prisma } from './prisma'")) {
    
    content = content
      .replace(/import\s+{\s*prisma\s*}\s+from\s+['"]\.\.\/prisma['"]/g, "import prisma from '../prisma'")
      .replace(/import\s+{\s*prisma\s*}\s+from\s+['"]\.\.\/\.\.\/prisma['"]/g, "import prisma from '../../prisma'")
      .replace(/import\s+{\s*prisma\s*}\s+from\s+['"]@\/lib\/prisma['"]/g, "import prisma from '@/lib/prisma'")
      .replace(/import\s+{\s*prisma\s*}\s+from\s+['"]\.\/prisma['"]/g, "import prisma from './prisma'");
    
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${file}`);
    fixedCount++;
  }
});

console.log(`\n✨ Fixed ${fixedCount} files with incorrect prisma imports`);