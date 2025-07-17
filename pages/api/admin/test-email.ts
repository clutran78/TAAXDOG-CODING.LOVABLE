import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { getEmailProviderStatus } from '../../../lib/auth/email-config';
import { sendEmail } from '../../../lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication and admin role
  const session = await getServerSession(req, res, authOptions);
  
  // For now, we'll use a simple API key check since NextAuth might not be fully configured
  const apiKey = req.headers['x-admin-api-key'];
  const isAuthorized = apiKey === process.env.NEXTAUTH_SECRET || 
    (session?.user && (session.user as any).role === 'ADMIN');

  if (!isAuthorized) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Admin access required. Use x-admin-api-key header with NEXTAUTH_SECRET value.'
    });
  }

  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Get email provider status
    const status = getEmailProviderStatus();
    
    if (!status.canSendEmails) {
      return res.status(503).json({
        error: 'Email service not configured',
        status,
        environment: process.env.NODE_ENV,
        provider: process.env.EMAIL_PROVIDER,
        hasKey: !!process.env.SENDGRID_API_KEY,
        keyPrefix: process.env.SENDGRID_API_KEY?.substring(0, 5)
      });
    }

    // Send test email
    const result = await sendEmail({
      to: email,
      subject: 'TaxReturnPro Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e40af;">Email Configuration Test</h1>
          <p>This is a test email from TaxReturnPro to verify email configuration.</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <h2>Configuration Details:</h2>
          <ul>
            <li><strong>Environment:</strong> ${process.env.NODE_ENV}</li>
            <li><strong>Provider:</strong> ${status.provider}</li>
            <li><strong>From:</strong> ${process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au'}</li>
            <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
          </ul>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated test email. If you received this, your email configuration is working correctly.
          </p>
        </div>
      `,
      text: `Email Configuration Test

This is a test email from TaxReturnPro to verify email configuration.

Configuration Details:
- Environment: ${process.env.NODE_ENV}
- Provider: ${status.provider}
- From: ${process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au'}
- Timestamp: ${new Date().toISOString()}

This is an automated test email. If you received this, your email configuration is working correctly.`
    });

    return res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      result,
      configuration: {
        ...status,
        environment: process.env.NODE_ENV,
        from: process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au'
      }
    });

  } catch (error: any) {
    console.error('[TestEmail] Error:', error);
    
    return res.status(500).json({
      error: 'Failed to send test email',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        code: error.code,
        provider: process.env.EMAIL_PROVIDER,
        hasKey: !!process.env.SENDGRID_API_KEY
      } : undefined
    });
  }
}