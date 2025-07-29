import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import crypto from 'crypto';
import {
  withValidation,
  validateMethod,
  composeMiddleware,
} from '../../../lib/middleware/validation';
import { authSchemas } from '../../../lib/validation/api-schemas';
import { logger } from '@/lib/logger';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { AuthEvent } from '@prisma/client';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/security/rateLimiter';
import { addSecurityHeaders } from '../../../lib/security/sanitizer';
import { apiResponse } from '@/lib/api/response';
import { EmailService } from '../../../lib/email';

// Constants
const RESET_TOKEN_LENGTH = 32;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const RESET_TOKEN_HASH_ALGORITHM = 'sha256';
const MAX_ACTIVE_RESET_TOKENS = 1; // Only allow one active reset token per user

// Generate secure reset token
function generateResetToken(): { token: string; hashedToken: string } {
  const token = crypto.randomBytes(RESET_TOKEN_LENGTH).toString('hex');
  const hashedToken = crypto
    .createHash(RESET_TOKEN_HASH_ALGORITHM)
    .update(token)
    .digest('hex');
  
  return { token, hashedToken };
}

// Send password reset email
async function sendPasswordResetEmail(
  email: string, 
  token: string, 
  userName: string
): Promise<boolean> {
  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;
  const expiryTime = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  
  return EmailService.sendEmail({
    to: email,
    subject: 'Reset Your Password - TAAXDOG',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .button { 
              display: inline-block; 
              background-color: #4F46E5; 
              color: white; 
              padding: 12px 30px; 
              text-decoration: none; 
              border-radius: 5px; 
              margin: 20px 0;
            }
            .footer { font-size: 12px; color: #666; margin-top: 30px; }
            .warning { color: #e74c3c; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              
              <p>We received a request to reset your password for your TAAXDOG account. 
              If you didn't make this request, you can safely ignore this email.</p>
              
              <p>To reset your password, click the button below:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #eee; padding: 10px;">
                ${resetUrl}
              </p>
              
              <p class="warning">This link will expire at ${expiryTime.toLocaleString()} 
              (${RESET_TOKEN_EXPIRY_HOURS} hour from now).</p>
              
              <div class="footer">
                <p><strong>Security Tips:</strong></p>
                <ul>
                  <li>Never share your password with anyone</li>
                  <li>TAAXDOG will never ask for your password via email</li>
                  <li>Always check the URL starts with ${process.env.NEXTAUTH_URL}</li>
                </ul>
                
                <p>If you're having trouble, please contact our support team.</p>
                
                <p>Best regards,<br>The TAAXDOG Team</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${userName},

We received a request to reset your password for your TAAXDOG account.

To reset your password, visit this link:
${resetUrl}

This link will expire at ${expiryTime.toLocaleString()} (${RESET_TOKEN_EXPIRY_HOURS} hour from now).

If you didn't request this password reset, you can safely ignore this email.

Security Tips:
- Never share your password with anyone
- TAAXDOG will never ask for your password via email
- Always check the URL starts with ${process.env.NEXTAUTH_URL}

Best regards,
The TAAXDOG Team
    `,
  });
}

async function forgotPasswordHandler(req: NextApiRequest, res: NextApiResponse) {
  // Add security headers
  addSecurityHeaders(res);

  const requestId = (req as any).requestId;
  const clientIp = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const startTime = Date.now();

  logger.info('Password reset request received', {
    requestId,
    clientIp,
    userAgent,
  });

  try {
    // Extract and normalize email
    const email = req.body.email.toLowerCase().trim();

    // Always return the same response to prevent email enumeration
    const successResponse = {
      message: 'If an account exists with this email, you will receive password reset instructions.',
    };

    // Use transaction for atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // Find user with lock to prevent race conditions
      const user = await tx.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
          lockedUntil: true,
          passwordResetExpires: true,
        },
      });

      if (!user) {
        // Log attempt for non-existent email (security monitoring)
        await tx.auditLog.create({
          data: {
            event: AuthEvent.PASSWORD_RESET,
            userId: 'unknown',
            ipAddress: clientIp,
            userAgent,
            success: false,
            metadata: { 
              email, 
              reason: 'User not found',
              requestId,
            },
          },
        });

        logger.info('Password reset requested for non-existent email', {
          email,
          clientIp,
          requestId,
        });

        return { found: false };
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
          email,
          clientIp,
          requestId,
        });

        return { found: false };
      }

      // Check if there's an active reset token
      if (user.passwordResetExpires && user.passwordResetExpires > new Date()) {
        const remainingMinutes = Math.floor(
          (user.passwordResetExpires.getTime() - Date.now()) / (1000 * 60)
        );

        logger.info('Active reset token exists', {
          userId: user.id,
          remainingMinutes,
          requestId,
        });

        // Don't generate a new token if one is still valid
        return { 
          found: true, 
          skipped: true, 
          reason: 'Active token exists',
          remainingMinutes,
        };
      }

      // Generate new reset token
      const { token, hashedToken } = generateResetToken();
      const resetExpires = new Date();
      resetExpires.setHours(resetExpires.getHours() + RESET_TOKEN_EXPIRY_HOURS);

      // Update user with hashed token
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashedToken,
          passwordResetExpires: resetExpires,
        },
      });

      // Log successful token generation
      await tx.auditLog.create({
        data: {
          event: AuthEvent.PASSWORD_RESET,
          userId: user.id,
          ipAddress: clientIp,
          userAgent,
          success: true,
          metadata: { 
            expiresAt: resetExpires.toISOString(),
            duration: Date.now() - startTime,
            requestId,
            emailSent: false, // Will update after email
          },
        },
      });

      logger.info('Password reset token generated', {
        userId: user.id,
        email: user.email,
        expiresAt: resetExpires.toISOString(),
        requestId,
      });

      return { 
        found: true, 
        user: { 
          email: user.email, 
          name: user.name || 'User',
          id: user.id,
        }, 
        token,
        resetExpires,
      };
    });

    // Send email only if user was found and token was generated
    if (result.found && !result.skipped && result.user && result.token) {
      // Send email asynchronously
      setImmediate(async () => {
        try {
          await sendPasswordResetEmail(
            result.user!.email, 
            result.token!, 
            result.user!.name
          );

          // Update audit log to indicate email sent
          await prisma.auditLog.updateMany({
            where: {
              userId: result.user!.id,
              event: AuthEvent.PASSWORD_RESET,
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
                expiresAt: result.resetExpires!.toISOString(),
              },
            },
          });

          logger.info('Password reset email sent', {
            userId: result.user!.id,
            email: result.user!.email,
            requestId,
          });
        } catch (emailError) {
          logger.error('Failed to send password reset email', {
            userId: result.user!.id,
            email: result.user!.email,
            error: emailError,
            requestId,
          });
        }
      });
    } else if (result.skipped) {
      logger.info('Skipped token generation - active token exists', {
        reason: result.reason,
        remainingMinutes: result.remainingMinutes,
        requestId,
      });
    }

    // Always return success to prevent email enumeration
    return apiResponse.success(res, successResponse);

  } catch (error: any) {
    logger.error('Forgot password error', {
      error: error.message,
      stack: error.stack,
      clientIp,
      requestId,
    });

    // Generic error response
    return apiResponse.internalError(
      res,
      error,
      'An unexpected error occurred. Please try again later.'
    );
  }
}

// Enhanced rate limiter for password reset
const passwordResetRateLimiter = {
  ...RATE_LIMIT_CONFIGS.auth.passwordReset,
  keyGenerator: (req: NextApiRequest) => {
    const ip = getClientIP(req) || 'unknown';
    const email = req.body?.email?.toLowerCase() || 'unknown';
    // Rate limit by both IP and email to prevent abuse
    return [
      `password-reset:ip:${ip}`,
      `password-reset:email:${email}`,
      `password-reset:global`, // Global rate limit to prevent system abuse
    ];
  },
  limits: [
    { windowMs: 15 * 60 * 1000, max: 3 }, // 3 requests per 15 minutes per IP/email
    { windowMs: 60 * 60 * 1000, max: 5 }, // 5 requests per hour per IP/email
    { windowMs: 24 * 60 * 60 * 1000, max: 10 }, // 10 requests per day per IP/email
  ],
  message: 'Too many password reset attempts. Please try again later.',
  handler: async (req: NextApiRequest, res: NextApiResponse) => {
    const ip = getClientIP(req);
    const email = req.body?.email;
    
    logger.warn('Password reset rate limit exceeded', {
      ip,
      email,
      userAgent: req.headers['user-agent'],
      requestId: (req as any).requestId,
    });
    
    // Log security event for rate limit violation
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.PASSWORD_RESET,
        userId: 'rate-limited',
        ipAddress: ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        success: false,
        metadata: { 
          reason: 'Rate limit exceeded',
          email,
          timestamp: new Date().toISOString(),
        },
      },
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
    body: authSchemas.forgotPassword.body,
    response: authSchemas.forgotPassword.response,
  }),
  withRateLimit(passwordResetRateLimiter),
)(forgotPasswordHandler);
