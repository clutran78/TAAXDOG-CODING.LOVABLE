import { NextApiRequest, NextApiResponse } from 'next';
import nextAuth from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { logger } from '@/lib/logger';
import { getDatabaseUrl, validateProductionDatabaseUrl, logDatabaseConnectionInfo } from '@/lib/utils/database-url';
import prisma from '@/lib/prisma';

export { authOptions };

// HTTP Status codes
const HTTP_OK = 200;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_SERVER_ERROR = 500;

// Rate limiting for auth endpoints
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_AUTH_ATTEMPTS = 50; // Increased from 10 to allow for session checks
const MINUTES_IN_WINDOW = 15;
const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;
const AUTH_WINDOW_MS = MINUTES_IN_WINDOW * SECONDS_IN_MINUTE * MS_IN_SECOND; // 15 minutes

function getRateLimitKey(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress || 'unknown';
  return `auth:${ip}`;
}

function checkRateLimit(req: NextApiRequest): boolean {
  // Get the auth action from the URL
  const action = req.query.nextauth?.[0] as string;
  
  // Don't rate limit session checks - they happen frequently and are read-only
  if (action === 'session') {
    return true;
  }
  
  const key = getRateLimitKey(req);
  const now = Date.now();
  const attempt = authAttempts.get(key);

  if (!attempt || attempt.resetAt < now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return true;
  }

  if (attempt.count >= MAX_AUTH_ATTEMPTS) {
    logger.warn('Auth rate limit exceeded', { 
      key, 
      count: attempt.count,
      resetAt: new Date(attempt.resetAt).toISOString(),
      action 
    });
    return false;
  }

  attempt.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of authAttempts.entries()) {
    if (attempt.resetAt < now) {
      authAttempts.delete(key);
    }
  }
}, SECONDS_IN_MINUTE * MS_IN_SECOND); // Clean up every minute

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Rate limiting
    if (!checkRateLimit(req)) {
      return res.status(HTTP_TOO_MANY_REQUESTS).json({
        error: 'Too many requests',
        message: 'Please try again later.',
      });
    }

    // Check for required environment variables
    const envErrors: string[] = [];
    
    if (!process.env.NEXTAUTH_SECRET) {
      envErrors.push('NEXTAUTH_SECRET is not set');
    }

    if (!process.env.NEXTAUTH_URL && process.env.NODE_ENV === 'production') {
      envErrors.push('NEXTAUTH_URL is not set in production');
    }

    // Validate database connection
    try {
      const databaseUrl = getDatabaseUrl();
      
      // In production, validate the database URL
      if (process.env.NODE_ENV === 'production') {
        const validation = validateProductionDatabaseUrl(databaseUrl);
        if (!validation.valid) {
          envErrors.push(`Database configuration errors: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
          logger.warn('Database configuration warnings', { warnings: validation.warnings });
        }
      }
      
      // Log connection info (without sensitive data)
      logDatabaseConnectionInfo(databaseUrl, 'nextauth-api');
      
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      
    } catch (dbError) {
      logger.error('Database connection error in auth handler', { 
        error: dbError instanceof Error ? dbError.message : String(dbError) 
      });
      envErrors.push('Database connection failed');
    }

    if (envErrors.length > 0) {
      logger.error('Authentication service configuration errors', { errors: envErrors });
      
      // In production, return generic error
      if (process.env.NODE_ENV === 'production') {
        return res.status(HTTP_INTERNAL_SERVER_ERROR).json({
          error: 'Server configuration error',
          message: 'Authentication service is not properly configured. Please contact support.',
        });
      }
      
      // In development, return detailed errors
      return res.status(HTTP_INTERNAL_SERVER_ERROR).json({
        error: 'Configuration error',
        message: 'Authentication service configuration errors',
        details: envErrors,
      });
    }

    // Log auth request (without sensitive data)
    const { password: _password, ...safeBody } = req.body || {};
    logger.debug('Auth request', {
      method: req.method,
      action: req.query.nextauth?.[0],
      provider: req.query.nextauth?.[1],
      userAgent: req.headers['user-agent'],
      ip: getRateLimitKey(req),
      body: safeBody,
    });

    // Pass the request to NextAuth with error handling
    const result = await nextAuth(req, res, authOptions);
    
    // Log successful auth responses
    if (res.statusCode === HTTP_OK) {
      logger.info('Auth request successful', {
        action: req.query.nextauth?.[0],
        provider: req.query.nextauth?.[1],
      });
    }
    
    return result;
    
  } catch (error) {
    logger.error('Unexpected error in auth handler', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Return generic error in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(HTTP_INTERNAL_SERVER_ERROR).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      });
    }
    
    // Return detailed error in development
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    });
  }
}
