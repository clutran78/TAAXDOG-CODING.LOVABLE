import { NextApiRequest, NextApiResponse } from 'next';
import { healthCheck } from '../../../lib/health-check';
import { apiResponse } from '@/lib/api/response';

// This endpoint requires authentication in production
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  // Simple authorization check for production
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.HEALTH_CHECK_TOKEN;

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }
  }

  try {
    const result = await healthCheck.performDetailedHealthCheck();
    const statusCode = result.health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(result);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
    });
  }
}
