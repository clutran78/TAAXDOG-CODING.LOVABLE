import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '../prisma';
// Simple utility to get client IP
function getClientIp(req: NextApiRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }
  return null;
}
import { logger } from '@/lib/logger';
import type { User, Role, Prisma } from '@prisma/client';

// Enhanced type definitions
export type UserRole = Role;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: Date | null;
}

export interface EnhancedSession extends Session {
  user: SessionUser;
  sessionId?: string;
  issuedAt?: string;
  expiresAt?: string;
}

export interface AuthenticatedRequest extends NextApiRequest {
  userId: string;
  userEmail: string;
  userRole: UserRole;
  session: EnhancedSession;
  clientIp?: string;
  userAgent?: string;
}

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  allowedRoles?: UserRole[];
  checkOwnership?: boolean;
  logAccess?: boolean;
  requireEmailVerification?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

// Rate limiting store
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  });
}, 60 * 1000); // Every minute

// Error response type
export interface AuthErrorResponse {
  error: string;
  message: string;
  code: string;
  details?: Record<string, any>;
  timestamp?: string;
}

// Enhanced error responses with consistent typing
export const AuthErrors = {
  UNAUTHORIZED: {
    error: 'Unauthorized',
    message: 'Authentication required. Please log in to access this resource.',
    code: 'AUTH_REQUIRED',
  } as AuthErrorResponse,

  FORBIDDEN: {
    error: 'Forbidden',
    message: 'You do not have permission to access this resource.',
    code: 'INSUFFICIENT_PERMISSIONS',
  } as AuthErrorResponse,

  INVALID_SESSION: {
    error: 'Invalid Session',
    message: 'Your session has expired or is invalid. Please log in again.',
    code: 'SESSION_INVALID',
  } as AuthErrorResponse,

  ROLE_REQUIRED: (requiredRoles: UserRole | UserRole[]): AuthErrorResponse => ({
    error: 'Insufficient Role',
    message: `This action requires ${Array.isArray(requiredRoles) ? requiredRoles.join(' or ') : requiredRoles} role.`,
    code: 'ROLE_REQUIRED',
    details: { requiredRoles },
  }),

  OWNERSHIP_REQUIRED: {
    error: 'Access Denied',
    message: 'You can only access your own data.',
    code: 'OWNERSHIP_REQUIRED',
  } as AuthErrorResponse,

  EMAIL_NOT_VERIFIED: {
    error: 'Email Not Verified',
    message: 'Please verify your email address to access this resource.',
    code: 'EMAIL_NOT_VERIFIED',
  } as AuthErrorResponse,

  ACCOUNT_LOCKED: (lockedUntil: Date): AuthErrorResponse => ({
    error: 'Account Locked',
    message: 'Your account is temporarily locked due to suspicious activity.',
    code: 'ACCOUNT_LOCKED',
    details: {
      lockedUntil: lockedUntil.toISOString(),
      remainingMinutes: Math.ceil((lockedUntil.getTime() - Date.now()) / 60000),
    },
  }),

  RATE_LIMIT_EXCEEDED: (resetAt: Date): AuthErrorResponse => ({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    details: {
      resetAt: resetAt.toISOString(),
      retryAfterSeconds: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
    },
  }),

  INTERNAL_ERROR: {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_ERROR',
  } as AuthErrorResponse,
} as const;

