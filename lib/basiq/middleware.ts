import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Types
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface AuthenticatedRequest extends NextApiRequest {
  userId: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
}

// Simple rate limiting in memory (consider Redis for production)
const rateLimitMap = new Map<string, RateLimitEntry>();

// Basic rate limiting function
function checkRateLimit(userId: string, limit: number = 60): boolean {
  const now = Date.now();
  const key = `basiq:${userId}`;
  const userLimit = rateLimitMap.get(key);

  if (!userLimit || userLimit.resetTime < now) {
    rateLimitMap.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }

  if (userLimit.count >= limit) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Simple security middleware for BASIQ endpoints
export async function withBasiqSecurity(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>,
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    try {
      // Check authentication
      const session = await getServerSession(req, res, authOptions);
      if (!session || !session.user) {
        const errorResponse: ErrorResponse = { error: 'Unauthorized' };
        return res.status(401).json(errorResponse);
      }

      // Basic rate limiting
      if (!checkRateLimit(session.user.id)) {
        const errorResponse: ErrorResponse = {
          error: 'Rate limit exceeded',
          message: 'Please try again in a minute',
        };
        return res.status(429).json(errorResponse);
      }

      // Add user context to request
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.userId = session.user.id;

      // Call the actual handler
      await handler(authenticatedReq, res);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('BASIQ middleware error:', errorMessage);

      // Return generic error to avoid leaking sensitive information
      const errorResponse: ErrorResponse = {
        error: 'Internal server error',
        message: 'An error occurred processing your request',
      };
      return res.status(500).json(errorResponse);
    }
  };
}

// Simple webhook signature validation
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
