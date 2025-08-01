/**
 * Authentication Constants
 *
 * Centralized constants for authentication, security, and user management
 */

// ============================================================================
// TOKEN CONFIGURATION
// ============================================================================

/** JWT token expiration times */
export const TOKEN_EXPIRY = {
  JWT_DEFAULT: '7d',
  EMAIL_VERIFICATION: 24, // hours
  PASSWORD_RESET: 1, // hours
  SESSION: 7 * 24, // hours (7 days)
  CSRF: 24, // hours
} as const;

/** Token length in bytes (hex output will be 2x) */
export const TOKEN_LENGTH = {
  DEFAULT: 32,
  CSRF: 24,
  SESSION: 48,
} as const;

// ============================================================================
// PASSWORD CONFIGURATION
// ============================================================================

/** Password security requirements */
export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 8,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  SPECIAL_CHARS: '!@#$%^&*(),.?":{}|<>',
  BCRYPT_ROUNDS: 12,
} as const;

/** Password validation messages */
export const PASSWORD_MESSAGES = {
  TOO_SHORT: 'Password must be at least 8 characters long',
  NO_UPPERCASE: 'Password must contain at least one uppercase letter',
  NO_LOWERCASE: 'Password must contain at least one lowercase letter',
  NO_NUMBER: 'Password must contain at least one number',
  NO_SPECIAL: 'Password must contain at least one special character',
} as const;

// ============================================================================
// ACCOUNT SECURITY
// ============================================================================

/** Account lockout thresholds */
export const LOCKOUT_THRESHOLDS = {
  ATTEMPTS_BEFORE_LOCKOUT: 5,
  MIN_LOCKOUT_MINUTES: 15,
  MAX_LOCKOUT_HOURS: 24,
  LOCKOUT_MULTIPLIER: 2,
  BASE_LOCKOUT_MINUTES: 5,
} as const;

/** Failed attempt thresholds for different lockout durations */
export const LOCKOUT_TIERS = {
  TIER_1: { attempts: 5, minutes: 15 },
  TIER_2: { attempts: 10, minutes: 60 },
  TIER_3: { attempts: 15, minutes: 1440 }, // 24 hours
} as const;

// ============================================================================
// JWT CONFIGURATION
// ============================================================================

/** JWT issuer and audience configuration */
export const JWT_CONFIG = {
  ISSUER: 'taaxdog',
  AUDIENCE: 'taaxdog-users',
  ALGORITHM: 'HS256',
} as const;

// ============================================================================
// COOKIE CONFIGURATION
// ============================================================================

/** Authentication cookie settings */
export const AUTH_COOKIE_CONFIG = {
  HTTP_ONLY: true,
  SECURE_IN_PRODUCTION: true,
  SAME_SITE: 'lax' as const,
  PATH: '/',
  MAX_AGE_SECONDS: 60 * 60 * 24 * 7, // 7 days
} as const;

// ============================================================================
// AUTHENTICATION EVENTS
// ============================================================================

/** Authentication event types for audit logging */
export const AUTH_EVENTS = {
  // Login events
  LOGIN: 'LOGIN',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',

  // Registration
  REGISTER: 'REGISTER',

  // Password events
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',

  // Email verification
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',

  // Account security
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',

  // Two-factor authentication
  TWO_FACTOR_ENABLED: 'TWO_FACTOR_ENABLED',
  TWO_FACTOR_DISABLED: 'TWO_FACTOR_DISABLED',
  TWO_FACTOR_SUCCESS: 'TWO_FACTOR_SUCCESS',
  TWO_FACTOR_FAILED: 'TWO_FACTOR_FAILED',

  // Session management
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_INVALIDATED: 'SESSION_INVALIDATED',
  SESSION_TIMEOUT: 'SESSION_TIMEOUT',
  SESSION_ACTIVITY: 'SESSION_ACTIVITY',

  // Security events
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',

  // Token events
  TOKEN_REFRESH: 'TOKEN_REFRESH',
} as const;

/** Critical security events that require immediate attention */
export const CRITICAL_AUTH_EVENTS = [
  AUTH_EVENTS.LOGIN_FAILED,
  AUTH_EVENTS.ACCOUNT_LOCKED,
  AUTH_EVENTS.TWO_FACTOR_FAILED,
  AUTH_EVENTS.PASSWORD_RESET_REQUEST,
  AUTH_EVENTS.SESSION_INVALIDATED,
] as const;

/** Events that trigger security alerts */
export const ALERT_AUTH_EVENTS = [
  AUTH_EVENTS.ACCOUNT_LOCKED,
  AUTH_EVENTS.TWO_FACTOR_FAILED,
] as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

/** Standard authentication error messages */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account is locked due to too many failed attempts',
  EMAIL_NOT_VERIFIED: 'Please verify your email before logging in',
  INVALID_TOKEN: 'Invalid or expired token',
  USER_NOT_FOUND: 'User not found',
  EMAIL_IN_USE: 'Email is already registered',
  WEAK_PASSWORD: 'Password does not meet security requirements',
  SESSION_EXPIRED: 'Your session has expired. Please log in again',
  UNAUTHORIZED: 'You are not authorized to access this resource',
  CSRF_INVALID: 'Invalid CSRF token',
} as const;

// ============================================================================
// SENSITIVE FIELDS
// ============================================================================

/** User fields that should never be sent to the client */
export const SENSITIVE_USER_FIELDS = [
  'password',
  'emailVerificationToken',
  'emailVerificationExpires',
  'passwordResetToken',
  'passwordResetExpires',
  'twoFactorSecret',
  'tfn', // Tax File Number
] as const;

// ============================================================================
// IP HEADERS
// ============================================================================

/** Headers to check for client IP address (in priority order) */
export const IP_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip', // Cloudflare
] as const;

// ============================================================================
// TYPES
// ============================================================================

export type AuthEventType = (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS];
export type CriticalAuthEvent = (typeof CRITICAL_AUTH_EVENTS)[number];
export type AlertAuthEvent = (typeof ALERT_AUTH_EVENTS)[number];
export type SensitiveField = (typeof SENSITIVE_USER_FIELDS)[number];
