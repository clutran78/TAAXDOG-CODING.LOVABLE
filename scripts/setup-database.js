const { Client } = require('pg');

const PRODUCTION_CONFIG = {
  host: 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
  port: 25060,
  user: 'taaxdog-admin',
  password: 'AVNS_kp_8AWjX2AzlvWOqm_V',
  database: 'taaxdog-production',
  ssl: { rejectUnauthorized: false }
};

async function setupDatabase() {
  const client = new Client(PRODUCTION_CONFIG);
  
  try {
    await client.connect();
    console.log('Connected to DigitalOcean PostgreSQL\n');
    
    // Check current permissions
    const permResult = await client.query(`
      SELECT 
        has_schema_privilege($1, 'public', 'CREATE') as can_create,
        has_schema_privilege($1, 'public', 'USAGE') as can_use
    `, ['taaxdog-admin']);
    
    const perms = permResult.rows[0];
    console.log('Current permissions:');
    console.log('- Can use public schema:', perms.can_use ? '✅' : '❌');
    console.log('- Can create in public schema:', perms.can_create ? '✅' : '❌');
    
    if (!perms.can_create) {
      console.log('\n⚠️  Cannot create tables in public schema.');
      console.log('Please run the following commands as the database superuser:');
      console.log('');
      console.log('GRANT CREATE ON SCHEMA public TO "taaxdog-admin";');
      console.log('GRANT ALL ON SCHEMA public TO "taaxdog-admin";');
      console.log('');
      console.log('Or in DigitalOcean control panel, ensure the user has full permissions.');
    } else {
      console.log('\n✅ Database permissions are correctly configured!');
      
      // Create initial tables
      console.log('\nCreating initial tables...');
      
      // Create migrations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
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
      
      console.log('\n✅ Database setup completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    if (error.code === '42501') {
      console.log('\n⚠️  Permission denied. Please ensure the database user has appropriate privileges.');
    }
  } finally {
    await client.end();
  }
}

console.log('=== Taaxdog Database Setup ===\n');
setupDatabase();