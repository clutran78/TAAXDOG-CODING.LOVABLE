import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../../../lib/middleware/auth';
import { withSessionRateLimit } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders, sanitizedSchemas } from '../../../lib/security/sanitizer';
import { getClientIp } from 'request-ip';
import { z } from 'zod';
import { hashPassword } from '../../../lib/auth/auth-utils';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Query validation schema for GET requests
const UserQuerySchema = z.object({
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, 'Page must be a positive number')
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, 'Limit must be between 1 and 100')
    .optional(),
  search: z.string().optional(),
  role: z.enum(['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT']).optional(),
  status: z.enum(['active', 'suspended', 'unverified']).optional(),
  sortBy: z.enum(['createdAt', 'lastLogin', 'name', 'email']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Validation schema for user updates
const UserUpdateSchema = z.object({
  name: sanitizedSchemas.displayName.optional(),
  email: sanitizedSchemas.email.optional(),
  role: z.enum(['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT']).optional(),
  suspended: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  passwordResetRequired: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional(),
});

// Validation schema for user creation
const UserCreateSchema = z.object({
  name: sanitizedSchemas.displayName,
  email: sanitizedSchemas.email,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT']).default('USER'),
  sendWelcomeEmail: z.boolean().default(true),
});

/**
 * Admin User Management API endpoint
 * Handles GET (list), POST (create), PATCH (update), DELETE operations
 * Requires ADMIN or SUPPORT role
 */
async function adminUsersHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const userId = req.userId;
  const userRole = req.userRole;
  const clientIp = getClientIp(req) || 'unknown';

  try {
    // Log admin access
    await prisma.auditLog
      .create({
        data: {
          event: 'ADMIN_USER_MANAGEMENT_ACCESS',
          userId,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            method: req.method,
            adminRole: userRole,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, userId);
      case 'POST':
        return handlePost(req, res, userId, userRole);
      case 'PATCH':
        return handlePatch(req, res, userId, userRole);
      case 'DELETE':
        return handleDelete(req, res, userId, userRole);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
        return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
    }
  } catch (error) {
    logger.error('Admin users API error:', error);
    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An error occurred while processing your request',
    });
  }
}

async function handleGet(req: AuthenticatedRequest, res: NextApiResponse, adminId: string) {
  try {
    // Validate query parameters
    const validationResult = UserQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return apiResponse.error(res, {
        error: 'Validation error',
        message: 'Invalid query parameters',
        errors: validationResult.error.flatten(),
      });
    }

    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validationResult.data;

    // Build query filters
    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      switch (status) {
        case 'active':
          where.suspended = false;
          where.emailVerified = { not: null };
          break;
        case 'suspended':
          where.suspended = true;
          break;
        case 'unverified':
          where.emailVerified = null;
          break;
      }
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          suspended: true,
          twoFactorEnabled: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              goals: { where: { deletedAt: null } },
              transactions: { where: { deletedAt: null } },
              receipts: { where: { deletedAt: null } },
              bankAccounts: { where: { deletedAt: null } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Get activity metrics for users
    const userIds = users.map((u) => u.id);
    const activityMetrics = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
      _count: true,
    });

    const activityMap = activityMetrics.reduce(
      (acc, item) => {
        acc[item.userId] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Enhance user data with activity metrics
    const enhancedUsers = users.map((user) => ({
      ...user,
      activityCount: activityMap[user.id] || 0,
      status: user.suspended ? 'suspended' : user.emailVerified ? 'active' : 'unverified',
    }));

    // Log successful retrieval
    await prisma.auditLog
      .create({
        data: {
          event: 'ADMIN_USERS_RETRIEVED',
          userId: adminId,
          ipAddress: getClientIp(req) || 'unknown',
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            count: users.length,
            filters: { search, role, status },
            timestamp: new Date().toISOString(),
          },
        },
      })
      .catch((err) => logger.error('Audit log error:', err));

    return apiResponse.success(res, {
      success: true,
      data: {
        users: enhancedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: skip + users.length < total,
        },
      },
    });
  } catch (error) {
    logger.error('Get users error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to fetch users',
      message: 'Unable to retrieve user list. Please try again.',
    });
  }
}

