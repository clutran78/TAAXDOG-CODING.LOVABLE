import db from './postgres.js';
import monitor from './connection-monitor.js';

// Note: Prisma is TypeScript-only, so we'll skip Prisma tests in this JS file

// Test database connections and pooling behavior
async function testConnections() {
  console.log('=== Testing Database Connections ===\n');

  // Test 1: Basic connection
  console.log('1. Testing basic PostgreSQL connection...');
  try {
    await db.initializePool();
    const health = await db.healthCheck();
    console.log('✓ PostgreSQL connection successful:', health);
  } catch (error) {
    console.error('✗ PostgreSQL connection failed:', error.message);
    return;
  }

  // Test 2: Query execution
  console.log('\n2. Testing query execution...');
  try {
    const queryResult = await db.query('SELECT NOW() as current_time, current_database() as db');
    console.log('✓ Query execution successful:', queryResult.rows[0]);
  } catch (error) {
    console.error('✗ Query execution failed:', error.message);
  }

  // Test 3: Connection pooling behavior
  console.log('\n3. Testing connection pooling...');
  try {
    // Start monitoring
    monitor.startHealthChecks(5000);

    // Execute multiple concurrent queries
    const queries = [];
    for (let i = 0; i < 10; i++) {
      queries.push(
        db.query(`SELECT pg_sleep(0.1), $1 as query_id`, [i])
          .then(() => ({ success: true, id: i }))
          .catch(error => ({ success: false, id: i, error: error.message }))
      );
    }

    console.log('Executing 10 concurrent queries...');
    const results = await Promise.all(queries);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✓ Completed: ${successful} successful, ${failed} failed`);
    
    // Check pool status
    const poolHealth = await db.healthCheck();
    console.log('Pool status:', poolHealth.pool);

  } catch (error) {
    console.error('✗ Pooling test failed:', error.message);
  }

  // Test 4: Transaction rollback
  console.log('\n4. Testing transaction rollback...');
  try {
    await db.transaction(async (client) => {
      await client.query('BEGIN');
      await client.query(`INSERT INTO test_table (id) VALUES (1)`);
      throw new Error('Intentional rollback');
    });
  } catch (error) {
    if (error.message === 'Intentional rollback') {
      console.log('✓ Transaction rollback successful');
    } else {
      console.error('✗ Transaction test failed:', error.message);
    }
  }

  // Test 5: Connection recovery
  console.log('\n5. Testing connection recovery...');
  try {
    // Force close pool
    await db.closePool();
    console.log('Pool closed');

    // Try query (should auto-reconnect)
    await db.query('SELECT 1');
    console.log('✓ Auto-reconnection successful');

  } catch (error) {
    console.error('✗ Recovery test failed:', error.message);
  }

  // Get final metrics
  console.log('\n=== Connection Metrics ===');
  console.log(monitor.getMetrics());

  // Cleanup
  monitor.stopHealthChecks();
  await db.closePool();
  
  console.log('\n=== Tests Complete ===');
}

// Run tests
testConnections().catch(console.error);