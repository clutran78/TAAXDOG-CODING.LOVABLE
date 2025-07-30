import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { AuthEvent } from '@prisma/client';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { apiResponse, ApiError, ApiErrorCode } from '@/lib/api/response';
import { commonSchemas } from '../../../lib/middleware/validation';
import { EmailService } from '../../../lib/email';

interface ExtendedNextApiRequest extends NextApiRequest {
  requestId?: string;
}

// Constants
const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_HASH_ALGORITHM = 'sha256';

// Validation schema for reset password
const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Reset token is required').regex(/^[a-f0-9]{64}$/, 'Invalid token format'),
    password: commonSchemas.password,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),
  response: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: z.any().optional(),
  }),
};

async function resetPasswordHandler(req: ExtendedNextApiRequest, res: NextApiResponse): Promise<void> {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = req.requestId;
  const clientIp = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const startTime = Date.now();

  logger.info('Password reset attempt', {
    requestId,
    clientIp,
    userAgent,
    tokenPrefix: req.body?.token ? String(req.body.token).substring(0, 8) : undefined,
    tokenLength: req.body?.token ? String(req.body.token).length : 0,
  });

  try {
    const { token, password } = req.body;

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto
      .createHash(RESET_TOKEN_HASH_ALGORITHM)
      .update(token)
      .digest('hex');

    logger.debug('Token hashing', {
      requestId,
      originalTokenPrefix: token.substring(0, 8),
      originalTokenLength: token.length,
      hashedTokenPrefix: hashedToken.substring(0, 8),
      hashedTokenLength: hashedToken.length,
      hashAlgorithm: RESET_TOKEN_HASH_ALGORITHM,
    });

    // Use transaction for atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // Find user with valid reset token
      const user = await tx.user.findFirst({
        where: {
          passwordResetToken: hashedToken,
          passwordResetExpires: {
            gt: new Date(), // Token must not be expired
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          lockedUntil: true,
          failedLoginAttempts: true,
          passwordResetExpires: true,
        },
      });

      if (!user) {
        // Check if token exists but is expired
        const expiredUser = await tx.user.findFirst({
          where: { passwordResetToken: hashedToken },
          select: { id: true, passwordResetExpires: true },
        });

        // Also check if there's any user with a reset token (for debugging)
        const anyUserWithToken = await tx.user.findFirst({
          where: { 
            passwordResetToken: { not: null },
            passwordResetExpires: { gt: new Date() }
          },
          select: { 
            id: true, 
            passwordResetToken: true,
            passwordResetExpires: true 
          },
        });

        if (anyUserWithToken) {
          logger.debug('Debug: Found user with active token', {
            requestId,
            storedTokenPrefix: anyUserWithToken.passwordResetToken?.substring(0, 8),
            expectedTokenPrefix: hashedToken.substring(0, 8),
            tokenMatch: anyUserWithToken.passwordResetToken === hashedToken,
            expiresAt: anyUserWithToken.passwordResetExpires,
          });
        }

        // Log failed attempt only if we have a user ID
        if (expiredUser?.id) {
          await tx.auditLog.create({
            data: {
              event: AuthEvent.PASSWORD_RESET,
              userId: expiredUser.id,
              ipAddress: clientIp,
              userAgent,
              success: false,
              metadata: { 
                reason: 'Token expired',
                requestId,
              },
            },
          });
        }

        logger.warn('Password reset attempted with invalid/expired token', {
          clientIp,
          requestId,
          expired: !!expiredUser,
        });

        return { success: false, reason: expiredUser ? 'expired_token' : 'invalid_token' };
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await tx.auditLog.create({
          data: {
            event: AuthEvent.PASSWORD_RESET,
            userId: user.id,
            ipAddress: clientIp,
            userAgent,
            success: false,
            metadata: { 
              reason: 'Account locked',
              lockedUntil: user.lockedUntil.toISOString(),
              requestId,
            },
          },
        });

        logger.warn('Password reset attempted on locked account', {
          userId: user.id,
          email: user.email,
          clientIp,
          requestId,
        });

        return { success: false, reason: 'account_locked' };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Update user password and clear reset token
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          // Clear any failed login attempts
          failedLoginAttempts: 0,
          lockedUntil: null,
          // Update security timestamp
          updatedAt: new Date(),
        },
      });

      // Log successful password reset
      await tx.auditLog.create({
        data: {
          event: AuthEvent.PASSWORD_RESET,
          userId: user.id,
          ipAddress: clientIp,
          userAgent,
          success: true,
          metadata: { 
            duration: Date.now() - startTime,
            requestId,
            method: 'token',
          },
        },
      });

      // Invalidate all existing sessions for this user
      await tx.session.deleteMany({
        where: { userId: user.id },
      });

      logger.info('Password reset successful', {
        userId: user.id,
        email: user.email,
        duration: Date.now() - startTime,
        requestId,
      });

      return { 
        success: true, 
        user: { 
          id: user.id, 
          email: user.email,
          name: user.name || 'User',
        },
      };
    });

    if (!result.success) {
      if (result.reason === 'invalid_token') {
        return apiResponse.badRequest(
          res,
          'Invalid reset token. Please request a new password reset.'
        );
      } else if (result.reason === 'expired_token') {
        return apiResponse.badRequest(
          res,
          'Reset token has expired. Please request a new password reset.'
        );
      } else if (result.reason === 'account_locked') {
        return apiResponse.forbidden(
          res,
          'Your account is temporarily locked. Please try again later.'
        );
      }
    }

    // Send confirmation email (non-blocking)
    if (result.user) {
      setImmediate(async () => {
        try {
          await EmailService.sendEmail({
            to: result.user!.email,
            subject: 'Password Changed Successfully - TAAXDOG',
            html: `
              <!DOCTYPE html>
              <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center;">
                      <h1>Password Changed</h1>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 30px;">
                      <p>Hi ${result.user!.name},</p>
                      <p>Your password has been successfully changed.</p>
                      <p>If you did not make this change, please contact our support team immediately.</p>
                      
                      <div style="background-color: #fff; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5;">
                        <p><strong>Security Information:</strong></p>
                        <ul style="list-style: none; padding: 0;">
                          <li>📅 Changed on: ${new Date().toLocaleString()}</li>
                          <li>🌐 IP Address: ${clientIp}</li>
                          <li>💻 Device: ${userAgent.split(' ')[0] || 'Unknown'}</li>
                        </ul>
                      </div>
                      
                      <p style="color: #e74c3c; font-weight: bold;">
                        ⚠️ All your active sessions have been logged out for security.
                      </p>
                      
                      <div style="font-size: 12px; color: #666; margin-top: 30px;">
                        <p>Best regards,<br>The TAAXDOG Team</p>
                        <p>This is an automated security notification. Please do not reply to this email.</p>
                      </div>
                    </div>
                  </div>
                </body>
              </html>
            `,
            text: `Hi ${result.user!.name},\n\nYour password has been successfully changed.\n\nSecurity Information:\n- Changed on: ${new Date().toLocaleString()}\n- IP Address: ${clientIp}\n- Device: ${userAgent.split(' ')[0] || 'Unknown'}\n\nAll your active sessions have been logged out for security.\n\nIf you did not make this change, please contact our support team immediately.\n\nBest regards,\nThe TAAXDOG Team`,
          });

          logger.info('Password change confirmation email sent', {
            userId: result.user!.id,
            email: result.user!.email,
            requestId,
          });
        } catch (emailError) {
          logger.error('Failed to send password change confirmation email', {
            userId: result.user!.id,
            email: result.user!.email,
            error: emailError,
            requestId,
          });
        }
      });
    }

    return apiResponse.success(res, null, {
      message: 'Password has been reset successfully. You can now login with your new password.',
    });

  } catch (error: any) {
    logger.error('Password reset error', {
      error: error.message,
      stack: error.stack,
      clientIp,
      requestId,
    });

    // Check for specific database errors
    if (error.code === 'P2025') {
      return apiResponse.badRequest(res, 'Invalid reset request');
    }

    return apiResponse.error(
      res,
      new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        'An error occurred while resetting your password. Please try again.',
        500,
        error
      ),
      { requestId }
    );
  }
}

