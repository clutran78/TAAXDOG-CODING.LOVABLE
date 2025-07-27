import { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions, logAuthEvent } from '../auth';
import { Role, AuthEvent } from '@prisma/client';
import { prisma } from '../prisma';
import { verifyJWT, getClientIP } from './auth-utils';
import { csrfProtection } from './csrf-protection';
import { apiRateLimiter } from './rate-limiter';
import { logger } from '@/lib/logger';

// Type for authenticated request
export interface AuthenticatedRequest extends NextApiRequest {
  user: {
    id: string;
    email: string;
    role: Role;
    emailVerified: Date | null;
  };
}

// Authentication middleware
export function withAuth(
  handler: NextApiHandler,
  options?: {
    requireEmailVerified?: boolean;
    allowedRoles?: Role[];
  },
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      // Get session
      const session = await getServerSession(req, res, authOptions);

      if (!session || !session.user) {
        await logAuthEvent({
          event: 'SUSPICIOUS_ACTIVITY',
          success: false,
          metadata: {
            reason: 'Unauthorized access attempt',
            path: req.url,
          },
          req,
        });
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get full user details
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
        return res.status(401).json({ message: 'User not found' });
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await logAuthEvent({
          event: 'ACCOUNT_LOCKED',
          userId: user.id,
          success: false,
          metadata: {
            reason: 'Account locked',
            lockedUntil: user.lockedUntil,
          },
          req,
        });
        return res.status(403).json({
          message: 'Account is locked. Please try again later.',
          lockedUntil: user.lockedUntil,
        });
      }

      // Check email verification if required
      if (options?.requireEmailVerified && !user.emailVerified) {
        return res.status(403).json({
          message: 'Email verification required',
          requiresVerification: true,
        });
      }

      // Check role permissions
      if (options?.allowedRoles && !options.allowedRoles.includes(user.role)) {
        await logAuthEvent({
          event: 'SUSPICIOUS_ACTIVITY',
          userId: user.id,
          success: false,
          metadata: {
            reason: 'Insufficient permissions',
            requiredRoles: options.allowedRoles,
            userRole: user.role,
          },
          req,
        });
        return res.status(403).json({
          message: 'Insufficient permissions',
          requiredRole: options.allowedRoles,
        });
      }

      // Add user to request
      (req as AuthenticatedRequest).user = user;

      // Call the handler
      return handler(req, res);
    } catch (error) {
      logger.error('Auth middleware error:', error);
      return res.status(500).json({ message: 'Authentication error' });
    }
  };
}

// Rate limiting middleware
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(
  handler: NextApiHandler,
  options: {
    windowMs?: number;
    max?: number;
    keyGenerator?: (req: NextApiRequest) => string;
  } = {},
) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const max = options.max || 60; // 60 requests default
  const keyGenerator =
    options.keyGenerator ||
    ((req) => {
      const forwarded = req.headers['x-forwarded-for'];
      const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket.remoteAddress;
      return `${req.url}:${ip || 'unknown'}`;
    });

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const limit = rateLimitStore.get(key);

    if (!limit || now > limit.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
    } else if (limit.count >= max) {
      const retryAfter = Math.ceil((limit.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      // Log rate limit violation
      const session = await getServerSession(req, res, authOptions);
      if (session?.user?.id) {
        await logAuthEvent({
          event: 'SUSPICIOUS_ACTIVITY',
          userId: session.user.id,
          success: false,
          metadata: {
            reason: 'Rate limit exceeded',
            endpoint: req.url,
          },
          req,
        });
      }

      return res.status(429).json({
        message: 'Too many requests. Please try again later.',
        retryAfter,
      });
    } else {
      limit.count++;
    }

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      const cutoff = now - windowMs * 2;
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetTime < cutoff) {
          rateLimitStore.delete(k);
        }
      }
    }

    return handler(req, res);
  };
}

// Combine multiple middlewares
export function withMiddleware(
  handler: NextApiHandler,
  middlewares: Array<(handler: NextApiHandler) => NextApiHandler>,
) {
  return middlewares.reduceRight((next, middleware) => middleware(next), handler);
}

// Email verification guard
export function requireEmailVerified(handler: NextApiHandler) {
  return withAuth(handler, { requireEmailVerified: true });
}

// Role-based guards
export function requireAdmin(handler: NextApiHandler) {
  return withAuth(handler, { allowedRoles: [Role.ADMIN] });
}

export function requireAccountant(handler: NextApiHandler) {
  return withAuth(handler, { allowedRoles: [Role.ADMIN, Role.ACCOUNTANT] });
}

// API key authentication for external services
export function withAPIKey(handler: NextApiHandler, serviceName: string) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return res.status(401).json({ message: 'API key required' });
    }

    // Validate API key (implement your logic)
    const isValidKey = await validateAPIKey(apiKey, serviceName);

    if (!isValidKey) {
      await logAuthEvent({
        event: 'SUSPICIOUS_ACTIVITY',
        success: false,
        metadata: {
          reason: 'Invalid API key',
          service: serviceName,
        },
        req,
      });
      return res.status(401).json({ message: 'Invalid API key' });
    }

    return handler(req, res);
  };
}

// Validate API key (implement your validation logic)
async function validateAPIKey(apiKey: string, serviceName: string): Promise<boolean> {
  // In production, check against database or external service
  // For now, simple validation
  const validKeys: Record<string, string> = {
    webhook: process.env.WEBHOOK_API_KEY || '',
    external: process.env.EXTERNAL_API_KEY || '',
  };

  return validKeys[serviceName] === apiKey;
}

// CSRF protection for state-changing operations
export function withCSRF(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method || '')) {
      const csrfToken = req.headers['x-csrf-token'] as string;

      if (!csrfToken) {
        return res.status(403).json({ message: 'CSRF token required' });
      }

      // Validate CSRF token (implement your logic)
      const session = await getServerSession(req, res, authOptions);
      if (!session) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Simple CSRF validation - in production use proper token generation/validation
      const expectedToken = `csrf_${session.user.id}_${req.url}`;
      const isValid = csrfToken === Buffer.from(expectedToken).toString('base64');

      if (!isValid) {
        await logAuthEvent({
          event: 'SUSPICIOUS_ACTIVITY',
          userId: session.user.id,
          success: false,
          metadata: {
            reason: 'Invalid CSRF token',
            endpoint: req.url,
          },
          req,
        });
        return res.status(403).json({ message: 'Invalid CSRF token' });
      }
    }

    return handler(req, res);
  };
}

// Subscription check middleware
export function requireSubscription(planTypes?: ('SMART' | 'PRO')[]) {
  return function (handler: NextApiHandler) {
    return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: req.user.id },
        select: {
          status: true,
          plan: true,
          currentPeriodEnd: true,
        },
      });

      if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
        return res.status(402).json({
          message: 'Active subscription required',
          requiresPayment: true,
        });
      }

      // Check if subscription is expired
      if (subscription.currentPeriodEnd < new Date()) {
        return res.status(402).json({
          message: 'Subscription expired',
          requiresPayment: true,
        });
      }

      // Check specific plan requirements
      if (planTypes && !planTypes.includes(subscription.plan)) {
        return res.status(403).json({
          message: `This feature requires ${planTypes.join(' or ')} plan`,
          requiredPlans: planTypes,
          currentPlan: subscription.plan,
        });
      }

      return handler(req, res);
    });
  };
}
