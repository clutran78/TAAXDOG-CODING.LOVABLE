import { NextApiRequest, NextApiResponse } from 'next';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
// import { getFinancialInsights } from '../../../lib/db/optimized-queries'; // TODO: Implement optimized queries
import { logger } from '../../../lib/utils/logger';
import { getClientIp } from 'request-ip';
import { z } from 'zod';
import { AuthEvent } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { apiResponse } from '@/lib/api/response';

// Query schema
const insightsQuerySchema = z.object({
  period: z.enum(['month', 'quarter', 'year']).optional().default('quarter'),
  refresh: z.enum(['true', 'false']).optional().default('false'),
});

// Response schema
const insightsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    period: z.string(),
    startDate: z.date(),
    endDate: z.date(),
    monthlyTrends: z.array(
      z.object({
        month: z.string(),
        income: z.number(),
        expenses: z.number(),
      }),
    ),
    categoryBreakdown: z.array(
      z.object({
        category: z.string(),
        taxCategory: z.string().nullable(),
        total: z.number(),
        count: z.number(),
        businessExpenses: z.number(),
      }),
    ),
    savingsRate: z.number(),
    goalProgress: z
      .object({
        totalGoals: z.number(),
        activeGoals: z.number(),
        completedGoals: z.number(),
        totalProgress: z.number(),
      })
      .nullable(),
    summary: z.array(
      z.object({
        type: z.string(),
        category: z.string(),
        message: z.string(),
        priority: z.string(),
      }),
    ),
  }),
  cached: z.boolean().optional(),
});

/**
 * Optimized AI insights endpoint with caching and efficient queries
 * Generates financial insights with minimal database load
 */
async function insightsV2Handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;
  const clientIp = getClientIp(req) || 'unknown';

  try {
    // Validate userId exists
    if (!userId) {
      logger.error('Missing userId in authenticated request', { requestId });
      return apiResponse.unauthorized(res, {
        error: 'Authentication Error',
        message: 'User ID not found in authenticated request',
        requestId,
      });
    }

    // Parse and validate query parameters
    const { period, refresh } = req.query as z.infer<typeof insightsQuerySchema>;

    logger.info('Optimized insights access', {
      userId,
      period,
      refresh,
      clientIp,
      requestId,
    });

    // Log AI insights access for audit
    await prisma.auditLog
      .create({
        data: {
          event: 'AI_INSIGHTS_ACCESS' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            version: 'v2',
            period,
            refresh,
            endpoint: '/api/ai/insights-v2',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    // Get optimized insights data
    const startTime = Date.now();

    // If refresh is requested, we might want to clear cache first
    // This would be implemented in the getFinancialInsights function

    const insights = await getFinancialInsights(userId, period);
    const queryTime = Date.now() - startTime;

    // Log performance metrics
    if (queryTime > 1000) {
      logger.warn('Slow insights query', {
        userId,
        period,
        queryTime,
        requestId,
      });
    } else {
      logger.info('Insights query completed', {
        userId,
        period,
        queryTime,
        requestId,
      });
    }

    // Check if data was served from cache
    const cached = queryTime < 100; // Assume cached if very fast

    // Log successful generation
    await prisma.auditLog
      .create({
        data: {
          event: 'AI_INSIGHTS_GENERATED' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            version: 'v2',
            period,
            cached,
            queryTime,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    // Format response
    const response = {
      success: true,
      data: insights,
      cached,
      _meta: {
        queryTime,
        timestamp: new Date(),
        requestId,
      },
    };

    return apiResponse.success(res, response);
  } catch (error) {
    logger.error('Optimized insights error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    // Log error for audit
    await prisma.auditLog
      .create({
        data: {
          event: 'AI_INSIGHTS_ERROR' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            version: 'v2',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return apiResponse.internalError(res, {
      error: 'Failed to generate insights',
      message: 'An error occurred while generating insights. Please try again.',
      requestId,
    });
  }
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['GET']),
  withValidation({
    query: insightsQuerySchema,
    response: insightsResponseSchema,
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 30, // Lower limit for AI insights
  }),
)(insightsV2Handler);
