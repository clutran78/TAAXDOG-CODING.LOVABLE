import type { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Block this test endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return apiResponse.notFound(res, { message: 'Not found' });
  }
  logger.info('Method:', req.method);
  logger.info('Headers:', req.headers);
  logger.info('Body:', req.body);
  logger.info('Body type:', typeof req.body);

  if (req.method === 'POST') {
    return apiResponse.success(res, {
      received: req.body,
      bodyType: typeof req.body,
      headers: {
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
      },
    });
  }

  return apiResponse.success(res, { message: 'Test endpoint ready' });
}
