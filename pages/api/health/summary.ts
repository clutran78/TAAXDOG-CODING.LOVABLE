import { NextApiRequest, NextApiResponse } from 'next';
import { healthCheck } from '../../../lib/health-check';
import { publicApiRateLimiter } from '../../../lib/auth/rate-limiter';
import { apiResponse } from '@/lib/api/response';

/**
 * Health check summary endpoint
 * Provides a lightweight summary of system health status
 * Useful for monitoring dashboards and quick status checks
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting
  const rateLimitOk = await publicApiRateLimiter(req, res);
  if (!rateLimitOk) return;

  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const health = await healthCheck.performHealthCheck();

    // Create a summary of all checks
    const allChecks = [
      { name: 'database', status: health.checks.database.status },
      { name: 'redis', status: health.checks.redis.status },
      { name: 'memory', status: health.checks.memory.status },
      { name: 'uptime', status: health.checks.uptime.status },
      { name: 'basiq', status: health.checks.basiq.status },
      { name: 'ai', status: health.checks.ai.status },
      { name: 'stripe', status: health.checks.stripe.status },
      { name: 'sendgrid', status: health.checks.sendgrid.status },
    ];

    const summary = {
      status: health.status,
      timestamp: health.timestamp,
      version: health.version,
      environment: health.environment,
      checks: {
        total: allChecks.length,
        passing: allChecks.filter((c) => c.status === 'pass').length,
        failing: allChecks.filter((c) => c.status === 'fail').length,
      },
      services: allChecks.reduce(
        (acc, check) => {
          acc[check.name] = check.status;
          return acc;
        },
        {} as Record<string, string>,
      ),
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json(summary);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check summary failed',
    });
  }
}

export default handler;
