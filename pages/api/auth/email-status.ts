import type { NextApiRequest, NextApiResponse } from 'next';
import { getEmailProviderStatus, shouldRequireEmailVerification } from '../../../lib/auth/email-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const status = getEmailProviderStatus();
  const requiresVerification = shouldRequireEmailVerification();

  return res.status(200).json({
    ...status,
    requiresEmailVerification: requiresVerification,
    environment: process.env.NODE_ENV,
    emailFrom: process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au'
  });
}