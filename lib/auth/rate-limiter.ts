import { NextApiRequest, NextApiResponse } from 'next';
import { LRUCache } from 'lru-cache';
import { apiResponse, ApiError, ApiErrorCode } from '@/lib/api/response';
import { logger } from '@/lib/logger';
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
  burst?: number; // Allow burst requests
  distributed?: boolean; // Use distributed rate limiting
  weight?: number; // Request weight for weighted rate limiting
  blockDuration?: number; // How long to block after limit exceeded
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequestTime?: number;
  blockedUntil?: number;
  violations?: number;
}

interface TokenBucketEntry extends RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface LeakyBucketEntry extends RateLimitEntry {
  water: number;
  lastLeak: number;
}

// Algorithm types
export enum RateLimitAlgorithm {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket',
  LEAKY_BUCKET = 'leaky_bucket',
}

// Create separate caches for different endpoints
const caches = new Map<string, LRUCache<string, RateLimitEntry>>();
const slidingWindowCaches = new Map<string, LRUCache<string, number[]>>();

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

// Get or create sliding window cache
function getSlidingWindowCache(endpoint: string): LRUCache<string, number[]> {
  if (!slidingWindowCaches.has(endpoint)) {
    slidingWindowCaches.set(
      endpoint,
      new LRUCache<string, number[]>({
        max: RATE_LIMIT_CACHE.MAX_ENTRIES,
        ttl: RATE_LIMIT_CACHE.TTL * 2, // Keep longer for sliding window
      }),
    );
  }
  return slidingWindowCaches.get(endpoint)!;
}

