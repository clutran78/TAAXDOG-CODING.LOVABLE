import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { logger } from '@/lib/logger';
import {
  authOptions,
  validatePassword,
  hashPassword,
  logAuthEvent,
} from '../../../lib/auth';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { AuthEvent } from '@prisma/client';
import { sendPasswordChangeNotification } from '../../../lib/services/email/email';
import { apiResponse } from '@/lib/api/response';

// Security configuration
const PASSWORD_HISTORY_COUNT = 5; // Number of previous passwords to check

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return apiResponse.unauthorized(res, { message: 'Unauthorized' });
  }

  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return apiResponse.error(res, { message: 'Current password and new password are required' });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return apiResponse.error(res, {
        message: 'New password does not meet requirements',
        errors: passwordValidation.errors,
        score: passwordValidation.score,
      });
    }

    // Check minimum password score for existing users (higher security)
    if (passwordValidation.score < 7) {
      return apiResponse.error(res, {
        message: 'Password is not strong enough. Please use a more complex password.',
        score: passwordValidation.score,
        minScore: 7,
      });
    }

    // Get user with password and email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, password: true },
    });

    if (!user || !user.password) {
      await logAuthEvent({
        event: 'PASSWORD_CHANGE',
        userId: session.user.id,
        success: false,
        metadata: { reason: 'User not found or no password set' },
        req,
      });
      return apiResponse.error(res, { message: 'Cannot change password for this account' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      // Increment failed attempts for security
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });

      await logAuthEvent({
        event: 'PASSWORD_CHANGE',
        userId: session.user.id,
        success: false,
        metadata: { reason: 'Invalid current password' },
        req,
      });
      return apiResponse.error(res, { message: 'Current password is incorrect' });
    }

    // Check if new password is the same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res
        .status(400)
        .json({ message: 'New password must be different from current password' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear any failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Log successful password change
    await logAuthEvent({
      event: 'PASSWORD_CHANGE',
      userId: user.id,
      success: true,
      req,
    });

    // Send email notification about password change
    try {
      await sendPasswordChangeNotification(user.email, user.name, req);
    } catch (emailError) {
      logger.error('Failed to send password change notification:', emailError);
    }

    apiResponse.success(res, {
      message: 'Password changed successfully',
      success: true,
    });
  } catch (error) {
    logger.error('Password change error:', error);
    await logAuthEvent({
      event: 'PASSWORD_CHANGE',
      userId: session.user.id,
      success: false,
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      req,
    });
    apiResponse.internalError(res, { message: 'An error occurred while changing password' });
  }
}
