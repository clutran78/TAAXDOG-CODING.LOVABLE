import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '@prisma/client';
import { createAuditLog } from '@/lib/services/auditLogger';
import { FinancialOperation } from '@prisma/client';
import { logger } from '@/lib/logger';
import {
  TOKEN_EXPIRY,
  TOKEN_LENGTH,
  PASSWORD_REQUIREMENTS,
  PASSWORD_MESSAGES,
  LOCKOUT_THRESHOLDS,
  JWT_CONFIG,
  AUTH_COOKIE_CONFIG,
  AUTH_EVENTS,
  CRITICAL_AUTH_EVENTS,
  ALERT_AUTH_EVENTS,
  AUTH_ERRORS,
  SENSITIVE_USER_FIELDS,
  IP_HEADERS,
  type AuthEventType,
} from '@/lib/constants';

// Environment variables with defaults for development
const JWT_SECRET =
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-development-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || TOKEN_EXPIRY.JWT_DEFAULT;
const BCRYPT_ROUNDS = PASSWORD_REQUIREMENTS.BCRYPT_ROUNDS;

/**
 * Hashes a plain text password using bcrypt with a secure number of rounds
 *
 * @param {string} password - The plain text password to hash
 * @returns {Promise<string>} The hashed password
 *
 * @example
 * const hashedPassword = await hashPassword('mySecurePassword123!');
 * // Returns: '$2a$12$....' (bcrypt hash)
 *
 * @throws {Error} If bcrypt fails to hash the password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_REQUIREMENTS.BCRYPT_ROUNDS);
}

/**
 * Verifies a plain text password against a bcrypt hash
 *
 * @param {string} password - The plain text password to verify
 * @param {string} hash - The bcrypt hash to compare against
 * @returns {Promise<boolean>} True if password matches the hash, false otherwise
 *
 * @example
 * const isValid = await verifyPassword('userPassword', storedHash);
 * if (isValid) {
 *   // Password is correct
 * }
 *
 * @throws {Error} If bcrypt comparison fails
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT token management
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId?: string;
}

/**
 * Generates a JWT token for user authentication
 *
 * @param {JWTPayload} payload - The payload to encode in the JWT
 * @param {string} payload.userId - Unique identifier of the user
 * @param {string} payload.email - User's email address
 * @param {string} payload.role - User's role (e.g., 'USER', 'ADMIN')
 * @param {string} [payload.sessionId] - Optional session identifier
 * @returns {string} Signed JWT token
 *
 * @example
 * const token = generateJWT({
 *   userId: '123',
 *   email: 'user@example.com',
 *   role: 'USER'
 * });
 * // Returns: 'eyJhbGciOiJIUzI1NiIs...'
 *
 * @note Token expires based on JWT_EXPIRES_IN env variable (default: 7 days)
 * @note Uses HS256 algorithm for signing
 */
export function generateJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_CONFIG.ISSUER,
    audience: JWT_CONFIG.AUDIENCE,
  });
}

/**
 * Verifies and decodes a JWT token
 *
 * @param {string} token - The JWT token to verify
 * @returns {JWTPayload} The decoded token payload
 *
 * @example
 * try {
 *   const payload = verifyJWT(token);
 *   logger.info(`User ${payload.userId} authenticated`);
 * } catch (error) {
 *   logger.error('Invalid token');
 * }
 *
 * @throws {Error} Throws 'Invalid or expired token' if token is invalid, expired, or has wrong issuer/audience
 *
 * @note Validates token signature, expiration, issuer, and audience
 */
export function verifyJWT(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE,
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error(AUTH_ERRORS.INVALID_TOKEN);
  }
}

/**
 * Generates a cryptographically secure random token
 *
 * @param {number} [length=32] - The number of random bytes to generate (output will be 2x this length in hex)
 * @returns {string} Hex-encoded random token
 *
 * @example
 * const token = generateSecureToken();
 * // Returns: '7f3e9b2a...' (64 characters)
 *
 * const shortToken = generateSecureToken(16);
 * // Returns: '3a9f2b...' (32 characters)
 *
 * @note Uses crypto.randomBytes for cryptographic security
 * @note Output length is 2 * input length due to hex encoding
 */