// Extract client identifier from request
function getClientIdentifier(req: NextApiRequest): string {
  // Try to get IP from various headers
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  const vercelIp = req.headers['x-vercel-forwarded-for'];

  let ip = 'unknown';

  if (typeof forwarded === 'string') {
    ip = forwarded.split(',')[0].trim();
  } else if (typeof realIp === 'string') {
    ip = realIp;
  } else if (typeof cfConnectingIp === 'string') {
    ip = cfConnectingIp;
  } else if (typeof vercelIp === 'string') {
    ip = vercelIp.split(',')[0].trim();
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  // Normalize IPv6 localhost
  if (ip === '::1') {
    ip = '127.0.0.1';
  }

  // Add user ID if authenticated
  const userId = (req as any).user?.id;
  if (userId) {
    return `user:${userId}`;
  }

  // Add session ID if available
  const sessionId = req.cookies?.['next-auth.session-token'] || req.cookies?.['__Secure-next-auth.session-token'];
  if (sessionId) {
    return `session:${sessionId.substring(0, 16)}:${ip}`;
  }

  return `ip:${ip}`;
}

// Sliding window rate limiter
function slidingWindowRateLimiter(
  key: string,
  options: RateLimitOptions,
  cache: LRUCache<string, number[]>
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowStart = now - options.interval;
  
  // Get request timestamps
  let timestamps = cache.get(key) || [];
  
  // Remove expired timestamps
  timestamps = timestamps.filter(ts => ts > windowStart);
  
  // Check if limit exceeded
  const count = timestamps.length;
  const allowed = count < options.maxRequests;
  
  if (allowed) {
    timestamps.push(now);
    cache.set(key, timestamps);
  }
  
  // Calculate reset time (when oldest request expires)
  const resetTime = timestamps.length > 0 
    ? timestamps[0] + options.interval 
    : now + options.interval;
  
  return {
    allowed,
    remaining: Math.max(0, options.maxRequests - timestamps.length),
    resetTime,
  };
}

// Token bucket rate limiter
function tokenBucketRateLimiter(
  key: string,
  options: RateLimitOptions,
  cache: LRUCache<string, TokenBucketEntry>
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const bucketSize = options.burst || options.maxRequests;
  const refillRate = options.maxRequests / options.interval;
  
  let entry = cache.get(key) as TokenBucketEntry || {
    count: 0,
    tokens: bucketSize,
    lastRefill: now,
    resetTime: now + options.interval,
  };
  
  // Refill tokens based on time elapsed
  const timeSinceLastRefill = now - entry.lastRefill;
  const tokensToAdd = Math.floor(timeSinceLastRefill * refillRate);
  
  if (tokensToAdd > 0) {
    entry.tokens = Math.min(bucketSize, entry.tokens + tokensToAdd);
    entry.lastRefill = now;
  }
  
  // Check if request can be allowed
  const weight = options.weight || 1;
  const allowed = entry.tokens >= weight;
  
  if (allowed) {
    entry.tokens -= weight;
    entry.count++;
  }
  
  // Calculate when bucket will be full again
  const tokensNeeded = bucketSize - entry.tokens;
  const resetTime = now + (tokensNeeded / refillRate);
  
  entry.resetTime = resetTime;
  cache.set(key, entry);
  
  return {
    allowed,
    remaining: Math.floor(entry.tokens),
    resetTime,
  };
}

// Leaky bucket rate limiter
function leakyBucketRateLimiter(
  key: string,
  options: RateLimitOptions,
  cache: LRUCache<string, LeakyBucketEntry>
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const capacity = options.maxRequests;
  const leakRate = options.maxRequests / options.interval; // requests per ms
  
  let entry = cache.get(key) as LeakyBucketEntry || {
    count: 0,
    water: 0,
    lastLeak: now,
    resetTime: now + options.interval,
  };
  
  // Calculate water leaked since last check
  const timeSinceLastLeak = now - entry.lastLeak;
  const leaked = timeSinceLastLeak * leakRate;
  
  // Update water level
  entry.water = Math.max(0, entry.water - leaked);
  entry.lastLeak = now;
  
  // Check if request can be added
  const weight = options.weight || 1;
  const allowed = entry.water + weight <= capacity;
  
  if (allowed) {
    entry.water += weight;
    entry.count++;
  }
  
  // Calculate when bucket will be empty
  const resetTime = entry.water > 0 ? now + (entry.water / leakRate) : now;
  
  entry.resetTime = resetTime;
  cache.set(key, entry);
  
  return {
    allowed,
    remaining: Math.max(0, Math.floor(capacity - entry.water)),
    resetTime,
  };
}

// Enhanced rate limiter middleware factory
export function createRateLimiter(
  endpoint: string, 
  options: RateLimitOptions,
  algorithm: RateLimitAlgorithm = RateLimitAlgorithm.FIXED_WINDOW
) {
  const cache = getCache(endpoint);
  const slidingCache = getSlidingWindowCache(endpoint);

  return async (
    req: NextApiRequest,
    res: NextApiResponse,
    next?: () => void | Promise<void>,
  ): Promise<boolean> => {
    try {
      // Generate rate limit key
      const key = options.keyGenerator ? options.keyGenerator(req) : getClientIdentifier(req);
      
      // Check if client is blocked
      const entry = cache.get(key);
      if (entry?.blockedUntil && Date.now() < entry.blockedUntil) {
        const retryAfter = Math.ceil((entry.blockedUntil - Date.now()) / 1000);
        
        res.setHeader(RATE_LIMIT_HEADERS.RETRY_AFTER, retryAfter.toString());
        
        apiResponse.tooManyRequests(res, retryAfter);
        return false;
      }

      let result: { allowed: boolean; remaining: number; resetTime: number };

      // Apply rate limiting based on algorithm
      switch (algorithm) {
        case RateLimitAlgorithm.SLIDING_WINDOW:
          result = slidingWindowRateLimiter(key, options, slidingCache);
          break;
          
        case RateLimitAlgorithm.TOKEN_BUCKET:
          result = tokenBucketRateLimiter(key, options, cache as LRUCache<string, TokenBucketEntry>);
          break;
          
        case RateLimitAlgorithm.LEAKY_BUCKET:
          result = leakyBucketRateLimiter(key, options, cache as LRUCache<string, LeakyBucketEntry>);
          break;
          
        case RateLimitAlgorithm.FIXED_WINDOW:
        default:
          const now = Date.now();
          const currentEntry = cache.get(key) || { 
            count: 0, 
            resetTime: now + options.interval,
            firstRequestTime: now,
            violations: 0,
          };

          // Reset if interval has passed
          if (now > currentEntry.resetTime) {
            currentEntry.count = 0;
            currentEntry.resetTime = now + options.interval;
            currentEntry.firstRequestTime = now;
          }

          result = {
            allowed: currentEntry.count < options.maxRequests,
            remaining: Math.max(0, options.maxRequests - currentEntry.count),
            resetTime: currentEntry.resetTime,
          };

          if (result.allowed) {
            currentEntry.count++;
            cache.set(key, currentEntry);
          } else {
            // Track violations
            currentEntry.violations = (currentEntry.violations || 0) + 1;
            
            // Block if too many violations
            if (currentEntry.violations >= 3 && options.blockDuration) {
              currentEntry.blockedUntil = now + options.blockDuration;
              logger.warn('Rate limit violations exceeded, blocking client', {
                key,
                violations: currentEntry.violations,
                blockedUntil: new Date(currentEntry.blockedUntil),
              });
            }
            
            cache.set(key, currentEntry);
          }
          break;
      }

      // Set rate limit headers
      res.setHeader(RATE_LIMIT_HEADERS.LIMIT, options.maxRequests.toString());
      res.setHeader(RATE_LIMIT_HEADERS.REMAINING, result.remaining.toString());
      res.setHeader(RATE_LIMIT_HEADERS.RESET, new Date(result.resetTime).toISOString());

      // Track statistics
      rateLimitStats.track(endpoint, result.allowed, entry?.violations && entry.violations >= 3);

      // Check if limit exceeded
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        res.setHeader(RATE_LIMIT_HEADERS.RETRY_AFTER, retryAfter.toString());

        // Log rate limit exceeded with more context
        logger.warn('Rate limit exceeded', {
          endpoint,
          key,
          algorithm,
          remaining: result.remaining,
          retryAfter,
          violations: entry?.violations || 0,
          userAgent: req.headers['user-agent'],
          path: req.url,
          method: req.method,
        });

        // Enhanced error response with more details
        const errorMessage = entry?.violations && entry.violations >= 3
          ? 'Too many rate limit violations. Access temporarily blocked.'
          : `Rate limit exceeded. Please retry after ${retryAfter} seconds.`;

        apiResponse.error(res, new ApiError(
          ApiErrorCode.TOO_MANY_REQUESTS,
          errorMessage,
          429,
          {
            retryAfter,
            limit: options.maxRequests,
            remaining: result.remaining,
            reset: new Date(result.resetTime).toISOString(),
            violations: entry?.violations,
          }
        ));
        return false;
      }

      // Continue to next middleware
      if (next) {
        await next();
      }

      return true;
    } catch (error) {
      logger.error('Rate limiter error', {
        error,
        endpoint,
        algorithm,
        key: options.keyGenerator ? 'custom' : 'default',
      });
      
      // Track error in stats
      rateLimitStats.track(endpoint, true); // Allow on error (fail open)
      
      // Fail open - allow request if rate limiter fails
      if (next) {
        await next();
      }
      
      return true;
    }
  };
}

