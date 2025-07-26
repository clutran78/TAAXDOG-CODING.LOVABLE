import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { goalSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '../../../lib/utils/logger';
import { AuthEvent } from '@prisma/client';
import { apiResponse } from '@/lib/api/response';

/**
 * Single goal API endpoint with comprehensive validation
 * Handles GET (retrieve), PATCH (update), DELETE (delete)
 */
async function goalDetailHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers to all responses
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;

  try {
    const userId = req.userId;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const { id } = req.query;

    // Validate userId exists
    if (!userId) {
      logger.error('Missing userId in authenticated request', { requestId });
      return apiResponse.unauthorized(res, {
        error: 'Authentication Error',
        message: 'User ID not found in authenticated request',
        requestId,
      });
    }

    // ID is already validated by middleware
    const goalId = id as string;

    logger.info('Goal detail API access', {
      userId,
      goalId,
      method: req.method,
      clientIp,
      requestId,
    });

    switch (req.method) {
      case 'GET':
        return handleGetGoal(userId, goalId, res, requestId);

      case 'PATCH':
        return handleUpdateGoal(userId, goalId, req.body, res, clientIp, requestId);

      case 'DELETE':
        return handleDeleteGoal(userId, goalId, res, clientIp, requestId);

      default:
        res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
        return apiResponse.methodNotAllowed(res, {
          error: 'Method not allowed',
          message: `Method ${req.method} is not allowed`,
          requestId,
        });
    }
  } catch (error) {
    logger.error('Goal detail API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.userId,
      goalId: req.query.id,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An error occurred while processing your request',
      requestId,
    });
  }
}

/**
 * Get a single goal by ID
 */
async function handleGetGoal(
  userId: string,
  goalId: string,
  res: NextApiResponse,
  requestId?: string,
) {
  try {
    const goal = await prisma.goal.findFirst({
      where: {
        id: goalId,
        userId,
        deletedAt: null,
      },
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
        completedAt: true,
      },
    });

    if (!goal) {
      logger.warn('Goal not found', {
        userId,
        goalId,
        requestId,
      });

      return apiResponse.notFound(res, {
        error: 'Not found',
        message: 'Goal not found',
        requestId,
      });
    }

    // Calculate progress
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

    const daysRemaining = goal.deadline
      ? Math.max(
          0,
          Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        )
      : null;

    logger.info('Goal retrieved', {
      userId,
      goalId,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        ...goal,
        progressPercentage: Math.min(100, Math.round(progress * 100) / 100),
        daysRemaining,
        isOverdue: goal.deadline ? new Date(goal.deadline) < new Date() : false,
      },
    });
  } catch (error) {
    logger.error('Error fetching goal', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      goalId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to fetch goal',
      message: 'Unable to retrieve your goal. Please try again.',
      requestId,
    });
  }
}

/**
 * Update a goal
 */
async function handleUpdateGoal(
  userId: string,
  goalId: string,
  body: any,
  res: NextApiResponse,
  clientIp: string,
  requestId?: string,
) {
  try {
    // Body is already validated by middleware
    const { name, description, targetAmount, currentAmount, deadline, status, priority } = body;

    // Verify goal exists and belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: {
        id: goalId,
        userId,
        deletedAt: null,
      },
    });

    if (!existingGoal) {
      logger.warn('Goal not found for update', {
        userId,
        goalId,
        requestId,
      });

      return apiResponse.notFound(res, {
        error: 'Not found',
        message: 'Goal not found',
        requestId,
      });
    }

    // Build update data
    const updateData: any = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(targetAmount !== undefined && { targetAmount }),
      ...(currentAmount !== undefined && { currentAmount }),
      ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      updatedAt: new Date(),
    };

    // Check if goal is being completed
    if (currentAmount !== undefined && targetAmount !== undefined) {
      if (currentAmount >= targetAmount) {
        updateData.status = 'COMPLETED';
        updateData.completedAt = new Date();
      }
    } else if (currentAmount !== undefined && currentAmount >= existingGoal.targetAmount) {
      updateData.status = 'COMPLETED';
      updateData.completedAt = new Date();
    }

    // Update the goal
    const updatedGoal = await prisma.goal.update({
      where: {
        id: goalId,
        userId, // Double-check ownership
      },
      data: updateData,
      select: {
        id: true,
        name: true,
        targetAmount: true,
        currentAmount: true,
        status: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    // Log goal update
    await prisma.auditLog.create({
      data: {
        event: 'GOAL_UPDATE' as AuthEvent,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          goalId,
          changes: updateData,
        },
      },
    });

    logger.info('Goal updated', {
      userId,
      goalId,
      updatedFields: Object.keys(updateData),
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      data: updatedGoal,
    });
  } catch (error) {
    logger.error('Error updating goal', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      goalId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to update goal',
      message: 'Unable to update your goal. Please try again.',
      requestId,
    });
  }
}

/**
 * Soft delete a goal
 */
async function handleDeleteGoal(
  userId: string,
  goalId: string,
  res: NextApiResponse,
  clientIp: string,
  requestId?: string,
) {
  try {
    // Verify goal exists and belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: {
        id: goalId,
        userId,
        deletedAt: null,
      },
    });

    if (!existingGoal) {
      logger.warn('Goal not found for deletion', {
        userId,
        goalId,
        requestId,
      });

      return apiResponse.notFound(res, {
        error: 'Not found',
        message: 'Goal not found',
        requestId,
      });
    }

    // Soft delete the goal
    await prisma.goal.update({
      where: {
        id: goalId,
        userId, // Double-check ownership
      },
      data: {
        deletedAt: new Date(),
        status: 'CANCELLED',
      },
    });

    // Log goal deletion
    await prisma.auditLog.create({
      data: {
        event: 'GOAL_DELETE' as AuthEvent,
        userId,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          goalId,
          goalName: existingGoal.name,
        },
      },
    });

    logger.info('Goal deleted', {
      userId,
      goalId,
      requestId,
    });

    return apiResponse.success(res, {
      success: true,
      message: 'Goal deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting goal', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      goalId,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Failed to delete goal',
      message: 'Unable to delete your goal. Please try again.',
      requestId,
    });
  }
}

// Export with validation, authentication and rate limiting middleware
export default composeMiddleware(
  validateMethod(['GET', 'PATCH', 'DELETE']),
  withValidation({
    params: goalSchemas.update.params,
    body: (req: NextApiRequest) => {
      if (req.method === 'PATCH') {
        return goalSchemas.update.body;
      }
      return undefined;
    },
    response: (req: NextApiRequest) => {
      if (req.method === 'GET') {
        return goalSchemas.list.response; // Similar structure for single goal
      }
      if (req.method === 'PATCH') {
        return goalSchemas.update.response;
      }
      return undefined;
    },
  }),
  authMiddleware.authenticated,
  withSessionRateLimit({
    window: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
  }),
)(goalDetailHandler);
