const { Client } = require('pg');
require('dotenv').config();

async function fixPermissions() {
  // Connect as doadmin to fix permissions
  const adminConfig = {
    host: process.env.DB_HOST || 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
    port: parseInt(process.env.DB_PORT || '25060'),
    user: process.env.DB_ADMIN_USER || 'doadmin',
    password: process.env.DB_ADMIN_PASSWORD,
    database: process.env.DB_NAME || 'taaxdog-production', // Connect to the target database
    ssl: { rejectUnauthorized: false },
  };

  if (!adminConfig.password) {
    console.error('❌ Admin database password not found in environment variables.');
    console.error('Please set DB_ADMIN_PASSWORD environment variable.');
    process.exit(1);
  }

  const adminClient = new Client(adminConfig);

  try {
    console.log('=== Fixing Database Permissions ===\n');

    await adminClient.connect();
    console.log('✅ Connected as doadmin\n');

    // Grant all privileges on the database
    console.log('Granting database privileges...');
    await adminClient.query(
      'GRANT ALL PRIVILEGES ON DATABASE "taaxdog-production" TO "taaxdog-admin"',
    );
    console.log('✅ Granted all privileges on database\n');

    // Grant schema permissions
    console.log('Granting schema permissions...');
    await adminClient.query('GRANT ALL ON SCHEMA public TO "taaxdog-admin"');
    console.log('✅ Granted all privileges on public schema\n');

    // Grant create permission on public schema
    console.log('Granting CREATE permission...');
    await adminClient.query('GRANT CREATE ON SCHEMA public TO "taaxdog-admin"');
    console.log('✅ Granted CREATE permission on public schema\n');

    // Make sure taaxdog-admin can use extensions
    console.log('Granting extension permissions...');
    await adminClient.query('GRANT USAGE ON SCHEMA public TO "taaxdog-admin"');
    console.log('✅ Granted USAGE permission\n');

    await adminClient.end();

    // Now test with taaxdog-admin user
    console.log('=== Testing Permissions ===\n');

    const userConfig = {
      host: process.env.DB_HOST || 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
      port: parseInt(process.env.DB_PORT || '25060'),
      user: process.env.DB_USER || 'taaxdog-admin',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'taaxdog-production',
      ssl: { rejectUnauthorized: false },
    };

    if (!userConfig.password) {
      console.error('❌ User database password not found in environment variables.');
      console.error('Please set DB_PASSWORD environment variable.');
      process.exit(1);
    }

    const userClient = new Client(userConfig);

    await userClient.connect();
    console.log('✅ Connected as taaxdog-admin\n');

    // Test table creation
    console.log('Testing table creation...');
    await userClient.query(`
      CREATE TABLE IF NOT EXISTS test_permissions (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Successfully created test table');

    await userClient.query('DROP TABLE IF EXISTS test_permissions');
    console.log('✅ Successfully dropped test table\n');

    console.log('🎉 Permissions fixed! Creating application tables...\n');

    // Create all application tables
    console.log('Creating users table...');
    await userClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created users table');

    console.log('Creating subscriptions table...');
    await userClient.query(`
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
      )
    `);
    console.log('✅ Created subscriptions table');

    console.log('Creating tax_returns table...');
    await userClient.query(`
      CREATE TABLE IF NOT EXISTS tax_returns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tax_year INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, tax_year)
      )
    `);
    console.log('✅ Created tax_returns table');

    console.log('Creating schema_migrations table...');
    await userClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        execution_time INTEGER
      )
    `);
    console.log('✅ Created schema_migrations table');

    console.log('Creating audit_logs table...');
    await userClient.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        operation VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        details JSONB,
        ip_address VARCHAR(45)
      )
    `);
    console.log('✅ Created audit_logs table');

    // Create update trigger function
    console.log('Creating update trigger function...');
    await userClient.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    console.log('✅ Created trigger function');

    // Apply triggers
    console.log('Applying triggers...');
    const tables = ['users', 'subscriptions', 'tax_returns'];
    for (const table of tables) {
      await userClient.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}
      `);
      await userClient.query(`
        CREATE TRIGGER update_${table}_updated_at 
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
      `);
    }
    console.log('✅ Applied update triggers');

    // Create indexes
    console.log('Creating indexes...');
    await userClient.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await userClient.query(
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)',
    );
    await userClient.query(
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id)',
    );
    await userClient.query(
      'CREATE INDEX IF NOT EXISTS idx_tax_returns_user_id ON tax_returns(user_id)',
    );
    console.log('✅ Created indexes');

    // List all tables
    const tablesResult = await userClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('\n=== Database Setup Complete ===');
    console.log('\nTables created:');
    tablesResult.rows.forEach((row) => {
      console.log('-', row.table_name);
    });

    await userClient.end();

    console.log('\n🎉 SUCCESS! Database is fully set up and ready to use!');
    console.log('\nYour application can now connect using:');
    console.log('- User: taaxdog-admin');
    console.log('- Database: taaxdog-production');
    console.log('- All tables and permissions are configured');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);

    if (error.detail) {
      console.error('Detail:', error.detail);
    }
  }
}

fixPermissions();
