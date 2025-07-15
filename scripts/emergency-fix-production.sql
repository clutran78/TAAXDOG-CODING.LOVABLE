-- Emergency Production Database Fix
-- Run this script to fix authentication issues

-- Step 1: Create missing enum types
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TaxResidency" AS ENUM ('RESIDENT', 'NON_RESIDENT', 'TEMPORARY_RESIDENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AuthEvent" AS ENUM (
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_RESET_REQUEST',
    'PASSWORD_RESET_SUCCESS', 'PASSWORD_CHANGE', 'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED',
    'EMAIL_VERIFIED', 'REGISTRATION', 'SESSION_EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Step 2: Fix table names (if using old schema)
ALTER TABLE IF EXISTS users RENAME TO "User";
ALTER TABLE IF EXISTS audit_logs RENAME TO "AuditLog";

-- Step 3: Add missing columns to User table
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

-- Step 4: Fix role column type (convert text to enum)
DO $$ BEGIN
  ALTER TABLE "User" 
  ALTER COLUMN "role" TYPE "Role" 
  USING CASE 
    WHEN "role" = 'USER' THEN 'USER'::"Role"
    WHEN "role" = 'ADMIN' THEN 'ADMIN'::"Role"
    WHEN "role" = 'ACCOUNTANT' THEN 'ACCOUNTANT'::"Role"
    WHEN "role" = 'SUPPORT' THEN 'SUPPORT'::"Role"
    ELSE 'USER'::"Role"
  END;
EXCEPTION WHEN OTHERS THEN null; END $$;

-- Step 5: Fix taxResidency column type
DO $$ BEGIN
  ALTER TABLE "User" 
  ALTER COLUMN "taxResidency" TYPE "TaxResidency" 
  USING CASE 
    WHEN "taxResidency" = 'RESIDENT' THEN 'RESIDENT'::"TaxResidency"
    WHEN "taxResidency" = 'NON_RESIDENT' THEN 'NON_RESIDENT'::"TaxResidency"
    WHEN "taxResidency" = 'TEMPORARY_RESIDENT' THEN 'TEMPORARY_RESIDENT'::"TaxResidency"
    ELSE 'RESIDENT'::"TaxResidency"
  END;
EXCEPTION WHEN OTHERS THEN null; END $$;

-- Step 6: Create AuditLog table with correct structure
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

-- Step 7: Create indexes
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_event_idx" ON "AuditLog"("event");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Step 8: Add foreign key constraint (if User table has data)
DO $$ BEGIN
  ALTER TABLE "AuditLog" 
  ADD CONSTRAINT "AuditLog_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN OTHERS THEN null; END $$;

-- Verify the fix
SELECT 'User table columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'User' 
ORDER BY ordinal_position;

SELECT 'AuditLog table columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'AuditLog' 
ORDER BY ordinal_position;