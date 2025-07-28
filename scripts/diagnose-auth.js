#!/usr/bin/env node

/**
 * Authentication Diagnostic Script
 * 
 * This script helps diagnose authentication issues by checking:
 * - Required environment variables
 * - Database connectivity
 * - User existence
 * - Password validation
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET'
];

const optionalEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SENDGRID_API_KEY',
  'EMAIL_FROM'
];

function checkEnvironmentVariables() {
  console.log('🔍 Checking Environment Variables...\n');
  
  const issues = [];
  const warnings = [];
  
  // Check required variables
  for (const varName of requiredEnvVars) {
    const value = process.env[varName];
    if (!value) {
      issues.push(`❌ Missing: ${varName}`);
    } else {
      // Mask sensitive values
      if (varName === 'NEXTAUTH_SECRET') {
        console.log(`✅ ${varName}: ${value.substring(0, 8)}... (${value.length} chars)`);
      } else if (varName === 'DATABASE_URL') {
        // Parse and show safe parts
        try {
          const url = new URL(value);
          console.log(`✅ ${varName}: ${url.protocol}//${url.username}:***@${url.hostname}:${url.port}${url.pathname}${url.search}`);
        } catch (e) {
          issues.push(`❌ Invalid: ${varName} - Not a valid URL`);
        }
      } else {
        console.log(`✅ ${varName}: ${value}`);
      }
    }
  }
  
  // Check optional variables
  console.log('\n📋 Optional Variables:');
  for (const varName of optionalEnvVars) {
    const value = process.env[varName];
    if (!value) {
      warnings.push(`⚠️  Not set: ${varName}`);
    } else {
      if (varName.includes('SECRET') || varName.includes('KEY')) {
        console.log(`✅ ${varName}: ${value.substring(0, 8)}... (${value.length} chars)`);
      } else {
        console.log(`✅ ${varName}: ${value}`);
      }
    }
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(warning));
  }
  
  if (issues.length > 0) {
    console.log('\n❌ Issues:');
    issues.forEach(issue => console.log(issue));
    return false;
  }
  
  console.log('\n✅ All required environment variables are present!\n');
  return true;
}

async function checkDatabaseConnection() {
  console.log('🔍 Checking Database Connection...\n');
  
  const prisma = new PrismaClient();
  
  try {
    // Test basic connectivity
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test user table access
    const userCount = await prisma.user.count();
    console.log(`✅ User table accessible (${userCount} users)`);
    
    return true;
  } catch (error) {
    console.log('❌ Database connection failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function checkUserAuth(email, password) {
  if (!email || !password) {
    console.log('⚠️  Skipping user authentication test (no credentials provided)');
    return true;
  }
  
  console.log(`🔍 Checking User Authentication for: ${email}\n`);
  
  const prisma = new PrismaClient();
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        emailVerified: true,
        role: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      console.log('❌ User not found');
      console.log('   Suggestion: Check if the email is correct or if the user was created');
      return false;
    }
    
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
    console.log(`   Created: ${user.createdAt}`);
    console.log(`   Failed Attempts: ${user.failedLoginAttempts}`);
    console.log(`   Locked Until: ${user.lockedUntil || 'Not locked'}`);
    
    if (!user.password) {
      console.log('❌ User has no password set');
      console.log('   Suggestion: User might have been created via OAuth or password needs to be reset');
      return false;
    }
    
    console.log('✅ User has password set');
    
    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      console.log('❌ Account is locked');
      console.log(`   Locked until: ${user.lockedUntil}`);
      return false;
    }
    
    // Test password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (isPasswordValid) {
      console.log('✅ Password is valid');
    } else {
      console.log('❌ Password is invalid');
      console.log('   Suggestion: Check if the password is correct or needs to be reset');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ User authentication check failed:');
    console.log(`   Error: ${error.message}`);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

function generateFixScript() {
  console.log('\n🔧 Environment Variable Fix Script for DigitalOcean:\n');
  
  console.log('Add these environment variables in your DigitalOcean App Platform:');
  console.log('1. Go to: https://cloud.digitalocean.com/apps');
  console.log('2. Select your app');
  console.log('3. Go to Settings > App-Level Environment Variables');
  console.log('4. Add/Update these variables:\n');
  
  console.log('# Required Variables:');
  console.log('NEXTAUTH_URL=https://dev.taxreturnpro.com.au');
  console.log('NEXTAUTH_SECRET=[Generate with: openssl rand -base64 32]');
  console.log('NODE_ENV=production');
  console.log('');
  
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL=postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require');
  }
  
  console.log('\n# Generate NEXTAUTH_SECRET:');
  console.log('Run locally: openssl rand -base64 32');
  console.log('Copy the output and use it as NEXTAUTH_SECRET value');
  
  console.log('\n5. Redeploy the application after adding variables');
  console.log('6. Test login at: https://dev.taxreturnpro.com.au/auth/login\n');
}

async function main() {
  console.log('🚀 TaxReturnPro Authentication Diagnostics\n');
  console.log('==========================================\n');
  
  const envOk = checkEnvironmentVariables();
  
  if (!envOk) {
    console.log('\n❌ Environment variable issues detected');
    generateFixScript();
    process.exit(1);
  }
  
  const dbOk = await checkDatabaseConnection();
  
  if (!dbOk) {
    console.log('\n❌ Database connection issues detected');
    console.log('Please check your DATABASE_URL and ensure the database is accessible');
    process.exit(1);
  }
  
  // Test user authentication if credentials provided
  const testEmail = process.argv[2];
  const testPassword = process.argv[3];
  
  if (testEmail && testPassword) {
    const authOk = await checkUserAuth(testEmail, testPassword);
    
    if (!authOk) {
      console.log('\n❌ User authentication issues detected');
      console.log('Please check user credentials or create a new account');
      process.exit(1);
    }
  }
  
  console.log('\n✅ All authentication diagnostics passed!');
  console.log('\nIf you\'re still having login issues, check:');
  console.log('1. Browser developer console for JavaScript errors');
  console.log('2. DigitalOcean application logs for server errors');
  console.log('3. Ensure the login page is using the correct NEXTAUTH_URL');
  
  if (!testEmail) {
    console.log('\nTo test a specific user account, run:');
    console.log('node scripts/diagnose-auth.js user@example.com password123');
  }
}

main().catch(error => {
  console.error('❌ Diagnostic script failed:', error);
  process.exit(1);
}); 