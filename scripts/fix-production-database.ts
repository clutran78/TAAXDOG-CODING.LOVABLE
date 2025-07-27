#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.production' });
dotenv.config({ path: '.env' });

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function fixProductionDatabase() {
  console.log('🔧 Fixing production database schema...\n');

  try {
    // Step 1: Create missing enum types
    console.log('📝 Creating missing enum types...');

    const enumQueries = [
      `DO $$ BEGIN
        CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE "TaxResidency" AS ENUM ('RESIDENT', 'NON_RESIDENT', 'TEMPORARY_RESIDENT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE "AuthEvent" AS ENUM (
          'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET_REQUEST',
          'PASSWORD_RESET_SUCCESS', 'PASSWORD_CHANGE', 'ACCOUNT_LOCKED',
          'ACCOUNT_UNLOCKED', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED',
          'EMAIL_VERIFIED', 'REGISTRATION', 'SESSION_EXPIRED'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE "Plan" AS ENUM ('SMART', 'PRO');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE "TaxReturnStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY_TO_LODGE', 'LODGED', 'PROCESSED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'DUPLICATE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE "BudgetStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,

      `DO $$ BEGIN
        CREATE TYPE "InsightPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,
    ];

    for (const query of enumQueries) {
      await prisma.$executeRawUnsafe(query);
    }
    console.log('✅ Enum types created\n');

    // Step 2: Fix User table
    console.log('📝 Fixing User table schema...');

    // First, check if we need to rename users to User
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;

    if (tableExists[0]?.exists) {
      // Rename table if needed
      await prisma.$executeRawUnsafe(`
        ALTER TABLE IF EXISTS users RENAME TO "User";
      `);
    }

    // Add missing columns to User table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "phone" TEXT,
      ADD COLUMN IF NOT EXISTS "password" TEXT,
      ADD COLUMN IF NOT EXISTS "image" TEXT,
      ADD COLUMN IF NOT EXISTS "abn" TEXT,
      ADD COLUMN IF NOT EXISTS "tfn" TEXT,
      ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "lastLoginIp" TEXT,
      ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
    `);

    // Convert role column to enum type
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";
    `);

    // Convert taxResidency column to enum type
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ALTER COLUMN "taxResidency" TYPE "TaxResidency" USING "taxResidency"::"TaxResidency";
    `);

    console.log('✅ User table fixed\n');

    // Step 3: Fix AuditLog table
    console.log('📝 Fixing AuditLog table schema...');

    // Check if audit_logs exists and rename it
    const auditLogExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
      );
    `;

    if (auditLogExists[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE IF EXISTS audit_logs RENAME TO "AuditLog";
      `);
    }

    // Create AuditLog table if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "userId" TEXT NOT NULL,
        "event" "AuthEvent" NOT NULL,
        "ipAddress" TEXT NOT NULL,
        "userAgent" TEXT,
        "success" BOOLEAN NOT NULL DEFAULT true,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
      );
    `);

    // Add indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
      CREATE INDEX IF NOT EXISTS "AuditLog_event_idx" ON "AuditLog"("event");
      CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
    `);

    // Add foreign key constraint
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "AuditLog" 
      ADD CONSTRAINT "AuditLog_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    console.log('✅ AuditLog table fixed\n');

    // Step 4: Run Prisma push to sync remaining schema
    console.log('📝 Syncing complete schema with Prisma...');
    console.log('Please run: npx prisma db push --accept-data-loss');
    console.log('This will ensure all tables and relationships are properly configured.\n');

    // Test the connection
    console.log('🧪 Testing database connection...');
    const userCount = await prisma.user.count();
    console.log(`✅ Database connected successfully! Found ${userCount} users.\n`);

    console.log('🎉 Database fixes completed!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma db push --accept-data-loss');
    console.log('2. Restart your application');
    console.log('3. Test authentication features\n');
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure DATABASE_URL is set correctly');
    console.error('2. Check database connection and permissions');
    console.error(
      '3. Try running: npx prisma db push --force-reset (WARNING: This will reset data)',
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixProductionDatabase();
