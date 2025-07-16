import { Pool } from 'pg';

// Test production database connection
async function testProductionConnection() {
  console.log('Testing DigitalOcean PostgreSQL connection...\n');
  
  // Get connection string from environment or use the one from .env.local
  const connectionString = process.env.PRODUCTION_DATABASE_URL || 
    "postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require";
  
  console.log('Connection string:', connectionString.replace(/:[^:@]+@/, ':****@'));
  
  // Test different SSL configurations
  const sslConfigs = [
    { name: 'rejectUnauthorized: false', config: { rejectUnauthorized: false } },
    { name: 'rejectUnauthorized: false, require: true', config: { rejectUnauthorized: false, require: true } },
    { name: 'SSL true', config: true },
    { name: 'No SSL', config: false }
  ];
  
  for (const { name, config } of sslConfigs) {
    console.log(`\nTesting with SSL config: ${name}`);
    
    const pool = new Pool({
      connectionString,
      ssl: config,
      connectionTimeoutMillis: 5000,
    });
    
    try {
      const result = await pool.query('SELECT NOW() as time, current_database() as db');
      console.log('✓ SUCCESS:', result.rows[0]);
      await pool.end();
      
      // If successful, save this configuration
      console.log('\n✅ Working SSL configuration found!');
      console.log('Use this in your postgres.js file:');
      console.log('ssl:', JSON.stringify(config, null, 2));
      break;
      
    } catch (error) {
      console.error('✗ FAILED:', error.message);
      await pool.end().catch(() => {});
    }
  }
}

testProductionConnection().catch(console.error);