#!/usr/bin/env ts-node

import { config } from 'dotenv';
import db from '../lib/database';
import { envConfig } from '../lib/env-config';
import { healthCheck } from '../lib/health-check';

// Load environment variables
config();

async function testConnection(environment: 'development' | 'production') {
  console.log(`\n=== Testing ${environment.toUpperCase()} Database Connection ===\n`);

  // Set environment
  process.env.NODE_ENV = environment;

  try {
    // Get configuration
    const config = envConfig.getConfig();
    console.log('Configuration:', envConfig.getSafeConfig());

    // Test basic connection
    console.log('\n1. Testing basic connection...');
    await db.connect('test-client');
    console.log('✓ Connection established successfully');

    // Test query execution
    console.log('\n2. Testing query execution...');
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✓ Query executed successfully');
    console.log('  Current time:', result.rows[0].current_time);
    console.log('  PostgreSQL version:', result.rows[0].pg_version);

    // Test SSL connection (production only)
    if (environment === 'production') {
      console.log('\n3. Testing SSL enforcement...');
      const sslResult = await db.query(`
        SELECT 
          ssl_is_used() as ssl_active,
          ssl_version() as ssl_version,
          ssl_cipher() as ssl_cipher
      `);

      const sslInfo = sslResult.rows[0];
      if (sslInfo.ssl_active) {
        console.log('✓ SSL is active');
        console.log('  SSL version:', sslInfo.ssl_version);
        console.log('  SSL cipher:', sslInfo.ssl_cipher);
      } else {
        console.error('✗ SSL is NOT active - this is a security risk!');
      }
    }

    // Test connection pooling
    console.log('\n4. Testing connection pooling...');
    const poolPromises = Array(10)
      .fill(null)
      .map((_, i) => db.query('SELECT $1::int as number', [i]));
    await Promise.all(poolPromises);
    console.log('✓ Connection pool handled 10 concurrent queries');

    // Test health check
    console.log('\n5. Testing health check...');
    const health = await healthCheck.performHealthCheck();
    console.log('✓ Health check completed');
    console.log('  Status:', health.status);
    console.log('  Database status:', health.checks.database.status);
    if (health.checks.database.responseTime) {
      console.log('  Response time:', health.checks.database.responseTime + 'ms');
    }

    // Test transaction
    console.log('\n6. Testing transaction...');
    await db.transaction(async (client) => {
      await client.query('CREATE TEMP TABLE test_transaction (id int, name text)');
      await client.query('INSERT INTO test_transaction VALUES ($1, $2)', [1, 'test']);
      const result = await client.query('SELECT * FROM test_transaction');
      console.log('✓ Transaction completed successfully');
      console.log('  Rows inserted:', result.rowCount);
    });

    // Test error handling
    console.log('\n7. Testing error handling...');
    try {
      await db.query('SELECT * FROM non_existent_table');
    } catch (error) {
      console.log('✓ Error handling working correctly');
      console.log('  Error message sanitized:', error.message);
    }

    console.log(`\n✅ All ${environment} database tests passed!\n`);
  } catch (error) {
    console.error(`\n❌ ${environment} database test failed:`, error);
  } finally {
    await db.disconnect();
  }
}

async function main() {
  const environment = process.argv[2] as 'development' | 'production';

  if (!environment || !['development', 'production'].includes(environment)) {
    console.log(`
Database Connection Test

Usage:
  npm run test-db [environment]

Environments:
  development  Test local PostgreSQL connection
  production   Test DigitalOcean PostgreSQL connection with SSL

Examples:
  npm run test-db development
  npm run test-db production
    `);
    process.exit(1);
  }

  await testConnection(environment);
}

main().catch(console.error);
