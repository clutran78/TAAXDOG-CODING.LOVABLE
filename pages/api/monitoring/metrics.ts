import { NextApiRequest, NextApiResponse } from 'next';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { logger } from '../../../lib/utils/logger';
import {
  getCurrentMetrics,
  getEndpointMetrics,
  resetEndpointMetrics,
  resetAllMetrics,
} from '../../../lib/monitoring/api';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';

// Validation schemas
const metricsQuerySchema = z.object({
  endpoint: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ALL']).optional(),
  action: z.enum(['view', 'reset']).optional().default('view'),
});

/**
 * API Metrics endpoint
 * Provides access to API monitoring metrics
 * Restricted to ADMIN role users only
 */
async function metricsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;
  const userRole = req.userRole;

  // Only admin can view metrics
  if (userRole !== 'ADMIN') {
    logger.warn('Non-admin attempt to access metrics', {
      userId,
      userRole,
      requestId,
    });

    return apiResponse.forbidden(res, {
      error: 'Forbidden',
      message: 'Admin access required to view metrics',
      requestId,
    });
  }

  try {
    if (req.method === 'GET') {
      const { endpoint, method, action } = req.query as z.infer<typeof metricsQuerySchema>;

      if (action === 'reset') {
        // Reset metrics
        if (endpoint) {
          resetEndpointMetrics(endpoint, method);
          logger.info('Endpoint metrics reset', {
            userId,
            endpoint,
            method,
            requestId,
          });

          return apiResponse.success(res, {
            success: true,
            message: `Metrics reset for ${method || 'all methods'} ${endpoint}`,
          });
        } else {
          resetAllMetrics();
          logger.info('All metrics reset', {
            userId,
            requestId,
          });

          return apiResponse.success(res, {
            success: true,
            message: 'All metrics have been reset',
          });
        }
      }

      // View metrics
      if (endpoint) {
        const metrics = getEndpointMetrics(endpoint, method);

        if (!metrics) {
          return apiResponse.notFound(res, {
            error: 'Not found',
            message: `No metrics found for ${method || 'any method'} ${endpoint}`,
            requestId,
          });
        }

        // Calculate additional stats
        const avgDuration =
          metrics.totalRequests > 0 ? metrics.totalDuration / metrics.totalRequests : 0;
        const errorRate =
          metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0;

        return apiResponse.success(res, {
          success: true,
          data: {
            ...metrics,
            averageDuration: Math.round(avgDuration),
            errorRate: Math.round(errorRate * 1000) / 10, // percentage with 1 decimal
            successRate: Math.round((1 - errorRate) * 1000) / 10,
          },
        });
      }

      // Get all metrics
      const allMetrics = getCurrentMetrics();

      // Transform metrics for response
      const transformedMetrics = Object.entries(allMetrics).map(([key, metrics]) => {
        const avgDuration =
          metrics.totalRequests > 0 ? metrics.totalDuration / metrics.totalRequests : 0;
        const errorRate =
          metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0;

        return {
          key,
          endpoint: metrics.endpoint,
          method: metrics.method,
          totalRequests: metrics.totalRequests,
          successfulRequests: metrics.successfulRequests,
          failedRequests: metrics.failedRequests,
          averageDuration: Math.round(avgDuration),
          minDuration: Math.round(metrics.minDuration),
          maxDuration: Math.round(metrics.maxDuration),
          errorRate: Math.round(errorRate * 1000) / 10,
          successRate: Math.round((1 - errorRate) * 1000) / 10,
          recentErrors: metrics.errors.slice(0, 10),
          statusCodeDistribution: metrics.statusCodes,
        };
      });

      // Sort by total requests (most used endpoints first)
      transformedMetrics.sort((a, b) => b.totalRequests - a.totalRequests);

      // Calculate summary stats
      const totalRequests = transformedMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
      const totalFailures = transformedMetrics.reduce((sum, m) => sum + m.failedRequests, 0);
      const overallErrorRate = totalRequests > 0 ? totalFailures / totalRequests : 0;

      return apiResponse.success(res, {
        success: true,
        data: {
          summary: {
            totalEndpoints: transformedMetrics.length,
            totalRequests,
            totalFailures,
            overallErrorRate: Math.round(overallErrorRate * 1000) / 10,
            timestamp: new Date(),
          },
          endpoints: transformedMetrics,
        },
      });
    }

    return apiResponse.methodNotAllowed(res, {
      error: 'Method not allowed',
      message: `Method ${req.method} is not allowed`,
      requestId,
    });
  } catch (error) {
    logger.error('Metrics API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'Unable to retrieve metrics',
      requestId,
    });
  }
}

// Export with validation, authentication and rate limiting
export default composeMiddleware(
  validateMethod(['GET']),
  withValidation({
    query: metricsQuerySchema,
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  }),
)(metricsHandler);
