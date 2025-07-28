import prisma from '../lib/prisma';
import { hashPassword } from '../lib/auth';

async function testRegistration() {
  console.log('=== Testing User Registration ===\n');

  const testUsers = [
    { email: 'test1@example.com', name: 'Test User 1', password: 'password123' },
    { email: 'test2@example.com', name: 'Test User 2', password: 'password123' },
    { email: 'test3@example.com', name: 'Test User 3', password: 'password123' },
  ];

  for (const userData of testUsers) {
    console.log(`\nTesting registration for: ${userData.email}`);

    try {
      // Check if user exists
      console.log('1. Checking if user exists...');
      const existing = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existing) {
        console.log('   User already exists, deleting...');
        await prisma.user.delete({
          where: { email: userData.email },
        });
      }

      // Create user
      console.log('2. Creating user...');
      const hashedPassword = await hashPassword(userData.password);
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          taxResidency: 'RESIDENT',
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      });

      console.log('✓ User created successfully:', user);

      // Verify user was created
      console.log('3. Verifying user...');
      const verified = await prisma.user.findUnique({
        where: { email: userData.email },
        select: { id: true, email: true },
      });

      if (verified) {
        console.log('✓ User verified in database');
      } else {
        console.log('✗ User not found after creation!');
      }
    } catch (error) {
      console.error('✗ Registration failed:', {
        error: error.message,
        code: error.code,
        meta: error.meta,
      });
    }
  }

  // Check total user count
  console.log('\n=== Final Statistics ===');
  try {
    const userCount = await prisma.user.count();
    console.log(`Total users in database: ${userCount}`);

    const recentUsers = await prisma.user.findMany({
      select: { email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    console.log('\nRecent users:');
    recentUsers.forEach((user) => {
      console.log(`- ${user.email} (created: ${user.createdAt})`);
    });
  } catch (error) {
    console.error('Failed to get statistics:', error.message);
  }

  await prisma.$disconnect();
}

// Run the test
testRegistration().catch(console.error);
