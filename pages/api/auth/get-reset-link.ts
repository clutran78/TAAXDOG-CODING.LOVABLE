import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { createPasswordResetToken } from '../../../lib/auth';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development or with a secret key
  if (process.env.NODE_ENV === 'production' && !req.headers['x-admin-key']) {
    return apiResponse.forbidden(res, { error: 'Forbidden in production' });
  }

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
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return apiResponse.notFound(res, { message: 'User not found' });
    }

    // Generate reset token
    const resetToken = await createPasswordResetToken(user.email);
    const resetUrl = `${process.env.NEXTAUTH_URL || 'https://dev.taxreturnpro.com.au'}/auth/reset-password?token=${resetToken}`;

    logger.info(`[GetResetLink] Generated reset link for ${email}`);

    return apiResponse.success(res, {
      message: 'Reset link generated',
      resetUrl,
      expiresIn: '1 hour',
      note: 'This is a temporary endpoint for debugging. Copy the link and use it to reset your password.',
    });
  } catch (error: any) {
    logger.error('[GetResetLink] Error:', error);
    return apiResponse.internalError(res, {
      message: 'An error occurred',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
