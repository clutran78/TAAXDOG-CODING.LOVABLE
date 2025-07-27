import { NextApiRequest, NextApiResponse } from 'next';
import { healthCheck } from '../../../lib/health-check';
import { withMiddleware } from '../../../lib/middleware';
import { publicApiRateLimiter } from '../../../lib/auth/rate-limiter';
import { apiResponse } from '@/lib/api/response';

/**
 * Health check endpoint specifically for external service monitoring
 * Useful for targeted monitoring of third-party API dependencies
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting
  const rateLimitOk = await publicApiRateLimiter(req, res);
  if (!rateLimitOk) return;

  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    // Perform full health check
    const fullHealth = await healthCheck.performHealthCheck();

    // Extract only external service checks
    const externalServices = {
      status: fullHealth.status,
      timestamp: fullHealth.timestamp,
      services: {
        database: fullHealth.checks.database,
        redis: fullHealth.checks.redis,
        basiq: fullHealth.checks.basiq,
        ai: fullHealth.checks.ai,
        stripe: fullHealth.checks.stripe,
        sendgrid: fullHealth.checks.sendgrid,
      },
    };

    // Calculate external services specific status
    const serviceStatuses = Object.values(externalServices.services).map((s) => s.status);
    const failedServices = serviceStatuses.filter((s) => s === 'fail').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failedServices === 0) {
      overallStatus = 'healthy';
    } else if (failedServices === serviceStatuses.length) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      ...externalServices,
      status: overallStatus,
      summary: {
        total: serviceStatuses.length,
        healthy: serviceStatuses.filter((s) => s === 'pass').length,
        unhealthy: failedServices,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'External services health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export default handler;
