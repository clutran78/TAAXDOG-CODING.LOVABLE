// External libraries
import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthEvent, GoalStatus, GoalCategory, Priority } from '@prisma/client';

// Database
import prisma from '../../../lib/prisma';

// Middleware
import { 
  authMiddleware, 
  AuthenticatedRequest,
  buildUserScopedFilters,
  validateResourceOwnership,
} from '../../../lib/middleware/auth';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';

// Security
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { withCSRFProtection } from '../../../lib/auth/csrf-protection';
import { sessionManager } from '../../../lib/auth/session-manager';

// Validation
import { goalSchemas } from '../../../lib/validation/api-schemas';

// Utils
import { logger } from '../../../lib/utils/logger';
import { apiResponse } from '@/lib/api/response';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { getCacheManager, CacheTTL } from '../../../lib/services/cache/cacheManager';

// Error handling
import {
  withErrorHandler,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  BadRequestError,
} from '../../../lib/errors/api-error-handler';

/**
 * Main handler for goals API endpoint with authentication and validation
 *
 * @param {AuthenticatedRequest} req - Authenticated request object with userId
 * @param {NextApiResponse} res - Next.js API response object
 * @returns {Promise<void>}
 *
 * @example
 * // GET /api/goals - List all user goals
 * // GET /api/goals?status=ACTIVE - List active goals
 * // GET /api/goals?category=SAVINGS - List savings goals
 * // POST /api/goals - Create a new goal
 *
 * @note Handles GET (list) and POST (create) methods
 * @note Update and delete operations are handled by /api/goals/[id]
 * @note Requires authentication via JWT token
 * @note All responses include security headers
 *
 * @throws {AuthenticationError} If userId is not found in request
 * @throws {ValidationError} If HTTP method is not allowed
 */
async function goalsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers to all responses
  addSecurityHeaders(res);

  const requestId = (req as any).requestId || crypto.randomUUID();
  const userId = req.userId;
  const userEmail = req.userEmail;
  const clientIp = getClientIP(req);
  const sessionId = req.session?.id;

  // Validate userId exists
  if (!userId) {
    logger.error('Missing user ID in authenticated request', { requestId });
    throw new AuthenticationError('User authentication failed');
  }

  // Update session activity
  if (sessionId) {
    await sessionManager.updateSessionActivity(sessionId, req);
  }

  logger.info('Goals API access', {
    userId,
    userEmail,
    method: req.method,
    clientIp,
    requestId,
    sessionId,
  });

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetGoals(userId, req.query, res, req, requestId);

      case 'POST':
        return await handleCreateGoal(userId, req.body, res, req, requestId);

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        throw new ValidationError(`Method ${req.method} is not allowed`);
    }
  } catch (error) {
    logger.error('Goals API error', {
      error,
      userId,
      method: req.method,
      requestId,
    });

    // Log error for monitoring
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.API_ERROR,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: {
          endpoint: '/api/goals',
          method: req.method,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId,
        },
      },
    }).catch(err => logger.error('Audit log error', { err }));

    throw error;
  }
}

/**
 * Retrieves all goals for the authenticated user with optional filtering
 *
 * @param {string} userId - The authenticated user's ID
 * @param {any} query - Query parameters for filtering (validated by middleware)
 * @param {any} query.status - Optional goal status filter ('ACTIVE', 'COMPLETED', 'ARCHIVED')
 * @param {any} query.category - Optional goal category filter
 * @param {NextApiResponse} res - Next.js API response object
 * @param {string} [requestId] - Request ID for tracking and debugging
 * @returns {Promise<void>}
 *
 * @example
 * // Returns all active goals
 * await handleGetGoals(userId, { status: 'ACTIVE' }, res);
 *
 * // Response format:
 * {
 *   success: true,
 *   data: {
 *     goals: [{
 *       id: '123',
 *       name: 'Save for vacation',
 *       targetAmount: 5000,
 *       currentAmount: 2500,
 *       progressPercentage: 50,
 *       daysRemaining: 45,
 *       isOverdue: false,
 *       ...
 *     }]
 *   }
 * }
 *
 * @note Excludes soft-deleted goals (deletedAt !== null)
 * @note Calculates progress percentage and days remaining for each goal
 * @note Orders by priority (desc), deadline (asc), then creation date (desc)
 */