export function generateSecureToken(length: number = TOKEN_LENGTH.DEFAULT): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generates a secure token for email verification with expiration
 *
 * @returns {Object} Token object with token string and expiration date
 * @returns {string} returns.token - 64-character hex token for email verification
 * @returns {Date} returns.expires - Expiration date/time (24 hours from generation)
 *
 * @example
 * const { token, expires } = generateEmailVerificationToken();
 * // Store in database:
 * await prisma.user.update({
 *   where: { id: userId },
 *   data: {
 *     emailVerificationToken: token,
 *     emailVerificationExpires: expires
 *   }
 * });
 *
 * @note Token expires in 24 hours
 * @note Use this token in verification emails sent to users
 */
export function generateEmailVerificationToken(): {
  token: string;
  expires: Date;
} {
  const token = generateSecureToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + TOKEN_EXPIRY.EMAIL_VERIFICATION);

  return { token, expires };
}

/**
 * Generates a secure token for password reset with short expiration
 *
 * @returns {Object} Token object with token string and expiration date
 * @returns {string} returns.token - 64-character hex token for password reset
 * @returns {Date} returns.expires - Expiration date/time (1 hour from generation)
 *
 * @example
 * const { token, expires } = generatePasswordResetToken();
 * // Store hashed version in database:
 * const hashedToken = await hashPassword(token);
 * await prisma.user.update({
 *   where: { email: userEmail },
 *   data: {
 *     passwordResetToken: hashedToken,
 *     passwordResetExpires: expires
 *   }
 * });
 *
 * @note Token expires in 1 hour for security
 * @note Always hash token before storing in database
 * @note Send plain token to user via secure email
 */
export function generatePasswordResetToken(): {
  token: string;
  expires: Date;
} {
  const token = generateSecureToken();
  const expires = new Date();
  expires.setHours(expires.getHours() + TOKEN_EXPIRY.PASSWORD_RESET);

  return { token, expires };
}

// Validate password strength
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates password strength against security requirements
 *
 * @param {string} password - The password to validate
 * @returns {PasswordValidation} Validation result with boolean flag and error messages
 * @returns {boolean} returns.isValid - True if password meets all requirements
 * @returns {string[]} returns.errors - Array of validation error messages
 *
 * @example
 * const validation = validatePasswordStrength('weak');
 * // Returns: { isValid: false, errors: ['Password must be at least 8 characters long', ...] }
 *
 * const validation = validatePasswordStrength('Strong123!');
 * // Returns: { isValid: true, errors: [] }
 *
 * @note Password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&*(),.?":{}|<>)
 */
