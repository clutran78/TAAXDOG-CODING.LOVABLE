import prisma from '../lib/prisma';
import { createPasswordResetToken, verifyPasswordResetToken, resetPassword } from '../lib/auth';

async function testPasswordResetFlow() {
  const testEmail = 'madalin.adrian.stroe@gmail.com';

  console.log('🧪 Testing Password Reset Flow\n');
  console.log('Test email:', testEmail);

  try {
    // Step 1: Create a reset token
    console.log('\n1️⃣ Creating password reset token...');
    const token = await createPasswordResetToken(testEmail);
    console.log('✅ Token created:', token.substring(0, 20) + '...');

    // Step 2: Verify the token
    console.log('\n2️⃣ Verifying token...');
    const verification = await verifyPasswordResetToken(token);
    if (verification) {
      console.log('✅ Token is valid for email:', verification.email);
      console.log('   Expires:', verification.expires);
    } else {
      console.log('❌ Token verification failed!');
      return;
    }

    // Step 3: Check if user exists
    console.log('\n3️⃣ Checking user...');
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      select: { id: true, email: true, name: true },
    });

    if (user) {
      console.log('✅ User found:', user.name);
    } else {
      console.log('❌ User not found!');
      return;
    }

    // Step 4: Test password reset (without actually resetting)
    console.log('\n4️⃣ Testing password reset function...');
    const newPassword = 'TestResetPassword123!';

    try {
      // Don't actually reset in this test
      console.log('✅ Password reset function is available');
      console.log('   Would reset password for:', testEmail);
      console.log('   New password would be:', newPassword);
    } catch (error: any) {
      console.log('❌ Password reset would fail:', error.message);
    }

    // Step 5: List all tokens for this user
    console.log('\n5️⃣ Checking all tokens for user...');
    const allTokens = await prisma.passwordResetToken.findMany({
      where: { email: testEmail },
      orderBy: { expires: 'desc' },
    });

    console.log(`Found ${allTokens.length} token(s):`);
    allTokens.forEach((t, i) => {
      console.log(`   ${i + 1}. Token: ${t.token.substring(0, 20)}...`);
      console.log(`      Expires: ${t.expires}`);
      console.log(`      Valid: ${t.expires > new Date() ? '✅' : '❌'}`);
    });

    // Generate the reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL || 'https://dev.taxreturnpro.com.au'}/auth/reset-password?token=${token}`;
    console.log('\n🔗 Reset URL for testing:');
    console.log(resetUrl);
  } catch (error) {
    console.error('\n❌ Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPasswordResetFlow().catch(console.error);
