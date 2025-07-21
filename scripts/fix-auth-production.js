#!/usr/bin/env node

// Script to diagnose and fix authentication issues in production

const { PrismaClient } = require('../generated/prisma');

async function diagnoseAuth() {
  console.log('🔍 Diagnosing Authentication Issues...\n');

  // Check environment variables
  console.log('1. Checking Environment Variables:');
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'NODE_ENV'
  ];

  const missingVars = [];
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      console.log(`❌ ${varName}: NOT SET`);
      missingVars.push(varName);
    } else {
      const value = varName.includes('SECRET') || varName.includes('PASSWORD') 
        ? '[HIDDEN]' 
        : process.env[varName].substring(0, 50) + '...';
      console.log(`✅ ${varName}: ${value}`);
    }
  });

  if (missingVars.length > 0) {
    console.log('\n⚠️  Missing required environment variables:', missingVars.join(', '));
    console.log('Please ensure all environment variables are set in your deployment platform.\n');
  }

  // Test database connection
  console.log('\n2. Testing Database Connection:');
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Check if User table exists and has the required columns
    const userCount = await prisma.user.count();
    console.log(`✅ User table accessible. Total users: ${userCount}`);

    // Check for password reset columns
    const sampleUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        password: true,
        passwordResetToken: true,
        passwordResetExpires: true,
      }
    });

    if (sampleUser) {
      console.log('✅ User schema has required password reset fields');
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.log('\nPossible solutions:');
    console.log('1. Check DATABASE_URL is correct');
    console.log('2. Ensure database is accessible from production server');
    console.log('3. Run migrations: npx prisma migrate deploy');
  } finally {
    await prisma.$disconnect();
  }

  // Check NextAuth configuration
  console.log('\n3. NextAuth Configuration:');
  if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
    console.log('❌ NEXTAUTH_SECRET is missing or too short');
    console.log('Generate a secure secret with: openssl rand -base64 32');
  } else {
    console.log('✅ NEXTAUTH_SECRET is set');
  }

  if (!process.env.NEXTAUTH_URL) {
    console.log('❌ NEXTAUTH_URL is not set');
  } else {
    console.log(`✅ NEXTAUTH_URL: ${process.env.NEXTAUTH_URL}`);
  }

  // Provide deployment instructions
  console.log('\n📋 Deployment Checklist:');
  console.log('1. Set all environment variables in your deployment platform');
  console.log('2. Use production DATABASE_URL from .env.local');
  console.log('3. Generate secure NEXTAUTH_SECRET: openssl rand -base64 32');
  console.log('4. Set NEXTAUTH_URL to your production domain');
  console.log('5. Run database migrations if needed');
  console.log('6. Restart your application after changes');

  console.log('\n💡 Example environment variables for DigitalOcean App Platform:');
  console.log('DATABASE_URL=postgresql://[from .env.local]');
  console.log('NEXTAUTH_URL=https://your-app.ondigitalocean.app');
  console.log('NEXTAUTH_SECRET=[generate with openssl]');
  console.log('NODE_ENV=production');
}

// Run diagnostics
diagnoseAuth().catch(console.error);