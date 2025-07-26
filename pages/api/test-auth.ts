import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Block this endpoint in production
  if (process.env.NODE_ENV === 'production') {
    return apiResponse.notFound(res, { message: 'Not found' });
  }
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { message: 'Method not allowed' });
  }

  const { email, password } = req.body;
  logger.info('Test auth for:', email);

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
      },
    });

    if (!user) {
      return apiResponse.notFound(res, { message: 'User not found' });
    }

    if (!user.password) {
      return apiResponse.error(res, { message: 'No password set for user' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return apiResponse.unauthorized(res, { message: 'Invalid password' });
    }

    // Success
    apiResponse.success(res, {
      message: 'Authentication successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Test auth error:', error);
    apiResponse.internalError(res, { message: 'Server error', error: error.message });
  }
}