export function validatePasswordStrength(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.MIN_LENGTH) {
    errors.push(PASSWORD_MESSAGES.TOO_SHORT);
  }

  if (PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push(PASSWORD_MESSAGES.NO_UPPERCASE);
  }

  if (PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push(PASSWORD_MESSAGES.NO_LOWERCASE);
  }

  if (PASSWORD_REQUIREMENTS.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push(PASSWORD_MESSAGES.NO_NUMBER);
  }

  const specialCharsRegex = new RegExp(`[${PASSWORD_REQUIREMENTS.SPECIAL_CHARS}]`);
  if (PASSWORD_REQUIREMENTS.REQUIRE_SPECIAL && !specialCharsRegex.test(password)) {
    errors.push(PASSWORD_MESSAGES.NO_SPECIAL);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Removes sensitive fields from user object before sending to client
 *
 * @param {Partial<User>} user - The user object to sanitize
 * @returns {Partial<User>} User object with sensitive fields removed
 *
 * @example
 * const user = await prisma.user.findUnique({ where: { id } });
 * const safeUser = sanitizeUser(user);
 * res.json({ user: safeUser }); // Safe to send to client
 *
 * @note Removes the following sensitive fields:
 * - password (hashed password)
 * - emailVerificationToken
 * - emailVerificationExpires
 * - passwordResetToken
 * - passwordResetExpires
 * - twoFactorSecret
 * - tfn (Tax File Number)
 *
 * @important Always use this function before sending user data to the client
 */
export function sanitizeUser(user: Partial<User>): Partial<User> {
  // Create a copy of the user object
  const sanitized = { ...user };

  // Remove all sensitive fields
  SENSITIVE_USER_FIELDS.forEach((field) => {
    delete sanitized[field as keyof User];
  });

  return sanitized;
}

/**
 * Generates a CSRF (Cross-Site Request Forgery) protection token
 *
 * @returns {string} 48-character hex token for CSRF protection
 *
 * @example
 * // Generate and store in session
 * const csrfToken = generateCSRFToken();
 * req.session.csrfToken = csrfToken;
 *
 * // Send to client in form or header
 * res.json({ csrfToken });
 *
 * @note Token should be stored in user session
 * @note Client must include token in X-CSRF-Token header or form field
 * @note Always validate token on state-changing requests (POST, PUT, DELETE)
 */
export function generateCSRFToken(): string {
  return generateSecureToken(TOKEN_LENGTH.CSRF);
}

/**
 * Verifies a CSRF token against the session token
 *
 * @param {string} token - The CSRF token provided by the client
 * @param {string} sessionToken - The CSRF token stored in the user's session
 * @returns {boolean} True if tokens match, false otherwise
 *
 * @example
 * const clientToken = req.headers['x-csrf-token'] || req.body._csrf;
 * const sessionToken = req.session.csrfToken;
 *
 * if (!verifyCSRFToken(clientToken, sessionToken)) {
 *   return res.status(403).json({ error: 'Invalid CSRF token' });
 * }
 *
 * @note This is a simple implementation - consider using a library like csurf for production
 * @note Tokens should be compared using constant-time comparison to prevent timing attacks
 */
export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  // In a real implementation, you would store and verify against session
  return token === sessionToken;
}

/**
 * Checks if a user account is currently locked due to failed login attempts
 *
 * @param {Partial<User>} user - The user object with lockedUntil field
 * @returns {boolean} True if account is locked, false if unlocked or no lock set
 *
 * @example
 * const user = await prisma.user.findUnique({ where: { email } });
 * if (isAccountLocked(user)) {
 *   const remainingTime = user.lockedUntil.getTime() - Date.now();
 *   return res.status(403).json({
 *     error: 'Account locked',
 *     lockedUntil: user.lockedUntil
 *   });
 * }
 *
 * @note Account is considered unlocked if lockedUntil is null or in the past
 * @note Use with calculateLockoutDuration() to implement progressive lockout
 */
export function isAccountLocked(user: Partial<User>): boolean {
  if (!user.lockedUntil) return false;
  return new Date() < new Date(user.lockedUntil);
}

/**
 * Calculates account lockout duration based on number of failed login attempts
 *
 * @param {number} failedAttempts - The number of consecutive failed login attempts
 * @returns {Date | null} The date/time when the account should be unlocked, or null if no lockout
 *
 * @example
 * // After 5 failed attempts
 * const lockoutUntil = calculateLockoutDuration(5);
 * await prisma.user.update({
 *   where: { id: userId },
 *   data: {
 *     failedLoginAttempts: 5,
 *     lockedUntil: lockoutUntil
 *   }
 * });
 *
 * @note Lockout duration increases with attempts:
 * - Less than 5 attempts: No lockout
 * - 5-9 attempts: 15 minutes
 * - 10-14 attempts: 1 hour
 * - 15+ attempts: 24 hours
 */
export function calculateLockoutDuration(failedAttempts: number): Date | null {
  if (failedAttempts < LOCKOUT_THRESHOLDS.ATTEMPTS_BEFORE_LOCKOUT) return null;

  // Calculate exponential backoff with base and max limits
  const exponentialMinutes =
    Math.pow(
      LOCKOUT_THRESHOLDS.LOCKOUT_MULTIPLIER,
      failedAttempts - LOCKOUT_THRESHOLDS.ATTEMPTS_BEFORE_LOCKOUT + 1,
    ) * LOCKOUT_THRESHOLDS.BASE_LOCKOUT_MINUTES;

  const lockoutMinutes = Math.min(exponentialMinutes, LOCKOUT_THRESHOLDS.MAX_LOCKOUT_HOURS * 60);

  const lockoutUntil = new Date();
  lockoutUntil.setMinutes(lockoutUntil.getMinutes() + lockoutMinutes);

  return lockoutUntil;
}

