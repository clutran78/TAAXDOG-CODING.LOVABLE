import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function createTestAccount() {
  const testEmail = 'a.stroe.3022@gmail.com';
  const testPassword = 'TestPassword123!';
  const testName = 'A Stroe';

  console.log('🧪 Creating test account for:', testEmail);

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: testEmail.toLowerCase() }
    });

    if (existingUser) {
      console.log('❌ User already exists!');
      console.log('   Deleting existing user...');
      await prisma.user.delete({ where: { id: existingUser.id } });
      console.log('   ✅ Existing user deleted');
    }

    // Create new user
    console.log('📝 Creating new user...');
    const hashedPassword = await bcrypt.hash(testPassword, 12);
    
    const newUser = await prisma.user.create({
      data: {
        email: testEmail.toLowerCase(),
        password: hashedPassword,
        name: testName,
        emailVerified: new Date(), // Auto-verify for testing
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      }
    });

    console.log('✅ User created successfully!');
    console.log('   ID:', newUser.id);
    console.log('   Email:', newUser.email);
    console.log('   Name:', newUser.name);
    console.log('   Role:', newUser.role);
    console.log('\n🔑 Login credentials:');
    console.log('   Email:', testEmail);
    console.log('   Password:', testPassword);

    // Test password verification
    const user = await prisma.user.findUnique({
      where: { email: testEmail.toLowerCase() }
    });

    if (user && user.password) {
      const isValid = await bcrypt.compare(testPassword, user.password);
      console.log('\n🔐 Password verification test:', isValid ? '✅ PASSED' : '❌ FAILED');
    }

  } catch (error) {
    console.error('❌ Error during account creation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAccount().catch(console.error);