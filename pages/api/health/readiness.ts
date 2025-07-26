import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getConfig } from '../../../lib/config';
import { withPublicRateLimit } from '../../../lib/security/rateLimiter';
import {
  sendSuccess,
  sendMethodNotAllowed,
  sendError,
  ERROR_CODES,
} from '@/lib/api/response';

// Readiness check - verify critical dependencies
async function readinessHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return apiResponse.methodNotAllowed(res, ['GET', 'HEAD']);
  }

  const checks: Record<string, boolean> = {};
  const errors: Record<string, string> = {};

  // Check database connection
  try {
    // Use Prisma's safe query method to verify database connectivity
    const result = await prisma.user.count({
      take: 1,
    });
    checks.database = true;
  } catch (error) {
    checks.database = false;
    errors.database = error instanceof Error ? error.message : 'Database connection failed';
  }

  // Check configuration
  try {
    const config = getConfig();
    checks.configuration = !!(config.database.url && config.auth.secret && config.stripe.secretKey);

    if (!checks.configuration) {
      errors.configuration = 'Missing required configuration';
    }
  } catch (error) {
    checks.configuration = false;
    errors.configuration = error instanceof Error ? error.message : 'Configuration load failed';
  }

  // Check environment
  checks.environment = !!(
    process.env.NODE_ENV &&
    process.env.DATABASE_URL &&
    process.env.NEXTAUTH_SECRET
  );

  if (!checks.environment) {
    errors.environment = 'Missing required environment variables';
  }

  // Determine if ready
  const ready = Object.values(checks).every((check) => check);
  const statusCode = ready ? 200 : 503;

  if (ready) {
    return apiResponse.success(
      res,
      {
        ready,
        checks,
      },
      {
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
    );
  } else {
    return sendError(res, ERROR_CODES.SERVICE_UNAVAILABLE, 'Service not ready', {
      statusCode: 503,
      details: {
        checks,
        errors,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// Export with rate limiting for public health check endpoint
export default withPublicRateLimit(readinessHandler, {
  window: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many health check requests. Please try again later.',
});
