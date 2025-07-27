const { Pool } = require('pg');
require('dotenv').config();

async function testConnectionPool() {
  console.log('=== Testing DigitalOcean Connection Pool ===\n');

  // Test connection pool (port 25061)
  const poolConfig = {
    host: process.env.DB_HOST || 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
    port: parseInt(process.env.DB_PORT_POOL || '25061'),
    user: process.env.DB_USER || 'taaxdog-admin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'taaxdog-production',
    ssl: {
      rejectUnauthorized: false,
    },
    min: 5,
    max: 20,
  };

  if (!poolConfig.password) {
    console.error('❌ Database password not found in environment variables.');
    console.error('Please set DB_PASSWORD environment variable.');
    process.exit(1);
  }

  const pool = new Pool(poolConfig);

  try {
    console.log('Testing connection pool on port 25061...');

    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Connected via connection pool');

    // Check SSL
    const sslResult = await client.query("SELECT current_setting('ssl') = 'on' as ssl_enabled");
    console.log('✅ SSL enabled:', sslResult.rows[0].ssl_enabled);

    // Test query
    const result = await client.query('SELECT COUNT(*) FROM users');
    console.log('✅ Query successful. Users count:', result.rows[0].count);

    client.release();

    // Test concurrent connections
    console.log('\nTesting concurrent connections...');
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(pool.query('SELECT pg_backend_pid() as pid, NOW() as time'));
    }

    const results = await Promise.all(promises);
    const uniquePids = new Set(results.map((r) => r.rows[0].pid));
    console.log(`✅ Handled 10 concurrent queries using ${uniquePids.size} connections`);

    console.log('\n🎉 Connection pool is working perfectly!');
    console.log('\nRecommended usage:');
    console.log('- Use port 25061 for connection pooling (better performance)');
    console.log('- Use port 25060 for direct connections (migrations, admin tasks)');
  } catch (error) {
    console.error('❌ Connection pool test failed:', error.message);

    // Fallback to direct connection
    console.log('\nTrying direct connection on port 25060...');
    const directPool = new Pool({
      ...poolConfig,
      port: 25060,
    });

    try {
      const client = await directPool.connect();
      console.log('✅ Direct connection works on port 25060');
      client.release();
      await directPool.end();
    } catch (err) {
      console.error('❌ Direct connection also failed:', err.message);
    }
  } finally {
    await pool.end();
  }
}

testConnectionPool();