async function handleGetGoals(
  userId: string,
  query: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId: string,
) {
  const startTime = Date.now();
  const cacheManager = await getCacheManager();

  try {
    // Query is already validated by middleware
    const { 
      status, 
      category, 
      page = 1, 
      limit = 20, 
      sortBy = 'priority', 
      sortOrder = 'desc',
      search,
      includeArchived = false,
    } = query;

    // Build cache key
    const cacheKey = `goals:${userId}:${JSON.stringify(query)}`;
    
    // Try to get from cache first
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached goals', { userId, requestId });
      return apiResponse.success(res, cached);
    }

    // Build query filters with proper typing
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (status) {
      where.status = status as GoalStatus;
    }
    if (category) {
      where.category = category as GoalCategory;
    }
    if (!includeArchived) {
      where.status = { not: GoalStatus.ARCHIVED };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    const take = Math.min(Number(limit), 100); // Cap at 100

    // Use transaction for consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get total count
      const total = await tx.goal.count({ where });

      // Get goals with optimized query
      const goals = await tx.goal.findMany({
        where,
        orderBy: [
          sortBy === 'priority' ? { priority: sortOrder as any } : {},
          sortBy === 'deadline' ? { deadline: sortOrder as any } : {},
          sortBy === 'created' ? { createdAt: sortOrder as any } : {},
          sortBy === 'progress' ? { currentAmount: sortOrder as any } : {},
          { createdAt: 'desc' }, // Secondary sort
        ],
        skip,
        take,
        select: {
          id: true,
          name: true,
          description: true,
          targetAmount: true,
          currentAmount: true,
          deadline: true,
          category: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          // Include related data
          _count: {
            select: {
              contributions: true,
            },
          },
        },
      });

      return { goals, total };
    });

    // Calculate progress and analytics for each goal
    const goalsWithProgress = result.goals.map((goal) => {
      const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

      const now = new Date();
      const deadline = goal.deadline ? new Date(goal.deadline) : null;
      const daysRemaining = deadline
        ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      // Calculate required monthly savings
      const monthsRemaining = daysRemaining ? daysRemaining / 30 : null;
      const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
      const requiredMonthlySaving = monthsRemaining && monthsRemaining > 0
        ? remainingAmount / monthsRemaining
        : null;

      // Determine if goal is at risk
      const isAtRisk = deadline && progress < 50 && daysRemaining && daysRemaining < 90;

      return {
        id: goal.id,
        name: goal.name,
        description: goal.description,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        remainingAmount,
        deadline: goal.deadline,
        category: goal.category,
        status: goal.status,
        priority: goal.priority,
        progressPercentage: Math.min(100, Math.round(progress * 100) / 100),
        daysRemaining,
        monthsRemaining: monthsRemaining ? Math.round(monthsRemaining * 10) / 10 : null,
        requiredMonthlySaving,
        isOverdue: deadline ? deadline < now && goal.status === GoalStatus.ACTIVE : false,
        isAtRisk,
        contributionCount: (goal as any)._count?.contributions || 0,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
      };
    });

    // Build response with analytics
    const response = {
      goals: goalsWithProgress,
      pagination: {
        page: Number(page),
        limit: take,
        total: result.total,
        pages: Math.ceil(result.total / take),
        hasMore: skip + take < result.total,
      },
      summary: {
        totalGoals: result.total,
        activeGoals: goalsWithProgress.filter(g => g.status === GoalStatus.ACTIVE).length,
        completedGoals: goalsWithProgress.filter(g => g.status === GoalStatus.COMPLETED).length,
        totalTargetAmount: goalsWithProgress.reduce((sum, g) => sum + g.targetAmount, 0),
        totalCurrentAmount: goalsWithProgress.reduce((sum, g) => sum + g.currentAmount, 0),
        overallProgress: goalsWithProgress.length > 0
          ? goalsWithProgress.reduce((sum, g) => sum + g.progressPercentage, 0) / goalsWithProgress.length
          : 0,
      },
    };

    // Cache the response
    await cacheManager.set(cacheKey, response, CacheTTL.MINUTE * 5);

    logger.info('Goals retrieved successfully', {
      userId,
      count: result.goals.length,
      total: result.total,
      processingTime: Date.now() - startTime,
      requestId,
    });

    return apiResponse.success(res, response);
  } catch (error) {
    logger.error('Error retrieving goals', {
      error,
      userId,
      duration: Date.now() - startTime,
      requestId,
    });

    throw error;
  }
}

