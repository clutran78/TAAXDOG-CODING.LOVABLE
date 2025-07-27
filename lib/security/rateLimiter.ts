import { NextApiRequest, NextApiResponse } from 'next';
import { getClientIp } from 'request-ip';
import { logger } from '@/lib/logger';

// Types
interface RateLimitOptions {
  window: number; // Time window in milliseconds
  max: number; // Maximum requests allowed in the window
  keyGenerator?: (req: NextApiRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  message?: string; // Custom error message
  standardHeaders?: boolean; // Include standard rate limit headers
  legacyHeaders?: boolean; // Include legacy X-RateLimit headers
}

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// In-memory store (consider Redis for production)
const stores = new Map<string, Map<string, RateLimitStore>>();

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // Auth endpoints - strict limits
  auth: {
    login: { window: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
    register: { window: 60 * 60 * 1000, max: 3 }, // 3 registrations per hour
    forgotPassword: { window: 60 * 60 * 1000, max: 3 }, // 3 requests per hour
    resetPassword: { window: 60 * 60 * 1000, max: 5 }, // 5 attempts per hour
  },

  // API endpoints - moderate limits
  api: {
    strict: { window: 60 * 1000, max: 30 }, // 30 requests per minute
    standard: { window: 60 * 1000, max: 60 }, // 60 requests per minute
    relaxed: { window: 60 * 1000, max: 120 }, // 120 requests per minute
  },

  // Public endpoints - lenient limits
  public: {
    health: { window: 60 * 1000, max: 100 }, // 100 requests per minute
    static: { window: 60 * 1000, max: 300 }, // 300 requests per minute
  },
};

// Get or create store for an endpoint
function getStore(endpoint: string): Map<string, RateLimitStore> {
  if (!stores.has(endpoint)) {
    stores.set(endpoint, new Map());
  }
  return stores.get(endpoint)!;
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  stores.forEach((store) => {
    store.forEach((value, key) => {
      if (value.resetTime < now) {
        store.delete(key);
      }
    });
  });
}, 60 * 1000); // Clean up every minute

// Default key generators
const keyGenerators = {
  // For authenticated endpoints - use user ID
  user: (req: NextApiRequest): string => {
    const userId = (req as any).userId || (req as any).session?.user?.id;
    if (!userId) {
      throw new Error('User ID not found for rate limiting');
    }
    return `user:${userId}`;
  },

  // For public endpoints - use IP address
  ip: (req: NextApiRequest): string => {
    const ip = getClientIp(req) || 'unknown';
    return `ip:${ip}`;
  },

  // Combined user + IP for extra security
  userIp: (req: NextApiRequest): string => {
    const userId = (req as any).userId || (req as any).session?.user?.id;
    const ip = getClientIp(req) || 'unknown';
    return userId ? `user:${userId}:ip:${ip}` : `ip:${ip}`;
  },
};

// Main rate limiter function
export function createRateLimiter(options: RateLimitOptions) {
  const {
    window,
    max,
    keyGenerator = keyGenerators.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Too many requests, please try again later.',
    standardHeaders = true,
    legacyHeaders = false,
  } = options;

  return async (
    req: NextApiRequest,
    res: NextApiResponse,
    next?: () => void | Promise<void>,
  ): Promise<boolean> => {
    try {
      // Generate key for this request
      const key = keyGenerator(req);
      const endpoint = req.url || 'unknown';
      const store = getStore(endpoint);
      const now = Date.now();

      // Get or create rate limit data
      let limitData = store.get(key);
      if (!limitData || limitData.resetTime < now) {
        limitData = {
          count: 0,
          resetTime: now + window,
        };
        store.set(key, limitData);
      }

      // Calculate remaining requests
      const remaining = Math.max(0, max - limitData.count);
      const reset = new Date(limitData.resetTime);

      // Add rate limit headers
      if (standardHeaders) {
        res.setHeader('RateLimit-Limit', max.toString());
        res.setHeader('RateLimit-Remaining', remaining.toString());
        res.setHeader('RateLimit-Reset', reset.toISOString());
        res.setHeader('RateLimit-Policy', `${max};w=${window / 1000}`);
      }

      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', max.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.floor(limitData.resetTime / 1000).toString());
      }

      // Check if limit exceeded
      if (limitData.count >= max) {
        const retryAfter = Math.ceil((limitData.resetTime - now) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        // Don't count this request if configured
        if (!skipFailedRequests) {
          limitData.count++;
        }

        res.status(429).json({
          error: 'Too Many Requests',
          message,
          retryAfter,
          resetAt: reset.toISOString(),
        });

        return false;
      }

      // Increment counter
      limitData.count++;

      // If next is provided, call it
      if (next) {
        await next();
      }

      return true;
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // On error, allow the request to proceed
      if (next) {
        await next();
      }
      return true;
    }
  };
}

