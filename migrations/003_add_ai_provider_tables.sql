-- AI Conversations table for storing chat history and context
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    messages JSONB NOT NULL,
    context JSONB,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for ai_conversations
CREATE INDEX IF NOT EXISTS ai_conversations_user_id_idx ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS ai_conversations_session_id_idx ON ai_conversations(session_id);
CREATE INDEX IF NOT EXISTS ai_conversations_created_at_idx ON ai_conversations(created_at);

-- AI Generated Insights table for storing analysis results
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    insight_type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    content JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    source_data_ids UUID[],
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Indexes for ai_insights
CREATE INDEX IF NOT EXISTS ai_insights_user_id_idx ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS ai_insights_type_idx ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS ai_insights_category_idx ON ai_insights(category);
CREATE INDEX IF NOT EXISTS ai_insights_is_active_idx ON ai_insights(is_active);
CREATE INDEX IF NOT EXISTS ai_insights_created_at_idx ON ai_insights(created_at);

-- AI Usage Tracking table for monitoring costs and performance
CREATE TABLE IF NOT EXISTS ai_usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for ai_usage_tracking
CREATE INDEX IF NOT EXISTS ai_usage_tracking_user_id_idx ON ai_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS ai_usage_tracking_provider_idx ON ai_usage_tracking(provider);
CREATE INDEX IF NOT EXISTS ai_usage_tracking_operation_type_idx ON ai_usage_tracking(operation_type);
CREATE INDEX IF NOT EXISTS ai_usage_tracking_created_at_idx ON ai_usage_tracking(created_at);

-- AI Cache table for storing repeated queries
CREATE TABLE IF NOT EXISTS ai_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    operation_type VARCHAR(100) NOT NULL,
    input_hash VARCHAR(64) NOT NULL,
    response JSONB NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- Indexes for ai_cache
CREATE INDEX IF NOT EXISTS ai_cache_key_idx ON ai_cache(cache_key);
CREATE INDEX IF NOT EXISTS ai_cache_operation_type_idx ON ai_cache(operation_type);
CREATE INDEX IF NOT EXISTS ai_cache_expires_at_idx ON ai_cache(expires_at);

-- AI Provider Health table for circuit breaker pattern
CREATE TABLE IF NOT EXISTS ai_provider_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'healthy',
    consecutive_failures INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP,
    last_success_at TIMESTAMP,
    circuit_open_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider)
);

-- Update trigger for updated_at columns
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_provider_health_updated_at BEFORE UPDATE ON ai_provider_health
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create enum types for consistency
DO $$ BEGIN
    CREATE TYPE ai_provider AS ENUM ('anthropic', 'openrouter', 'gemini');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_operation_type AS ENUM (
        'tax_consultation',
        'receipt_processing',
        'financial_insights',
        'report_commentary',
        'document_analysis',
        'chat_response'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ai_insight_type AS ENUM (
        'tax_deduction',
        'tax_optimization',
        'cash_flow',
        'expense_pattern',
        'business_performance',
        'compliance_risk',
        'savings_opportunity'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;