// Pre-configured rate limiters with different algorithms
export const authRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.AUTH, 
  rateLimitConfigs.auth,
  RateLimitAlgorithm.SLIDING_WINDOW
);

export const passwordResetRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.PASSWORD_RESET,
  rateLimitConfigs.passwordReset,
  RateLimitAlgorithm.FIXED_WINDOW
);

export const emailVerificationRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.EMAIL_VERIFICATION,
  rateLimitConfigs.emailVerification,
  RateLimitAlgorithm.FIXED_WINDOW
);

export const apiRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.API, 
  rateLimitConfigs.api,
  RateLimitAlgorithm.TOKEN_BUCKET
);

// Public API rate limiter - now properly exported
export const publicApiRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.PUBLIC_API,
  {
    ...rateLimitConfigs.publicApi,
    blockDuration: TIME_INTERVALS.HOUR, // Block for 1 hour after violations
  },
  RateLimitAlgorithm.SLIDING_WINDOW
);

// General rate limiter for other endpoints
export const generalRateLimiter = createRateLimiter(
  RATE_LIMIT_ENDPOINTS.GENERAL,
  rateLimitConfigs.api,
  RateLimitAlgorithm.TOKEN_BUCKET
);

// Rate limit decorator for API routes
export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  options: RateLimitOptions = rateLimitConfigs.api,
  algorithm: RateLimitAlgorithm = RateLimitAlgorithm.FIXED_WINDOW,
) {
  const rateLimiter = createRateLimiter(RATE_LIMIT_ENDPOINTS.CUSTOM, options, algorithm);

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

    getResetTime: (ip: string): Date | null => {
      const entry = cache.get(ip);
      return entry ? new Date(entry.resetTime) : null;
    },

    isBlocked: (ip: string): boolean => {
      const entry = cache.get(ip);
      return entry?.blockedUntil ? Date.now() < entry.blockedUntil : false;
    },
  };
}

