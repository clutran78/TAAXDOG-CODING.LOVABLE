import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { authSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '../../../lib/utils/logger';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { AuthEvent } from '@prisma/client';
import { apiResponse } from '../../../lib/api/response';

async function registerHandler(req: NextApiRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const clientIp = getClientIP(req);
  const startTime = Date.now();

  logger.info('Registration attempt', {
    requestId,
    clientIp,
    email: req.body?.email,
  });

  try {
    // Input is already validated by middleware
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      logger.warn('Registration attempt with existing email', { email, clientIp, requestId });

      // Log security event
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.REGISTER,
          userId: existingUser.id,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: { reason: 'Email already exists' },
        },
      });

      return apiResponse.error(res, 'An account with this email already exists', 409, undefined, 'USER_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        role: 'USER',
        emailVerified: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Log successful registration
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.REGISTER,
        userId: user.id,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: { duration: Date.now() - startTime },
      },
    });

    logger.info('User registered successfully', {
      userId: user.id,
      email: user.email,
      duration: Date.now() - startTime,
      requestId,
    });

    // TODO: Send verification email
    // await sendVerificationEmail(user.email, user.id);

    return apiResponse.created(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }, 'User registered successfully');
  } catch (error: any) {
    logger.error('Registration error', {
      error: error.message,
      code: error.code,
      clientIp,
      requestId,
    });

    // Check for specific Prisma errors
    if (error.code === 'P2002') {
      return apiResponse.error(res, 'An account with this email already exists', 409, undefined, 'USER_EXISTS');
    }

    return apiResponse.internalError(res, error, 'An error occurred during registration. Please try again.');
  }
}

// Export with validation, rate limiting and monitoring
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation({
    body: authSchemas.register.body,
    response: authSchemas.register.response,
  }),
  withRateLimit({
    ...RATE_LIMIT_CONFIGS.auth.register,
    keyGenerator: (req) => {
      // Use IP address for rate limiting registration
      const ip = getClientIP(req) || 'unknown';
      return `register:${ip}`;
    },
    message: 'Too many registration attempts. Please try again in 1 hour.',
  }),
)(registerHandler);
