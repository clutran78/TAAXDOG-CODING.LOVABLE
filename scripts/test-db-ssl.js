#!/usr/bin/env node

const { Client } = require('pg');

async function testDatabaseConnection() {
  const connectionString = process.env.DATABASE_URL || 
    'postgresql://taaxdog-admin:AVNS_sOOnNB63elYEvJLTVuy@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require';
  
  console.log('Testing database connection with SSL...\n');
  
  // Parse connection string and force SSL
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false // For DigitalOcean managed databases
    }
  });

  try {
    await client.connect();
    console.log('✅ Database connection successful!');
    
    // Test query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Query executed successfully');
    console.log('Current time:', result.rows[0].current_time);
    console.log('PostgreSQL version:', result.rows[0].pg_version.split(',')[0]);
    
    // Check SSL status
    const sslResult = await client.query('SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
    if (sslResult.rows.length > 0 && sslResult.rows[0].ssl) {
      console.log('✅ SSL connection active');
      console.log('SSL version:', sslResult.rows[0].version);
    } else {
      console.log('⚠️  SSL not active');
    }
    
    await client.end();
    console.log('\n✅ Database SSL configuration is working correctly!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testDatabaseConnection();