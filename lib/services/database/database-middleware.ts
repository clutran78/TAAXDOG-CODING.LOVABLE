import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage } from 'http';
import db from './database';
import { logger } from '@/lib/logger';

interface ExtendedRequest extends NextApiRequest {
  clientId?: string;
  userAgent?: string;
  realIp?: string;
}

// Rate limiting store (in production, use Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export class DatabaseSecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'DatabaseSecurityError';
  }
}

// Get client identifier for rate limiting
function getClientId(req: ExtendedRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (forwarded as string).split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';

  req.realIp = ip;
  return ip;
}

// Rate limiting middleware
export function rateLimitMiddleware(
  windowMs: number = 60000, // 1 minute
  maxRequests: number = 100,
) {
  return (req: ExtendedRequest, res: NextApiResponse, next: () => void) => {
    const clientId = getClientId(req);
    const now = Date.now();

    const clientData = requestCounts.get(clientId) || { count: 0, resetTime: now + windowMs };

    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + windowMs;
    }

    clientData.count++;
    requestCounts.set(clientId, clientData);

    if (clientData.count > maxRequests) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
      });
      return;
    }

    req.clientId = clientId;
    next();
  };
}

// SQL injection prevention middleware
export function sqlInjectionProtection(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void,
) {
  const suspiciousPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|#|\/\*|\*\/)/g,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
    /(';|";)/g,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value !== 'string') return true;

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(value)) {
        return false;
      }
    }
    return true;
  };

  const checkObject = (obj: any): boolean => {
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        if (!checkObject(value)) return false;
      } else if (!checkValue(value)) {
        return false;
      }
    }
    return true;
  };

  // Check query parameters
  if (!checkObject(req.query)) {
    res.status(400).json({ error: 'Invalid query parameters detected' });
    return;
  }

  // Check body
  if (req.body && !checkObject(req.body)) {
    res.status(400).json({ error: 'Invalid request body detected' });
    return;
  }

  next();
}

// Error sanitization middleware
export function errorHandler(
  error: Error,
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void,
) {
  console.error('API Error:', {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    path: req.url,
    method: req.method,
  });

  // Sanitize error messages
  let message = 'Internal server error';
  let statusCode = 500;

  if (error instanceof DatabaseSecurityError) {
    message = error.message;
    statusCode = error.statusCode;
  } else if (error.message.includes('rate limit')) {
    message = 'Too many requests';
    statusCode = 429;
  } else if (error.message.includes('unauthorized')) {
    message = 'Unauthorized';
    statusCode = 401;
  } else if (error.message.includes('validation')) {
    message = 'Validation error';
    statusCode = 400;
  }

  // Remove sensitive information
  const sanitizedError = {
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown',
  };

  res.status(statusCode).json(sanitizedError);
}

// Audit logging for sensitive operations
export async function auditMiddleware(operation: string, sensitive: boolean = false) {
  return async (req: ExtendedRequest, res: NextApiResponse, next: () => void) => {
    const startTime = Date.now();

    // Capture original end function
    const originalEnd = res.end;

    res.end = function (...args: any[]): any {
      const duration = Date.now() - startTime;

      // Log audit entry asynchronously
      if (sensitive || res.statusCode >= 400) {
        const userId = (req as any).session?.userId || 'anonymous';

        db.auditLog(operation, userId, {
          method: req.method,
          path: req.url,
          statusCode: res.statusCode,
          duration,
          ipAddress: req.realIp || req.clientId,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        }).catch((error) => {
          logger.error('Audit logging failed:', error);
        });
      }

      // Call original end function
      return (originalEnd as any).apply(res, args);
    } as any;

    next();
  };
}

// Security headers middleware
export function securityHeaders(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
}

// Combine all middleware for database endpoints
export function databaseSecurityMiddleware(
  options: {
    rateLimit?: { windowMs?: number; maxRequests?: number };
    audit?: { operation: string; sensitive?: boolean };
  } = {},
) {
  const middlewares: any[] = [
    securityHeaders,
    rateLimitMiddleware(options.rateLimit?.windowMs, options.rateLimit?.maxRequests),
    sqlInjectionProtection,
  ];

  if (options.audit) {
    middlewares.push(auditMiddleware(options.audit.operation, options.audit.sensitive));
  }

  return (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
    let index = 0;

    const runNext = () => {
      if (index >= middlewares.length) {
        next();
        return;
      }

      const middleware = middlewares[index++];
      middleware(req, res, runNext);
    };

    runNext();
  };
}