// Middleware wrapper for easier use
export function withRateLimit(handler: any, options: RateLimitOptions) {
  const rateLimiter = createRateLimiter(options);

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const allowed = await rateLimiter(req, res);
    if (allowed) {
      return handler(req, res);
    }
  };
}

// Pre-configured rate limiters
export const rateLimiters = {
  // Authentication endpoints
  authLogin: createRateLimiter({
    ...RATE_LIMIT_CONFIGS.auth.login,
    keyGenerator: keyGenerators.ip,
    message: 'Too many login attempts. Please try again later.',
  }),

  authRegister: createRateLimiter({
    ...RATE_LIMIT_CONFIGS.auth.register,
    keyGenerator: keyGenerators.ip,
    message: 'Too many registration attempts. Please try again later.',
  }),

  authForgotPassword: createRateLimiter({
    ...RATE_LIMIT_CONFIGS.auth.forgotPassword,
    keyGenerator: keyGenerators.ip,
    message: 'Too many password reset requests. Please try again later.',
  }),

  // API endpoints
  apiStrict: createRateLimiter({
    ...RATE_LIMIT_CONFIGS.api.strict,
    keyGenerator: keyGenerators.user,
  }),

  apiStandard: createRateLimiter({
    ...RATE_LIMIT_CONFIGS.api.standard,
    keyGenerator: keyGenerators.user,
  }),

  apiRelaxed: createRateLimiter({
    ...RATE_LIMIT_CONFIGS.api.relaxed,
    keyGenerator: keyGenerators.user,
  }),

  // Public endpoints
  publicHealth: createRateLimiter({
    ...RATE_LIMIT_CONFIGS.public.health,
    keyGenerator: keyGenerators.ip,
  }),

  publicStatic: createRateLimiter({
    ...RATE_LIMIT_CONFIGS.public.static,
    keyGenerator: keyGenerators.ip,
  }),
};

// Helper to apply rate limiting to session-based endpoints
export function withSessionRateLimit(handler: any, config: Partial<RateLimitOptions> = {}) {
  return withRateLimit(handler, {
    ...RATE_LIMIT_CONFIGS.api.standard,
    keyGenerator: keyGenerators.user,
    ...config,
  });
}

// Helper to apply rate limiting to public endpoints
export function withPublicRateLimit(handler: any, config: Partial<RateLimitOptions> = {}) {
  return withRateLimit(handler, {
    ...RATE_LIMIT_CONFIGS.public.health,
    keyGenerator: keyGenerators.ip,
    ...config,
  });
}

// Sliding window rate limiter for more accurate limiting
export function createSlidingWindowRateLimiter(options: RateLimitOptions) {
  const { window, max, keyGenerator = keyGenerators.ip } = options;
  const windowLogs = new Map<string, number[]>();

  return async (
    req: NextApiRequest,
    res: NextApiResponse,
    next?: () => void | Promise<void>,
  ): Promise<boolean> => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - window;

    // Get or create log for this key
    let log = windowLogs.get(key) || [];

    // Remove old entries
    log = log.filter((timestamp) => timestamp > windowStart);

    // Check if limit exceeded
    if (log.length >= max) {
      const oldestEntry = Math.min(...log);
      const retryAfter = Math.ceil((oldestEntry + window - now) / 1000);

      res.setHeader('Retry-After', retryAfter.toString());
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Rate limit exceeded',
        retryAfter,
      });

      return false;
    }

    // Add current request
    log.push(now);
    windowLogs.set(key, log);

    // Clean up old keys periodically
    if (Math.random() < 0.01) {
      // 1% chance to clean up
      windowLogs.forEach((value, key) => {
        if (value.every((timestamp) => timestamp < windowStart)) {
          windowLogs.delete(key);
        }
      });
    }

    if (next) {
      await next();
    }

    return true;
  };
}
