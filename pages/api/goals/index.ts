// External libraries
import { NextApiRequest, NextApiResponse } from 'next';
import { AuthEvent } from '@prisma/client';

// Database
import { prisma } from '../../../lib/prisma';
import {
  findManyWithPagination,
  createSecure,
  handleDatabaseError,
  withTransaction,
  buildUserScopedWhere,
} from '../../../lib/db/query-patterns';

// Middleware
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';

// Security
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';

// Validation
import { goalSchemas } from '../../../lib/validation/api-schemas';

// Utils
import { logger } from '../../../lib/utils/logger';
import {
  sendSuccess,
  sendCreated,
  sendUnauthorized,
  sendValidationError,
  sendMethodNotAllowed,
  sendPaginatedSuccess,
  sendInternalError,
  ERROR_CODES,
} from '@/lib/api/response';

// Error handling
import {
  withErrorHandler,
  ValidationError,
  AuthenticationError,
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

  const requestId = (req as any).requestId;
  const userId = req.userId;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Validate userId exists
  if (!userId) {
    return apiResponse.unauthorized(res, 'User ID not found in authenticated request', {
      meta: { requestId },
    });
  }

  logger.info('Goals API access', {
    userId,
    method: req.method,
    clientIp,
    requestId,
  });

  switch (req.method) {
    case 'GET':
      return handleGetGoals(userId, req.query, res, requestId);

    case 'POST':
      return handleCreateGoal(userId, req.body, res, clientIp, requestId);

    default:
      return apiResponse.methodNotAllowed(res, ['GET', 'POST'], {
        meta: { requestId },
      });
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
  requestId?: string,
) {
  try {
    // Query is already validated by middleware
    const { status, category, page = 1, limit = 20 } = query;

    // Build query filters
    const baseFilters: any = {};
    if (status) baseFilters.status = status;
    if (category) baseFilters.category = category;

    // Use standardized query pattern with pagination
    const result = await findManyWithPagination(prisma.goal, {
      userId,
      where: baseFilters,
      page: Number(page),
      limit: Number(limit),
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
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
      },
    });

    const goals = result.data;

    // Calculate progress for each goal
    const goalsWithProgress = goals.map((goal) => {
      const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

      const daysRemaining = goal.deadline
        ? Math.max(
            0,
            Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          )
        : null;

      return {
        id: goal.id,
        name: goal.name,
        description: goal.description,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        deadline: goal.deadline,
        category: goal.category,
        status: goal.status,
        priority: goal.priority,
        progressPercentage: Math.min(100, Math.round(progress * 100) / 100),
        daysRemaining,
        isOverdue: goal.deadline ? new Date(goal.deadline) < new Date() : false,
        userId,
        createdAt: goal.createdAt,
      };
    });

    logger.info('Goals retrieved', {
      userId,
      count: goals.length,
      requestId,
    });

    return sendPaginatedSuccess(
      res,
      goalsWithProgress,
      {
        page: result.meta?.page || 1,
        limit: result.meta?.limit || 20,
        total: result.meta?.total || 0,
      },
      {
        meta: { requestId },
      },
    );
  } catch (error) {
    await handleDatabaseError(error, {
      operation: 'fetchGoals',
      userId,
      resource: 'Goal',
      requestId,
    });

    return apiResponse.internalError(res, error, {
      message: 'Failed to retrieve goals',
      meta: { requestId },
    });
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
  clientIp: string,
  requestId?: string,
) {
  try {
    // Body is already validated by middleware
    const { name, description, targetAmount, deadline, category, priority } = body;

    // Ensure deadline is in the future
    if (deadline && new Date(deadline) <= new Date()) {
      return apiResponse.validationError(
        res,
        [{ field: 'deadline', message: 'Deadline must be in the future' }],
        {
          meta: { requestId },
        },
      );
    }

    // Use transaction for goal creation and audit logging
    const goal = await withTransaction(async (tx) => {
      // Create the goal using standardized pattern
      const newGoal = await createSecure(
        tx.goal,
        {
          name,
          description: description || null,
          targetAmount,
          currentAmount: 0,
          deadline: deadline ? new Date(deadline) : null,
          category: category || 'GENERAL',
          priority: priority || 'MEDIUM',
          status: 'ACTIVE',
        },
        userId,
        {
          maxRecords: 50, // Limit to 50 active goals per user
          auditLog: true,
        },
      );

      // Log goal creation in audit log
      await tx.auditLog.create({
        data: {
          event: 'GOAL_CREATE' as AuthEvent,
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            goalId: newGoal.id,
            goalName: newGoal.name,
            targetAmount: newGoal.targetAmount,
          },
        },
      });

      return newGoal;
    });

    logger.info('Goal created', {
      userId,
      goalId: goal.id,
      requestId,
    });

    return apiResponse.created(
      res,
      {
        ...goal,
        currentAmount: 0,
        progressPercentage: 0,
      },
      {
        location: `/api/goals/${goal.id}`,
        meta: { requestId },
      },
    );
  } catch (error) {
    await handleDatabaseError(error, {
      operation: 'createGoal',
      userId,
      resource: 'Goal',
      requestId,
    });

    return apiResponse.internalError(res, error, {
      message: 'Failed to create goal',
      meta: { requestId },
    });
  }
}

// Export with validation, authentication, rate limiting and error handling middleware
export default composeMiddleware(
  validateMethod(['GET', 'POST']),
  withValidation({
    query: (req: NextApiRequest) => {
      if (req.method === 'GET') {
        return goalSchemas.list.query;
      }
      return undefined;
    },
    body: (req: NextApiRequest) => {
      if (req.method === 'POST') {
        return goalSchemas.create.body;
      }
      return undefined;
    },
    response: (req: NextApiRequest) => {
      if (req.method === 'GET') {
        return goalSchemas.list.response;
      }
      if (req.method === 'POST') {
        return goalSchemas.create.response;
      }
      return undefined;
    },
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  }),
)(withErrorHandler(goalsHandler));
