/**
 * Rate Limiting Constants
 *
 * Centralized configuration for API rate limiting
 */

// ============================================================================
// TIME INTERVALS
// ============================================================================

/** Time intervals in milliseconds */
export const TIME_INTERVALS = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  TWELVE_HOURS: 12 * 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
} as const;

// ============================================================================
// RATE LIMIT CONFIGURATIONS
// ============================================================================

/** Authentication endpoint rate limits */
export const AUTH_RATE_LIMITS = {
  LOGIN: {
    interval: TIME_INTERVALS.FIVE_MINUTES, // Changed from 1 minute to 5 minutes
    maxRequests: 10, // Increased from 5 to 10 attempts per 5 minutes
    blockDuration: TIME_INTERVALS.THIRTY_MINUTES,
  },
  REGISTER: {
    interval: TIME_INTERVALS.ONE_HOUR,
    maxRequests: 5, // Increased from 3 to 5
    blockDuration: TIME_INTERVALS.ONE_HOUR,
  },
  PASSWORD_RESET: {
    interval: TIME_INTERVALS.ONE_HOUR,
    maxRequests: 5, // Increased from 3 to 5
    blockDuration: TIME_INTERVALS.SIX_HOURS,
  },
  EMAIL_VERIFICATION: {
    interval: TIME_INTERVALS.FIVE_MINUTES, // Changed from 1 minute to 5 minutes
    maxRequests: 5, // Increased from 3 to 5
    blockDuration: TIME_INTERVALS.TEN_MINUTES,
  },
} as const;

/** API endpoint rate limits */
export const API_RATE_LIMITS = {
  GENERAL: {
    interval: TIME_INTERVALS.ONE_MINUTE,
    maxRequests: 100,
  },
  PUBLIC: {
    interval: TIME_INTERVALS.ONE_MINUTE,
    maxRequests: 30, // Stricter for public endpoints
  },
  AI_SERVICES: {
    interval: TIME_INTERVALS.ONE_MINUTE,
    maxRequests: 10, // Limited due to cost
  },
  FILE_UPLOAD: {
    interval: TIME_INTERVALS.FIVE_MINUTES,
    maxRequests: 10,
  },
  REPORT_GENERATION: {
    interval: TIME_INTERVALS.ONE_HOUR,
    maxRequests: 5,
  },
  BULK_OPERATIONS: {
    interval: TIME_INTERVALS.TEN_MINUTES,
    maxRequests: 5,
  },
  BANKING_SYNC: {
    interval: TIME_INTERVALS.ONE_HOUR,
    maxRequests: 10,
  },
} as const;

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/** LRU cache settings for rate limit storage */
export const RATE_LIMIT_CACHE = {
  MAX_ENTRIES: 10000, // Maximum unique IPs/users to track
  TTL: TIME_INTERVALS.ONE_DAY, // Time to keep entries in cache
  UPDATE_AGE_ON_GET: false, // Don't refresh TTL on access
} as const;

// ============================================================================
// HTTP HEADERS
// ============================================================================

/** Rate limit response headers */
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
} as const;

// ============================================================================
// ERROR RESPONSES
// ============================================================================

/** Rate limit error messages */
export const RATE_LIMIT_ERRORS = {
  TOO_MANY_REQUESTS: 'Too many requests',
  RETRY_LATER: 'Rate limit exceeded. Please try again later.',
  getRetryMessage: (seconds: number) =>
    `Rate limit exceeded. Please try again in ${seconds} seconds.`,
} as const;

/** HTTP status codes */
export const HTTP_STATUS = {
  TOO_MANY_REQUESTS: 429,
} as const;

// ============================================================================
// ENDPOINT IDENTIFIERS
// ============================================================================

/** Endpoint names for rate limit caches */
export const RATE_LIMIT_ENDPOINTS = {
  AUTH: 'auth',
  PASSWORD_RESET: 'passwordReset',
  EMAIL_VERIFICATION: 'emailVerification',
  API: 'api',
  PUBLIC_API: 'publicApi',
  GENERAL: 'general',
  CUSTOM: 'custom',
} as const;

// ============================================================================
// SPECIAL CONFIGURATIONS
// ============================================================================

/** Progressive rate limiting for repeated violations */
export const PROGRESSIVE_LIMITS = {
  VIOLATION_THRESHOLD: 3, // Number of rate limit hits before applying stricter limits
  MULTIPLIER: 0.5, // Reduce allowed requests by 50% for repeat offenders
  RECOVERY_TIME: TIME_INTERVALS.ONE_HOUR, // Time before limits return to normal
} as const;

/** Bypass rate limiting for specific conditions */
export const RATE_LIMIT_BYPASS = {
  ADMIN_ROLES: ['ADMIN', 'SUPPORT'],
  INTERNAL_IPS: ['127.0.0.1', '::1'], // localhost
  API_KEY_HEADER: 'X-API-Key',
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  interval: number;
  maxRequests: number;
  blockDuration?: number;
}

export type EndpointName = (typeof RATE_LIMIT_ENDPOINTS)[keyof typeof RATE_LIMIT_ENDPOINTS];
