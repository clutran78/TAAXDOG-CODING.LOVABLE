#!/usr/bin/env ts-node

import fetch from 'node-fetch';

async function testPasswordReset() {
  const testEmail = process.argv[2] || 'test@example.com';
  const apiUrl = 'https://taxreturnpro.com.au/api/auth/forgot-password';

  console.log('🧪 Testing password reset functionality...');
  console.log(`📧 Sending password reset to: ${testEmail}\n`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testEmail }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Password reset request successful!');
      console.log('📬 Check your email for the reset link');
      console.log('\n📊 Now check SendGrid Activity Dashboard:');
      console.log('   https://app.sendgrid.com/activity');
    } else {
      console.log('❌ Password reset failed:');
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Usage
if (process.argv.length < 3) {
  console.log('Usage: npm run test-password-reset <email>');
  console.log('Example: npm run test-password-reset your@email.com');
  process.exit(1);
}

testPasswordReset();