async function handlePost(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  adminId: string,
  adminRole: string,
) {
  try {
    // Only ADMIN role can create users
    if (adminRole !== 'ADMIN') {
      return apiResponse.forbidden(res, {
        error: 'Forbidden',
        message: 'Only administrators can create users',
      });
    }

    // Validate input
    const validationResult = UserCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return apiResponse.error(res, {
        error: 'Validation error',
        message: 'Invalid user data',
        errors: validationResult.error.flatten(),
      });
    }

    const { name, email, password, role, sendWelcomeEmail } = validationResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email already exists',
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        emailVerified: sendWelcomeEmail ? null : new Date(), // Auto-verify if not sending email
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Log user creation
    await prisma.auditLog.create({
      data: {
        event: 'ADMIN_USER_CREATED',
        userId: adminId,
        ipAddress: getClientIp(req) || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          createdUserId: newUser.id,
          createdUserEmail: newUser.email,
          createdUserRole: newUser.role,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // TODO: Send welcome email if requested
    if (sendWelcomeEmail) {
      // Email sending logic would go here
    }

    return apiResponse.created(res, {
      success: true,
      data: {
        user: newUser,
        message: sendWelcomeEmail
          ? 'User created successfully. Welcome email sent.'
          : 'User created successfully.',
      },
    });
  } catch (error) {
    logger.error('Create user error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to create user',
      message: 'Unable to create user. Please try again.',
    });
  }
}

async function handlePatch(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  adminId: string,
  adminRole: string,
) {
  try {
    const { userId: targetUserId } = req.query;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return apiResponse.error(res, {
        error: 'Invalid request',
        message: 'User ID is required',
      });
    }

    // Validate input
    const validationResult = UserUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return apiResponse.error(res, {
        error: 'Validation error',
        message: 'Invalid update data',
        errors: validationResult.error.flatten(),
      });
    }

    const updateData = validationResult.data;

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, role: true },
    });

    if (!targetUser) {
      return apiResponse.notFound(res, {
        error: 'User not found',
        message: 'The specified user does not exist',
      });
    }

    // Role-based permissions
    if (adminRole === 'SUPPORT') {
      // Support can only modify certain fields
      const allowedFields = ['suspended', 'passwordResetRequired', 'emailVerified'];
      const requestedFields = Object.keys(updateData);
      const disallowedFields = requestedFields.filter((f) => !allowedFields.includes(f));

      if (disallowedFields.length > 0) {
        return apiResponse.forbidden(res, {
          error: 'Forbidden',
          message: `Support role cannot modify: ${disallowedFields.join(', ')}`,
        });
      }
    }

    // Prevent self-demotion for admins
    if (targetUserId === adminId && updateData.role && updateData.role !== 'ADMIN') {
      return apiResponse.forbidden(res, {
        error: 'Forbidden',
        message: 'Cannot demote your own admin account',
      });
    }

    // Prevent modification of super admin (first admin)
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN', deletedAt: null },
    });

    if (
      adminCount === 1 &&
      targetUser.role === 'ADMIN' &&
      (updateData.role !== 'ADMIN' || updateData.suspended === true)
    ) {
      return apiResponse.forbidden(res, {
        error: 'Forbidden',
        message: 'Cannot demote or suspend the last admin',
      });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        suspended: true,
        twoFactorEnabled: true,
        updatedAt: true,
      },
    });

    // Log user update
    await prisma.auditLog.create({
      data: {
        event: 'ADMIN_USER_UPDATED',
        userId: adminId,
        ipAddress: getClientIp(req) || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          targetUserId,
          targetUserEmail: targetUser.email,
          changes: updateData,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        user: updatedUser,
        message: 'User updated successfully',
      },
    });
  } catch (error) {
    logger.error('Update user error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to update user',
      message: 'Unable to update user. Please try again.',
    });
  }
}

async function handleDelete(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  adminId: string,
  adminRole: string,
) {
  try {
    // Only ADMIN role can delete users
    if (adminRole !== 'ADMIN') {
      return apiResponse.forbidden(res, {
        error: 'Forbidden',
        message: 'Only administrators can delete users',
      });
    }

    const { userId: targetUserId } = req.query;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return apiResponse.error(res, {
        error: 'Invalid request',
        message: 'User ID is required',
      });
    }

    // Prevent self-deletion
    if (targetUserId === adminId) {
      return apiResponse.forbidden(res, {
        error: 'Forbidden',
        message: 'Cannot delete your own account',
      });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        role: true,
        _count: {
          select: {
            transactions: { where: { deletedAt: null } },
            goals: { where: { deletedAt: null } },
            receipts: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!targetUser) {
      return apiResponse.notFound(res, {
        error: 'User not found',
        message: 'The specified user does not exist',
      });
    }

    // Prevent deletion of last admin
    if (targetUser.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', deletedAt: null },
      });

      if (adminCount === 1) {
        return apiResponse.forbidden(res, {
          error: 'Forbidden',
          message: 'Cannot delete the last admin',
        });
      }
    }

    // Soft delete user and cascade to related data
    await prisma.$transaction(async (tx) => {
      // Soft delete user
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          deletedAt: new Date(),
          email: `deleted_${Date.now()}_${targetUser.email}`, // Prevent email conflicts
        },
      });

      // Soft delete related data
      await Promise.all([
        tx.transaction.updateMany({
          where: { userId: targetUserId, deletedAt: null },
          data: { deletedAt: new Date() },
        }),
        tx.goal.updateMany({
          where: { userId: targetUserId, deletedAt: null },
          data: { deletedAt: new Date() },
        }),
        tx.receipt.updateMany({
          where: { userId: targetUserId, deletedAt: null },
          data: { deletedAt: new Date() },
        }),
        tx.bankAccount.updateMany({
          where: { userId: targetUserId, deletedAt: null },
          data: { deletedAt: new Date() },
        }),
      ]);
    });

    // Log user deletion
    await prisma.auditLog.create({
      data: {
        event: 'ADMIN_USER_DELETED',
        userId: adminId,
        ipAddress: getClientIp(req) || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          deletedUserId: targetUserId,
          deletedUserEmail: targetUser.email,
          deletedUserRole: targetUser.role,
          dataDeleted: {
            transactions: targetUser._count.transactions,
            goals: targetUser._count.goals,
            receipts: targetUser._count.receipts,
          },
          timestamp: new Date().toISOString(),
        },
      },
    });

    return apiResponse.success(res, {
      success: true,
      data: {
        message: 'User and related data deleted successfully',
        deletedData: {
          userId: targetUserId,
          transactions: targetUser._count.transactions,
          goals: targetUser._count.goals,
          receipts: targetUser._count.receipts,
        },
      },
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to delete user',
      message: 'Unable to delete user. Please try again.',
    });
  }
}

// Export with authentication middleware requiring ADMIN or SUPPORT role
export default withSessionRateLimit(
  authMiddleware.authenticated(adminUsersHandler, {
    allowedRoles: ['ADMIN', 'SUPPORT'],
  }),
  {
    window: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  },
);
