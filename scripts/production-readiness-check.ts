#!/usr/bin/env ts-node

import { readFile, readdir } from 'fs/promises';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

interface CheckResult {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: CheckResult[] = [];

function addResult(category: string, check: string, status: 'pass' | 'fail' | 'warn', message: string) {
  results.push({ category, check, status, message });
}

async function checkEnvironment() {
  console.log('🔍 Checking Environment Configuration...\n');
  
  // Check encryption key
  if (process.env.FIELD_ENCRYPTION_KEY) {
    if (process.env.FIELD_ENCRYPTION_KEY.length === 64) {
      addResult('Environment', 'Encryption Key', 'pass', 'Valid 64-character key found');
    } else {
      addResult('Environment', 'Encryption Key', 'fail', `Invalid key length: ${process.env.FIELD_ENCRYPTION_KEY.length}`);
    }
  } else {
    addResult('Environment', 'Encryption Key', 'fail', 'FIELD_ENCRYPTION_KEY not set');
  }

  // Check database URL
  if (process.env.DATABASE_URL) {
    if (process.env.DATABASE_URL.includes('sslmode=require')) {
      addResult('Environment', 'Database SSL', 'pass', 'SSL mode enabled');
    } else {
      addResult('Environment', 'Database SSL', 'warn', 'SSL mode not explicitly required');
    }
  } else {
    addResult('Environment', 'Database URL', 'fail', 'DATABASE_URL not set');
  }

  // Check NextAuth
  if (process.env.NEXTAUTH_SECRET) {
    addResult('Environment', 'NextAuth Secret', 'pass', 'Secret configured');
  } else {
    addResult('Environment', 'NextAuth Secret', 'fail', 'NEXTAUTH_SECRET not set');
  }
}

async function checkMigrations() {
  console.log('🔍 Checking API Migrations...\n');
  
  const apiDir = resolve(__dirname, '../pages/api');
  let totalFiles = 0;
  let migratedFiles = 0;
  let pendingMigrations = 0;

  async function scanDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        if (!entry.name.includes('[...nextauth]') && 
            !entry.name.includes('test') &&
            !entry.name.includes('health')) {
          totalFiles++;
          
          // Check if file has RLS middleware
          const content = await readFile(fullPath, 'utf-8');
          if (content.includes('withRLSMiddleware')) {
            migratedFiles++;
          } else if (content.includes('getServerSession') && content.includes('userId')) {
            pendingMigrations++;
          }
          
          // Check for pending migration files
          if (entry.name.includes('-rls-migrated')) {
            addResult('Migrations', 'Pending Files', 'warn', `Found unmigrated file: ${entry.name}`);
          }
        }
      }
    }
  }

  await scanDir(apiDir);
  
  const migrationRate = totalFiles > 0 ? (migratedFiles / totalFiles * 100).toFixed(1) : 0;
  
  if (migrationRate === '100.0') {
    addResult('Migrations', 'API Routes', 'pass', `All ${totalFiles} API routes migrated`);
  } else if (parseInt(migrationRate as string) >= 80) {
    addResult('Migrations', 'API Routes', 'warn', `${migratedFiles}/${totalFiles} routes migrated (${migrationRate}%)`);
  } else {
    addResult('Migrations', 'API Routes', 'fail', `Only ${migratedFiles}/${totalFiles} routes migrated (${migrationRate}%)`);
  }
  
  if (pendingMigrations > 0) {
    addResult('Migrations', 'Pending Routes', 'warn', `${pendingMigrations} routes need migration`);
  }
}