// Advanced rate limiter with multiple strategies
export class AdvancedRateLimiter {
  private limiters: Map<string, ReturnType<typeof createRateLimiter>> = new Map();

  constructor(
    private defaultOptions: RateLimitOptions,
    private defaultAlgorithm: RateLimitAlgorithm = RateLimitAlgorithm.TOKEN_BUCKET
  ) {}

  // Create or get a rate limiter for a specific key
  getRateLimiter(key: string, options?: Partial<RateLimitOptions>, algorithm?: RateLimitAlgorithm) {
    const limiterKey = `${key}-${algorithm || this.defaultAlgorithm}`;
    
    if (!this.limiters.has(limiterKey)) {
      this.limiters.set(
        limiterKey,
        createRateLimiter(
          key,
          { ...this.defaultOptions, ...options },
          algorithm || this.defaultAlgorithm
        )
      );
    }
    
    return this.limiters.get(limiterKey)!;
  }

  // Apply rate limiting with fallback strategies
  async applyRateLimit(
    req: NextApiRequest,
    res: NextApiResponse,
    strategies: Array<{
      key: string;
      options?: Partial<RateLimitOptions>;
      algorithm?: RateLimitAlgorithm;
    }>
  ): Promise<boolean> {
    for (const strategy of strategies) {
      const limiter = this.getRateLimiter(strategy.key, strategy.options, strategy.algorithm);
      const allowed = await limiter(req, res);
      
      if (!allowed) {
        return false;
      }
    }
    
    return true;
  }

  // Clear all rate limit data for a specific identifier
  clearLimits(identifier: string) {
    caches.forEach(cache => {
      const keys = Array.from(cache.keys());
      keys.forEach(key => {
        if (key.includes(identifier)) {
          cache.delete(key);
        }
      });
    });
    
    slidingWindowCaches.forEach(cache => {
      const keys = Array.from(cache.keys());
      keys.forEach(key => {
        if (key.includes(identifier)) {
          cache.delete(key);
        }
      });
    });
  }
}

// Distributed rate limiter that works with external stores
export class DistributedRateLimiter {
  constructor(
    private store: DistributedRateLimitStore,
    private defaultOptions: RateLimitOptions = rateLimitConfigs.api
  ) {}

