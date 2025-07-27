#!/usr/bin/env node

// Load production environment
require('dotenv').config({ path: '.env.production' });

const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function validateProduction() {
  console.log('🚀 TAAXDOG PRODUCTION VALIDATION\n');

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  const issues = [];

  // 1. Environment Variables
  console.log('1️⃣  ENVIRONMENT VARIABLES\n');
  const requiredEnvVars = [
    'NODE_ENV',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'DATABASE_URL',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'EMAIL_FROM',
    'ANTHROPIC_API_KEY',
    'BASIQ_API_KEY',
  ];

  requiredEnvVars.forEach((varName) => {
    totalChecks++;
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Set`);
      passedChecks++;
    } else {
      console.log(`❌ ${varName}: Missing`);
      failedChecks++;
      issues.push(`Missing environment variable: ${varName}`);
    }
  });

  // 2. Database Connection
  console.log('\n2️⃣  DATABASE CONNECTION\n');
  totalChecks++;
  try {
    // Use the project's standard Prisma import
    const { prisma } = require('../lib/db/unifiedMonitoredPrisma');

    // Create a timeout promise
    const timeoutMs = 10000; // 10 second timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Database connection timeout after 10 seconds')),
        timeoutMs,
      );
    });

    // Create the database query promise
    const queryPromise = async () => {
      const result = await prisma.$queryRaw`SELECT NOW() as current_time`;
      await prisma.$disconnect();
      return result;
    };

    // Race the query against the timeout
    const result = await Promise.race([queryPromise(), timeoutPromise]);

    console.log('✅ Database connection: Working');
    console.log(`   Current time: ${result[0].current_time}`);
    passedChecks++;
  } catch (error) {
    console.log('❌ Database connection: Failed');
    console.log(`   Error: ${error.message}`);
    failedChecks++;
    issues.push('Database connection failed');

    // Ensure disconnection even on error
    try {
      const { prisma } = require('../lib/db/unifiedMonitoredPrisma');
      await prisma.$disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
  }

  // 3. Email Service
  console.log('\n3️⃣  EMAIL SERVICE\n');
  totalChecks++;
  if (
    process.env.EMAIL_PROVIDER === 'sendgrid' &&
    process.env.SENDGRID_API_KEY &&
    process.env.SENDGRID_API_KEY !== 'SG.your-sendgrid-api-key'
  ) {
    console.log('✅ Email service: Configured (SendGrid)');
    passedChecks++;
  } else if (process.env.SENDGRID_API_KEY === 'SG.your-sendgrid-api-key') {
    console.log('❌ Email service: Using placeholder API key');
    failedChecks++;
    issues.push('SendGrid API key is still a placeholder - set actual API key');
  } else if (process.env.EMAIL_PROVIDER === 'console') {
    console.log('⚠️  Email service: Console mode (no emails will be sent)');
    passedChecks++;
    issues.push('Email service in console mode - configure SendGrid for production');
  } else {
    console.log('❌ Email service: Not configured');
    failedChecks++;
    issues.push('Email service not configured');
  }

  // 4. Backup System
  console.log('\n4️⃣  BACKUP SYSTEM\n');
  totalChecks++;
  if (
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.BACKUP_BUCKET
  ) {
    console.log('✅ Backup system: Configured (AWS S3)');
    passedChecks++;
  } else {
    console.log('⚠️  Backup system: Not configured (manual backups only)');
    passedChecks++;
    issues.push('AWS S3 backup not configured - using manual backups');
  }

  // 5. Security Keys
  console.log('\n5️⃣  SECURITY KEYS\n');
  const securityKeys = ['NEXTAUTH_SECRET', 'JWT_SECRET', 'ENCRYPTION_KEY'];
  securityKeys.forEach((key) => {
    totalChecks++;
    if (process.env[key] && process.env[key] !== 'generate-secure-secret-here') {
      console.log(`✅ ${key}: Set`);
      passedChecks++;
    } else {
      console.log(`❌ ${key}: Not set or using placeholder`);
      failedChecks++;
      issues.push(`Security key not set: ${key}`);
    }
  });

  // 6. System Resources
  console.log('\n6️⃣  SYSTEM RESOURCES\n');
  totalChecks++;
  try {
    const { stdout } = await execAsync('df -h . | tail -1');
    const diskUsage = parseInt(stdout.split(/\s+/)[4]);
    if (diskUsage < 80) {
      console.log(`✅ Disk usage: ${diskUsage}% (OK)`);
      passedChecks++;
    } else {
      console.log(`⚠️  Disk usage: ${diskUsage}% (High)`);
      passedChecks++;
      issues.push(`High disk usage: ${diskUsage}%`);
    }
  } catch (error) {
    console.log('❌ Could not check disk usage');
    failedChecks++;
  }

  // 7. Node.js Version
  console.log('\n7️⃣  NODE.JS VERSION\n');
  totalChecks++;
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion >= 18) {
    console.log(`✅ Node.js version: ${nodeVersion} (OK)`);
    passedChecks++;
  } else {
    console.log(`❌ Node.js version: ${nodeVersion} (Requires 18+)`);
    failedChecks++;
    issues.push('Node.js version too old');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total checks: ${totalChecks}`);
  console.log(`✅ Passed: ${passedChecks}`);
  console.log(`❌ Failed: ${failedChecks}`);
  console.log(`Success rate: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);

  if (issues.length > 0) {
    console.log('\n⚠️  ISSUES TO RESOLVE:');
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
  }

  // Overall status
  console.log('\n' + '='.repeat(60));
  if (failedChecks === 0) {
    console.log('✅ PRODUCTION READY - All checks passed!');
    process.exit(0);
  } else if (
    failedChecks <= 3 &&
    !issues.some((i) => i.includes('Database') || i.includes('Security key'))
  ) {
    console.log('⚠️  MOSTLY READY - Minor issues to resolve');
    process.exit(0);
  } else {
    console.log('❌ NOT READY - Critical issues must be resolved');
    process.exit(1);
  }
}

validateProduction().catch((error) => {
  console.error('Validation failed:', error);
  process.exit(1);
});
