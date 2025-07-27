#!/usr/bin/env node

require('dotenv').config({ path: '.env.production' });

const sgMail = require('@sendgrid/mail');

async function sendTestEmail(recipientEmail) {
  if (!recipientEmail) {
    console.error('Usage: node scripts/send-test-email.js <recipient-email>');
    process.exit(1);
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.error('❌ SENDGRID_API_KEY is not set');
    process.exit(1);
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = {
    to: recipientEmail,
    from: process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au',
    subject: 'TaxReturnPro - Test Email',
    text: 'This is a test email from TaxReturnPro production configuration.',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">TaxReturnPro Test Email</h2>
        <p>This is a test email to verify your email configuration is working correctly.</p>
        <p><strong>Configuration Details:</strong></p>
        <ul>
          <li>Environment: ${process.env.NODE_ENV || 'Not set'}</li>
          <li>From: ${process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au'}</li>
          <li>Timestamp: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</li>
        </ul>
        <p>If you received this email, your SendGrid configuration is working correctly!</p>
        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          © ${new Date().getFullYear()} TaxReturnPro. All rights reserved.
        </p>
      </div>
    `,
  };

  try {
    console.log('📧 Sending test email to:', recipientEmail);
    const [response] = await sgMail.send(msg);
    console.log('✅ Test email sent successfully!');
    console.log('Response status:', response.statusCode);
    console.log('Message ID:', response.headers['x-message-id']);
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.body);
    }
    process.exit(1);
  }
}

// Get recipient email from command line
const recipientEmail = process.argv[2];
sendTestEmail(recipientEmail);
