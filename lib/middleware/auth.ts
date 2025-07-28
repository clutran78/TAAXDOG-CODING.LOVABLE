import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import prisma from '../prisma';
import { getClientIp } from 'request-ip';
import { logger } from '@/lib/logger';

// Types
export interface AuthenticatedRequest extends NextApiRequest {
  userId: string;
  userEmail: string;
  userRole: string;
  session: any;
}

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  allowedRoles?: string[];
  checkOwnership?: boolean;
  logAccess?: boolean;
}

// Error responses
export const AuthErrors = {
  UNAUTHORIZED: {
    error: 'Unauthorized',
    message: 'Authentication required. Please log in to access this resource.',
    code: 'AUTH_REQUIRED',
  },
  FORBIDDEN: {
    error: 'Forbidden',
    message: 'You do not have permission to access this resource.',
    code: 'INSUFFICIENT_PERMISSIONS',
  },
  INVALID_SESSION: {
    error: 'Invalid Session',
    message: 'Your session has expired or is invalid. Please log in again.',
    code: 'SESSION_INVALID',
  },
  ROLE_REQUIRED: (role: string) => ({
    error: 'Insufficient Role',
    message: `This action requires ${role} role.`,
    code: 'ROLE_REQUIRED',
  }),
  OWNERSHIP_REQUIRED: {
    error: 'Access Denied',
    message: 'You can only access your own data.',
    code: 'OWNERSHIP_REQUIRED',
  },
};

// Main authentication middleware
export function withAuth(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>,
  options: AuthMiddlewareOptions = {},
) {
  const {
    requireAuth = true,
    allowedRoles = [],
    checkOwnership = true,
    logAccess = true,
  } = options;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Get session from NextAuth
      const session = await getServerSession(req, res, authOptions);

      // Check if authentication is required
      if (requireAuth && !session?.user?.id) {
        if (logAccess) {
          await logUnauthorizedAccess(req);
        }
        return res.status(401).json(AuthErrors.UNAUTHORIZED);
      }

      // If authenticated, verify session is still valid
      if (session?.user?.id) {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            email: true,
            role: true,
            emailVerified: true,
            lockedUntil: true,
          },
        });

        if (!user) {
          return res.status(401).json(AuthErrors.INVALID_SESSION);
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return res.status(403).json({
            error: 'Account Locked',
            message: 'Your account is temporarily locked due to suspicious activity.',
            lockedUntil: user.lockedUntil,
          });
        }

        // Check role permissions
        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
          if (logAccess) {
            await logForbiddenAccess(req, user.id, user.role);
          }
          return res.status(403).json(AuthErrors.ROLE_REQUIRED(allowedRoles.join(' or ')));
        }

        // Attach user info to request
        (req as AuthenticatedRequest).userId = user.id;
        (req as AuthenticatedRequest).userEmail = user.email;
        (req as AuthenticatedRequest).userRole = user.role;
        (req as AuthenticatedRequest).session = session;
      }

      // Call the actual handler
      return handler(req as AuthenticatedRequest, res);
    } catch (error) {
      logger.error('Authentication middleware error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred during authentication.',
      });
    }
  };
}

// Helper function to ensure user can only access their own data
export function ensureOwnership(
  userId: string,
  resourceOwnerId: string,
  userRole: string = 'USER',
): boolean {
  // Admins can access any resource
  if (userRole === 'ADMIN' || userRole === 'SUPPORT') {
    return true;
  }

  // Regular users can only access their own resources
  return userId === resourceOwnerId;
}

// Helper to create user-scoped Prisma queries
export function createUserScopedQuery(userId: string, userRole: string = 'USER') {
  // Admins can see all data
  if (userRole === 'ADMIN') {
    return {};
  }

  // Regular users can only see their own data
  return {
    where: {
      userId: userId,
    },
  };
}

