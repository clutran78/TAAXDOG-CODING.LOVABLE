-- Add performance indexes for optimized queries
-- These indexes significantly improve query performance for common access patterns

-- Compound indexes for transaction queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_user_date 
  ON "Transaction" ("userId", "date" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_user_type_date 
  ON "Transaction" ("userId", "type", "date" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_user_category 
  ON "Transaction" ("userId", "category");

-- Index for transaction search queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_search 
  ON "Transaction" ("userId", "description", "merchant");

-- Goal indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_goal_user_status 
  ON "Goal" ("userId", "status") 
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_goal_user_active 
  ON "Goal" ("userId") 
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

-- Bank account indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bankaccount_user_status 
  ON "BankAccount" ("userId", "status") 
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bankaccount_user_active 
  ON "BankAccount" ("userId") 
  WHERE "status" IN ('ACTIVE', 'CONNECTED') AND "deletedAt" IS NULL;

-- Receipt indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipt_user_date 
  ON "Receipt" ("userId", "createdAt" DESC) 
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipt_user_status 
  ON "Receipt" ("userId", "status");

-- Budget indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_user_active 
  ON "Budget" ("userId") 
  WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_user_category 
  ON "Budget" ("userId", "category");

-- Audit log indexes for compliance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditlog_user_event 
  ON "AuditLog" ("userId", "event", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditlog_event_date 
  ON "AuditLog" ("event", "createdAt" DESC);

-- Partial indexes for business expense tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_business_expenses 
  ON "Transaction" ("userId", "taxCategory", "date" DESC) 
  WHERE "isBusinessExpense" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_tax_deductible 
  ON "Transaction" ("userId", "date" DESC) 
  WHERE "taxCategory" IS NOT NULL AND "isBusinessExpense" = true;

-- User indexes for authentication queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email_active 
  ON "User" (LOWER("email")) 
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_active 
  ON "User" ("id") 
  WHERE "deletedAt" IS NULL AND "isLocked" = false;

-- Session indexes for auth performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_user 
  ON "Session" ("userId", "expires") 
  WHERE "expires" > NOW();

-- Text search indexes for full-text search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_description_search 
  ON "Transaction" USING gin(to_tsvector('english', "description"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_merchant_search 
  ON "Transaction" USING gin(to_tsvector('english', COALESCE("merchant", '')));

-- Indexes for aggregation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_aggregation 
  ON "Transaction" ("userId", "type", "category", "date" DESC);

-- API metrics indexes for monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apimetric_endpoint_time 
  ON "ApiMetric" ("endpoint", "recordedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apimetric_performance 
  ON "ApiMetric" ("averageDuration" DESC, "recordedAt" DESC) 
  WHERE "errorRate" < 0.1;

-- Analyze tables to update statistics after index creation
ANALYZE "Transaction";
ANALYZE "Goal";
ANALYZE "BankAccount";
ANALYZE "User";
ANALYZE "Budget";
ANALYZE "Receipt";
ANALYZE "AuditLog";