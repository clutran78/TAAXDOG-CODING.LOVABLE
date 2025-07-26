import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import crypto from 'crypto';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { authSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '../../../lib/utils/logger';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { AuthEvent } from '@prisma/client';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { apiResponse } from '@/lib/api/response';

async function forgotPasswordHandler(req: NextApiRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const clientIp = getClientIP(req);

  try {
    // Input is already validated by middleware
    const { email } = req.body;

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message:
        'If an account exists with this email, you will receive password reset instructions.',
    };

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      logger.info('Password reset requested for non-existent email', {
        email,
        clientIp,
        requestId,
      });

      // Still log the attempt for security monitoring
      await prisma.auditLog.create({
        data: {
          event: 'PASSWORD_RESET_REQUEST' as AuthEvent,
          userId: 'unknown',
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: { email, reason: 'User not found' },
        },
      });

      return apiResponse.success(res, successResponse);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetToken,
        resetTokenExpiry: resetExpires,
      },
    });

    // Log the password reset request
    await prisma.auditLog.create({
      data: {
        event: 'PASSWORD_RESET_REQUEST' as AuthEvent,
        userId: user.id,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || '',
        success: true,
        metadata: { expiresAt: resetExpires.toISOString() },
      },
    });

    logger.info('Password reset token generated', {
      userId: user.id,
      email: user.email,
      clientIp,
      requestId,
    });

    // TODO: Send password reset email
    // await sendPasswordResetEmail(user.email, resetToken);

    return apiResponse.success(res, successResponse);
  } catch (error: any) {
    logger.error('Forgot password error', {
      error: error.message,
      clientIp,
      requestId,
    });

    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
      requestId,
    });
  }
}

// Export with validation, rate limiting and monitoring
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation({
    body: authSchemas.forgotPassword.body,
    response: authSchemas.forgotPassword.response,
  }),
  withRateLimit({
    ...RATE_LIMIT_CONFIGS.auth.passwordReset,
    keyGenerator: (req) => {
      const ip = getClientIP(req) || 'unknown';
      const email = req.body?.email?.toLowerCase();
      return email ? `forgot-password:${ip}:${email}` : `forgot-password:${ip}`;
    },
    message: 'Too many password reset attempts. Please try again later.',
  }),
)(forgotPasswordHandler);
