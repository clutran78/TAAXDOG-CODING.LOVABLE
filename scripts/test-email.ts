#!/usr/bin/env ts-node

import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/email';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function testEmailSending() {
  const testEmail = process.argv[2];
  
  if (!testEmail) {
    console.error('Usage: npm run test-email <email-address>');
    process.exit(1);
  }

  console.log('🧪 Testing email configuration...');
  console.log('Provider:', process.env.EMAIL_PROVIDER || 'smtp');
  console.log('From:', process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au');
  console.log('To:', testEmail);
  
  try {
    // Test password reset email
    console.log('\n📧 Sending password reset email...');
    await sendPasswordResetEmail(
      testEmail,
      'Test User',
      'test-token-123456'
    );
    console.log('✅ Password reset email sent successfully!');
    
    // Test verification email
    console.log('\n📧 Sending verification email...');
    await sendVerificationEmail(
      testEmail,
      'Test User',
      'verify-token-789012'
    );
    console.log('✅ Verification email sent successfully!');
    
    console.log('\n🎉 All emails sent successfully!');
    console.log('Check your inbox for the test emails.');
    
  } catch (error) {
    console.error('\n❌ Error sending email:', error);
    process.exit(1);
  }
}

// Run the test
testEmailSending();