/**
 * Creates a new financial goal for the authenticated user
 *
 * @param {string} userId - The authenticated user's ID
 * @param {any} body - Request body with goal details (validated by middleware)
 * @param {string} body.name - Name of the goal (required)
 * @param {string} [body.description] - Optional description of the goal
 * @param {number} body.targetAmount - Target amount to save (required, must be positive)
 * @param {string} [body.deadline] - Optional deadline in ISO format
 * @param {string} [body.category] - Goal category (defaults to 'GENERAL')
 * @param {string} [body.priority] - Goal priority: 'HIGH', 'MEDIUM', 'LOW' (defaults to 'MEDIUM')
 * @param {NextApiResponse} res - Next.js API response object
 * @param {string} clientIp - Client IP address for audit logging
 * @param {string} [requestId] - Request ID for tracking and debugging
 * @returns {Promise<void>}
 *
 * @example
 * // Request body:
 * {
 *   name: "Emergency Fund",
 *   description: "Save 6 months of expenses",
 *   targetAmount: 15000,
 *   deadline: "2024-12-31",
 *   category: "SAVINGS",
 *   priority: "HIGH"
 * }
 *
 * // Response:
 * {
 *   success: true,
 *   data: {
 *     id: "goal-123",
 *     name: "Emergency Fund",
 *     targetAmount: 15000,
 *     currentAmount: 0,
 *     progressPercentage: 0,
 *     ...
 *   }
 * }
 *
 * @throws {ValidationError} If deadline is in the past
 * @note Creates audit log entry for compliance
 * @note New goals start with status 'ACTIVE' and currentAmount 0
 */
