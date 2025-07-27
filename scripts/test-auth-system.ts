import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function testAuthSystem() {
  console.log('🔍 Testing Authentication System...\n');

  try {
    // 1. Test database connection
    console.log('1. Testing database connection...');
    const dbTest = await prisma.$queryRaw`SELECT NOW()`;
    console.log('✅ Database connection successful\n');

    // 2. Check if User table exists
    console.log('2. Checking User table...');
    const userCount = await prisma.user.count();
    console.log(`✅ User table exists with ${userCount} users\n`);

    // 3. Test password hashing
    console.log('3. Testing password hashing...');
    const testPassword = 'TestPassword123!';
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    console.log(`✅ Password hashed successfully`);
    console.log(`   Original: ${testPassword}`);
    console.log(`   Hashed: ${hashedPassword.substring(0, 20)}...`);

    // Test password comparison
    const isMatch = await bcrypt.compare(testPassword, hashedPassword);
    console.log(`✅ Password comparison works: ${isMatch}\n`);

    // 4. Check for any existing test users
    console.log('4. Checking for test users...');
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [{ email: { contains: 'test' } }, { email: { contains: 'demo' } }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (testUsers.length > 0) {
      console.log(`Found ${testUsers.length} test users:`);
      testUsers.forEach((user) => {
        console.log(
          `   - ${user.email} (${user.name}) - Verified: ${user.emailVerified ? 'Yes' : 'No'}`,
        );
      });
    } else {
      console.log('   No test users found');
    }
    console.log('');

    // 5. Check recent user registrations
    console.log('5. Checking recent user registrations (last 7 days)...');
    const recentUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        email: true,
        createdAt: true,
        emailVerified: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    if (recentUsers.length > 0) {
      console.log(`Found ${recentUsers.length} recent registrations:`);
      recentUsers.forEach((user) => {
        console.log(
          `   - ${user.email} - ${user.createdAt.toISOString()} - Verified: ${user.emailVerified ? 'Yes' : 'No'}`,
        );
      });
    } else {
      console.log('   No recent registrations');
    }
    console.log('');

    // 6. Check for users with password reset tokens
    console.log('6. Checking for active password reset tokens...');
    const usersWithResetTokens = await prisma.user.findMany({
      where: {
        passwordResetToken: { not: null },
      },
      select: {
        email: true,
        passwordResetExpires: true,
      },
    });

    if (usersWithResetTokens.length > 0) {
      console.log(`Found ${usersWithResetTokens.length} users with reset tokens:`);
      usersWithResetTokens.forEach((user) => {
        const isExpired = user.passwordResetExpires && user.passwordResetExpires < new Date();
        console.log(
          `   - ${user.email} - Expires: ${user.passwordResetExpires?.toISOString()} - ${isExpired ? 'EXPIRED' : 'Active'}`,
        );
      });
    } else {
      console.log('   No active password reset tokens');
    }
    console.log('');

    console.log('✅ All authentication system tests passed!\n');
  } catch (error) {
    console.error('❌ Error testing auth system:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAuthSystem();
