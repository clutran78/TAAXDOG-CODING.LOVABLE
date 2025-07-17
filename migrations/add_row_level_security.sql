-- Enable Row Level Security on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS user_isolation_policy ON users;
DROP POLICY IF EXISTS goal_isolation_policy ON goals;
DROP POLICY IF EXISTS transaction_isolation_policy ON bank_transactions;
DROP POLICY IF EXISTS receipt_isolation_policy ON receipts;
DROP POLICY IF EXISTS budget_isolation_policy ON budgets;
DROP POLICY IF EXISTS budget_tracking_isolation_policy ON budget_tracking;
DROP POLICY IF EXISTS bank_connection_isolation_policy ON bank_connections;
DROP POLICY IF EXISTS bank_account_isolation_policy ON bank_accounts;
DROP POLICY IF EXISTS tax_return_isolation_policy ON tax_returns;
DROP POLICY IF EXISTS financial_insight_isolation_policy ON financial_insights;
DROP POLICY IF EXISTS ai_conversation_isolation_policy ON ai_conversations;
DROP POLICY IF EXISTS ai_insight_isolation_policy ON ai_insights;
DROP POLICY IF EXISTS ai_usage_isolation_policy ON ai_usage_tracking;

-- Create function to get current user ID (if not exists)
CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User table policies
-- Users can only see and update their own record
CREATE POLICY user_isolation_policy ON users
  FOR ALL
  USING (id = current_user_id()::TEXT);

-- Goal policies
-- Users can only access their own goals
CREATE POLICY goal_isolation_policy ON goals
  FOR ALL
  USING (user_id = current_user_id()::TEXT);

-- Transaction policies
-- Users can only access their own transactions
CREATE POLICY transaction_isolation_policy ON bank_transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bank_accounts ba
      JOIN basiq_users bu ON bu.id = ba.basiq_user_id
      WHERE ba.id = bank_transactions.bank_account_id
      AND bu.user_id = current_user_id()::TEXT
    )
  );

-- Receipt policies
-- Users can only access their own receipts
CREATE POLICY receipt_isolation_policy ON receipts
  FOR ALL
  USING ("userId" = current_user_id()::TEXT);

-- Budget policies
-- Users can only access their own budgets
CREATE POLICY budget_isolation_policy ON budgets
  FOR ALL
  USING (user_id = current_user_id()::TEXT);

-- Budget tracking policies
-- Users can only access their own budget tracking
CREATE POLICY budget_tracking_isolation_policy ON budget_tracking
  FOR ALL
  USING (user_id = current_user_id()::TEXT);

-- BankConnection policies
-- Users can only access their own bank connections
CREATE POLICY bank_connection_isolation_policy ON bank_connections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM basiq_users
      WHERE basiq_users.id = bank_connections.basiq_user_id
      AND basiq_users.user_id = current_user_id()::TEXT
    )
  );

-- Account policies
-- Users can access accounts linked to their bank connections
CREATE POLICY bank_account_isolation_policy ON bank_accounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM basiq_users
      WHERE basiq_users.id = bank_accounts.basiq_user_id
      AND basiq_users.user_id = current_user_id()::TEXT
    )
  );


-- TaxReturn policies
-- Users can only access their own tax returns
CREATE POLICY tax_return_isolation_policy ON tax_returns
  FOR ALL
  USING ("userId" = current_user_id()::TEXT);

-- FinancialInsight policies
-- Users can only access their own financial insights
CREATE POLICY financial_insight_isolation_policy ON financial_insights
  FOR ALL
  USING (user_id = current_user_id()::TEXT);

-- AIConversation policies
-- Users can only access their own AI conversations
CREATE POLICY ai_conversation_isolation_policy ON ai_conversations
  FOR ALL
  USING ("userId" = current_user_id()::TEXT);

-- AIInsight policies
-- Users can only access their own AI insights
CREATE POLICY ai_insight_isolation_policy ON ai_insights
  FOR ALL
  USING ("userId" = current_user_id()::TEXT);

-- AIUsageTracking policies
-- Users can only access their own AI usage
CREATE POLICY ai_usage_isolation_policy ON ai_usage_tracking
  FOR ALL
  USING ("userId" = current_user_id()::TEXT);


-- Admin bypass policies (for admin users)
-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = current_user_id()::TEXT
    AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add admin bypass policies for all tables
CREATE POLICY admin_bypass_user ON users
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_goal ON goals
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_transaction ON bank_transactions
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_receipt ON receipts
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_budget ON budgets
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_budget_tracking ON budget_tracking
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_bank_connection ON bank_connections
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_bank_account ON bank_accounts
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_tax_return ON tax_returns
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_financial_insight ON financial_insights
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_ai_conversation ON ai_conversations
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_ai_insight ON ai_insights
  FOR ALL
  USING (is_admin());

CREATE POLICY admin_bypass_ai_usage ON ai_usage_tracking
  FOR ALL
  USING (is_admin());

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION current_user_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO PUBLIC;

-- Create index for performance on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_user_role ON users(role) WHERE role = 'ADMIN';
CREATE INDEX IF NOT EXISTS idx_goal_userid ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_userid ON receipts("userId");
CREATE INDEX IF NOT EXISTS idx_budget_userid ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_tracking_userid ON budget_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_basiq_users_userid ON basiq_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_return_userid ON tax_returns("userId");
CREATE INDEX IF NOT EXISTS idx_financial_insight_userid ON financial_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_userid ON ai_conversations("userId");
CREATE INDEX IF NOT EXISTS idx_ai_insight_userid ON ai_insights("userId");
CREATE INDEX IF NOT EXISTS idx_ai_usage_userid ON ai_usage_tracking("userId");