async function checkSecurity() {
  console.log('🔍 Checking Security Configuration...\n');
  
  // Check if RLS migration has been applied
  const rlsMigration = resolve(__dirname, '../migrations/add_row_level_security.sql');
  if (existsSync(rlsMigration)) {
    addResult('Security', 'RLS Migration', 'pass', 'RLS migration file exists');
  } else {
    addResult('Security', 'RLS Migration', 'fail', 'RLS migration file not found');
  }

  // Check encryption library
  const encryptionLib = resolve(__dirname, '../lib/encryption.ts');
  if (existsSync(encryptionLib)) {
    addResult('Security', 'Encryption Library', 'pass', 'Encryption library implemented');
  } else {
    addResult('Security', 'Encryption Library', 'fail', 'Encryption library not found');
  }

  // Check RLS middleware
  const rlsMiddleware = resolve(__dirname, '../lib/middleware/rls-middleware.ts');
  if (existsSync(rlsMiddleware)) {
    addResult('Security', 'RLS Middleware', 'pass', 'RLS middleware implemented');
  } else {
    addResult('Security', 'RLS Middleware', 'fail', 'RLS middleware not found');
  }
}

async function checkDocumentation() {
  console.log('🔍 Checking Documentation...\n');
  
  const docs = [
    'RLS_IMPLEMENTATION_GUIDE.md',
    'RLS_MIGRATION_GUIDE.md',
    'SECURITY_IMPLEMENTATION_SUMMARY.md',
    'SECURITY_DEPLOYMENT_CHECKLIST.md'
  ];

  for (const doc of docs) {
    const docPath = resolve(__dirname, '..', doc);
    if (existsSync(docPath)) {
      addResult('Documentation', doc, 'pass', 'Documentation exists');
    } else {
      addResult('Documentation', doc, 'warn', 'Documentation missing');
    }
  }
}

async function checkScripts() {
  console.log('🔍 Checking Utility Scripts...\n');
  
  const scripts = [
    'test-rls-policies.ts',
    'test-encryption.ts',
    'encrypt-existing-data.ts',
    'test-security-complete.ts',
    'monitor-rls-performance.ts'
  ];

  for (const script of scripts) {
    const scriptPath = resolve(__dirname, script);
    if (existsSync(scriptPath)) {
      addResult('Scripts', script, 'pass', 'Script available');
    } else {
      addResult('Scripts', script, 'warn', 'Script missing');
    }
  }
}

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 PRODUCTION READINESS REPORT');
  console.log('='.repeat(80) + '\n');

  const categories = [...new Set(results.map(r => r.category))];
  
  for (const category of categories) {
    console.log(`\n${category}:`);
    console.log('-'.repeat(category.length + 1));
    
    const categoryResults = results.filter(r => r.category === category);
    for (const result of categoryResults) {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️ ' : '❌';
      console.log(`${icon} ${result.check}: ${result.message}`);
    }
  }

  // Summary
  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warn').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const total = results.length;

  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`⚠️  Warnings: ${warnings}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);

  const score = (passed / total * 100).toFixed(1);
  console.log(`\n🎯 Readiness Score: ${score}%`);

  if (failed === 0 && warnings <= 2) {
    console.log('\n✅ System is READY for production deployment!');
  } else if (failed === 0) {
    console.log('\n⚠️  System is MOSTLY READY - address warnings before deployment');
  } else {
    console.log('\n❌ System is NOT READY - critical issues must be resolved');
  }

  // Action items
  console.log('\n📋 Action Items:');
  let actionCount = 1;
  
  for (const result of results) {
    if (result.status === 'fail') {
      console.log(`${actionCount}. [CRITICAL] Fix ${result.category} - ${result.check}: ${result.message}`);
      actionCount++;
    }
  }
  
  for (const result of results) {
    if (result.status === 'warn') {
      console.log(`${actionCount}. [RECOMMENDED] Address ${result.category} - ${result.check}: ${result.message}`);
      actionCount++;
    }
  }
}

async function main() {
  console.log('🚀 Production Readiness Check\n');
  console.log('Checking system configuration for production deployment...\n');

  await checkEnvironment();
  await checkMigrations();
  await checkSecurity();
  await checkDocumentation();
  await checkScripts();
  
  generateReport();
}

main().catch(console.error);