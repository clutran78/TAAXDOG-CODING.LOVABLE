const { PrismaClient } = require('../generated/prisma');

async function setupDatabase() {
  console.log('🔧 Setting up TAAXDOG database...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('Please create a .env.local file with your PostgreSQL connection string');
    console.error('Example: DATABASE_URL="postgresql://username:password@localhost:5432/taaxdog_db"');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Test database connection
    console.log('1. Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully\n');

    // Check if tables exist
    console.log('2. Checking database schema...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found. Please run: npx prisma migrate dev');
    } else {
      console.log(`✅ Found ${tables.length} tables in database\n`);
    }

    // Test user operations
    console.log('3. Testing user operations...');
    const userCount = await prisma.user.count();
    console.log(`✅ User table accessible. Current users: ${userCount}\n`);

    console.log('🎉 Database setup verification complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run build');
    console.log('2. Run: npm run dev');
    console.log('3. Test registration at: http://localhost:3000/auth/register');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure PostgreSQL is running');
    console.error('2. Check your DATABASE_URL in .env.local');
    console.error('3. Run: npx prisma migrate dev');
    console.error('4. Run: npx prisma generate');
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();