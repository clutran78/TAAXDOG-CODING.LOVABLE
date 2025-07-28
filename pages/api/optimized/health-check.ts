import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { withPublicRateLimit } from '../../../lib/security/rateLimiter';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

/**
 * Health check endpoint for monitoring database and cache performance
 */
async function healthCheckHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    // Check authorization (optional - you might want to protect this endpoint)
    const authHeader = req.headers.authorization;
    const isAuthorized = authHeader === `Bearer ${process.env.HEALTH_CHECK_TOKEN}`;

    // Basic health check (always available)
    const basicHealth = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    if (!isAuthorized) {
      return apiResponse.success(res, basicHealth);
    }

    // Detailed health check for authorized requests
    const databaseHealth = await checkDatabaseHealth();

    const detailedHealth = {
      ...basicHealth,
      status: databaseHealth.isHealthy ? 'healthy' : 'degraded',
      services: {
        database: databaseHealth,
      },
    };

    // Set appropriate status code
    const statusCode = detailedHealth.status === 'healthy' ? 200 : 503;

    return res.status(statusCode).json(detailedHealth);
  } catch (error) {
    logger.error('Health check error:', error);
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function checkDatabaseHealth() {
  const startTime = Date.now();

  try {
    // Simple query to check connection using Prisma's safe query method
    // This uses findFirst on a small table to verify database connectivity
    await prisma.user.findFirst({
      select: { id: true },
      take: 1,
    });

    const responseTime = Date.now() - startTime;

    return {
      isHealthy: true,
      responseTime,
      status: responseTime < 100 ? 'excellent' : responseTime < 500 ? 'good' : 'slow',
    };
  } catch (error) {
    return {
      isHealthy: false,
      responseTime: Date.now() - startTime,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export with rate limiting
export default withPublicRateLimit(healthCheckHandler, {
  window: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute
  message: 'Too many health check requests. Please try again later.',
});
