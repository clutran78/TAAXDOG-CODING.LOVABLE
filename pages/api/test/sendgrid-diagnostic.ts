import type { NextApiRequest, NextApiResponse } from 'next';
import sgMail from '@sendgrid/mail';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development or with a secret header
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-test-key'] !== process.env.TEST_EMAIL_SECRET
  ) {
    return apiResponse.forbidden(res, { error: 'Forbidden' });
  }

  logger.info('[SendGrid Diagnostic] Running diagnostics...');

  const diagnostics = {
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
      EMAIL_FROM: process.env.EMAIL_FROM || 'Not set',
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY
        ? {
            exists: true,
            startsWithSG: process.env.SENDGRID_API_KEY.startsWith('SG.'),
            length: process.env.SENDGRID_API_KEY.length,
            preview: process.env.SENDGRID_API_KEY.substring(0, 10) + '...',
          }
        : { exists: false },
      APP_URL: process.env.APP_URL,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    },
    sendgridInit: {
      apiKeySet: false,
      error: null as any,
    },
    testEmail: {
      attempted: false,
      success: false,
      error: null as any,
      response: null as any,
    },
  };

  // Test SendGrid initialization
  if (process.env.SENDGRID_API_KEY) {
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      diagnostics.sendgridInit.apiKeySet = true;
    } catch (error: any) {
      diagnostics.sendgridInit.error = error.message;
    }
  }

  // If requested, try to send a test email
  if (req.method === 'POST' && req.body.testEmail && diagnostics.sendgridInit.apiKeySet) {
    diagnostics.testEmail.attempted = true;

    const msg = {
      to: req.body.testEmail,
      from: process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au',
      subject: 'SendGrid Diagnostic Test',
      text: 'This is a test email from the SendGrid diagnostic endpoint.',
      html: '<p>This is a test email from the SendGrid diagnostic endpoint.</p><p>If you received this, SendGrid is working correctly!</p>',
    };

    try {
      logger.info('[SendGrid Diagnostic] Attempting to send test email to:', req.body.testEmail);
      const [response] = await sgMail.send(msg);
      diagnostics.testEmail.success = true;
      diagnostics.testEmail.response = {
        statusCode: response.statusCode,
        headers: response.headers,
        messageId: response.headers['x-message-id'],
      };
      logger.info('[SendGrid Diagnostic] ✅ Test email sent successfully');
    } catch (error: any) {
      logger.error('[SendGrid Diagnostic] ❌ Failed to send test email:', error);
      diagnostics.testEmail.error = {
        message: error.message,
        code: error.code,
        response: error.response?.body,
      };
    }
  }

  // Check email provider logic
  const providerLogic = {
    shouldUseSendGrid:
      process.env.EMAIL_PROVIDER === 'sendgrid' && process.env.SENDGRID_API_KEY?.startsWith('SG.'),
    actualProvider: !process.env.EMAIL_PROVIDER
      ? 'console (no EMAIL_PROVIDER)'
      : process.env.EMAIL_PROVIDER !== 'sendgrid'
        ? `${process.env.EMAIL_PROVIDER} (not sendgrid)`
        : !process.env.SENDGRID_API_KEY
          ? 'console (no API key)'
          : !process.env.SENDGRID_API_KEY.startsWith('SG.')
            ? 'console (invalid API key format)'
            : 'sendgrid',
  };

  const response = {
    timestamp: new Date().toISOString(),
    diagnostics,
    providerLogic,
    recommendations: [] as string[],
  };

  // Add recommendations
  if (!process.env.EMAIL_PROVIDER) {
    response.recommendations.push('Set EMAIL_PROVIDER=sendgrid in environment variables');
  }
  if (!process.env.SENDGRID_API_KEY) {
    response.recommendations.push('Set SENDGRID_API_KEY in environment variables');
  }
  if (process.env.SENDGRID_API_KEY && !process.env.SENDGRID_API_KEY.startsWith('SG.')) {
    response.recommendations.push('SENDGRID_API_KEY should start with "SG."');
  }
  if (!process.env.EMAIL_FROM) {
    response.recommendations.push('Set EMAIL_FROM to your verified sender email');
  }

  apiResponse.success(res, response);
}
