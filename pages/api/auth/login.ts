import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { withApiMonitoring } from '../../../lib/monitoring';
import {
  verifyPassword,
  generateJWT,
  sanitizeUser,
  getClientIP,
  getAuthCookieOptions,
  isAccountLocked,
  calculateLockoutDuration,
  generateSessionToken,
} from '../../../lib/auth/auth-utils';
import { AuthEvent } from '@prisma/client';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { authSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '../../../lib/utils/logger';
import { apiResponse } from '../../../lib/api/response';

async function loginHandler(req: NextApiRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const startTime = Date.now();
  const clientIp = getClientIP(req);
  const requestId = (req as any).requestId;

  try {
    // Input is already validated by middleware
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        emailVerified: true,
        role: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || !user.password) {
      // Don't reveal if user exists
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Prevent timing attacks
      logger.warn('Login attempt for non-existent user', { email, clientIp, requestId });
      return apiResponse.unauthorized(res, 'Invalid email or password');
    }

    // Check if account is locked
    if (isAccountLocked(user)) {
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.LOGIN,
          userId: user.id,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: { reason: 'Account locked' },
        },
      });

      const remainingTime = user.lockedUntil
        ? Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000 / 60)
        : 0;

      logger.warn('Login attempt on locked account', { userId: user.id, clientIp, requestId });
      return apiResponse.forbidden(
        res,
        `Too many failed login attempts. Account locked for ${remainingTime} minutes.`
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      // Increment failed attempts
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updateData: any = { failedLoginAttempts: failedAttempts };

      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        const lockoutDuration = calculateLockoutDuration(failedAttempts);
        updateData.lockedUntil = new Date(Date.now() + lockoutDuration);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      await prisma.auditLog.create({
        data: {
          event: AuthEvent.LOGIN,
          userId: user.id,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: { reason: 'Invalid password', failedAttempts },
        },
      });

      logger.warn('Failed login attempt', { userId: user.id, failedAttempts, clientIp, requestId });
      return apiResponse.unauthorized(res, 'Invalid email or password');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.LOGIN,
          userId: user.id,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: { reason: 'Email not verified' },
        },
      });

      logger.warn('Login attempt with unverified email', { userId: user.id, clientIp, requestId });
      return apiResponse.forbidden(res, 'Please verify your email before logging in');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA
      const tempToken = generateSessionToken();

      // Store temp token in cache or session
      await prisma.session.create({
        data: {
          sessionToken: tempToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          metadata: { type: '2fa_pending' },
        },
      });

      return apiResponse.success(res, {
        requiresTwoFactor: true,
        tempToken,
        message: 'Please enter your 2FA code',
      });
    }

    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT
    const token = generateJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Create session
    const sessionToken = generateSessionToken();
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
      },
    });

    // Log successful login
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.LOGIN,
        userId: user.id,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: { duration: Date.now() - startTime },
      },
    });

    // Set cookies
    const cookieOptions = getAuthCookieOptions();
    res.setHeader('Set-Cookie', [
      `authToken=${token}; ${Object.entries(cookieOptions)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')}`,
      `sessionToken=${sessionToken}; ${Object.entries(cookieOptions)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')}`,
    ]);

    logger.info('Successful login', {
      userId: user.id,
      duration: Date.now() - startTime,
      requestId,
    });

    return apiResponse.success(res, {
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    logger.error('Login error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientIp,
      requestId,
    });

    return apiResponse.internalError(res, error, 'An error occurred during login. Please try again.');
  }
}

// Export with validation, rate limiting and monitoring
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation({
    body: authSchemas.login.body,
    response: authSchemas.login.response,
  }),
  withRateLimit({
    ...RATE_LIMIT_CONFIGS.auth.login,
    keyGenerator: (req) => {
      // Use IP address for rate limiting login attempts
      const ip = getClientIP(req) || 'unknown';
      // Also consider email if provided for more granular limiting
      const email = req.body?.email?.toLowerCase();
      return email ? `login:${ip}:${email}` : `login:${ip}`;
    },
    message: 'Too many login attempts. Please try again in 15 minutes.',
  }),
  withApiMonitoring,
)(loginHandler);
