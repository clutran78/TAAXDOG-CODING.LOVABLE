import { NextApiRequest, NextApiResponse } from 'next';
import { LRUCache } from 'lru-cache';
import {
  TIME_INTERVALS,
  AUTH_RATE_LIMITS,
  API_RATE_LIMITS,
  RATE_LIMIT_CACHE,
  RATE_LIMIT_HEADERS,
  RATE_LIMIT_ERRORS,
  HTTP_STATUS,
  RATE_LIMIT_ENDPOINTS,
  type RateLimitConfig,
} from '@/lib/constants';

interface RateLimitOptions {
  interval: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per interval
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: NextApiRequest) => string; // Custom key generation
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Create separate caches for different endpoints
const caches = new Map<string, LRUCache<string, RateLimitEntry>>();

// Default rate limit configurations
export const rateLimitConfigs = {
  auth: AUTH_RATE_LIMITS.LOGIN,
  passwordReset: AUTH_RATE_LIMITS.PASSWORD_RESET,
  emailVerification: AUTH_RATE_LIMITS.EMAIL_VERIFICATION,
  api: API_RATE_LIMITS.GENERAL,
  publicApi: API_RATE_LIMITS.PUBLIC,
};

// Get or create cache for endpoint
function getCache(endpoint: string): LRUCache<string, RateLimitEntry> {
  if (!caches.has(endpoint)) {
    caches.set(
      endpoint,
      new LRUCache<string, RateLimitEntry>({
        max: RATE_LIMIT_CACHE.MAX_ENTRIES,
        ttl: RATE_LIMIT_CACHE.TTL,
        updateAgeOnGet: RATE_LIMIT_CACHE.UPDATE_AGE_ON_GET,
      }),
    );
  }
  return caches.get(endpoint)!;
}

// Extract client identifier from request
function getClientIdentifier(req: NextApiRequest): string {
  // Try to get IP from various headers
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip'];

  let ip = 'unknown';

  if (typeof forwarded === 'string') {
    ip = forwarded.split(',')[0].trim();
  } else if (typeof realIp === 'string') {
    ip = realIp;
  } else if (typeof cfConnectingIp === 'string') {
    ip = cfConnectingIp;
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  // Add user ID if authenticated
  const userId = (req as any).user?.id;
  if (userId) {
    return `${ip}:${userId}`;
  }

  return ip;
}

// Rate limiter middleware factory
export function createRateLimiter(endpoint: string, options: RateLimitOptions) {
  const cache = getCache(endpoint);

  return async (
    req: NextApiRequest,
    res: NextApiResponse,
    next?: () => void | Promise<void>,
  ): Promise<boolean> => {
    // Generate rate limit key
    const key = options.keyGenerator ? options.keyGenerator(req) : getClientIdentifier(req);

    const now = Date.now();
    const entry = cache.get(key) || { count: 0, resetTime: now + options.interval };

    // Reset if interval has passed
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + options.interval;
    }

    // Check if limit exceeded
    if (entry.count >= options.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

      res.setHeader(RATE_LIMIT_HEADERS.LIMIT, options.maxRequests.toString());
      res.setHeader(RATE_LIMIT_HEADERS.REMAINING, '0');
      res.setHeader(RATE_LIMIT_HEADERS.RESET, new Date(entry.resetTime).toISOString());
      res.setHeader(RATE_LIMIT_HEADERS.RETRY_AFTER, retryAfter.toString());

      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        error: RATE_LIMIT_ERRORS.TOO_MANY_REQUESTS,
        message: RATE_LIMIT_ERRORS.getRetryMessage(retryAfter),
        retryAfter,
      });

      return false;
    }

    // Increment counter
    entry.count++;
    cache.set(key, entry);

    // Set rate limit headers
    res.setHeader(RATE_LIMIT_HEADERS.LIMIT, options.maxRequests.toString());
    res.setHeader(RATE_LIMIT_HEADERS.REMAINING, (options.maxRequests - entry.count).toString());
    res.setHeader(RATE_LIMIT_HEADERS.RESET, new Date(entry.resetTime).toISOString());

    // Continue to next middleware
    if (next) {
      await next();
    }

    return true;
  };
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter(RATE_LIMIT_ENDPOINTS.AUTH, rateLimitConfigs.auth);
export const passwordResetRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.PASSWORD_RESET,
  rateLimitConfigs.passwordReset,
);
export const emailVerificationRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.EMAIL_VERIFICATION,
  rateLimitConfigs.emailVerification,
);
export const apiRateLimiter = createRateLimiter(RATE_LIMIT_ENDPOINTS.API, rateLimitConfigs.api);

// Rate limit decorator for API routes
export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: RateLimitOptions = rateLimitConfigs.api,
) {
  const rateLimiter = createRateLimiter(RATE_LIMIT_ENDPOINTS.CUSTOM, options);

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const allowed = await rateLimiter(req, res);
    if (allowed) {
      await handler(req, res);
    }
  };
}

// IP-based rate limiting for specific actions
export function createIPRateLimiter(action: string, maxAttempts: number, windowMs: number) {
  const cache = getCache(`ip-${action}`);

  return {
    check: (ip: string): boolean => {
      const now = Date.now();
      const entry = cache.get(ip) || { count: 0, resetTime: now + windowMs };

      if (now > entry.resetTime) {
        entry.count = 0;
        entry.resetTime = now + windowMs;
      }

      return entry.count < maxAttempts;
    },

    increment: (ip: string): void => {
      const now = Date.now();
      const entry = cache.get(ip) || { count: 0, resetTime: now + windowMs };

      if (now > entry.resetTime) {
        entry.count = 1;
        entry.resetTime = now + windowMs;
      } else {
        entry.count++;
      }

      cache.set(ip, entry);
    },

    reset: (ip: string): void => {
      cache.delete(ip);
    },

    getRemaining: (ip: string): number => {
      const now = Date.now();
      const entry = cache.get(ip);

      if (!entry || now > entry.resetTime) {
        return maxAttempts;
      }

      return Math.max(0, maxAttempts - entry.count);
    },
  };
}

// Public API rate limiter with stricter limits for finance application security
export const publicApiRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.PUBLIC_API,
  rateLimitConfigs.publicApi,
);

// General rate limiter for other endpoints
export const generalRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.GENERAL,
  rateLimitConfigs.api,
);
