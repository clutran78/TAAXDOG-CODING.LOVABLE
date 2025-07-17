-- Migration: Add Performance Indexes
-- Generated: 2025-01-17
-- Description: Adds performance indexes to improve query speed

-- User model indexes
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_createdAt_idx" ON "users"("createdAt");

-- Goal model indexes
-- Note: Some indexes may already exist, IF NOT EXISTS prevents errors
CREATE INDEX IF NOT EXISTS "goals_userId_idx" ON "goals"("user_id");
CREATE INDEX IF NOT EXISTS "goals_status_idx" ON "goals"("status");
CREATE INDEX IF NOT EXISTS "goals_targetDate_idx" ON "goals"("target_date");
CREATE INDEX IF NOT EXISTS "goals_category_idx" ON "goals"("category");
CREATE INDEX IF NOT EXISTS "goals_userId_status_idx" ON "goals"("user_id", "status");

-- bank_transactions model indexes
CREATE INDEX IF NOT EXISTS "bank_transactions_bank_account_id_idx" ON "bank_transactions"("bank_account_id");
CREATE INDEX IF NOT EXISTS "bank_transactions_transaction_date_idx" ON "bank_transactions"("transaction_date");
CREATE INDEX IF NOT EXISTS "bank_transactions_category_idx" ON "bank_transactions"("category");
CREATE INDEX IF NOT EXISTS "bank_transactions_bank_account_id_transaction_date_idx" ON "bank_transactions"("bank_account_id", "transaction_date");

-- Receipt model indexes
-- Note: Some may already exist with custom names
CREATE INDEX IF NOT EXISTS "idx_receipts_user_id" ON "receipts"("userId");
CREATE INDEX IF NOT EXISTS "idx_receipts_date" ON "receipts"("date");
CREATE INDEX IF NOT EXISTS "idx_receipts_merchant" ON "receipts"("merchant");
CREATE INDEX IF NOT EXISTS "idx_receipts_processing_status" ON "receipts"("processing_status");
CREATE INDEX IF NOT EXISTS "idx_receipts_processed_at" ON "receipts"("created_at");

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    schemaname = 'public' 
    AND tablename IN ('users', 'goals', 'bank_transactions', 'receipts')
ORDER BY 
    tablename, 
    indexname;