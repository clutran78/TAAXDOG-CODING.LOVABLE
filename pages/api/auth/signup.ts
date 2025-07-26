import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateSecureToken } from '@/lib/auth/auth-utils';
import { isPasswordStrong } from '@/lib/auth/validation';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return apiResponse.error(res, { error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiResponse.error(res, { error: 'Invalid email format' });
    }

    // Validate password strength
    const passwordValidation = isPasswordStrong(password);
    if (!passwordValidation.isValid) {
      return apiResponse.error(res, {
        error: 'Weak password',
        details: passwordValidation.errors,
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate verification token
    const verificationToken = generateSecureToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: email.split('@')[0], // Default name from email
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    // Log successful registration
    await prisma.auditLog.create({
      data: {
        event: 'REGISTER',
        userId: user.id,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
        userAgent: req.headers['user-agent'] || '',
        success: true,
      },
    });

    // TODO: Send verification email
    // For now, we'll skip email verification for testing

    return apiResponse.created(res, {
      message: 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: any) {
    logger.error('[Signup] Error:', error);
    return apiResponse.internalError(res, {
      error: 'An error occurred during signup',
    });
  }
}
