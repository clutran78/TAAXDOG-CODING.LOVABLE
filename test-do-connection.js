const { Pool } = require('pg');

// Create connection URL without sslmode parameter (we'll handle SSL in config)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL with your PostgreSQL connection string');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('Testing DigitalOcean PostgreSQL connection...\n');
    
    // Basic connection test
    const client = await pool.connect();
    console.log('✅ Connected successfully!');
    
    // Get database info
    const result = await client.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        current_setting('ssl') = 'on' as ssl_enabled
    `);
    
    const info = result.rows[0];
    console.log('\nDatabase Information:');
    console.log('- Database:', info.database);
    console.log('- User:', info.user);
    console.log('- SSL Enabled:', info.ssl_enabled);
    console.log('- Version:', info.version.split(',')[0]);
    
    // Test schema permissions
    console.log('\nTesting schema access...');
    const schemaResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'public'
    `);
    
    if (schemaResult.rows.length > 0) {
      console.log('✅ Public schema exists');
      
      // Check if we can create tables
      const privilegeResult = await client.query(`
        SELECT has_schema_privilege($1, 'public', 'CREATE') as can_create
      `, [info.user]);
      
      console.log('- Can create tables:', privilegeResult.rows[0].can_create ? '✅ Yes' : '❌ No');
    }
    
    // List existing tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\nExisting tables:', tablesResult.rows.length);
    tablesResult.rows.forEach(row => {
      console.log('-', row.table_name);
    });
    
    client.release();
    console.log('\n✅ All connection tests passed!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();