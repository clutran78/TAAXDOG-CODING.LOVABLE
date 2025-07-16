import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

// Email configuration
const emailConfig = {
  from: {
    name: 'TaxReturnPro',
    email: process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au',
  },
  support: {
    email: 'support@taxreturnpro.com.au',
  },
};

// Initialize SendGrid if API key is provided
if (process.env.SENDGRID_API_KEY) {
  console.log('Initializing SendGrid with API key:', process.env.SENDGRID_API_KEY.substring(0, 10) + '...');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.log('SendGrid API key not found in environment variables');
}

// Email provider type
type EmailProvider = 'sendgrid' | 'smtp' | 'console';

// Get the current email provider
function getEmailProvider(): EmailProvider {
  console.log('Email provider selection:', {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV,
    SMTP_USER: process.env.SMTP_USER ? 'Set' : 'Not set',
    SMTP_PASS: process.env.SMTP_PASS ? 'Set' : 'Not set',
  });
  
  // Check if SendGrid is configured and preferred
  if (process.env.EMAIL_PROVIDER === 'sendgrid' && process.env.SENDGRID_API_KEY) {
    console.log('Using SendGrid provider');
    return 'sendgrid';
  }
  
  // Fall back to SMTP in production if configured
  if (process.env.NODE_ENV === 'production' && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('Using SMTP provider');
    return 'smtp';
  }
  
  // Default to console in development or if nothing is configured
  console.log('Using console provider (no email will be sent)');
  return 'console';
}

// Send email using SendGrid
async function sendWithSendGrid(options: any) {
  // Re-check and set API key in case it wasn't initialized
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SendGrid API key is not configured');
  }
  
  // Ensure SendGrid is initialized with the current API key
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  
  const msg = {
    to: options.to,
    from: {
      email: emailConfig.from.email,
      name: emailConfig.from.name,
    },
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    console.log('Attempting to send email via SendGrid to:', options.to);
    const [response] = await sgMail.send(msg);
    console.log('SendGrid email sent successfully');
    return { 
      messageId: response.headers['x-message-id'] || `sg-${Date.now()}`,
      provider: 'sendgrid' 
    };
  } catch (error: any) {
    console.error('SendGrid error:', error);
    if (error.response) {
      console.error('SendGrid response error:', error.response.body);
    }
    throw new Error(`Failed to send email via SendGrid: ${error.message}`);
  }
}

// Create email transporter for SMTP
function createSMTPTransporter() {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Universal email sending function
async function sendEmail(options: any) {
  const provider = getEmailProvider();
  
  switch (provider) {
    case 'sendgrid':
      return sendWithSendGrid(options);
      
    case 'smtp':
      const transporter = createSMTPTransporter();
      const result = await transporter.sendMail({
        from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
        ...options,
      });
      return { ...result, provider: 'smtp' };
      
    case 'console':
    default:
      console.log('📧 Email would be sent:', {
        from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
        ...options,
      });
      return { 
        messageId: `dev-${Date.now()}`,
        provider: 'console' 
      };
  }
}

// Legacy createTransporter function for backward compatibility
function createTransporter() {
  const provider = getEmailProvider();
  
  if (provider === 'smtp') {
    return createSMTPTransporter();
  }
  
  // Return a compatible interface for non-SMTP providers
  return {
    sendMail: async (options: any) => {
      try {
        return await sendEmail(options);
      } catch (error) {
        console.error('Error in createTransporter sendMail:', error);
        throw error;
      }
    },
  };
}

// Email templates
const templates = {
  verification: (name: string, verificationUrl: string) => ({
    subject: 'Verify your TaxReturnPro account',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to TaxReturnPro</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Thanks for signing up! Please verify your email address to get started with TaxReturnPro.</p>
              <p>Click the button below to verify your email:</p>
              <a href="${verificationUrl}" class="button">Verify Email</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all;">${verificationUrl}</p>
              <p>This link will expire in 24 hours.</p>
              <p>If you didn't create an account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.</p>
              <p>This email was sent from a notification-only address that cannot accept incoming email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${name},

Thanks for signing up! Please verify your email address to get started with TaxReturnPro.

Click this link to verify your email:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.
    `.trim(),
  }),
  
  passwordReset: (name: string, resetUrl: string) => ({
    subject: 'Reset your TaxReturnPro password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 10px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all;">${resetUrl}</p>
              <div class="warning">
                <p><strong>Security Notice:</strong> This link will expire in 1 hour for your security.</p>
              </div>
              <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.</p>
              <p>Need help? Contact us at ${emailConfig.support.email}</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${name},

We received a request to reset your password. Click this link to create a new password:
${resetUrl}

This link will expire in 1 hour for your security.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.
Need help? Contact us at ${emailConfig.support.email}
    `.trim(),
  }),
  
  welcomeAfterVerification: (name: string) => ({
    subject: 'Welcome to TaxReturnPro - Get Started',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .feature { margin: 15px 0; padding: 15px; background-color: white; border-radius: 5px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to TaxReturnPro!</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Your email has been verified successfully! Here's how to get started:</p>
              
              <div class="feature">
                <h3>📊 1. Complete Your Profile</h3>
                <p>Add your tax details and financial information to get personalized insights.</p>
              </div>
              
              <div class="feature">
                <h3>📱 2. Connect Your Bank</h3>
                <p>Securely link your bank accounts for automatic expense tracking.</p>
              </div>
              
              <div class="feature">
                <h3>🧾 3. Start Tracking Receipts</h3>
                <p>Upload receipts with our AI-powered scanner for easy tax deductions.</p>
              </div>
              
              <div class="feature">
                <h3>💡 4. Get Tax Insights</h3>
                <p>Receive personalized recommendations to maximize your tax return.</p>
              </div>
              
              <a href="${(process.env.APP_URL || 'https://taxreturnpro.com.au')}/dashboard" class="button">Go to Dashboard</a>
              
              <p>Need help? Check out our <a href="${(process.env.APP_URL || 'https://taxreturnpro.com.au')}/help">Help Center</a> or reply to this email.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.</p>
              <p>ABN: 12 345 678 901 | Sydney, Australia</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${name},

Your email has been verified successfully! Here's how to get started:

1. Complete Your Profile - Add your tax details and financial information to get personalized insights.
2. Connect Your Bank - Securely link your bank accounts for automatic expense tracking.
3. Start Tracking Receipts - Upload receipts with our AI-powered scanner for easy tax deductions.
4. Get Tax Insights - Receive personalized recommendations to maximize your tax return.

Go to Dashboard: ${(process.env.APP_URL || 'https://taxreturnpro.com.au')}/dashboard

Need help? Check out our Help Center at ${(process.env.APP_URL || 'https://taxreturnpro.com.au')}/help or reply to this email.

© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.
ABN: 12 345 678 901 | Sydney, Australia
    `.trim(),
  }),
  
  twoFactorCode: (name: string, code: string) => ({
    subject: 'Your TaxReturnPro verification code',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .code { font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background-color: white; border-radius: 5px; letter-spacing: 5px; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verification Code</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Your verification code is:</p>
              <div class="code">${code}</div>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this code, please secure your account immediately.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${name},

Your verification code is: ${code}

This code will expire in 10 minutes.

If you didn't request this code, please secure your account immediately.

© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.
    `.trim(),
  }),
};

// Send verification email
export async function sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'https://taxreturnpro.com.au';
  const verificationUrl = `${appUrl}/auth/verify-email?token=${token}`;
  const template = templates.verification(name, verificationUrl);
  
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
    to: email,
    ...template,
  });
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
  const appUrl = process.env.APP_URL || 'https://taxreturnpro.com.au';
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
  const template = templates.passwordReset(name, resetUrl);
  
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
    to: email,
    ...template,
  });
}

