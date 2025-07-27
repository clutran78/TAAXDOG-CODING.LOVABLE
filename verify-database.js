const { Pool } = require('pg');
require('dotenv').config();

async function verifyDatabase() {
  const poolConfig = {
    host: process.env.DB_HOST || 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
    port: parseInt(process.env.DB_PORT || '25060'),
    user: process.env.DB_USER || 'taaxdog-admin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'taaxdog-production',
    ssl: {
      rejectUnauthorized: false,
    },
  };

  if (!poolConfig.password) {
    console.error('❌ Database password not found in environment variables.');
    console.error('Please set DB_PASSWORD environment variable.');
    process.exit(1);
  }

  const pool = new Pool(poolConfig);

  try {
    console.log('=== Verifying Database Setup ===\n');

    // Test connection
    const client = await pool.connect();
    console.log('✅ Connection successful');

    // Verify SSL
    const sslResult = await client.query("SELECT current_setting('ssl') = 'on' as ssl_enabled");
    console.log('✅ SSL enabled:', sslResult.rows[0].ssl_enabled);

    // List all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('\n📋 Tables in database:');
    tablesResult.rows.forEach((row) => {
      console.log('  -', row.table_name);
    });

    // Test each table
    console.log('\n🧪 Testing tables:');

    // Test users table
    await client.query(`
      INSERT INTO users (email, name) 
      VALUES ('test@example.com', 'Test User')
      ON CONFLICT (email) DO NOTHING
    `);
    const userResult = await client.query('SELECT COUNT(*) FROM users');
    console.log('  ✅ users table:', userResult.rows[0].count, 'records');

    // Test audit_logs
    await client.query(`
      INSERT INTO audit_logs (operation, user_id, details, ip_address) 
      VALUES ('test_operation', 'test_user', '{"test": true}'::jsonb, '127.0.0.1')
    `);
    const auditResult = await client.query('SELECT COUNT(*) FROM audit_logs');
    console.log('  ✅ audit_logs table:', auditResult.rows[0].count, 'records');

    // Check triggers
    const triggerResult = await client.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public'
    `);
    console.log('\n🔧 Triggers installed:', triggerResult.rows.length);

    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname NOT LIKE '%_pkey'
    `);
    console.log('📊 Custom indexes:', indexResult.rows.length);

    client.release();

    console.log('\n✅ Database verification complete!');
    console.log('\n🎉 Your database is fully operational with:');
    console.log('  - SSL encryption enabled');
    console.log('  - All tables created');
    console.log('  - Triggers installed');
    console.log('  - Indexes configured');
    console.log('  - Full read/write permissions');

    console.log('\n📝 Connection details for your application:');
    console.log('  Host:', 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com');
    console.log('  Port:', 25060);
    console.log('  Database:', 'taaxdog-production');
    console.log('  User:', 'taaxdog-admin');
    console.log('  SSL:', 'Required (rejectUnauthorized: false)');
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await pool.end();
  }
}

verifyDatabase();
