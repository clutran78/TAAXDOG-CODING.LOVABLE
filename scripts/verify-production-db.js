#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function verifyProductionDatabase() {
  console.log('🔍 Verifying Production Database for Authentication...\n');

  // Check environment
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Database URL exists:', !!process.env.DATABASE_URL);

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set!');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

  try {
    // 1. Test connection
    console.log('\n1. Testing database connection...');
    await prisma.$connect();
    console.log('✅ Connected to database');

    // 2. Check User table schema
    console.log('\n2. Checking User table schema...');
    const testQuery = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      ORDER BY ordinal_position;
    `;

    console.log('User table columns:');
    testQuery.forEach((col) => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check for required columns
    const requiredColumns = ['id', 'email', 'password', 'name', 'role', 'emailVerified'];
    const columnNames = testQuery.map((col) => col.column_name);
    const missingColumns = requiredColumns.filter((col) => !columnNames.includes(col));

    if (missingColumns.length > 0) {
      console.error('❌ Missing required columns:', missingColumns);
    } else {
      console.log('✅ All required columns present');
    }

    // 3. Test user count
    console.log('\n3. Checking existing users...');
    const userCount = await prisma.user.count();
    console.log(`Total users in database: ${userCount}`);

    // 4. Test creating a user
    console.log('\n4. Testing user creation...');
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    try {
      const hashedPassword = await bcrypt.hash(testPassword, 12);

      const testUser = await prisma.user.create({
        data: {
          email: testEmail,
          password: hashedPassword,
          name: 'Test User',
          emailVerified: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      console.log('✅ User created successfully:', {
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });

      // 5. Test password verification
      console.log('\n5. Testing password verification...');
      const createdUser = await prisma.user.findUnique({
        where: { email: testEmail },
      });

      const isValid = await bcrypt.compare(testPassword, createdUser.password);
      console.log(`Password verification: ${isValid ? '✅ Success' : '❌ Failed'}`);

      // Clean up test user
      await prisma.user.delete({
        where: { email: testEmail },
      });
      console.log('✅ Test user cleaned up');
    } catch (createError) {
      console.error('❌ Failed to create test user:', {
        message: createError.message,
        code: createError.code,
        meta: createError.meta,
      });
    }

    // 6. Check for password reset columns
    console.log('\n6. Checking password reset columns...');
    const hasResetColumns =
      columnNames.includes('passwordResetToken') && columnNames.includes('passwordResetExpires');

    if (hasResetColumns) {
      console.log('✅ Password reset columns present');
    } else {
      console.log('⚠️  Password reset columns missing - password reset will not work');
    }

    // 7. Test a simple query
    console.log('\n7. Testing basic query...');
    const firstUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    if (firstUser) {
      console.log('✅ Query successful - found user:', firstUser.email);
    } else {
      console.log('⚠️  No users found in database');
    }

    console.log('\n✅ Database verification complete!');
  } catch (error) {
    console.error('\n❌ Database verification failed:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyProductionDatabase().catch(console.error);
