import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { createBudget } from '../../../lib/ai-budget-prediction';
import { logger } from '@/lib/logger';
import {
  authMiddleware,
  AuthenticatedRequest,
  buildUserScopedFilters,
} from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { sanitizers, addSecurityHeaders, sanitizedSchemas } from '../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { z } from 'zod';
import { apiResponse } from '@/lib/api/response';

// Validation schemas
const CreateBudgetSchema = z.object({
  name: sanitizedSchemas.plainText
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  monthlyBudget: z
    .number()
    .positive('Monthly budget must be positive')
    .max(1000000, 'Monthly budget cannot exceed $1,000,000'),
  targetSavings: z
    .number()
    .min(0, 'Target savings cannot be negative')
    .max(1000000, 'Target savings cannot exceed $1,000,000')
    .optional(),
  monthlyIncome: z
    .number()
    .positive('Monthly income must be positive')
    .max(1000000, 'Monthly income cannot exceed $1,000,000')
    .optional(),
  categoryLimits: z.record(z.string(), z.number().positive()).optional(),
});

/**
 * Budgets API endpoint
 * Handles GET (list), POST (create) operations
 * Uses authentication middleware to ensure data isolation
 */
async function budgetsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  try {
    const userId = req.userId;
    const clientIp = getClientIp(req) || 'unknown';

    // Validate userId exists
    if (!userId) {
      return apiResponse.unauthorized(res, {
        error: 'Authentication Error',
        message: 'User ID not found in authenticated request',
      });
    }

    // Log budget access for audit
    await prisma.auditLog
      .create({
        data: {
          event: 'BUDGET_ACCESS',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            method: req.method,
            endpoint: '/api/budgets',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err););

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, userId);
      case 'POST':
        return handlePost(req, res, userId);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('Budgets API error:', error);
    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An error occurred while processing your request',
    });
  }
}

async function handleGet(req: AuthenticatedRequest, res: NextApiResponse, userId: string) {
  try {
    const { status, includeTracking } = req.query;

    // Build query filters with user scoping
    const baseFilters: any = {};
    if (status) {
      baseFilters.status = status;
    }

    const where = buildUserScopedFilters(req, baseFilters);

    // Additional security: ensure budgets belong to user
    const secureWhere = {
      ...where,
      userId: userId,
      deletedAt: null, // Exclude soft-deleted budgets
    };

    const budgets = await prisma.budget
      .findMany({
        where: secureWhere,
        include: {
          budgetTracking:
            includeTracking === 'true'
              ? {
                  orderBy: [{ year: 'desc' }, { month: 'desc' }],
                  take: 12, // Last 12 months
                }
              : false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          name: true,
          monthlyBudget: true,
          targetSavings: true,
          monthlyIncome: true,
          categoryLimits: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          userId: true, // Include for verification
          budgetTracking: includeTracking === 'true',
        },
      })
      .then((budgets) =>
        // Double-check: ensure all budgets belong to user
        budgets.filter((b) => b.userId === userId).map(({ userId: _, ...b }) => b),
      );

    // Calculate current month variance
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const budgetsWithVariance = budgets.map((budget) => {
      if (budget.budgetTracking) {
        const currentTracking = budget.budgetTracking.filter(
          (t) => t.month === currentMonth && t.year === currentYear,
        );

        const totalPredicted = currentTracking.reduce(
          (sum, t) => sum + parseFloat(t.predictedAmount.toString()),
          0,
        );
        const totalActual = currentTracking.reduce(
          (sum, t) => sum + parseFloat(t.actualAmount?.toString() || '0'),
          0,
        );

        return {
          ...budget,
          currentMonthVariance: totalActual - totalPredicted,
          currentMonthVariancePercent:
            totalPredicted > 0 ? ((totalActual - totalPredicted) / totalPredicted) * 100 : 0,
        };
      }
      return budget;
    });

    // Set security headers
    res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return apiResponse.success(res, {
      success: true,
      budgets: budgetsWithVariance,
      count: budgetsWithVariance.length,
      _security: {
        dataScope: 'user-only',
        filteredBy: userId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get budgets error:', error, { userId });
    return apiResponse.internalError(res, {
      error: 'Failed to fetch budgets',
      message: 'Unable to retrieve your budgets. Please try again.',
    });
  }
}

async function handlePost(req: AuthenticatedRequest, res: NextApiResponse, userId: string) {
  const clientIp = getClientIp(req) || 'unknown';

  try {
    // Validate and sanitize input data
    const validationResult = CreateBudgetSchema.safeParse(req.body);
    if (!validationResult.success) {
      return apiResponse.error(res, {
        error: 'Validation error',
        message: 'Invalid input data',
        errors: validationResult.error.flatten(),
      });
    }

    const validatedData = validationResult.data;

    // Check for existing active budget with user isolation
    const existingBudget = await prisma.budget.findFirst({
      where: {
        userId: userId, // Strict user filtering
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (existingBudget) {
      // Verify ownership before deactivating
      if (existingBudget.userId !== userId) {
        console.error('Security violation: Budget ownership mismatch', {
          expected: userId,
          received: existingBudget.userId,
        });
        throw new Error('Security violation: Ownership mismatch');
      }

      // Soft deactivate existing budget
      await prisma.budget.update({
        where: {
          id: existingBudget.id,
          userId: userId, // Double-check ownership
        },
        data: {
          status: 'INACTIVE',
          updatedAt: new Date(),
        },
      });
    }

    // Create new budget with AI predictions
    const budget = await createBudget(userId, {
      name: validatedData.name, // Already sanitized
      monthlyBudget: validatedData.monthlyBudget,
      targetSavings: validatedData.targetSavings,
      monthlyIncome: validatedData.monthlyIncome,
      categoryLimits: validatedData.categoryLimits,
    });

    // Log successful creation
    await prisma.auditLog
      .create({
        data: {
          event: 'BUDGET_CREATED',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            budgetId: budget.id,
            budgetName: budget.name,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err););

    // Set security headers
    res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return apiResponse.created(res, {
      success: true,
      data: budget,
      message: 'Budget created with AI predictions',
      _security: {
        dataScope: 'user-only',
        createdBy: userId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Create budget error:', error, { userId });

    // Log error
    await prisma.auditLog
      .create({
        data: {
          event: 'BUDGET_CREATE_ERROR',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err););

    return apiResponse.internalError(res, {
      error: 'Failed to create budget',
      message: 'Unable to create your budget. Please try again.',
    });
  }
}

// Export with authentication and rate limiting middleware
export default withSessionRateLimit(authMiddleware.authenticated(budgetsHandler), {
  window: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
});
