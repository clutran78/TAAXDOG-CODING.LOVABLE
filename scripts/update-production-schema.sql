-- Add missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN IF NOT EXISTS "password" TEXT,
ADD COLUMN IF NOT EXISTS "image" TEXT,
ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'USER',
ADD COLUMN IF NOT EXISTS "abn" TEXT,
ADD COLUMN IF NOT EXISTS "tfn" TEXT,
ADD COLUMN IF NOT EXISTS "taxResidency" TEXT DEFAULT 'RESIDENT',
ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastLoginIp" TEXT,
ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows to have updatedAt value
UPDATE users SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;

-- Add missing columns to audit_logs table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        ALTER TABLE audit_logs 
        ADD COLUMN IF NOT EXISTS "event" TEXT DEFAULT 'UNKNOWN',
        ADD COLUMN IF NOT EXISTS "ipAddress" TEXT DEFAULT '0.0.0.0',
        ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
        ADD COLUMN IF NOT EXISTS "success" BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS "metadata" JSONB;
        
        -- Update existing rows
        UPDATE audit_logs SET "event" = 'UNKNOWN' WHERE "event" IS NULL;
        UPDATE audit_logs SET "ipAddress" = '0.0.0.0' WHERE "ipAddress" IS NULL;
    END IF;
END $$;