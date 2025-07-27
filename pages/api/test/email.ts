import type { NextApiRequest, NextApiResponse } from 'next';
import { sendEmail } from '../../../lib/services/email/email';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development or with a secret key
  const secretKey = req.headers['x-test-key'];
  if (process.env.NODE_ENV === 'production' && secretKey !== process.env.TEST_EMAIL_SECRET) {
    return apiResponse.forbidden(res, { error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const { to } = req.body;

  if (!to) {
    return apiResponse.error(res, { error: 'Email address required' });
  }

  logger.info('[TestEmail] Starting email test to:', to);
  console.log('[TestEmail] Environment check:', {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY
      ? 'Set (length: ' + process.env.SENDGRID_API_KEY.length + ')'
      : 'Not set',
    EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    APP_URL: process.env.APP_URL,
    NODE_ENV: process.env.NODE_ENV,
  });

  try {
    const result = await sendEmail({
      to,
      subject: 'Test Email from TaxReturnPro',
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from your TaxReturnPro application.</p>
        <p>If you're receiving this, your email configuration is working correctly!</p>
        <hr>
        <p><small>Environment: ${process.env.NODE_ENV}</small></p>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
      text: `Test Email\n\nThis is a test email from your TaxReturnPro application.\nIf you're receiving this, your email configuration is working correctly!\n\nEnvironment: ${process.env.NODE_ENV}\nSent at: ${new Date().toISOString()}`,
    });

    logger.info('[TestEmail] ✅ Email sent successfully:', result);

    apiResponse.success(res, {
      success: true,
      message: 'Test email sent successfully',
      provider: result.provider,
      messageId: result.messageId,
      to,
      environment: {
        provider: process.env.EMAIL_PROVIDER || 'default',
        from: process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au',
      },
    });
  } catch (error: any) {
    console.error('[TestEmail] ❌ Failed to send test email:', {
      error: error.message,
      code: error.code,
      response: error.response?.body,
      stack: error.stack,
    });

    apiResponse.internalError(res, {
      error: 'Failed to send test email',
      message: error.message,
      details: error.response?.body || error.toString(),
    });
  }
}
