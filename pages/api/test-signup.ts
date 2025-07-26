import type { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  logger.info('Test register endpoint called');
  logger.info('Body:', req.body);

  return apiResponse.success(res, {
    message: 'Test successful',
    received: req.body,
  });
}
