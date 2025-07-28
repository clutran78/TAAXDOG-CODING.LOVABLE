#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all files with incorrect prisma imports
const findCommand = `grep -r "import { prisma }" lib/ pages/ scripts/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort | uniq`;
let files = [];

try {
  const output = execSync(findCommand, { encoding: 'utf8' });
  files = output.trim().split('\n').filter(f => f);
} catch (error) {
  console.log('No files found with incorrect imports');
  process.exit(0);
}

console.log(`Found ${files.length} files with incorrect prisma imports\n`);

let fixedCount = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    
    // Fix all variations of incorrect prisma imports
    const patterns = [
      // Standard relative imports
      [/import\s+{\s*prisma\s*}\s+from\s+['"]\.\.\/prisma['"]/g, "import prisma from '../prisma'"],
      [/import\s+{\s*prisma\s*}\s+from\s+['"]\.\.\/\.\.\/prisma['"]/g, "import prisma from '../../prisma'"],
      [/import\s+{\s*prisma\s*}\s+from\s+['"]\.\.\/\.\.\/\.\.\/prisma['"]/g, "import prisma from '../../../prisma'"],
      [/import\s+{\s*prisma\s*}\s+from\s+['"]\.\/prisma['"]/g, "import prisma from './prisma'"],
      // Absolute imports
      [/import\s+{\s*prisma\s*}\s+from\s+['"]@\/lib\/prisma['"]/g, "import prisma from '@/lib/prisma'"],
      [/import\s+{\s*prisma\s*}\s+from\s+['"]lib\/prisma['"]/g, "import prisma from 'lib/prisma'"],
      // With extra spaces or formatting
      [/import\s+{\s*prisma\s*,?\s*}\s+from\s+['"]([^'"]+prisma)['"]/g, "import prisma from '$1'"],
    ];
    
    patterns.forEach(([pattern, replacement]) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(file, content);
      console.log(`✅ Fixed: ${file}`);
      fixedCount++;
    }
  } catch (error) {
    console.log(`❌ Error fixing ${file}: ${error.message}`);
  }
});

console.log(`\n✨ Fixed ${fixedCount} files with incorrect prisma imports`);

// Verify no more incorrect imports remain
try {
  execSync(findCommand, { encoding: 'utf8' });
  console.log('\n⚠️  Some files may still have incorrect imports. Please check manually.');
} catch {
  console.log('\n✅ All prisma imports have been fixed!');
}