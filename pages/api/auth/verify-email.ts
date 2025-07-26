import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getClientIP } from '../../../lib/auth/auth-utils';
import { verifyEmailSchema, validateInput } from '../../../lib/auth/validation';
import { emailVerificationRateLimiter } from '../../../lib/auth/rate-limiter';
import { sendWelcomeEmail } from '../../../lib/email';
import { AuthEvent } from '@prisma/client';
import { logAuthEvent } from '../../../lib/auth';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }

  // Apply rate limiting
  const rateLimitOk = await emailVerificationRateLimiter(req, res);
  if (!rateLimitOk) return;

  const startTime = Date.now();
  const clientIp = getClientIP(req);

  try {
    // Validate input
    const validation = validateInput(verifyEmailSchema, req.body);
    if (!validation.success) {
      return apiResponse.error(res, {
        error: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { token } = validation.data;

    // Find user with valid verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(), // Token must not be expired
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      },
    });

    if (!user) {
      // Log failed attempt
      await prisma.auditLog.create({
        data: {
          event: AuthEvent.EMAIL_VERIFICATION,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: false,
          metadata: {
            reason: 'Invalid or expired token',
            token: token.substring(0, 8) + '...', // Log partial token for debugging
          },
        },
      });

      return apiResponse.error(res, {
        error: 'Invalid or expired token',
        message: 'This verification link is invalid or has expired. Please request a new one.',
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      // Clean up token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });

      return apiResponse.success(res, {
        message: 'Email already verified',
        alreadyVerified: true,
      });
    }

    // Update user as verified in transaction
    await prisma.$transaction(async (tx) => {
      // Update user
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          emailVerificationToken: null,
          emailVerificationExpires: null,
          // Clear any lockouts on verification
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Log successful verification
      await tx.auditLog.create({
        data: {
          event: AuthEvent.EMAIL_VERIFICATION,
          userId: user.id,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || '',
          success: true,
          metadata: {
            email: user.email,
          },
        },
      });
    });

    // Send welcome email (outside transaction)
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      logger.error('[VerifyEmail] Failed to send welcome email:', emailError);
      // Don't fail verification if welcome email fails
    }

    const duration = Date.now() - startTime;
    console.log('[VerifyEmail] Email verified successfully:', {
      userId: user.id,
      email: user.email,
      duration: `${duration}ms`,
      ip: clientIp,
    });

    // Return success response
    return apiResponse.success(res, {
      message: 'Email verified successfully! You can now access all features.',
      success: true,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Log error
    console.error('[VerifyEmail] Email verification error:', {
      error: error.message,
      code: error.code,
      duration: `${duration}ms`,
      ip: clientIp,
    });

    // Generic error response
    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
}

// Resend verification email endpoint
export async function resendVerificationEmail(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return apiResponse.error(res, { message: 'Email is required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists
      return apiResponse.success(res, {
        message: 'If an account exists with this email, a verification email will be sent.',
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return apiResponse.success(res, {
        message: 'Email is already verified',
        alreadyVerified: true,
      });
    }

    // Check for recent verification emails (rate limiting)
    const recentTokens = await prisma.verificationToken.count({
      where: {
        identifier: email,
        expires: { gt: new Date() },
        token: { not: { startsWith: 'reset_' } },
      },
    });

    if (recentTokens >= 3) {
      await logAuthEvent({
        event: 'EMAIL_VERIFICATION',
        userId: user.id,
        success: false,
        metadata: { reason: 'Too many verification attempts' },
        req,
      });
      return apiResponse.rateLimitExceeded(res, {
        message: 'Too many verification emails requested. Please try again later.',
      });
    }

    // Create new verification token
    const { createVerificationToken } = await import('../../../lib/auth');
    const newToken = await createVerificationToken(email);

    // Send verification email
    const { sendVerificationEmail } = await import('../../../lib/email');
    await sendVerificationEmail(email, user.name, newToken);

    // Log resend attempt
    await logAuthEvent({
      event: 'EMAIL_VERIFICATION',
      userId: user.id,
      success: true,
      metadata: { action: 'resend' },
      req,
    });

    apiResponse.success(res, {
      message: 'Verification email sent successfully',
      success: true,
    });
  } catch (error) {
    logger.error('Resend verification error:', error);
    apiResponse.internalError(res, { message: 'An error occurred sending verification email' });
  }
}
