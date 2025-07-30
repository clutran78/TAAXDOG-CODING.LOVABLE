import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../../../lib/services/email/email';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Constants matching the reset-password endpoint
const RESET_TOKEN_LENGTH = 32;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const RESET_TOKEN_HASH_ALGORITHM = 'sha256';

// Generate secure reset token
function generateResetToken(): { token: string; hashedToken: string } {
  const token = crypto.randomBytes(RESET_TOKEN_LENGTH).toString('hex');
  const hashedToken = crypto
    .createHash(RESET_TOKEN_HASH_ALGORITHM)
    .update(token)
    .digest('hex');
  
  return { token, hashedToken };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return apiResponse.error(res, { message: 'Email is required' });
    }

    // Always return success to prevent email enumeration
    const successMessage =
      'If an account exists with this email, you will receive password reset instructions.';

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        passwordResetExpires: true,
      },
    });

    if (!user) {
      // Don't reveal if user exists
      return apiResponse.success(res, { message: successMessage });
    }

    // Check if there's an active reset token
    if (user.passwordResetExpires && user.passwordResetExpires > new Date()) {
      logger.info('Active reset token exists, skipping generation', {
        email: user.email,
        expiresAt: user.passwordResetExpires,
      });
      return apiResponse.success(res, { message: successMessage });
    }

    // For testing, we'll skip email verification check
    // In production, uncomment this:
    // if (!user.emailVerified) {
    //   return apiResponse.success(res, { message: successMessage });
    // }

    // Generate reset token using SHA256 to match reset-password endpoint
    const { token, hashedToken } = generateResetToken();
    const resetExpires = new Date();
    resetExpires.setHours(resetExpires.getHours() + RESET_TOKEN_EXPIRY_HOURS);

    // Update user with hashed token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: resetExpires,
      },
    });

    logger.info(`✅ Password reset token generated for: ${user.email}`);

    // Try to send email (use the unhashed token)
    try {
      await sendPasswordResetEmail(user.email, user.name, token);
      logger.info('[ForgotPassword] ✅ Reset email sent successfully to:', user.email);
    } catch (emailError: any) {
      console.error('[ForgotPassword] ❌ Failed to send email:', {
        error: emailError.message,
        code: emailError.code,
        response: emailError.response?.body,
        to: user.email,
        stack: emailError.stack,
      });

      // In production, we still return success to prevent email enumeration
      // but log the full error for debugging
      if (process.env.NODE_ENV === 'development') {
        return apiResponse.internalError(res, {
          message: 'Failed to send reset email',
          error: emailError.message,
        });
      }
    }

    const baseUrl =
      process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://taxreturnpro.com.au';

    return apiResponse.success(res, {
      message: successMessage,
      // Include token in development for testing
      debug:
        process.env.NODE_ENV === 'development'
          ? {
              resetToken: token,
              resetUrl: `${baseUrl}/auth/reset-password?token=${token}`,
            }
          : undefined,
    });
  } catch (error: any) {
    logger.error('[ForgotPassword] Error:', error);
    return apiResponse.internalError(res, {
      message: 'An error occurred processing your request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
