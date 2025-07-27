import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function fixUserPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log(`
Usage: npm run fix-password [email] [password]

Example:
  npm run fix-password user@example.com NewPassword123!
`);
    process.exit(1);
  }

  console.log(`\n🔧 Fixing password for user: ${email}\n`);

  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        password: true,
      },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log('📋 User details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
    console.log(`   Has Password: ${user.password ? 'Yes' : 'No'}\n`);

    // Hash the new password
    console.log('🔐 Hashing new password...');
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update the user's password
    console.log('💾 Updating password in database...');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        // Also set emailVerified if it's not set
        emailVerified: user.emailVerified || new Date(),
      },
    });

    console.log('✅ Password updated successfully!\n');

    // Test the new password
    console.log('🧪 Testing new password...');
    const updatedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (updatedUser && updatedUser.password) {
      const isValid = await bcrypt.compare(newPassword, updatedUser.password);
      console.log(`   Password verification: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);

      if (isValid) {
        console.log('\n🎉 Success! User can now login with:');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${newPassword}`);
      }
    }

    // Clear any existing password reset tokens
    console.log('\n🧹 Clearing any existing reset tokens...');
    await prisma.passwordResetToken.deleteMany({
      where: { email: email.toLowerCase() },
    });
    console.log('✅ Reset tokens cleared');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// For the specific user having issues
console.log('==========================================');
console.log('Password Fix Utility for TAAXDOG');
console.log('==========================================');

fixUserPassword().catch(console.error);
