import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { createPasswordResetToken } from '../../../lib/auth';
import { sendPasswordResetEmail } from '../../../lib/services/email/email';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

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
      },
    });

    if (!user) {
      // Don't reveal if user exists
      return apiResponse.success(res, { message: successMessage });
    }

    // For testing, we'll skip email verification check
    // In production, uncomment this:
    // if (!user.emailVerified) {
    //   return apiResponse.success(res, { message: successMessage });
    // }

    // Generate reset token
    const resetToken = await createPasswordResetToken(user.email);

    // Try to send email
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
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
              resetToken,
              resetUrl: `${baseUrl}/auth/reset-password?token=${resetToken}`,
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
