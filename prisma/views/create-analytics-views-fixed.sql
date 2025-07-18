-- Create materialized views for complex analytics queries
-- Adjusted for actual database schema

-- Monthly spending summary view for bank transactions
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_spending_summary AS
SELECT 
    ba.basiq_user_id as user_id,
    DATE_TRUNC('month', t.transaction_date) as month,
    t.category,
    SUM(t.amount) as total_amount,
    COUNT(*) as transaction_count,
    AVG(t.amount) as avg_amount,
    SUM(CASE WHEN t.is_business_expense THEN t.amount ELSE 0 END) as deductible_amount,
    COUNT(CASE WHEN t.is_business_expense THEN 1 END) as deductible_count
FROM bank_transactions t
JOIN bank_accounts ba ON t.bank_account_id = ba.id
WHERE t.transaction_date >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '2 years')
  AND t.amount > 0
GROUP BY ba.basiq_user_id, DATE_TRUNC('month', t.transaction_date), t.category
WITH DATA;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_monthly_spending_user_month 
ON monthly_spending_summary(user_id, month DESC);

-- Tax category aggregations view
CREATE MATERIALIZED VIEW IF NOT EXISTS tax_category_summary AS
SELECT 
    ba.basiq_user_id as user_id,
    DATE_TRUNC('year', t.transaction_date) as tax_year,
    t.tax_category,
    SUM(CASE WHEN t.is_business_expense THEN t.amount ELSE 0 END) as deductible_total,
    COUNT(CASE WHEN t.is_business_expense THEN 1 END) as deductible_count,
    SUM(t.amount) as total_amount,
    COUNT(*) as total_count,
    MAX(t.transaction_date) as last_transaction_date
FROM bank_transactions t
JOIN bank_accounts ba ON t.bank_account_id = ba.id
WHERE t.is_business_expense = true
  AND t.tax_category IS NOT NULL
GROUP BY ba.basiq_user_id, DATE_TRUNC('year', t.transaction_date), t.tax_category
WITH DATA;

-- Create index for tax category lookups
CREATE INDEX IF NOT EXISTS idx_tax_category_user_year 
ON tax_category_summary(user_id, tax_year DESC);

-- Goal progress analytics view (simplified)
CREATE MATERIALIZED VIEW IF NOT EXISTS goal_progress_analytics AS
SELECT 
    g.id as goal_id,
    g.user_id,
    g.title as goal_name,
    g.target_amount,
    g.current_amount,
    g.target_date,
    g.created_at,
    g.status,
    CASE 
        WHEN g.target_amount > 0 THEN (g.current_amount / g.target_amount * 100)
        ELSE 0 
    END as progress_percentage,
    CASE 
        WHEN g.target_date IS NOT NULL THEN 
            GREATEST(0, g.target_date - CURRENT_DATE)
        ELSE NULL 
    END as days_remaining,
    CASE 
        WHEN g.target_date IS NOT NULL AND g.target_amount > g.current_amount THEN
            (g.target_amount - g.current_amount) / NULLIF(GREATEST(1, g.target_date - CURRENT_DATE), 0)
        ELSE 0
    END as daily_target_amount
FROM goals g
WITH DATA;

-- Create indexes for goal analytics
CREATE INDEX IF NOT EXISTS idx_goal_progress_user_active 
ON goal_progress_analytics(user_id, status);

-- User financial summary view (simplified for existing schema)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_financial_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    COUNT(DISTINCT r.id) as total_receipts,
    COUNT(DISTINCT g.id) as total_goals,
    COALESCE(SUM(r.total_amount), 0) as total_receipt_amount,
    COALESCE(AVG(r.total_amount), 0) as avg_receipt_amount
FROM users u
LEFT JOIN receipts r ON r."userId" = u.id
LEFT JOIN goals g ON g.user_id = u.id
GROUP BY u.id, u.email, u.name
WITH DATA;

-- Create index for user summary
CREATE INDEX IF NOT EXISTS idx_user_financial_summary_id ON user_financial_summary(user_id);

-- Create refresh function for all views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    -- Use non-concurrent refresh if concurrent is not available
    REFRESH MATERIALIZED VIEW monthly_spending_summary;
    REFRESH MATERIALIZED VIEW tax_category_summary;
    REFRESH MATERIALIZED VIEW goal_progress_analytics;
    REFRESH MATERIALIZED VIEW user_financial_summary;
END;
$$ LANGUAGE plpgsql;