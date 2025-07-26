import type { NextApiRequest, NextApiResponse } from 'next';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Block this endpoint entirely in production
  if (process.env.NODE_ENV === 'production') {
    return apiResponse.notFound(res, { message: 'Not found' });
  }

  // In development, still require a token for extra security
  const token = req.headers['x-test-token'];
  if (token !== process.env.HEALTH_CHECK_TOKEN) {
    return apiResponse.forbidden(res, { message: 'Forbidden' });
  }

  // Return minimal configuration without exposing any key prefixes
  const config = {
    environment: process.env.NODE_ENV,
    emailProvider: process.env.EMAIL_PROVIDER || 'Not configured',
    sendgridConfigured: !!process.env.SENDGRID_API_KEY,
    smtpConfigured: !!process.env.SMTP_USER && !!process.env.SMTP_HOST,
    emailFrom: process.env.EMAIL_FROM ? 'Configured' : 'Not configured',
  };

  apiResponse.success(res, config);
}
