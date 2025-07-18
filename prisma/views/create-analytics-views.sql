-- Create materialized views for complex analytics queries
-- These views optimize frequently accessed aggregated data

-- Monthly spending summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_spending_summary AS
SELECT 
    t.user_id,
    DATE_TRUNC('month', t.created_at) as month,
    t.category,
    SUM(t.amount) as total_amount,
    COUNT(*) as transaction_count,
    AVG(t.amount) as avg_amount,
    SUM(CASE WHEN t.is_tax_deductible THEN t.amount ELSE 0 END) as deductible_amount,
    COUNT(CASE WHEN t.is_tax_deductible THEN 1 END) as deductible_count
FROM bank_transactions t
WHERE t.created_at >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '2 years')
GROUP BY t.user_id, DATE_TRUNC('month', t.created_at), t.category
WITH DATA;

-- Create index for fast lookups
CREATE INDEX idx_monthly_spending_user_month 
ON monthly_spending_summary(user_id, month DESC);

-- Tax category aggregations view
CREATE MATERIALIZED VIEW IF NOT EXISTS tax_category_summary AS
SELECT 
    t.user_id,
    DATE_TRUNC('year', t.created_at) as tax_year,
    t.category,
    SUM(CASE WHEN t.is_tax_deductible THEN t.amount ELSE 0 END) as deductible_total,
    COUNT(CASE WHEN t.is_tax_deductible THEN 1 END) as deductible_count,
    SUM(t.amount) as total_amount,
    COUNT(*) as total_count,
    MAX(t.created_at) as last_transaction_date
FROM bank_transactions t
WHERE t.is_tax_deductible = true
GROUP BY t.user_id, DATE_TRUNC('year', t.created_at), t.category
WITH DATA;

-- Create index for tax category lookups
CREATE INDEX idx_tax_category_user_year 
ON tax_category_summary(user_id, tax_year DESC);

-- Goal progress analytics view
CREATE MATERIALIZED VIEW IF NOT EXISTS goal_progress_analytics AS
SELECT 
    g.id as goal_id,
    g.user_id,
    g.name as goal_name,
    g.target_amount,
    g.current_amount,
    g.target_date,
    g.created_at,
    g.is_active,
    COUNT(DISTINCT bt.id) as transaction_count,
    COALESCE(SUM(bt.amount), 0) as total_contributed,
    CASE 
        WHEN g.target_amount > 0 THEN (g.current_amount / g.target_amount * 100)
        ELSE 0 
    END as progress_percentage,
    CASE 
        WHEN g.target_date IS NOT NULL THEN 
            GREATEST(0, EXTRACT(DAY FROM g.target_date - CURRENT_DATE))
        ELSE NULL 
    END as days_remaining,
    CASE 
        WHEN g.target_date IS NOT NULL AND g.target_amount > g.current_amount THEN
            (g.target_amount - g.current_amount) / NULLIF(GREATEST(1, EXTRACT(DAY FROM g.target_date - CURRENT_DATE)), 0)
        ELSE 0
    END as daily_target_amount
FROM goals g
LEFT JOIN bank_transactions bt ON bt.goal_id = g.id
GROUP BY g.id, g.user_id, g.name, g.target_amount, g.current_amount, 
         g.target_date, g.created_at, g.is_active
WITH DATA;

-- Create indexes for goal analytics
CREATE INDEX idx_goal_progress_user_active 
ON goal_progress_analytics(user_id, is_active, progress_percentage DESC);

-- User financial summary view
CREATE MATERIALIZED VIEW IF NOT EXISTS user_financial_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    COUNT(DISTINCT bt.id) as total_transactions,
    COUNT(DISTINCT g.id) as total_goals,
    COUNT(DISTINCT r.id) as total_receipts,
    COUNT(DISTINCT bc.id) as active_bank_connections,
    COALESCE(SUM(bt.amount), 0) as lifetime_spending,
    COALESCE(SUM(CASE WHEN bt.is_tax_deductible THEN bt.amount ELSE 0 END), 0) as lifetime_deductibles,
    COALESCE(AVG(bt.amount), 0) as avg_transaction_amount,
    MAX(bt.created_at) as last_transaction_date,
    MAX(bc.last_synced_at) as last_bank_sync
FROM users u
LEFT JOIN bank_transactions bt ON bt.user_id = u.id
LEFT JOIN goals g ON g.user_id = u.id
LEFT JOIN receipts r ON r.user_id = u.id
LEFT JOIN bank_connections bc ON bc.user_id = u.id AND bc.is_active = true
GROUP BY u.id, u.email, u.name
WITH DATA;

-- Create index for user summary
CREATE INDEX idx_user_financial_summary_id ON user_financial_summary(user_id);

-- Create refresh function for all views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_spending_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY tax_category_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY goal_progress_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_financial_summary;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to refresh views (requires pg_cron extension)
-- This should be run daily at 2 AM
-- SELECT cron.schedule('refresh-analytics-views', '0 2 * * *', 'SELECT refresh_analytics_views();');