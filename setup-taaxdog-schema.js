const { Client } = require('pg');
require('dotenv').config();

async function setupTaaxdogSchema() {
  const clientConfig = {
    host: process.env.DB_HOST || 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
    port: parseInt(process.env.DB_PORT || '25060'),
    user: process.env.DB_USER || 'taaxdog-admin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'taaxdog-production',
    ssl: { rejectUnauthorized: false }
  };

  if (!clientConfig.password) {
    console.error('❌ Database password not found in environment variables.');
    console.error('Please set DB_PASSWORD environment variable.');
    process.exit(1);
  }

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Create our own schema instead of using public
    console.log('=== Creating taaxdog schema ===');
    
    try {
      await client.query('CREATE SCHEMA IF NOT EXISTS taaxdog AUTHORIZATION "taaxdog-admin"');
      console.log('✅ Schema "taaxdog" created/verified');
    } catch (error) {
      if (error.code === '42P06') { // Schema already exists
        console.log('✅ Schema "taaxdog" already exists');
      } else {
        throw error;
      }
    }

    // Set search path to use our schema
    await client.query('SET search_path TO taaxdog, public');
    console.log('✅ Search path set to taaxdog schema');

    // Check permissions on our schema
    const permResult = await client.query(`
      SELECT 
        has_schema_privilege('taaxdog-admin', 'taaxdog', 'CREATE') as can_create,
        has_schema_privilege('taaxdog-admin', 'taaxdog', 'USAGE') as can_use
    `);

    const perms = permResult.rows[0];
    console.log('\nSchema permissions:');
    console.log('- Can use schema:', perms.can_use ? '✅' : '❌');
    console.log('- Can create in schema:', perms.can_create ? '✅' : '❌');

    if (perms.can_create) {
      console.log('\n=== Creating tables in taaxdog schema ===');

      // Create migrations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS taaxdog.schema_migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          execution_time INTEGER
        )
      `);
      console.log('✅ Created schema_migrations table');

      // Create audit logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS taaxdog.audit_logs (
          id SERIAL PRIMARY KEY,
          operation VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          details JSONB,
          ip_address VARCHAR(45)
        )
      `);
      console.log('✅ Created audit_logs table');

      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS taaxdog.users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created users table');

      // Create index
      await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON taaxdog.users(email)');
      console.log('✅ Created email index');

      // Create subscriptions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS taaxdog.subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES taaxdog.users(id) ON DELETE CASCADE,
          stripe_customer_id VARCHAR(255) UNIQUE,
          stripe_subscription_id VARCHAR(255) UNIQUE,
          plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('smart', 'pro')),
          status VARCHAR(50) NOT NULL,
          trial_ends_at TIMESTAMP,
          current_period_start TIMESTAMP,
          current_period_end TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created subscriptions table');

      // Create tax returns table
      await client.query(`
        CREATE TABLE IF NOT EXISTS taaxdog.tax_returns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES taaxdog.users(id) ON DELETE CASCADE,
          tax_year INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'draft',
          data JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, tax_year)
        )
      `);
      console.log('✅ Created tax_returns table');

      // Create update trigger function
      await client.query(`
        CREATE OR REPLACE FUNCTION taaxdog.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);
      console.log('✅ Created update trigger function');

      // Apply triggers
      const tables = ['users', 'subscriptions', 'tax_returns'];
      for (const table of tables) {
        await client.query(`
          CREATE TRIGGER update_${table}_updated_at 
          BEFORE UPDATE ON taaxdog.${table}
          FOR EACH ROW EXECUTE FUNCTION taaxdog.update_updated_at_column()
        `);
      }
      console.log('✅ Created update triggers');

      // List all tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'taaxdog'
        ORDER BY table_name
      `);

      console.log('\n=== Tables created in taaxdog schema ===');
      tablesResult.rows.forEach(row => {
        console.log('-', row.table_name);
      });

      console.log('\n🎉 Database setup completed successfully!');
      console.log('\nIMPORTANT: Update your application to use schema "taaxdog"');
      console.log('Either set search_path or prefix tables with "taaxdog."');

    } else {
      console.log('\n❌ Cannot create tables in taaxdog schema');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error('Error code:', error.code);
    
    if (error.code === '42501') {
      console.log('\nTrying alternative approach...');
    }
  } finally {
    await client.end();
  }
}

console.log('=== Taaxdog Database Setup (Using Custom Schema) ===\n');
setupTaaxdogSchema();