async function handleCreateGoal(
  userId: string,
  body: any,
  res: NextApiResponse,
  req: AuthenticatedRequest,
  requestId: string,
) {
  const startTime = Date.now();
  const clientIp = getClientIP(req);
  const cacheManager = await getCacheManager();

  try {
    // Body is already validated by middleware
    const { name, description, targetAmount, deadline, category, priority, initialAmount } = body;

    // Additional validation
    if (deadline) {
      const deadlineDate = new Date(deadline);
      const now = new Date();
      
      if (deadlineDate <= now) {
        throw new ValidationError('Deadline must be in the future');
      }
      
      // Warn if deadline is too far in the future (>10 years)
      const tenYearsFromNow = new Date();
      tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);
      if (deadlineDate > tenYearsFromNow) {
        logger.warn('Goal deadline is very far in the future', {
          userId,
          deadline: deadlineDate,
          requestId,
        });
      }
    }

    // Check user's goal limit
    const activeGoalCount = await prisma.goal.count({
      where: {
        userId,
        status: GoalStatus.ACTIVE,
        deletedAt: null,
      },
    });

    if (activeGoalCount >= 50) {
      throw new BadRequestError('Maximum number of active goals (50) reached. Archive or complete some goals first.');
    }

    // Use transaction for goal creation
    const goal = await prisma.$transaction(async (tx) => {
      // Create the goal
      const newGoal = await tx.goal.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          name: name.trim(),
          description: description?.trim() || null,
          targetAmount,
          currentAmount: initialAmount || 0,
          deadline: deadline ? new Date(deadline) : null,
          category: category || GoalCategory.GENERAL,
          priority: priority || Priority.MEDIUM,
          status: GoalStatus.ACTIVE,
        },
      });

      // Create initial contribution if provided
      if (initialAmount && initialAmount > 0) {
        await tx.goalContribution.create({
          data: {
            id: crypto.randomUUID(),
            goalId: newGoal.id,
            userId,
            amount: initialAmount,
            description: 'Initial contribution',
          },
        });
      }

      // Log goal creation in audit log
      await tx.auditLog.create({
        data: {
          event: AuthEvent.DATA_CREATE,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            resource: 'goal',
            goalId: newGoal.id,
            goalName: newGoal.name,
            targetAmount: newGoal.targetAmount,
            initialAmount: initialAmount || 0,
          },
        },
      });

      return newGoal;
    });

    // Clear goals cache for this user
    const cachePattern = `goals:${userId}:*`;
    await cacheManager.deletePattern(cachePattern);

    // Calculate initial progress
    const progressPercentage = goal.targetAmount > 0 
      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 10000) / 100)
      : 0;

    const daysRemaining = goal.deadline
      ? Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    logger.info('Goal created successfully', {
      userId,
      goalId: goal.id,
      targetAmount: goal.targetAmount,
      processingTime: Date.now() - startTime,
      requestId,
    });

    return apiResponse.created(res, {
      ...goal,
      progressPercentage,
      daysRemaining,
      remainingAmount: Math.max(0, goal.targetAmount - goal.currentAmount),
    }, `/api/goals/${goal.id}`);
  } catch (error) {
    logger.error('Error creating goal', {
      error,
      userId,
      duration: Date.now() - startTime,
      requestId,
    });

    // Log error in audit log
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.DATA_CREATE,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: {
          resource: 'goal',
          error: error instanceof Error ? error.message : 'Unknown error',
          requestData: { name: body.name, targetAmount: body.targetAmount },
        },
      },
    }).catch(err => logger.error('Audit log error', { err }));

    throw error;
  }
}

// Enhanced validation schemas
const enhancedGoalSchemas = {
  list: {
    query: z.object({
      status: z.enum(Object.values(GoalStatus) as [string, ...string[]]).optional(),
      category: z.enum(Object.values(GoalCategory) as [string, ...string[]]).optional(),
      page: z.string().regex(/^\d+$/).transform(Number).default('1'),
      limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
      sortBy: z.enum(['priority', 'deadline', 'created', 'progress']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
      search: z.string().max(100).optional(),
      includeArchived: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    }),
  },
  create: {
    body: z.object({
      name: z.string().min(1).max(100).trim(),
      description: z.string().max(500).optional(),
      targetAmount: z.number().positive().max(1000000000), // Max 1 billion
      deadline: z.string().datetime().optional(),
      category: z.enum(Object.values(GoalCategory) as [string, ...string[]]).optional(),
      priority: z.enum(Object.values(Priority) as [string, ...string[]]).optional(),
      initialAmount: z.number().min(0).optional(),
    }),
  },
};

// Export with comprehensive middleware stack
export default composeMiddleware(
  validateMethod(['GET', 'POST']),
  withValidation({
    query: (req: NextApiRequest) => {
      if (req.method === 'GET') return enhancedGoalSchemas.list.query;
      return z.object({});
    },
    body: (req: NextApiRequest) => {
      if (req.method === 'POST') return enhancedGoalSchemas.create.body;
      return z.object({});
    },
  }),
  authMiddleware.authenticated,
  withCSRFProtection,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  }),
)(withErrorHandler(goalsHandler));
