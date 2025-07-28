import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { verifyJWT, getClientIP } from '../../../lib/auth/auth-utils';
import { AuthEvent } from '@prisma/client';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const clientIp = getClientIP(req);

  try {
    // Get auth token from cookie
    const cookies = req.headers.cookie?.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const authToken = cookies?.['auth-token'];
    const sessionToken = cookies?.['session-token'];

    let userId: string | null = null;
    let sessionId: string | null = null;

    // Try to get user info from JWT
    if (authToken) {
      try {
        const decoded = verifyJWT(authToken);
        userId = decoded.userId;
        sessionId = decoded.sessionId || null;
      } catch (error) {
        // Token might be invalid or expired, but we still want to clear cookies
        logger.error('[Logout] Invalid auth token:', error);
      }
    }

    // Delete session from database if we have a session token
    if (sessionToken) {
      try {
        const deletedSession = await prisma.session.delete({
          where: { sessionToken },
        });
        userId = userId || deletedSession.userId;
      } catch (error) {
        // Session might not exist
        logger.error('[Logout] Session not found:', error);
      }
    }

    // Clear all sessions for the user if we have userId
    if (userId) {
      try {
        await prisma.session.deleteMany({
          where: { userId },
        });

        // Log logout event
        await prisma.auditLog.create({
          data: {
            event: AuthEvent.LOGOUT,
            userId,
            ipAddress: clientIp,
            userAgent: req.headers['user-agent'] || '',
            success: true,
            metadata: {
              sessionId,
              clearedAllSessions: true,
            },
          },
        });
      } catch (error) {
        logger.error('[Logout] Error clearing sessions:', error);
      }
    }

    // Clear auth cookies
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const cookieOptions = [
      `Max-Age=0`,
      `Path=/`,
      `HttpOnly`,
      !isDevelopment && `Secure`,
      `SameSite=lax`,
    ]
      .filter(Boolean)
      .join('; ');

    res.setHeader('Set-Cookie', [
      `auth-token=; ${cookieOptions}`,
      `session-token=; ${cookieOptions}`,
      `csrf-token=; ${cookieOptions}`,
    ]);

    console.log('[Logout] User logged out successfully:', {
      userId,
      ip: clientIp,
    });

    // Return success response
    return apiResponse.success(res, {
      message: 'Logout successful',
    });
  } catch (error: any) {
    // Log error
    console.error('[Logout] Logout error:', {
      error: error.message,
      code: error.code,
      ip: clientIp,
    });

    // Still clear cookies even if there's an error
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const cookieOptions = [
      `Max-Age=0`,
      `Path=/`,
      `HttpOnly`,
      !isDevelopment && `Secure`,
      `SameSite=lax`,
    ]
      .filter(Boolean)
      .join('; ');

    res.setHeader('Set-Cookie', [
      `auth-token=; ${cookieOptions}`,
      `session-token=; ${cookieOptions}`,
      `csrf-token=; ${cookieOptions}`,
    ]);

    // Return success anyway - user wants to logout
    return apiResponse.success(res, {
      message: 'Logout successful',
    });
  }
}
