import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
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
import { loginSchema, validateInput } from '../../../lib/auth/validation';
import { authRateLimiter } from '../../../lib/auth/rate-limiter';
import { AuthEvent } from '../../../generated/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply rate limiting
  const rateLimitOk = await authRateLimiter(req, res);
  if (!rateLimitOk) return;

  const startTime = Date.now();
  const clientIp = getClientIP(req);

  try {
    // Validate input
    const validation = validateInput(loginSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { email, password } = validation.data;

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
      await new Promise(resolve => setTimeout(resolve, 1000)); // Prevent timing attacks
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
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

      return res.status(403).json({
        error: 'Account locked',
        message: 'Your account has been temporarily locked due to multiple failed login attempts. Please try again later.',
        lockedUntil: user.lockedUntil,
      });
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password);

    if (!passwordValid) {
      // Increment failed login attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const lockoutUntil = calculateLockoutDuration(failedAttempts);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil: lockoutUntil,
        },
      });

      // Log failed attempt
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.LOGIN,
          userId: user.id,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            reason: 'Invalid password',
            attempts: failedAttempts,
          },
        },
      });

      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
        remainingAttempts: lockoutUntil ? 0 : Math.max(0, 5 - failedAttempts),
      });
    }

    // Check if email is verified (only if email provider is configured)
    const { shouldRequireEmailVerification } = await import('../../../lib/auth/email-config');
    if (shouldRequireEmailVerification() && !user.emailVerified) {
      return res.status(403).json({
        error: 'Email not verified',
        message: 'Please verify your email address before logging in.',
        requiresVerification: true,
      });
    }

    // Reset failed login attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
      },
    });

    // Generate session token
    const sessionToken = generateSessionToken();

    // Create session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Generate JWT token
    const token = generateJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    // Set auth cookie
    const isDevelopment = process.env.NODE_ENV !== 'production';
    res.setHeader('Set-Cookie', [
      `auth-token=${token}; ${Object.entries(getAuthCookieOptions(isDevelopment))
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')}`,
      `session-token=${sessionToken}; ${Object.entries(getAuthCookieOptions(isDevelopment))
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')}`,
    ]);

    // Log successful login
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.LOGIN,
        userId: user.id,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: {
          sessionId: session.id,
          twoFactorRequired: user.twoFactorEnabled,
        },
      },
    });

    const duration = Date.now() - startTime;
    console.log('[Login] User logged in successfully:', {
      userId: user.id,
      email: user.email,
      duration: `${duration}ms`,
      ip: clientIp,
    });

    // Return success response
    return res.status(200).json({
      message: 'Login successful',
      user: sanitizeUser(user),
      requiresTwoFactor: user.twoFactorEnabled,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Log error
    console.error('[Login] Login failed:', {
      error: error.message,
      code: error.code,
      duration: `${duration}ms`,
      ip: clientIp,
      email: req.body.email,
    });

    // Generic error response
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
}