-- BASIQ Banking Integration Schema for Australian Banks
-- Compliant with Australian banking standards and ATO requirements

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- BASIQ Users table - stores BASIQ user credentials and mapping
CREATE TABLE IF NOT EXISTS basiq_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    basiq_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    mobile VARCHAR(20),
    connection_status VARCHAR(50) DEFAULT 'active',
    consent_id VARCHAR(255),
    consent_status VARCHAR(50),
    consent_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bank Connections table - stores individual bank connections
CREATE TABLE IF NOT EXISTS bank_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basiq_user_id UUID REFERENCES basiq_users(id) ON DELETE CASCADE,
    connection_id VARCHAR(255) UNIQUE NOT NULL,
    institution_id VARCHAR(255) NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    institution_short_name VARCHAR(100),
    institution_logo_url TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bank Accounts table - stores account details
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basiq_user_id UUID REFERENCES basiq_users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
    basiq_account_id VARCHAR(255) UNIQUE NOT NULL,
    account_holder VARCHAR(255),
    account_number VARCHAR(50),
    bsb VARCHAR(10), -- Australian BSB format
    institution_name VARCHAR(255),
    account_type VARCHAR(100),
    account_name VARCHAR(255),
    balance_available DECIMAL(15,2),
    balance_current DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'AUD',
    status VARCHAR(50) DEFAULT 'active',
    is_business_account BOOLEAN DEFAULT FALSE,
    last_synced TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bank Transactions table - stores transaction history
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
    basiq_transaction_id VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    transaction_date DATE NOT NULL,
    post_date DATE,
    balance DECIMAL(15,2),
    transaction_type VARCHAR(100),
    direction VARCHAR(20), -- 'credit' or 'debit'
    category VARCHAR(100),
    subcategory VARCHAR(100),
    merchant_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'posted',
    is_business_expense BOOLEAN DEFAULT FALSE,
    tax_category VARCHAR(100),
    gst_amount DECIMAL(15,2), -- For GST tracking
    receipt_id UUID, -- Will reference receipts table when created
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BASIQ Webhooks table - stores webhook events for processing
CREATE TABLE IF NOT EXISTS basiq_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id VARCHAR(255) UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    processed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BASIQ API Logs table - for audit and debugging
CREATE TABLE IF NOT EXISTS basiq_api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_body JSONB,
    response_status INTEGER,
    response_body JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_basiq_users_user_id ON basiq_users(user_id);
CREATE INDEX idx_basiq_users_status ON basiq_users(connection_status);
CREATE INDEX idx_bank_connections_basiq_user_id ON bank_connections(basiq_user_id);
CREATE INDEX idx_bank_connections_status ON bank_connections(status);
CREATE INDEX idx_bank_accounts_basiq_user_id ON bank_accounts(basiq_user_id);
CREATE INDEX idx_bank_accounts_connection_id ON bank_accounts(connection_id);
CREATE INDEX idx_bank_accounts_is_business ON bank_accounts(is_business_account);
CREATE INDEX idx_bank_transactions_account_id ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_category ON bank_transactions(tax_category);
CREATE INDEX idx_bank_transactions_business ON bank_transactions(is_business_expense);
CREATE INDEX idx_basiq_webhooks_status ON basiq_webhooks(status);
CREATE INDEX idx_basiq_webhooks_event_type ON basiq_webhooks(event_type);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to all tables
CREATE TRIGGER update_basiq_users_updated_at BEFORE UPDATE ON basiq_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_connections_updated_at BEFORE UPDATE ON bank_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_transactions_updated_at BEFORE UPDATE ON bank_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();