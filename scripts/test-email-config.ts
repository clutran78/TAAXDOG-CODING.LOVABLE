// Test email configuration
console.log('🔍 Testing Email Configuration\n');

console.log('Environment Variables:');
console.log('EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'Not set');
console.log(
  'SENDGRID_API_KEY:',
  process.env.SENDGRID_API_KEY
    ? `Set (${process.env.SENDGRID_API_KEY.substring(0, 10)}...)`
    : 'Not set',
);
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'Not set');
console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL || 'Not set');

console.log('\nChecking SendGrid API Key:');
if (process.env.SENDGRID_API_KEY) {
  if (process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    console.log('✅ API key format is valid');
  } else {
    console.log('❌ API key format is invalid (should start with "SG.")');
  }
} else {
  console.log('❌ No SendGrid API key found');
}

console.log('\nTesting email send...');

import { sendEmail } from '../lib/email';

async function testEmail() {
  try {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Email Configuration',
      html: '<p>This is a test email</p>',
      text: 'This is a test email',
    });

    console.log('\nEmail send result:', result);
  } catch (error) {
    console.error('\n❌ Error sending email:', error);
  }
}

testEmail();
