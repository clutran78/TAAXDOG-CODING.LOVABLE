const { Client } = require('pg');

async function testProductionConnection() {
  const client = new Client({
    host: 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
    port: 25060,
    user: 'taaxdog-admin',
    password: 'AVNS_kp_8AWjX2AzlvWOqm_V',
    database: 'taaxdog-production',
    ssl: {
      rejectUnauthorized: false, // Required for DigitalOcean
      require: true
    }
  });

  try {
    console.log('Connecting to DigitalOcean PostgreSQL...');
    await client.connect();
    console.log('✓ Connected successfully!');

    const result = await client.query('SELECT NOW() as time, current_user, version()');
    console.log('\nConnection details:');
    console.log('- Current time:', result.rows[0].time);
    console.log('- Connected as:', result.rows[0].current_user);
    console.log('- PostgreSQL version:', result.rows[0].version);

    // Test SSL
    const sslResult = await client.query("SELECT current_setting('ssl') = 'on' AS ssl_enabled");
    console.log('- SSL enabled:', sslResult.rows[0].ssl_enabled);

    // Test creating a table
    console.log('\nTesting table creation...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        tested_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Table created successfully');

    // Insert test record
    await client.query('INSERT INTO connection_test DEFAULT VALUES');
    const countResult = await client.query('SELECT COUNT(*) FROM connection_test');
    console.log('✓ Test record inserted. Total records:', countResult.rows[0].count);

    // Clean up
    await client.query('DROP TABLE connection_test');
    console.log('✓ Test table cleaned up');

    console.log('\n✅ All production database tests passed!');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await client.end();
  }
}

testProductionConnection();