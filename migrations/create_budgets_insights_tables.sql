-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    monthly_budget DECIMAL(15,2),
    target_savings DECIMAL(15,2),
    monthly_income DECIMAL(15,2),
    predictions JSONB,
    category_limits JSONB,
    confidence_score DECIMAL(3,2),
    ai_provider VARCHAR(50),
    ai_model VARCHAR(100),
    analysis_period VARCHAR(50),
    prediction_period VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for budgets
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_status ON budgets(status);
CREATE INDEX idx_budgets_created_at ON budgets(created_at);

-- Create budget tracking table
CREATE TABLE IF NOT EXISTS budget_tracking (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    budget_id TEXT REFERENCES budgets(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER,
    year INTEGER,
    predicted_amount DECIMAL(15,2),
    actual_amount DECIMAL(15,2),
    variance DECIMAL(15,2),
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for budget tracking
CREATE INDEX idx_budget_tracking_budget_id ON budget_tracking(budget_id);
CREATE INDEX idx_budget_tracking_user_id ON budget_tracking(user_id);
CREATE INDEX idx_budget_tracking_month_year ON budget_tracking(month, year);
CREATE INDEX idx_budget_tracking_category ON budget_tracking(category);

-- Create financial insights table
CREATE TABLE IF NOT EXISTS financial_insights (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    insight_type VARCHAR(100),
    category VARCHAR(100),
    content JSONB,
    confidence_score DECIMAL(3,2),
    source_data_ids TEXT[],
    provider VARCHAR(50),
    model VARCHAR(100),
    title VARCHAR(255),
    description TEXT,
    recommendations JSONB,
    priority VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Create indexes for financial insights
CREATE INDEX idx_financial_insights_user_id ON financial_insights(user_id);
CREATE INDEX idx_financial_insights_type ON financial_insights(insight_type);
CREATE INDEX idx_financial_insights_category ON financial_insights(category);
CREATE INDEX idx_financial_insights_priority ON financial_insights(priority);
CREATE INDEX idx_financial_insights_is_active ON financial_insights(is_active);
CREATE INDEX idx_financial_insights_created_at ON financial_insights(created_at);

-- Create trigger to update updated_at for budgets
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE
    ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();