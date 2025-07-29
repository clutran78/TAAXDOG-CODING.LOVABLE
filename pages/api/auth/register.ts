import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { authSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '@/lib/logger';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { AuthEvent } from '@prisma/client';
import { apiResponse } from '../../../lib/api/response';
import { Sanitizers } from '../../../lib/validation/input-validator';
import { sendVerificationEmail } from '../../../lib/email';

// Constants
const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFICATION_TOKEN_LENGTH = 32;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

async function registerHandler(req: NextApiRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const clientIp = getClientIP(req);
  const startTime = Date.now();
  const userAgent = req.headers['user-agent'] || '';

  // Log registration attempt
  logger.info('Registration attempt', {
    requestId,
    clientIp,
    email: req.body?.email,
    userAgent,
  });

  try {
    // Extract and sanitize inputs (already validated by middleware)
    const email = req.body.email.toLowerCase().trim();
    const password = req.body.password;
    const name = Sanitizers.sanitizeName(req.body.name);

    // Additional input validation
    if (!email || !password || !name) {
      return apiResponse.badRequest(res, 'Missing required fields');
    }

    // Transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Check if user already exists with proper locking
      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        // Log failed attempt for existing email
        await tx.auditLog.create({
          data: {
            event: AuthEvent.REGISTER,
            userId: existingUser.id,
            ipAddress: clientIp,
            userAgent,
            success: false,
            metadata: { 
              reason: 'Email already exists',
              requestId,
            },
          },
        });

        logger.warn('Registration attempt with existing email', {
          email,
          clientIp,
          requestId,
        });

        return { error: 'USER_EXISTS' };
      }

      // Generate secure password hash
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(EMAIL_VERIFICATION_TOKEN_LENGTH).toString('hex');
      const emailVerificationExpires = new Date();
      emailVerificationExpires.setHours(emailVerificationExpires.getHours() + EMAIL_VERIFICATION_EXPIRY_HOURS);

      // Create user with all required fields
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'USER',
          emailVerified: null,
          emailVerificationToken,
          emailVerificationExpires,
          // Security defaults
          failedLoginAttempts: 0,
          twoFactorEnabled: false,
          // Australian compliance defaults
          taxResidency: 'RESIDENT',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      // Create initial financial year record for data isolation
      const currentYear = new Date().getFullYear();
      const financialYear = new Date().getMonth() >= 6 ? currentYear : currentYear - 1;
      
      await tx.taxReturn.create({
        data: {
          userId: user.id,
          year: financialYear,
          status: 'NOT_STARTED',
          // Initialize with empty values for data isolation
          income: 0,
          deductions: 0,
          taxWithheld: 0,
          estimatedRefund: 0,
        },
      });

      // Log successful registration
      await tx.auditLog.create({
        data: {
          event: AuthEvent.REGISTER,
          userId: user.id,
          ipAddress: clientIp,
          userAgent,
          success: true,
          metadata: {
            duration: Date.now() - startTime,
            requestId,
            emailSent: false, // Will update after email
          },
        },
      });

      return { user, emailVerificationToken };
    });

    // Handle transaction result
    if ('error' in result) {
      return apiResponse.conflict(res, 'An account with this email already exists');
    }

    const { user, emailVerificationToken } = result;

    // Send verification email (non-blocking)
    setImmediate(async () => {
      try {
        await sendVerificationEmail(user.email, emailVerificationToken);
        
        // Update audit log to indicate email sent
        await prisma.auditLog.updateMany({
          where: {
            userId: user.id,
            event: AuthEvent.REGISTER,
            metadata: {
              path: ['requestId'],
              equals: requestId,
            },
          },
          data: {
            metadata: {
              emailSent: true,
              duration: Date.now() - startTime,
              requestId,
            },
          },
        });
      } catch (emailError) {
        logger.error('Failed to send verification email', {
          userId: user.id,
          email: user.email,
          error: emailError,
          requestId,
        });
      }
    });

    logger.info('User registered successfully', {
      userId: user.id,
      email: user.email,
      duration: Date.now() - startTime,
      requestId,
    });

    // Return success response
    return apiResponse.created(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      message: 'Registration successful. Please check your email to verify your account.',
    }, 'User registered successfully');

  } catch (error: any) {
    logger.error('Registration error', {
      error: error.message,
      code: error.code,
      stack: error.stack,
      clientIp,
      requestId,
    });

    // Handle specific database errors
    if (error.code === 'P2002') {
      return apiResponse.conflict(res, 'An account with this email already exists');
    }

    if (error.code === 'P2003') {
      return apiResponse.badRequest(res, 'Invalid data provided');
    }

    // Generic error response
    return apiResponse.error(
      res,
      error instanceof Error ? error : new Error('Registration failed'),
      {
        statusCode: 500,
        requestId,
      }
    );
  }
}

// Enhanced rate limiter for registration
const registrationRateLimiter = {
  ...RATE_LIMIT_CONFIGS.auth.register,
  keyGenerator: (req: NextApiRequest) => {
    // Use combination of IP and email for rate limiting
    const ip = getClientIP(req) || 'unknown';
    const email = req.body?.email?.toLowerCase() || 'unknown';
    // Rate limit by both IP and email to prevent abuse
    return [`register:ip:${ip}`, `register:email:${email}`];
  },
  message: 'Too many registration attempts. Please try again in 1 hour.',
  // Custom handler for rate limit errors
  handler: async (req: NextApiRequest, res: NextApiResponse) => {
    const ip = getClientIP(req);
    logger.warn('Registration rate limit exceeded', {
      ip,
      email: req.body?.email,
      userAgent: req.headers['user-agent'],
    });
    
    return apiResponse.tooManyRequests(
      res,
      'Too many registration attempts. Please try again in 1 hour.',
      3600, // 1 hour in seconds
      (req as any).requestId
    );
  },
};

// Export with validation, rate limiting and monitoring
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation({
    body: authSchemas.register.body,
    response: authSchemas.register.response,
  }),
  withRateLimit(registrationRateLimiter),
)(registerHandler);
