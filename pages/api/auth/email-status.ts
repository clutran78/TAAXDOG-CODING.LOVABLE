import type { NextApiRequest, NextApiResponse } from 'next';
import { apiResponse } from '@/lib/api/response';
import {
  getEmailProviderStatus,
  shouldRequireEmailVerification,
} from '../../../lib/auth/email-config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const status = getEmailProviderStatus();
  const requiresVerification = shouldRequireEmailVerification();

  return apiResponse.success(res, {
    ...status,
    requiresEmailVerification: requiresVerification,
    environment: process.env.NODE_ENV,
    emailFrom: process.env.EMAIL_FROM || 'noreply@taxreturnpro.com.au',
  });
}
