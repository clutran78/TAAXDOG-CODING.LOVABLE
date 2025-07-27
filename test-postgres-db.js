const { Client } = require('pg');
require('dotenv').config();

async function testPostgresDatabase() {
  // First, try connecting to the default postgres database
  const postgresConfig = {
    host: process.env.DB_HOST || 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
    port: parseInt(process.env.DB_PORT || '25060'),
    user: process.env.DB_USER || 'taaxdog-admin',
    password: process.env.DB_PASSWORD,
    database: 'postgres', // Default database
    ssl: { rejectUnauthorized: false },
  };

  if (!postgresConfig.password) {
    console.error('❌ Database password not found in environment variables.');
    console.error('Please set DB_PASSWORD environment variable.');
    process.exit(1);
  }

  const postgresClient = new Client(postgresConfig);

  try {
    console.log('=== Testing connection to postgres database ===\n');
    await postgresClient.connect();
    console.log('✅ Connected to postgres database');

    // Check if our target database exists
    const dbResult = await postgresClient.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datname = 'taaxdog-production'
    `);

    if (dbResult.rows.length > 0) {
      console.log('✅ Database "taaxdog-production" exists');
    } else {
      console.log('❌ Database "taaxdog-production" does not exist');
      console.log('\nCreating database...');

      try {
        await postgresClient.query('CREATE DATABASE "taaxdog-production"');
        console.log('✅ Database created successfully');
      } catch (err) {
        console.log('❌ Could not create database:', err.message);
      }
    }

    await postgresClient.end();

    // Now connect to our actual database
    console.log('\n=== Connecting to taaxdog-production database ===\n');

    const client = new Client({
      host: process.env.DB_HOST || 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
      port: parseInt(process.env.DB_PORT || '25060'),
      user: process.env.DB_USER || 'taaxdog-admin',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'taaxdog-production',
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log('✅ Connected to taaxdog-production database');

    // Check our privileges
    const privResult = await client.query(`
      SELECT 
        current_user,
        current_database(),
        has_database_privilege(current_database(), 'CREATE') as can_create_schema,
        pg_has_role(current_user, 'pg_database_owner', 'MEMBER') as is_db_owner
    `);

    const privs = privResult.rows[0];
    console.log('\nUser privileges:');
    console.log('- Current user:', privs.current_user);
    console.log('- Current database:', privs.current_database);
    console.log('- Can create schemas:', privs.can_create_schema ? '✅' : '❌');
    console.log('- Is database owner:', privs.is_db_owner ? '✅' : '❌');

    // Try to create schema permissions
    console.log('\n=== Setting up schema permissions ===\n');

    try {
      // First, check who owns the public schema
      const schemaOwnerResult = await client.query(`
        SELECT 
          n.nspname as schema_name,
          pg_catalog.pg_get_userbyid(n.nspowner) as owner_name
        FROM pg_catalog.pg_namespace n
        WHERE n.nspname = 'public'
      `);

      if (schemaOwnerResult.rows.length > 0) {
        const schemaInfo = schemaOwnerResult.rows[0];
        console.log('Public schema owner:', schemaInfo.owner_name);

        // If we own the schema or are db owner, grant permissions
        if (schemaInfo.owner_name === 'taaxdog-admin' || privs.is_db_owner) {
          await client.query('GRANT CREATE ON SCHEMA public TO "taaxdog-admin"');
          console.log('✅ CREATE permission granted on public schema');
        }
      }

      // Try creating a test table
      console.log('\nTesting table creation...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS test_permissions (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('✅ Test table created successfully');

      // Clean up test table
      await client.query('DROP TABLE IF EXISTS test_permissions');
      console.log('✅ Test table removed');

      console.log('\n🎉 Database is fully configured and ready to use!');
    } catch (error) {
      console.log('❌ Permission setup failed:', error.message);

      if (error.code === '42501') {
        // Insufficient privilege
        console.log('\n=== Manual Setup Required ===');
        console.log('Please ask DigitalOcean support or use their control panel to:');
        console.log('1. Make "taaxdog-admin" the owner of the database');
        console.log('2. Or grant CREATE privileges on the public schema');
        console.log(
          '\nAlternatively, we can work without the public schema by creating our own schema.',
        );
      }
    }

    await client.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
  }
}

testPostgresDatabase();
