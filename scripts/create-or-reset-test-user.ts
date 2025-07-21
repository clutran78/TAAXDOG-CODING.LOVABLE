import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function createOrResetTestUser() {
  const testEmail = 'testuser@example.com';
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';

  console.log('🔧 Creating or resetting test user...\n');
  console.log(`Email: ${testEmail}`);
  console.log(`Password: ${testPassword}`);
  console.log('');

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (existingUser) {
      console.log('✅ User exists, resetting password...');
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(testPassword, 12);
      
      // Update the user
      const updatedUser = await prisma.user.update({
        where: { email: testEmail },
        data: {
          password: hashedPassword,
          emailVerified: new Date(),
          passwordResetToken: null,
          passwordResetExpires: null,
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });
      
      console.log('✅ Password reset successfully!');
      console.log(`User ID: ${updatedUser.id}`);
      console.log(`Email verified: ${updatedUser.emailVerified ? 'Yes' : 'No'}`);
      
    } else {
      console.log('📝 User does not exist, creating new user...');
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(testPassword, 12);
      
      // Create new user
      const newUser = await prisma.user.create({
        data: {
          email: testEmail,
          password: hashedPassword,
          name: testName,
          emailVerified: new Date(),
          role: 'USER'
        }
      });
      
      console.log('✅ User created successfully!');
      console.log(`User ID: ${newUser.id}`);
    }

    console.log('\n🧪 Testing password hash...');
    
    // Verify the password works
    const user = await prisma.user.findUnique({
      where: { email: testEmail }
    });
    
    if (user && user.password) {
      const isValid = await bcrypt.compare(testPassword, user.password);
      console.log(`Password validation: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (!isValid) {
        console.error('\n❌ WARNING: Password validation failed! There might be an issue with bcrypt.');
      }
    }
    
    console.log('\n📋 Test User Credentials:');
    console.log('========================');
    console.log(`Email: ${testEmail}`);
    console.log(`Password: ${testPassword}`);
    console.log('========================\n');
    console.log('You can now use these credentials to test login.\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createOrResetTestUser();