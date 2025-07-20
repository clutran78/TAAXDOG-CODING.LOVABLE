import { NextApiRequest, NextApiResponse } from 'next';
import { healthCheck } from '../../../lib/health-check';
import { publicApiRateLimiter } from '../../../lib/auth/rate-limiter';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apply rate limiting to prevent abuse
  const rateLimitOk = await publicApiRateLimiter(req, res);
  if (!rateLimitOk) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await healthCheck.performHealthCheck();
    const statusCode = result.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(result);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
}