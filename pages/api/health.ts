import { NextApiRequest, NextApiResponse } from 'next';
import { addSecurityHeaders } from '../../lib/security/sanitizer';
import { getHealthMetrics } from '../../lib/monitoring/api';
import { logger } from '../../lib/utils/logger';
import { withValidation, validateMethod, composeMiddleware } from '../../lib/middleware/validation';
import { z } from 'zod';

// Response schema
const healthResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    timestamp: z.date(),
    metrics: z
      .object({
        totalRequests: z.number(),
        totalFailures: z.number(),
        overallErrorRate: z.number(),
        averageResponseTime: z.number(),
        activeEndpoints: z.number(),
      })
      .nullable(),
    issues: z.array(z.string()),
    database: z.object({
      connected: z.boolean(),
    }),
  }),
});

/**
 * Health check endpoint
 * Provides system health status without authentication
 * Used for monitoring and alerting
 */
async function healthHandler(req: NextApiRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  try {
    // Get health metrics
    const health = await getHealthMetrics();

    // Set appropriate status code based on health
    let statusCode = 200;
    if (health.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    } else if (health.status === 'degraded') {
      statusCode = 200; // Still return 200 for degraded to avoid false alarms
    }

    // Log health check (only if unhealthy)
    if (health.status === 'unhealthy') {
      logger.error('Health check failed', {
        status: health.status,
        issues: health.issues,
      });
    }

    return res.status(statusCode).json({
      success: health.status !== 'unhealthy',
      data: health,
    });
  } catch (error) {
    logger.error('Health check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return unhealthy status on error
    return res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date(),
        metrics: null,
        issues: ['Health check failed'],
        database: {
          connected: false,
        },
      },
    });
  }
}

// Export with validation only (no auth required for health checks)
export default composeMiddleware(
  validateMethod(['GET']),
  withValidation({
    response: healthResponseSchema,
  }),
)(healthHandler);