// Send welcome email after verification
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const template = templates.welcomeAfterVerification(name);
  
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
    to: email,
    ...template,
  });
}

// Send two-factor authentication code
export async function sendTwoFactorCode(email: string, name: string, code: string): Promise<void> {
  const template = templates.twoFactorCode(name, code);
  
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
    to: email,
    ...template,
  });
}

// Send password change notification
export async function sendPasswordChangeNotification(email: string, name: string, req?: any): Promise<void> {
  const ipAddress = req?.headers?.['x-forwarded-for']?.split(',')[0] || 
                   req?.headers?.['x-real-ip'] || 
                   'Unknown';
  const userAgent = req?.headers?.['user-agent'] || 'Unknown';
  const browser = userAgent.includes('Chrome') ? 'Chrome' :
                 userAgent.includes('Firefox') ? 'Firefox' :
                 userAgent.includes('Safari') ? 'Safari' : 'Unknown browser';
  
  const template = {
    subject: 'Your TaxReturnPro password was changed',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .warning { background-color: #fee2e2; border: 1px solid #ef4444; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Changed</h1>
            </div>
            <div class="content">
              <h2>Hi ${name},</h2>
              <p>Your TaxReturnPro password was successfully changed.</p>
              
              <div class="details">
                <h3>Details:</h3>
                <p><strong>Date & Time:</strong> ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}</p>
                <p><strong>IP Address:</strong> ${ipAddress}</p>
                <p><strong>Browser:</strong> ${browser}</p>
              </div>
              
              <div class="warning">
                <p><strong>⚠️ Important:</strong> If you didn't make this change, your account may be compromised. Please:</p>
                <ol>
                  <li>Reset your password immediately</li>
                  <li>Enable two-factor authentication</li>
                  <li>Review your recent account activity</li>
                  <li>Contact support at ${emailConfig.support.email}</li>
                </ol>
              </div>
              
              <p>For security reasons, you may need to sign in again on all your devices.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.</p>
              <p>This is a security notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${name},

Your TaxReturnPro password was successfully changed.

Details:
- Date & Time: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
- IP Address: ${ipAddress}
- Browser: ${browser}

⚠️ Important: If you didn't make this change, your account may be compromised. Please:
1. Reset your password immediately
2. Enable two-factor authentication
3. Review your recent account activity
4. Contact support at ${emailConfig.support.email}

For security reasons, you may need to sign in again on all your devices.

© ${new Date().getFullYear()} TaxReturnPro. All rights reserved.
    `.trim(),
  };
  
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
    to: email,
    ...template,
  });
}