# DigitalOcean Database Setup Guide

## Current Status
- ✅ Connection working with SSL
- ✅ Database exists: `taaxdog-production`
- ❌ User `taaxdog-admin` cannot create tables (insufficient permissions)

## Problem
The database `taaxdog-production` is owned by `doadmin` (DigitalOcean's admin user), not by `taaxdog-admin`. This prevents the user from creating tables.

## Solutions

### Option 1: Use DigitalOcean Control Panel (Recommended)

1. **Log into DigitalOcean Control Panel**
2. **Navigate to your Database Cluster**
3. **Go to "Users & Databases" tab**
4. **For the `taaxdog-admin` user:**
   - Click on "Show more options" (three dots)
   - Select "Edit Permissions"
   - Ensure the user has ALL privileges on `taaxdog-production` database
   - Or make the user an admin/superuser

### Option 2: Create a New Database with Correct Owner

1. **In DigitalOcean Control Panel:**
   - Go to "Users & Databases" tab
   - Create a new database
   - Set `taaxdog-admin` as the owner

2. **Update your connection string to use the new database**

### Option 3: Use doadmin User (Temporary Solution)

If you have access to the `doadmin` user credentials:

```sql
-- Connect as doadmin user
GRANT ALL PRIVILEGES ON DATABASE "taaxdog-production" TO "taaxdog-admin";
GRANT ALL ON SCHEMA public TO "taaxdog-admin";
```

## SQL Commands to Run (After Permissions Are Fixed)

Save this as `setup-after-permissions.sql`:

```sql
-- Create tables in public schema
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('smart', 'pro')),
    status VARCHAR(50) NOT NULL,
    trial_ends_at TIMESTAMP,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tax_year INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tax_year)
);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tax_returns_updated_at BEFORE UPDATE ON tax_returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_tax_returns_user_id ON tax_returns(user_id);
```

## Quick Test Script

After fixing permissions, run this to verify:

```javascript
// test-after-permissions.js
const { Client } = require('pg');

async function testDatabase() {
  const client = new Client({
    host: 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
    port: 25060,
    user: 'taaxdog-admin',
    password: 'AVNS_kp_8AWjX2AzlvWOqm_V',
    database: 'taaxdog-production',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected');
    
    // Test table creation
    await client.query(`
      CREATE TABLE IF NOT EXISTS permission_test (
        id SERIAL PRIMARY KEY
      )
    `);
    console.log('✅ Can create tables!');
    
    await client.query('DROP TABLE IF EXISTS permission_test');
    console.log('✅ Permissions are working!');
    
  } catch (error) {
    console.error('❌ Still no permissions:', error.message);
  } finally {
    await client.end();
  }
}

testDatabase();
```

## Action Required

Please follow Option 1 above to grant permissions through the DigitalOcean control panel. This is the simplest and most secure approach for managed databases.