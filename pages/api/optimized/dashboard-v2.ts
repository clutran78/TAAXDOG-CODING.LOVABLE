import { NextApiRequest, NextApiResponse } from 'next';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
// import { getOptimizedDashboardData } from '../../../lib/db/optimized-queries'; // TODO: Implement optimized queries
import { logger } from '../../../lib/utils/logger';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';

// Response schema for validation
const dashboardResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    user: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string().nullable(),
      createdAt: z.date(),
      role: z.string(),
      _count: z.object({
        transactions: z.number(),
        goals: z.number(),
        budgets: z.number(),
        bankAccounts: z.number(),
      }),
    }),
    transactions: z.array(
      z.object({
        id: z.string(),
        amount: z.number(),
        description: z.string(),
        date: z.date(),
        category: z.string().nullable(),
        type: z.string(),
        bankAccountId: z.string(),
      }),
    ),
    goals: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        targetAmount: z.number(),
        currentAmount: z.number(),
        deadline: z.date().nullable(),
        category: z.string().nullable(),
        progressPercentage: z.number(),
        daysRemaining: z.number().nullable(),
      }),
    ),
    categorySpending: z.array(
      z.object({
        category: z.string(),
        total: z.number(),
        count: z.number(),
      }),
    ),
    totalBalance: z.number(),
    insights: z.array(
      z.object({
        type: z.string(),
        message: z.string(),
      }),
    ),
  }),
  cached: z.boolean().optional(),
});

/**
 * Optimized dashboard endpoint with caching and efficient queries
 * Returns user dashboard data with minimal database hits
 */
async function dashboardV2Handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const userId = req.userId!;

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

    logger.info('Optimized dashboard access', {
      userId,
      requestId,
    });

    // Get optimized dashboard data
    const startTime = Date.now();
    const dashboardData = await getOptimizedDashboardData(userId);
    const queryTime = Date.now() - startTime;

    // Log performance metrics
    if (queryTime > 500) {
      logger.warn('Slow dashboard query', {
        userId,
        queryTime,
        requestId,
      });
    } else {
      logger.info('Dashboard query completed', {
        userId,
        queryTime,
        requestId,
      });
    }

    // Check if data was served from cache
    const cached = queryTime < 50; // Assume cached if very fast

    // Format response
    const response = {
      success: true,
      data: dashboardData,
      cached,
      _meta: {
        queryTime,
        timestamp: new Date(),
        requestId,
      },
    };

    return apiResponse.success(res, response);
  } catch (error) {
    logger.error('Optimized dashboard error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to load dashboard',
      message: 'An error occurred while loading your dashboard. Please try again.',
      requestId,
    });
  }
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['GET']),
  withValidation({
    response: dashboardResponseSchema,
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 120, // Higher limit for dashboard
  }),
)(dashboardV2Handler);