// Enhanced rate limiter for password reset
const resetPasswordRateLimiter = {
  ...RATE_LIMIT_CONFIGS.auth.passwordReset,
  keyGenerator: (req: NextApiRequest) => {
    const ip = getClientIP(req) || 'unknown';
    // Don't access req.body here as it might not be parsed yet
    // Just use IP-based rate limiting for password reset
    return `reset-password:ip:${ip}`;
  },
  limits: [
    { windowMs: 5 * 60 * 1000, max: 5 }, // 5 attempts per 5 minutes
    { windowMs: 60 * 60 * 1000, max: 10 }, // 10 attempts per hour
  ],
  message: 'Too many password reset attempts. Please try again later.',
  handler: async (req: ExtendedNextApiRequest, res: NextApiResponse): Promise<void> => {
    const ip = getClientIP(req);
    
    logger.warn('Password reset rate limit exceeded', {
      ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
    });
    
    return apiResponse.tooManyRequests(
      res,
      'Too many password reset attempts. Please try again later.'
    );
  },
};

// Export with validation, rate limiting and monitoring
export default composeMiddleware(
  validateMethod(['POST']),
  withValidation({
    body: resetPasswordSchema.body,
    response: resetPasswordSchema.response,
  }),
  withRateLimit(resetPasswordRateLimiter),
)(resetPasswordHandler);
