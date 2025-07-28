import { NextApiRequest, NextApiResponse } from 'next';
import NextAuth from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { logger } from '@/lib/logger';

export { authOptions };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check for required environment variables
  if (!process.env.NEXTAUTH_SECRET) {
    logger.error('NEXTAUTH_SECRET is not set');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Authentication service is not properly configured. Please contact support.',
    });
  }

  if (!process.env.NEXTAUTH_URL && process.env.NODE_ENV === 'production') {
    logger.error('NEXTAUTH_URL is not set in production');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Authentication service is not properly configured. Please contact support.',
    });
  }

  // Pass the request to NextAuth
  return NextAuth(req, res, authOptions);
}