// Helper function for rate limiting
function checkRateLimit(key: string, options: { maxRequests: number; windowMs: number }): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return true;
  }

  if (entry.count >= options.maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// Enhanced authentication middleware with better verification
export function withAuth<T extends AuthenticatedRequest = AuthenticatedRequest>(
  handler: (req: T, res: NextApiResponse) => Promise<void> | void,
  options: AuthMiddlewareOptions = {},
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  const {
    requireAuth = true,
    allowedRoles = [],
    checkOwnership = true,
    logAccess = true,
    requireEmailVerification = false,
    rateLimit,
  } = options;

  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    const startTime = Date.now();
    const clientIp = getClientIp(req) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    try {
      // Add timestamp to all error responses
      const errorWithTimestamp = (error: AuthErrorResponse, statusCode: number) => {
        return res.status(statusCode).json({
          ...error,
          timestamp: new Date().toISOString(),
        });
      };

      // Rate limiting check
      if (rateLimit) {
        const rateLimitKey = `${req.url}:${clientIp}`;
        if (!checkRateLimit(rateLimitKey, rateLimit)) {
          const resetAt = new Date(Date.now() + rateLimit.windowMs);
          if (logAccess) {
            logger.warn('Rate limit exceeded', {
              path: req.url,
              clientIp,
              maxRequests: rateLimit.maxRequests,
            });
          }
          return errorWithTimestamp(AuthErrors.RATE_LIMIT_EXCEEDED(resetAt), 429);
        }
      }

      // Get session from NextAuth
      const session = (await getServerSession(req, res, authOptions)) as EnhancedSession | null;

      // Check if authentication is required
      if (requireAuth && !session?.user?.id) {
        if (logAccess) {
          await logUnauthorizedAccess(req, clientIp, userAgent);
        }
        return errorWithTimestamp(AuthErrors.UNAUTHORIZED, 401);
      }

      // If authenticated, perform enhanced verification
      if (session?.user?.id) {
        // Fetch fresh user data with additional security checks
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            email: true,
            role: true,
            emailVerified: true,
            lockedUntil: true,
            lastLoginAt: true,
          },
        });

        // Comprehensive user verification
        if (!user) {
          logger.warn('Session user not found in database', {
            sessionUserId: session.user.id,
            clientIp,
          });
          return errorWithTimestamp(AuthErrors.INVALID_SESSION, 401);
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          if (logAccess) {
            await logForbiddenAccess(req, user.id, user.role as string, clientIp, userAgent);
          }
          return errorWithTimestamp(AuthErrors.ACCOUNT_LOCKED(user.lockedUntil), 403);
        }

        // Check email verification if required
        if (requireEmailVerification && !user.emailVerified) {
          logger.info('Unverified email attempted access', {
            userId: user.id,
            email: user.email,
            clientIp,
          });
          return errorWithTimestamp(AuthErrors.EMAIL_NOT_VERIFIED, 403);
        }

        // Check role permissions with proper typing
        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role as UserRole)) {
          if (logAccess) {
            await logForbiddenAccess(req, user.id, user.role as string, clientIp, userAgent);
          }
          return errorWithTimestamp(AuthErrors.ROLE_REQUIRED(allowedRoles), 403);
        }

        // Attach enhanced user info to request
        const authenticatedReq = req as T;
        authenticatedReq.userId = user.id;
        authenticatedReq.userEmail = user.email;
        authenticatedReq.userRole = user.role as UserRole;
        authenticatedReq.session = session;
        authenticatedReq.clientIp = clientIp;
        authenticatedReq.userAgent = userAgent;

        // Log successful authentication
        if (logAccess) {
          logger.debug('Request authenticated', {
            userId: user.id,
            path: req.url,
            method: req.method,
            role: user.role,
            duration: Date.now() - startTime,
          });
        }
      }

      // Call the actual handler
      const result = await handler(req as T, res);

      // Log request completion
      if (logAccess && session?.user?.id) {
        logger.debug('Request completed', {
          userId: session.user.id,
          path: req.url,
          method: req.method,
          statusCode: res.statusCode,
          duration: Date.now() - startTime,
        });
      }

      return result;
    } catch (error) {
      logger.error('Authentication middleware error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.url,
        method: req.method,
        clientIp,
        duration: Date.now() - startTime,
      });

      return res.status(500).json({
        ...AuthErrors.INTERNAL_ERROR,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

// Enhanced helper function to ensure user can only access their own data
export function ensureOwnership(
  userId: string,
  resourceOwnerId: string,
  userRole: UserRole,
): boolean {
  // Type-safe role checking
  const adminRoles: UserRole[] = ['ADMIN', 'SUPPORT'];

  // Admins and support can access any resource
  if (adminRoles.includes(userRole)) {
    return true;
  }

  // Regular users can only access their own resources
  return userId === resourceOwnerId;
}

// Enhanced helper to create user-scoped Prisma queries with proper typing
export function createUserScopedQuery<T extends { where?: any }>(
  userId: string,
  userRole: UserRole,
  additionalWhere?: T['where'],
): Pick<T, 'where'> {
  // Admins can see all data
  if (userRole === 'ADMIN') {
    return additionalWhere ? { where: additionalWhere } : ({} as Pick<T, 'where'>);
  }

  // Regular users can only see their own data
  const userFilter = { userId };

  if (additionalWhere) {
    return {
      where: {
        AND: [userFilter, additionalWhere],
      },
    } as Pick<T, 'where'>;
  }

  return { where: userFilter } as Pick<T, 'where'>;
}

// Resource ownership validation result type
export interface ResourceValidationResult<T> {
  resource: T | null;
  error?: AuthErrorResponse;
  statusCode?: number;
}

// Enhanced helper to validate resource ownership with better typing
export async function validateResourceOwnership<
  T extends { userId: string; id: string },
  M extends {
    findUnique: (args: any) => Promise<T | null>;
  },
>(
  req: AuthenticatedRequest,
  res: NextApiResponse,
  resourceId: string,
  model: M,
  options: {
    allowedRoles?: UserRole[];
    includeDeleted?: boolean;
    select?: Record<string, boolean>;
  } = {},
): Promise<T | null> {
  const { allowedRoles = ['ADMIN'], includeDeleted = false, select } = options;

  try {
    // Build query with optional soft delete check
    const query: any = {
      where: { id: resourceId },
    };

    if (select) {
      query.select = select;
    }

    if (!includeDeleted && model.constructor.name !== 'UserDelegate') {
      query.where = {
        ...query.where,
        deletedAt: null,
      };
    }

    const resource = await model.findUnique(query);

    if (!resource) {
      const notFoundError: AuthErrorResponse = {
        error: 'Not Found',
        message: 'The requested resource was not found.',
        code: 'RESOURCE_NOT_FOUND',
        timestamp: new Date().toISOString(),
      };
      res.status(404).json(notFoundError);
      return null;
    }

    // Check ownership with enhanced role checking
    const hasAccess =
      ensureOwnership(req.userId, resource.userId, req.userRole) ||
      allowedRoles.includes(req.userRole);

    if (!hasAccess) {
      logger.warn('Ownership validation failed', {
        userId: req.userId,
        resourceId: resource.id,
        resourceOwnerId: resource.userId,
        userRole: req.userRole,
        requiredRoles: allowedRoles,
      });

      res.status(403).json({
        ...AuthErrors.OWNERSHIP_REQUIRED,
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    return resource;
  } catch (error) {
    logger.error('Resource validation error', {
      error: error instanceof Error ? error.message : String(error),
      resourceId,
      userId: req.userId,
    });

    res.status(500).json({
      ...AuthErrors.INTERNAL_ERROR,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

// Enhanced logging functions for security audit
async function logUnauthorizedAccess(
  req: NextApiRequest,
  clientIp: string,
  userAgent: string,
): Promise<void> {
  try {
    // TODO: Implement proper security audit logging for access control violations
    // Note: AuditLog is for authentication events only
    logger.warn('Unauthorized access attempt', {
      clientIp,
      userAgent,
      path: req.url || 'unknown',
      method: req.method || 'unknown',
      headers: {
        origin: req.headers.origin || null,
        referer: req.headers.referer || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to log unauthorized access', {
      error: error instanceof Error ? error.message : String(error),
      clientIp,
      path: req.url,
    });
  }
}

async function logForbiddenAccess(
  req: NextApiRequest,
  userId: string,
  userRole: string,
  clientIp: string,
  userAgent: string,
): Promise<void> {
  try {
    // TODO: Implement proper security audit logging for access control violations
    // Note: AuditLog is for authentication events only
    logger.warn('Forbidden access attempt', {
      userId,
      clientIp,
      userAgent,
      path: req.url || 'unknown',
      method: req.method || 'unknown',
      userRole,
      attemptedResource: req.query.id || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to log forbidden access', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      clientIp,
      path: req.url,
    });
  }
}

// Enhanced middleware combinations with proper typing
type AuthHandler<T extends AuthenticatedRequest = AuthenticatedRequest> = (
  req: T,
  res: NextApiResponse,
) => Promise<void> | void;

export const authMiddleware = {
  // Require authentication only
  authenticated: <T extends AuthenticatedRequest = AuthenticatedRequest>(handler: AuthHandler<T>) =>
    withAuth<T>(handler, {
      requireAuth: true,
      checkOwnership: true,
      logAccess: true,
    }),

  // Require admin role
  admin: <T extends AuthenticatedRequest = AuthenticatedRequest>(handler: AuthHandler<T>) =>
    withAuth<T>(handler, {
      requireAuth: true,
      allowedRoles: ['ADMIN'],
      checkOwnership: false,
      logAccess: true,
    }),

  // Require admin or support role
  adminOrSupport: <T extends AuthenticatedRequest = AuthenticatedRequest>(
    handler: AuthHandler<T>,
  ) =>
    withAuth<T>(handler, {
      requireAuth: true,
      allowedRoles: ['ADMIN', 'SUPPORT'],
      checkOwnership: false,
      logAccess: true,
    }),

  // Require accountant role
  accountant: <T extends AuthenticatedRequest = AuthenticatedRequest>(handler: AuthHandler<T>) =>
    withAuth<T>(handler, {
      requireAuth: true,
      allowedRoles: ['ACCOUNTANT', 'ADMIN'],
      checkOwnership: false,
      logAccess: true,
    }),

  // Require verified email
  verified: <T extends AuthenticatedRequest = AuthenticatedRequest>(handler: AuthHandler<T>) =>
    withAuth<T>(handler, {
      requireAuth: true,
      requireEmailVerification: true,
      checkOwnership: true,
      logAccess: true,
    }),

  // Optional authentication (public endpoints that benefit from auth)
  optional: <T extends AuthenticatedRequest = AuthenticatedRequest>(handler: AuthHandler<T>) =>
    withAuth<T>(handler, {
      requireAuth: false,
      checkOwnership: true,
      logAccess: false,
    }),

  // Rate limited endpoint
  rateLimited: <T extends AuthenticatedRequest = AuthenticatedRequest>(
    handler: AuthHandler<T>,
    maxRequests = 10,
    windowMs = 60000, // 1 minute
  ) =>
    withAuth<T>(handler, {
      requireAuth: true,
      checkOwnership: true,
      logAccess: true,
      rateLimit: { maxRequests, windowMs },
    }),
};

// Enhanced helper function to extract user ID from various auth methods
export async function extractUserId(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> {
  // Try to get from authenticated request
  if (isAuthenticated(req)) {
    return req.userId;
  }

  // Try to get from NextAuth session
  try {
    const session = (await getServerSession(req, res, authOptions)) as EnhancedSession | null;
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

// Enhanced type guard to check if request is authenticated
export function isAuthenticated(req: NextApiRequest): req is AuthenticatedRequest {
  const authReq = req as AuthenticatedRequest;
  return !!(authReq.userId && authReq.session && authReq.userEmail && authReq.userRole);
}

// Enhanced helper to build user-scoped filters for Prisma queries
export function buildUserScopedFilters<T extends Record<string, any>>(
  req: AuthenticatedRequest,
  additionalFilters: T = {} as T,
): T & { userId?: string } {
  // Admins see all data
  if (req.userRole === 'ADMIN') {
    return additionalFilters;
  }

  // Merge user filter with additional filters
  return {
    ...additionalFilters,
    userId: req.userId,
  };
}

// Permission action type
export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'create:own'
  | 'read:own'
  | 'update:own'
  | 'delete:own'
  | 'read:users'
  | 'update:users'
  | 'delete:users'
  | 'read:transactions'
  | 'create:transactions'
  | 'read:reports'
  | 'create:reports'
  | '*';

// Enhanced permission system with typed actions
export function hasPermission(
  userRole: UserRole,
  action: PermissionAction,
  resourceOwnerId?: string,
  userId?: string,
): boolean {
  const permissions: Record<UserRole, PermissionAction[]> = {
    ADMIN: ['*'], // Admin can do everything
    ACCOUNTANT: [
      'read:transactions',
      'read:users',
      'read:reports',
      'create:reports',
      'read:own',
      'update:own',
    ],
    SUPPORT: ['read:users', 'read:transactions', 'update:users', 'read:own'],
    USER: ['read:own', 'update:own', 'delete:own', 'create:own'],
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
  if (resourceOwnerId && userId && resourceOwnerId === userId) {
    const ownAction = `${action.split(':')[0]}:own` as PermissionAction;
    if (userPermissions.includes(ownAction)) {
      return true;
    }
  }

  return false;
}

// Batch permission check for multiple actions
export function hasAnyPermission(
  userRole: UserRole,
  actions: PermissionAction[],
  resourceOwnerId?: string,
  userId?: string,
): boolean {
  return actions.some((action) => hasPermission(userRole, action, resourceOwnerId, userId));
}

// Get all permissions for a role
export function getRolePermissions(userRole: UserRole): PermissionAction[] {
  const permissions: Record<UserRole, PermissionAction[]> = {
    ADMIN: ['*'],
    ACCOUNTANT: [
      'read:transactions',
      'read:users',
      'read:reports',
      'create:reports',
      'read:own',
      'update:own',
    ],
    SUPPORT: ['read:users', 'read:transactions', 'update:users', 'read:own'],
    USER: ['read:own', 'update:own', 'delete:own', 'create:own'],
  };

  return permissions[userRole] || [];
}

// All types are already exported inline above