  async checkLimit(
    key: string,
    options: RateLimitOptions = this.defaultOptions
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const entry = await this.store.get(key);
    
    if (!entry || now > entry.resetTime) {
      // Reset or new entry
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + options.interval,
        firstRequestTime: now,
      };
      
      await this.store.set(key, newEntry, Math.ceil(options.interval / 1000));
      
      return {
        allowed: true,
        remaining: options.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }
    
    // Check if blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.blockedUntil,
      };
    }
    
    // Check if limit exceeded
    if (entry.count >= options.maxRequests) {
      // Track violations
      entry.violations = (entry.violations || 0) + 1;
      
      // Block if too many violations
      if (entry.violations >= 3 && options.blockDuration) {
        entry.blockedUntil = now + options.blockDuration;
      }
      
      await this.store.set(key, entry, Math.ceil(options.interval / 1000));
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }
    
    // Increment count
    entry.count++;
    await this.store.set(key, entry, Math.ceil(options.interval / 1000));
    
    return {
      allowed: true,
      remaining: options.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  async reset(key: string): Promise<void> {
    await this.store.delete(key);
  }
}

// Distributed rate limiting support
export interface DistributedRateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  set(key: string, value: RateLimitEntry, ttl?: number): Promise<void>;
  increment(key: string, field: string, value?: number): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// Redis-compatible store implementation
export class RedisRateLimitStore implements DistributedRateLimitStore {
  constructor(private redis: any) {}

  async get(key: string): Promise<RateLimitEntry | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: RateLimitEntry, ttl?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl, data);
    } else {
      await this.redis.set(key, data);
    }
  }

  async increment(key: string, field: string, value = 1): Promise<number> {
    return await this.redis.hincrby(key, field, value);
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.redis.expire(key, ttl);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

// Enhanced error handling with retry logic
export class RateLimitError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryAfter?: number,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Rate limit statistics tracker
export class RateLimitStats {
  private stats = new Map<string, {
    allowed: number;
    blocked: number;
    violations: number;
    lastReset: number;
  }>();

  track(endpoint: string, allowed: boolean, violation = false): void {
    const now = Date.now();
    const current = this.stats.get(endpoint) || {
      allowed: 0,
      blocked: 0,
      violations: 0,
      lastReset: now,
    };

    if (allowed) {
      current.allowed++;
    } else {
      current.blocked++;
      if (violation) {
        current.violations++;
      }
    }

    this.stats.set(endpoint, current);
  }

  getStats(endpoint?: string): Record<string, unknown> {
    if (endpoint) {
      return this.stats.get(endpoint) || {};
    }
    
    const allStats: Record<string, unknown> = {};
    this.stats.forEach((value, key) => {
      allStats[key] = value;
    });
    return allStats;
  }

  reset(endpoint?: string): void {
    if (endpoint) {
      this.stats.delete(endpoint);
    } else {
      this.stats.clear();
    }
  }
}

// Global stats instance
export const rateLimitStats = new RateLimitStats();

// Export rate limiting utilities
export const rateLimiter = {
  create: createRateLimiter,
  withRateLimit,
  createIPRateLimiter,
  AdvancedRateLimiter,
  DistributedRateLimiter,
  RedisRateLimitStore,
  RateLimitError,
  algorithms: RateLimitAlgorithm,
  stats: rateLimitStats,
  
  // Utility functions
  clearAllCaches: () => {
    caches.clear();
    slidingWindowCaches.clear();
  },
  
  getCacheStats: () => {
    const stats: Record<string, { size: number; maxSize: number }> = {};
    
    caches.forEach((cache, key) => {
      stats[key] = {
        size: cache.size,
        maxSize: cache.max,
      };
    });
    
    slidingWindowCaches.forEach((cache, key) => {
      stats[`sliding_${key}`] = {
        size: cache.size,
        maxSize: cache.max,
      };
    });
    
    return stats;
  },
  
  // Test if rate limit would be allowed without consuming
  test: async (endpoint: string, identifier: string, options?: RateLimitOptions): Promise<boolean> => {
    const cache = getCache(endpoint);
    const key = identifier;
    const entry = cache.get(key);
    
    if (!entry) return true;
    
    const now = Date.now();
    const opts = options || rateLimitConfigs.api;
    
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return false;
    }
    
    if (now > entry.resetTime) {
      return true;
    }
    
    return entry.count < opts.maxRequests;
  },
};