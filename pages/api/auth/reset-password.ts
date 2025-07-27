import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { verifyPasswordResetToken, resetPassword } from '../../../lib/auth';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(
    `[ResetPassword] Request received - Method: ${req.method}, Time: ${new Date().toISOString()}`,
  );

  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const { token, password } = req.body;
    logger.info(`[ResetPassword] Reset attempt with token: ${token?.substring(0, 10)}...`);

    if (!token || !password) {
      return apiResponse.error(res, {
        error: 'Missing required fields',
        message: 'Token and password are required',
      });
    }

    if (password.length < 8) {
      return apiResponse.error(res, {
        error: 'Invalid password',
        message: 'Password must be at least 8 characters long',
      });
    }

    // Use the new password reset token verification
    logger.info(`[ResetPassword] Verifying token...`);
    const resetToken = await verifyPasswordResetToken(token);

    if (!resetToken) {
      logger.info(`[ResetPassword] Invalid or expired token: ${token?.substring(0, 10)}...`);
      return apiResponse.error(res, {
        error: 'Invalid token',
        message: 'Password reset token is invalid or has expired',
      });
    }

    logger.info(`[ResetPassword] Token valid for email: ${resetToken.email}`);

    // Use the resetPassword function from auth.ts
    try {
      await resetPassword(token, password);
      logger.info(`[ResetPassword] ✅ Password reset successful for: ${resetToken.email}`);

      return apiResponse.success(res, {
        message: 'Password reset successful',
        success: true,
      });
    } catch (error: any) {
      logger.error(`[ResetPassword] Failed to reset password:`, error);
      return apiResponse.internalError(res, {
        error: 'Failed to reset password',
        message: error.message || 'Failed to reset password. Please try again.',
      });
    }
  } catch (error: any) {
    logger.error('❌ Reset password error:', error);
    return apiResponse.internalError(res, {
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
}
