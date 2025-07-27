import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

async function resetUserPassword() {
  const email = 'a.stroe.3022@gmail.com';
  const newPassword = 'password123'; // Simple password

  console.log(`Resetting password for: ${email}`);
  console.log(`New password will be: ${newPassword}`);

  try {
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password and reset failed attempts
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    console.log('\n✅ Password reset successfully!');
    console.log('Updated user:', updatedUser);
    console.log('\n📝 You can now login with:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
    console.log('\n🌐 Login at: http://localhost:3000/auth/login');
  } catch (error) {
    console.error('❌ Error resetting password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetUserPassword();
