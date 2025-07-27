import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function debugAuthIssues() {
  console.log('\n🔍 DEBUGGING AUTHENTICATION ISSUES\n');

  try {
    // 1. Test database connection
    console.log('1. Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful\n');

    // 2. List all users
    console.log('2. Listing all users in database:');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        role: true,
        createdAt: true,
        password: true,
      },
    });

    if (users.length === 0) {
      console.log('❌ No users found in database!\n');
    } else {
      console.log(`Found ${users.length} users:`);
      users.forEach((user) => {
        console.log(`
  - Email: ${user.email}
    Name: ${user.name}
    Role: ${user.role}
    Email Verified: ${user.emailVerified ? 'Yes' : 'No'}
    Has Password: ${user.password ? 'Yes' : 'No'}
    Created: ${user.createdAt.toLocaleDateString()}`);
      });
    }

    // 3. Check specific user
    const testEmail = 'madalin.adrian.stroe@gmail.com';
    console.log(`\n3. Checking specific user: ${testEmail}`);
    const specificUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    if (specificUser) {
      console.log('✅ User found');
      console.log(`   - ID: ${specificUser.id}`);
      console.log(`   - Has password: ${specificUser.password ? 'Yes' : 'No'}`);

      // Test password
      if (specificUser.password) {
        const testPasswords = ['password', 'Password123!', 'Test123!'];
        console.log('\n   Testing common passwords:');
        for (const pwd of testPasswords) {
          const isValid = await bcrypt.compare(pwd, specificUser.password);
          console.log(`   - "${pwd}": ${isValid ? '✅ MATCHES' : '❌ No match'}`);
        }
      }
    } else {
      console.log('❌ User not found');
    }

    // 4. Check password reset tokens
    console.log('\n4. Checking password reset tokens:');
    const resetTokens = await prisma.passwordResetToken.findMany({
      orderBy: { expires: 'desc' },
      take: 5,
    });

    if (resetTokens.length === 0) {
      console.log('No password reset tokens found');
    } else {
      console.log(`Found ${resetTokens.length} recent tokens:`);
      resetTokens.forEach((token) => {
        console.log(`  - Email: ${token.email}`);
        console.log(`    Token: ${token.token.substring(0, 20)}...`);
        console.log(`    Expires: ${token.expires}`);
        console.log(`    Valid: ${token.expires > new Date() ? 'Yes' : 'No (expired)'}\n`);
      });
    }

    // 5. Test creating a user
    console.log('\n5. Testing user creation...');
    const testUser = {
      email: 'test-' + Date.now() + '@example.com',
      password: 'TestPassword123!',
      name: 'Test User',
    };

    try {
      const hashedPassword = await bcrypt.hash(testUser.password, 12);
      const newUser = await prisma.user.create({
        data: {
          email: testUser.email,
          password: hashedPassword,
          name: testUser.name,
          emailVerified: new Date(),
        },
      });
      console.log('✅ Test user created successfully');
      console.log(`   - ID: ${newUser.id}`);
      console.log(`   - Email: ${newUser.email}`);

      // Clean up test user
      await prisma.user.delete({ where: { id: newUser.id } });
      console.log('✅ Test user cleaned up');
    } catch (error: any) {
      console.log('❌ Failed to create test user:', error.message);
    }

    // 6. Check sessions
    console.log('\n6. Checking active sessions:');
    const sessions = await prisma.session.findMany({
      where: {
        expires: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (sessions.length === 0) {
      console.log('No active sessions found');
    } else {
      console.log(`Found ${sessions.length} active sessions`);
      sessions.forEach((session) => {
        console.log(`  - User: ${session.user.email}`);
        console.log(`    Expires: ${session.expires}`);
      });
    }
  } catch (error) {
    console.error('\n❌ Error during debugging:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug script
debugAuthIssues().catch(console.error);