// Helper to validate resource ownership before operations
export async function validateResourceOwnership<T extends { userId: string }>(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  resourceId: string,
  model: any,
  allowedRoles: string[] = ['ADMIN'],
): Promise<T | null> {
  try {
    const resource = await model.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Resource not found.',
      });
      return null;
    }

    // Check ownership
    if (
      !ensureOwnership(req.userId, resource.userId, req.userRole) &&
      !allowedRoles.includes(req.userRole)
    ) {
      res.status(403).json(AuthErrors.OWNERSHIP_REQUIRED);
      return null;
    }

    return resource;
  } catch (error) {
    logger.error('Resource validation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate resource ownership.',
    });
    return null;
  }
}

// Logging functions for security audit
async function logUnauthorizedAccess(req: NextApiRequest) {
  try {
    const ip = getClientIp(req) || 'unknown';
    await prisma.auditLog.create({
      data: {
        event: 'UNAUTHORIZED_ACCESS',
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: {
          path: req.url,
          method: req.method,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to log unauthorized access:', error);
  }
}

async function logForbiddenAccess(req: NextApiRequest, userId: string, userRole: string) {
  try {
    const ip = getClientIp(req) || 'unknown';
    await prisma.auditLog.create({
      data: {
        event: 'FORBIDDEN_ACCESS',
        userId,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: {
          path: req.url,
          method: req.method,
          userRole,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to log forbidden access:', error);
  }
}

// Middleware combinations for common patterns
export const authMiddleware = {
  // Require authentication only
  authenticated: (handler: any) =>
    withAuth(handler, {
      requireAuth: true,
      checkOwnership: true,
    }),

  // Require admin role
  admin: (handler: any) =>
    withAuth(handler, {
      requireAuth: true,
      allowedRoles: ['ADMIN'],
      checkOwnership: false,
    }),

  // Require admin or support role
  adminOrSupport: (handler: any) =>
    withAuth(handler, {
      requireAuth: true,
      allowedRoles: ['ADMIN', 'SUPPORT'],
      checkOwnership: false,
    }),

  // Require accountant role
  accountant: (handler: any) =>
    withAuth(handler, {
      requireAuth: true,
      allowedRoles: ['ACCOUNTANT', 'ADMIN'],
      checkOwnership: false,
    }),

  // Optional authentication (public endpoints that benefit from auth)
  optional: (handler: any) =>
    withAuth(handler, {
      requireAuth: false,
      checkOwnership: true,
    }),
};

// Helper function to extract user ID from various auth methods
export function extractUserId(req: NextApiRequest): string | null {
  // Try to get from authenticated request
  if ((req as any).userId) {
    return (req as any).userId;
  }

  // Try to get from session
  if ((req as any).session?.user?.id) {
    return (req as any).session.user.id;
  }

  // Try to get from NextAuth session (fallback)
  // This would need to be async in practice
  return null;
}

// Type guard to check if request is authenticated
export function isAuthenticated(req: NextApiRequest): req is AuthenticatedRequest {
  return !!(req as any).userId && !!(req as any).session;
}

// Helper to build user-scoped filters for Prisma queries
export function buildUserScopedFilters(req: AuthenticatedRequest, additionalFilters: any = {}) {
  if (req.userRole === 'ADMIN') {
    return additionalFilters;
  }

  return {
    ...additionalFilters,
    userId: req.userId,
  };
}

// Helper to check if user has permission for specific action
export function hasPermission(userRole: string, action: string, resource?: string): boolean {
  const permissions: Record<string, string[]> = {
    ADMIN: ['*'], // Admin can do everything
    ACCOUNTANT: ['read:transactions', 'read:users', 'read:reports', 'create:reports'],
    SUPPORT: ['read:users', 'read:transactions', 'update:users'],
    USER: ['read:own', 'update:own', 'delete:own'],
  };

  const userPermissions = permissions[userRole] || [];

  // Check for wildcard permission
  if (userPermissions.includes('*')) {
    return true;
  }

  // Check for specific permission
  if (userPermissions.includes(action)) {
    return true;
  }

  // Check for own resource permission
  if (resource === 'own' && userPermissions.includes(`${action}:own`)) {
    return true;
  }

  return false;
}

// Export types for use in other files
export type { AuthenticatedRequest, AuthMiddlewareOptions };
