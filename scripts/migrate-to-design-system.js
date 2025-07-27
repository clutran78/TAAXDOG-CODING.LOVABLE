#!/usr/bin/env node

/**
 * Migration script to help update components to use the new design system
 * Usage: node scripts/migrate-to-design-system.js [component-path]
 */

const fs = require('fs');
const path = require('path');

// Mapping of old patterns to new components
const migrations = {
  // Button migrations
  buttons: [
    {
      pattern: /<button\s+className=".*?bg-blue-600.*?">([^<]*)<\/button>/g,
      replacement: '<Button variant="primary">$1</Button>',
      imports: ["import { Button } from '@/components/ui/Button';"],
    },
    {
      pattern: /<button\s+className=".*?bg-green-600.*?">([^<]*)<\/button>/g,
      replacement: '<Button variant="success">$1</Button>',
      imports: ["import { Button } from '@/components/ui/Button';"],
    },
    {
      pattern: /<button\s+className=".*?bg-red-600.*?">([^<]*)<\/button>/g,
      replacement: '<Button variant="danger">$1</Button>',
      imports: ["import { Button } from '@/components/ui/Button';"],
    },
    {
      pattern: /className="btn btn-primary"/g,
      replacement: 'variant="primary"',
      requiresComponent: 'Button',
    },
    {
      pattern: /className="btn btn-secondary"/g,
      replacement: 'variant="secondary"',
      requiresComponent: 'Button',
    },
  ],

  // Card migrations
  cards: [
    {
      pattern: /<div\s+className="bg-white rounded-lg shadow.*?">/g,
      replacement: '<Card>',
      imports: ["import { Card } from '@/components/ui/card';"],
    },
    {
      pattern: /<div\s+className="card">/g,
      replacement: '<Card>',
      imports: ["import { Card } from '@/components/ui/card';"],
    },
    {
      pattern: /<div\s+className="card-body">/g,
      replacement: '<CardContent>',
      imports: ["import { Card, CardContent } from '@/components/ui/card';"],
    },
  ],

  // Input migrations
  inputs: [
    {
      pattern: /<input\s+type="([^"]+)"\s+className=".*?px-3 py-2.*?border.*?rounded.*?"/g,
      replacement: '<Input type="$1"',
      imports: ["import { Input } from '@/components/ui/Input';"],
    },
    {
      pattern: /className=".*?form-control.*?"/g,
      replacement: '',
      requiresComponent: 'Input',
    },
  ],

  // Badge migrations
  badges: [
    {
      pattern: /<span\s+className=".*?bg-blue-100 text-blue-800.*?">([^<]*)<\/span>/g,
      replacement: '<Badge variant="primary">$1</Badge>',
      imports: ["import { Badge } from '@/components/ui/Badge';"],
    },
    {
      pattern: /<span\s+className="badge badge-(\w+)">/g,
      replacement: '<Badge variant="$1">',
      imports: ["import { Badge } from '@/components/ui/Badge';"],
    },
  ],

  // Alert migrations
  alerts: [
    {
      pattern: /<div\s+className=".*?bg-red-50.*?text-red-800.*?">(.*?)<\/div>/gs,
      replacement: '<Alert variant="danger">$1</Alert>',
      imports: ["import { Alert } from '@/components/ui/alert';"],
    },
    {
      pattern: /<div\s+className=".*?bg-green-50.*?text-green-800.*?">(.*?)<\/div>/gs,
      replacement: '<Alert variant="success">$1</Alert>',
      imports: ["import { Alert } from '@/components/ui/alert';"],
    },
  ],
};

function migrateFile(filePath) {
  console.log(`\nMigrating: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let requiredImports = new Set();
  let changesMade = [];

  // Apply migrations
  Object.entries(migrations).forEach(([category, patterns]) => {
    patterns.forEach((migration) => {
      const matches = content.match(migration.pattern);
      if (matches) {
        content = content.replace(migration.pattern, migration.replacement);
        if (migration.imports) {
          migration.imports.forEach((imp) => requiredImports.add(imp));
        }
        changesMade.push(`- ${category}: Found ${matches.length} pattern(s)`);
      }
    });
  });

  // Add imports if changes were made
  if (changesMade.length > 0) {
    const importStatements = Array.from(requiredImports).join('\n');

    // Find the last import statement
    const lastImportMatch = content.match(/^import.*?;$/gm);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      content =
        content.slice(0, lastImportIndex + lastImport.length) +
        '\n' +
        importStatements +
        content.slice(lastImportIndex + lastImport.length);
    }

    // Write the migrated file
    fs.writeFileSync(filePath, content);

    console.log('✅ Migration complete!');
    console.log('Changes made:');
    changesMade.forEach((change) => console.log(change));
  } else {
    console.log('ℹ️  No migrations needed');
  }
}

function findComponentFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach((item) => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walk(fullPath);
      } else if (stat.isFile() && (item.endsWith('.tsx') || item.endsWith('.jsx'))) {
        files.push(fullPath);
      }
    });
  }

  walk(dir);
  return files;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Design System Migration Tool\n');
  console.log('Usage:');
  console.log('  node scripts/migrate-to-design-system.js <file-or-directory>');
  console.log('  node scripts/migrate-to-design-system.js --dry-run <file-or-directory>');
  console.log('\nExamples:');
  console.log('  node scripts/migrate-to-design-system.js components/budget/');
  console.log('  node scripts/migrate-to-design-system.js components/auth/login.tsx');
  process.exit(0);
}

const targetPath = args[args.length - 1];
const isDryRun = args.includes('--dry-run');

if (!fs.existsSync(targetPath)) {
  console.error(`Error: Path not found: ${targetPath}`);
  process.exit(1);
}

const stat = fs.statSync(targetPath);

if (stat.isFile()) {
  migrateFile(targetPath);
} else if (stat.isDirectory()) {
  const files = findComponentFiles(targetPath);
  console.log(`Found ${files.length} component files to check\n`);

  files.forEach((file) => {
    if (!isDryRun) {
      migrateFile(file);
    } else {
      console.log(`Would migrate: ${file}`);
    }
  });
}

console.log('\n✨ Migration process complete!');