// IP address extraction from request
export function getClientIP(req: any): string {
  // Check each header in priority order
  for (const header of IP_HEADERS) {
    const value = req.headers[header];
    if (value) {
      // Handle comma-separated values (e.g., X-Forwarded-For)
      return typeof value === 'string' ? value.split(',')[0].trim() : value;
    }
  }

  // Fallback to direct connection
  return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

// Session token generation
export function generateSessionToken(): string {
  return generateSecureToken(TOKEN_LENGTH.SESSION);
}

// Cookie options for production
export function getAuthCookieOptions(isDevelopment: boolean = false) {
  return {
    httpOnly: AUTH_COOKIE_CONFIG.HTTP_ONLY,
    secure: !isDevelopment && AUTH_COOKIE_CONFIG.SECURE_IN_PRODUCTION,
    sameSite: AUTH_COOKIE_CONFIG.SAME_SITE,
    path: AUTH_COOKIE_CONFIG.PATH,
    maxAge: AUTH_COOKIE_CONFIG.MAX_AGE_SECONDS,
  };
}

// Re-export AuthEventType from constants
export { type AuthEventType } from '@/lib/constants';

// Authentication event metadata interface
export interface AuthEventMetadata {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  reason?: string;
  attemptNumber?: number;
  lockoutUntil?: Date;
  email?: string;
  role?: string;
  provider?: string; // e.g., 'credentials', 'google'
  errorCode?: string;
  [key: string]: any; // Allow additional metadata
}

/**
 * Log authentication events for audit purposes
 * Maps authentication events to financial operations for unified audit logging
 */
export async function logAuthEvent(
  userId: string,
  eventType: AuthEventType,
  metadata: AuthEventMetadata = {},
): Promise<void> {
  try {
    // Map auth events to appropriate financial operations for audit logging
    // Since FinancialOperation enum doesn't have auth-specific values,
    // we'll use COMPLIANCE_DATA_ACCESS for auth events and store the actual event type in metadata
    const operationType = FinancialOperation.COMPLIANCE_DATA_ACCESS;

    // Prepare audit data
    const auditData = {
      userId,
      operationType,
      resourceType: 'AUTH_EVENT',
      resourceId: userId, // User ID as resource for auth events
      currentData: {
        eventType,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      success: !eventType.includes('FAILED') && !eventType.includes('LOCKED'),
      errorMessage: metadata.reason || metadata.errorCode || null,
    };

    // Prepare context
    const context = {
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      sessionId: metadata.sessionId,
    };

    // Create audit log entry
    await createAuditLog(auditData, context);

    // Log critical security events to console in production
    if (CRITICAL_AUTH_EVENTS.includes(eventType as any) && process.env.NODE_ENV === 'production') {
      console.warn(`[SECURITY] Auth Event: ${eventType}`, {
        userId,
        ipAddress: metadata.ipAddress,
        timestamp: new Date().toISOString(),
        reason: metadata.reason,
      });
    }

    // Send alerts for critical events if enabled
    if (process.env.ENABLE_SECURITY_ALERTS === 'true') {
      const shouldAlert =
        ALERT_AUTH_EVENTS.includes(eventType as any) &&
        metadata.attemptNumber &&
        metadata.attemptNumber >= LOCKOUT_THRESHOLDS.ATTEMPTS_BEFORE_LOCKOUT - 2;

      if (shouldAlert) {
        // In production, this would trigger an alert to security team
        logger.error(`[ALERT] Critical Auth Event: ${eventType} for user ${userId}`);
      }
    }
  } catch (error) {
    // Log error but don't throw - audit logging should not break authentication flow
    console.error('Failed to log auth event:', {
      userId,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
