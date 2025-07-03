-- Rollback initial schema

-- Drop triggers
DROP TRIGGER IF EXISTS update_tax_returns_updated_at ON tax_returns;
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order due to foreign keys
DROP TABLE IF EXISTS tax_returns;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS users;