import type { NextApiRequest, NextApiResponse } from 'next';
import { signIn } from 'next-auth/react';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(
    `[SimpleLogin] Request received - Method: ${req.method}, Time: ${new Date().toISOString()}`,
  );

  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    logger.info(`[SimpleLogin] Login attempt for email: ${email}`);

    // Basic validation
    if (!email || !password) {
      return apiResponse.error(res, { message: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        emailVerified: true,
        role: true,
      },
    });

    if (!user) {
      logger.info(`[SimpleLogin] User not found for email: ${email}`);
      return apiResponse.unauthorized(res, { message: 'Invalid email or password' });
    }

    // Check password
    if (!user.password) {
      logger.info(`[SimpleLogin] User has no password set: ${email}`);
      return apiResponse.unauthorized(res, { message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    logger.info(`[SimpleLogin] Password validation result for ${email}: ${isPasswordValid}`);

    if (!isPasswordValid) {
      logger.info(`[SimpleLogin] Invalid password for user: ${email}`);
      return apiResponse.unauthorized(res, { message: 'Invalid email or password' });
    }

    // Check if email is verified (only if email provider is configured)
    const { shouldRequireEmailVerification } = await import('../../../lib/auth/email-config');
    if (shouldRequireEmailVerification() && !user.emailVerified) {
      return apiResponse.forbidden(res, {
        message: 'Please verify your email before logging in',
        requiresVerification: true,
      });
    }

    // Return success with user data
    logger.info(`[SimpleLogin] Login successful for user: ${email}`);
    return apiResponse.success(res, {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('[SimpleLogin] Error:', {
      message: error.message,
      stack: error.stack,
      email: req.body?.email,
      timestamp: new Date().toISOString(),
    });
    return apiResponse.internalError(res, {
      message: 'An error occurred during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
