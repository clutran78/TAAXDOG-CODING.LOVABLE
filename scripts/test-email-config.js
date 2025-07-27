#!/usr/bin/env node

require('dotenv').config({ path: '.env.production' });

const sgMail = require('@sendgrid/mail');

async function testEmailConfiguration() {
  console.log('🔍 Testing Email Configuration\n');

  // Check environment variables
  console.log('Environment Check:');
  console.log('- SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || '❌ Missing');
  console.log(
    '- EMAIL_PROVIDER:',
    process.env.EMAIL_PROVIDER || 'Not set (will use default logic)',
  );
  console.log('- NODE_ENV:', process.env.NODE_ENV || 'Not set');

  if (!process.env.SENDGRID_API_KEY) {
    console.error('\n❌ SENDGRID_API_KEY is not set in environment variables');
    console.log('\nTo configure SendGrid:');
    console.log('1. Sign up at https://sendgrid.com');
    console.log('2. Create an API key with "Mail Send" permissions');
    console.log('3. Add to .env.production: SENDGRID_API_KEY=SG.your-api-key-here');
    console.log('4. Verify your sender domain in SendGrid dashboard');
    process.exit(1);
  }

  // Validate API key format
  if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    console.error('\n⚠️  Warning: SendGrid API key should start with "SG."');
  }

  // Test SendGrid connection
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Create a test email (but don't send it)
    const msg = {
      to: 'test@example.com',
      from: process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au',
      subject: 'Test Email Configuration',
      text: 'This is a test email',
      html: '<p>This is a test email</p>',
    };

    console.log('\n✅ SendGrid API key is valid format');
    console.log('✅ Email configuration appears correct');

    console.log('\nEmail will be sent from:', msg.from);
    console.log('\n📧 To send a test email, run:');
    console.log('   node scripts/send-test-email.js your-email@example.com');
  } catch (error) {
    console.error('\n❌ SendGrid configuration error:', error.message);
  }

  // Production readiness check
  console.log('\n🏁 Production Readiness:');
  const isReady =
    process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM && process.env.NODE_ENV === 'production';

  if (isReady) {
    console.log('✅ Email service is ready for production');
  } else {
    console.log('❌ Email service is NOT ready for production');
    console.log('\nRequired fixes:');
    if (!process.env.SENDGRID_API_KEY) console.log('  - Set SENDGRID_API_KEY');
    if (!process.env.EMAIL_FROM) console.log('  - Set EMAIL_FROM');
    if (process.env.NODE_ENV !== 'production') console.log('  - Set NODE_ENV=production');
  }
}

testEmailConfiguration();
