#!/usr/bin/env ts-node

import { readFile, writeFile, unlink, rename, copyFile } from 'fs/promises';
import { resolve, dirname, basename } from 'path';
import { existsSync } from 'fs';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

interface MigrationFile {
  original: string;
  migrated: string;
  backup: string;
}

async function findMigratedFiles(): Promise<MigrationFile[]> {
  const { execSync } = require('child_process');
  const migratedFiles = execSync('find pages/api -name "*-rls-migrated.ts" -type f')
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);

  return migratedFiles.map((migrated) => {
    const original = migrated.replace('-rls-migrated.ts', '.ts');
    const backup = migrated.replace('-rls-migrated.ts', '.ts.backup');
    return { original, migrated, backup };
  });
}

async function showDiff(file1: string, file2: string) {
  try {
    const { execSync } = require('child_process');
    console.log(`\n📄 Comparing: ${basename(file1)}`);
    console.log('═'.repeat(60));

    // Try to use git diff for colored output
    try {
      execSync(`git diff --no-index --color ${file1} ${file2}`, { stdio: 'inherit' });
    } catch {
      // Fallback to regular diff
      execSync(`diff -u ${file1} ${file2} || true`, { stdio: 'inherit' });
    }
  } catch (error) {
    console.log('Could not generate diff');
  }
}

async function testEndpoint(apiPath: string) {
  console.log(`\n🧪 Testing endpoint: ${apiPath}`);

  // Extract the API path from the file path
  const endpoint = apiPath
    .replace('pages/api/', '/api/')
    .replace(/\[([^\]]+)\]/g, 'test-$1')
    .replace('.ts', '');

  console.log(`   Endpoint: ${endpoint}`);
  console.log('   Run manual test with: curl http://localhost:3000' + endpoint);
}

async function main() {
  console.log('🔄 RLS Migration Review and Apply Tool\n');

  const migrations = await findMigratedFiles();

  if (migrations.length === 0) {
    console.log('No migrated files found. Run the migration script first.');
    process.exit(0);
  }

  console.log(`Found ${migrations.length} migrated files to review\n`);

  let applied = 0;
  let skipped = 0;
  let errors = 0;

  for (const migration of migrations) {
    console.log('\n' + '='.repeat(80));
    console.log(`📁 File: ${migration.original}`);
    console.log(`📝 Migrated: ${migration.migrated}`);

    if (!existsSync(migration.original)) {
      console.log('❌ Original file not found!');
      errors++;
      continue;
    }

    // Show diff
    await showDiff(migration.original, migration.migrated);

    // Show test suggestion
    await testEndpoint(migration.original);

    console.log('\n📋 Options:');
    console.log('  [a] Apply migration (backup original)');
    console.log('  [t] Test first (keep for manual testing)');
    console.log('  [s] Skip this file');
    console.log('  [d] Delete migrated file (reject migration)');
    console.log('  [q] Quit');

    const answer = await question('\nYour choice: ');

    switch (answer.toLowerCase()) {
      case 'a':
        // Backup original
        await copyFile(migration.original, migration.backup);
        console.log(`✅ Backed up to: ${migration.backup}`);

        // Replace with migrated version
        await copyFile(migration.migrated, migration.original);
        console.log(`✅ Applied migration to: ${migration.original}`);

        // Remove migrated file
        await unlink(migration.migrated);
        console.log(`✅ Removed temporary file: ${migration.migrated}`);

        applied++;
        break;

      case 't':
        console.log('📌 Keeping both files for testing');
        console.log('   Original: ' + migration.original);
        console.log('   Migrated: ' + migration.migrated);
        console.log('   Test the migrated version, then manually apply if successful');
        skipped++;
        break;

      case 's':
        console.log('⏭️  Skipped');
        skipped++;
        break;

      case 'd':
        await unlink(migration.migrated);
        console.log(`🗑️  Deleted migrated file: ${migration.migrated}`);
        skipped++;
        break;

      case 'q':
        console.log('\n👋 Exiting...');
        rl.close();
        process.exit(0);

      default:
        console.log('❓ Invalid option, skipping');
        skipped++;
    }
  }

  console.log('\n📊 Summary:');
  console.log('═'.repeat(40));
  console.log(`✅ Applied: ${applied}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);

  if (applied > 0) {
    console.log('\n⚠️  Important: ');
    console.log('1. Test all applied endpoints thoroughly');
    console.log('2. Original files are backed up with .backup extension');
    console.log('3. To rollback: rename .backup files back to .ts');
    console.log('4. Update any imports that reference the changed files');
  }

  rl.close();
}

main().catch(console.error);
