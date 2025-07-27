const { Client } = require('pg');
require('dotenv').config();

async function checkPermissions() {
  const clientConfig = {
    host: process.env.DB_HOST || 'taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com',
    port: parseInt(process.env.DB_PORT || '25060'),
    user: process.env.DB_USER || 'taaxdog-admin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'taaxdog-production',
    ssl: { rejectUnauthorized: false },
  };

  if (!clientConfig.password) {
    console.error('❌ Database password not found in environment variables.');
    console.error('Please set DB_PASSWORD environment variable.');
    process.exit(1);
  }

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get detailed user information
    const userInfoResult = await client.query(`
      SELECT 
        current_user,
        session_user,
        current_database(),
        version()
    `);
    const info = userInfoResult.rows[0];
    console.log('=== Connection Info ===');
    console.log('Current user:', info.current_user);
    console.log('Session user:', info.session_user);
    console.log('Database:', info.current_database);
    console.log('PostgreSQL:', info.version.split(' ')[1]);

    // Check database ownership
    const dbOwnerResult = await client.query(`
      SELECT 
        d.datname as database_name,
        pg_catalog.pg_get_userbyid(d.datdba) as owner
      FROM pg_catalog.pg_database d
      WHERE d.datname = current_database()
    `);
    console.log('\n=== Database Ownership ===');
    const dbInfo = dbOwnerResult.rows[0];
    console.log('Database owner:', dbInfo.owner);
    console.log('Is current user owner?', dbInfo.owner === info.current_user ? '✅ Yes' : '❌ No');

    // Check what we can do
    console.log('\n=== User Capabilities ===');
    const capsResult = await client.query(`
      SELECT 
        has_database_privilege(current_database(), 'CREATE') as can_create_schema,
        has_database_privilege(current_database(), 'TEMP') as can_create_temp,
        has_database_privilege(current_database(), 'CONNECT') as can_connect,
        pg_has_role(current_user, 'pg_read_all_data', 'MEMBER') as can_read_all,
        pg_has_role(current_user, 'pg_write_all_data', 'MEMBER') as can_write_all
    `);
    const caps = capsResult.rows[0];
    console.log('Can create schemas:', caps.can_create_schema ? '✅' : '❌');
    console.log('Can create temp tables:', caps.can_create_temp ? '✅' : '❌');
    console.log('Can connect:', caps.can_connect ? '✅' : '❌');
    console.log('Can read all data:', caps.can_read_all ? '✅' : '❌');
    console.log('Can write all data:', caps.can_write_all ? '✅' : '❌');

    // List all schemas
    console.log('\n=== Available Schemas ===');
    const schemasResult = await client.query(`
      SELECT 
        n.nspname as schema_name,
        pg_catalog.pg_get_userbyid(n.nspowner) as owner,
        has_schema_privilege(n.nspname, 'CREATE') as can_create,
        has_schema_privilege(n.nspname, 'USAGE') as can_use
      FROM pg_catalog.pg_namespace n
      WHERE n.nspname NOT LIKE 'pg_%'
        AND n.nspname NOT IN ('information_schema')
      ORDER BY n.nspname
    `);

    schemasResult.rows.forEach((schema) => {
      console.log(`\nSchema: ${schema.schema_name}`);
      console.log(`  Owner: ${schema.owner}`);
      console.log(`  Can use: ${schema.can_use ? '✅' : '❌'}`);
      console.log(`  Can create: ${schema.can_create ? '✅' : '❌'}`);
    });

    // Check if we can create in any schema
    const createableSchema = schemasResult.rows.find((s) => s.can_create);
    if (createableSchema) {
      console.log(`\n✅ You can create tables in schema: ${createableSchema.schema_name}`);

      // Try to create a test table there
      console.log(`\nTesting table creation in ${createableSchema.schema_name}...`);
      try {
        await client.query(`
          CREATE TABLE ${createableSchema.schema_name}.test_table (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        console.log('✅ Test table created successfully!');

        // Drop it
        await client.query(`DROP TABLE ${createableSchema.schema_name}.test_table`);
        console.log('✅ Test table dropped');

        console.log(`\n🎉 You can use schema "${createableSchema.schema_name}" for your tables!`);
      } catch (err) {
        console.log('❌ Table creation failed:', err.message);
      }
    } else {
      console.log('\n❌ No schemas available for table creation');

      // Check if we're in a DigitalOcean managed database
      console.log('\n=== DigitalOcean Specific Checks ===');

      // List all roles
      const rolesResult = await client.query(`
        SELECT rolname, rolsuper, rolcreaterole, rolcreatedb
        FROM pg_roles
        WHERE rolname = current_user
      `);

      const role = rolesResult.rows[0];
      console.log('Role details:', role);

      console.log('\n=== SOLUTION ===');
      console.log('For DigitalOcean managed databases, you need to:');
      console.log('1. Go to your DigitalOcean control panel');
      console.log('2. Navigate to your database cluster');
      console.log('3. Either:');
      console.log('   a) Create a new database and make taaxdog-admin the owner');
      console.log('   b) Grant permissions using the "Users & Databases" interface');
      console.log('   c) Use the "doadmin" user to set up permissions');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

console.log('=== Checking Database Permissions ===\n');
checkPermissions();
