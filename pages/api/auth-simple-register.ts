import type { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Block this test endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return apiResponse.notFound(res, { message: 'Not found' });
  }
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  logger.info('Simple register called');
  logger.info('Body:', req.body);
  logger.info('Headers:', req.headers);

  // Simple validation
  const { email, password, name } = req.body || {};

  if (!email || !password || !name) {
    return apiResponse.error(res, {
      error: 'Missing required fields',
      received: req.body,
    });
  }

  // For testing, just return success
  return apiResponse.success(res, {
    message: 'Registration test successful',
    data: { email, name },
  });
}
