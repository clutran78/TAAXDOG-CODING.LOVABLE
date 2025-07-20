import { NextApiRequest, NextApiResponse } from 'next';
import { LRUCache } from 'lru-cache';

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
  auth: {
    interval: 60 * 1000, // 1 minute
    maxRequests: 5,
  },
  passwordReset: {
    interval: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
  },
  emailVerification: {
    interval: 60 * 1000, // 1 minute
    maxRequests: 3,
  },
  api: {
    interval: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
};

// Get or create cache for endpoint
function getCache(endpoint: string): LRUCache<string, RateLimitEntry> {
  if (!caches.has(endpoint)) {
    caches.set(endpoint, new LRUCache<string, RateLimitEntry>({
      max: 10000, // Store up to 10k unique IPs
      ttl: 24 * 60 * 60 * 1000, // 24 hour TTL
    }));
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
    next?: () => void | Promise<void>
  ): Promise<boolean> => {
    // Generate rate limit key
    const key = options.keyGenerator 
      ? options.keyGenerator(req) 
      : getClientIdentifier(req);
    
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
      
      res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
      res.setHeader('Retry-After', retryAfter.toString());
      
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      });
      
      return false;
    }
    
    // Increment counter
    entry.count++;
    cache.set(key, entry);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (options.maxRequests - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());
    
    // Continue to next middleware
    if (next) {
      await next();
    }
    
    return true;
  };
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter('auth', rateLimitConfigs.auth);
export const passwordResetRateLimiter = createRateLimiter('passwordReset', rateLimitConfigs.passwordReset);
export const emailVerificationRateLimiter = createRateLimiter('emailVerification', rateLimitConfigs.emailVerification);
export const apiRateLimiter = createRateLimiter('api', rateLimitConfigs.api);

// Rate limit decorator for API routes
export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: RateLimitOptions = rateLimitConfigs.api
) {
  const rateLimiter = createRateLimiter('custom', options);
  
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