const { Pool } = require('pg');
require('dotenv').config();

async function testConnection(env) {
  console.log(`\n=== Testing ${env.toUpperCase()} Database Connection ===\n`);

  const isDevelopment = env === 'development';
  const connectionString = isDevelopment
    ? 'postgresql://genesis@localhost:5432/taaxdog_development'
    : 'postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require';

  const poolConfig = {
    connectionString,
    min: isDevelopment ? 2 : 5,
    max: isDevelopment ? 10 : 20,
    connectionTimeoutMillis: 10000,
  };

  // SSL configuration for production
  if (!isDevelopment || connectionString.includes('sslmode=require')) {
    poolConfig.ssl = {
      rejectUnauthorized: false,
      require: true
    };
  }

  console.log('Connection string:', connectionString.replace(/:[^:@]+@/, ':[REDACTED]@'));
  console.log('SSL enabled:', !!poolConfig.ssl);

  const pool = new Pool(poolConfig);

  try {
    // Test basic connection
    console.log('\n1. Testing basic connection...');
    const client = await pool.connect();
    console.log('✓ Connection established successfully');
    client.release();

    // Test query execution
    console.log('\n2. Testing query execution...');
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✓ Query executed successfully');
    console.log('  Current time:', result.rows[0].current_time);
    console.log('  PostgreSQL version:', result.rows[0].pg_version);

    // Test SSL connection (production only)
    if (!isDevelopment) {
      console.log('\n3. Testing SSL enforcement...');
      const sslResult = await pool.query(`
        SELECT 
          current_setting('ssl') = 'on' AS ssl_active,
          current_setting('ssl_cipher', true) as ssl_cipher
      `);
      
      const sslInfo = sslResult.rows[0];
      if (sslInfo.ssl_active) {
        console.log('✓ SSL is active');
        console.log('  SSL version:', sslInfo.ssl_version || 'N/A');
        console.log('  SSL cipher:', sslInfo.ssl_cipher || 'N/A');
      } else {
        console.error('✗ SSL is NOT active - this is a security risk!');
      }
    }

    // Test connection pooling
    console.log('\n4. Testing connection pooling...');
    const poolPromises = Array(5).fill(null).map((_, i) => 
      pool.query('SELECT $1::int as number', [i])
    );
    await Promise.all(poolPromises);
    console.log('✓ Connection pool handled 5 concurrent queries');

    console.log(`\n✅ All ${env} database tests passed!\n`);

  } catch (error) {
    console.error(`\n❌ ${env} database test failed:`);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nMake sure PostgreSQL is running and accessible.');
    } else if (error.code === '3D000') {
      console.error('\nDatabase does not exist. Please create it first.');
    }
  } finally {
    await pool.end();
    console.log('Connection pool closed');
  }
}

// Main execution
const env = process.argv[2];

if (!env || !['development', 'production'].includes(env)) {
  console.log(`
Database Connection Test

Usage:
  node test-database.js [environment]

Environments:
  development  Test local PostgreSQL connection
  production   Test DigitalOcean PostgreSQL connection with SSL

Examples:
  node test-database.js development
  node test-database.js production
  `);
  process.exit(1);
}

testConnection(env).catch(console.error);