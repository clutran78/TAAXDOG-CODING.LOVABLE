import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { verifyJWT } from './auth-utils';

// CSRF token storage (in production, use Redis or similar)
const csrfTokenStore = new Map<string, { token: string; expires: number }>();

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 4 * 60 * 60 * 1000; // 4 hours
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';

// Methods that require CSRF protection
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Generate CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

// Store CSRF token
export function storeCSRFToken(sessionId: string, token: string): void {
  const expires = Date.now() + CSRF_TOKEN_EXPIRY;
  csrfTokenStore.set(sessionId, { token, expires });

  // Clean up expired tokens periodically
  if (Math.random() < 0.1) {
    // 10% chance to clean up
    cleanupExpiredTokens();
  }
}

// Validate CSRF token
export function validateCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokenStore.get(sessionId);

  if (!stored) {
    return false;
  }

  if (Date.now() > stored.expires) {
    csrfTokenStore.delete(sessionId);
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(stored.token), Buffer.from(token));
}

// Clean up expired tokens
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [sessionId, data] of csrfTokenStore.entries()) {
    if (now > data.expires) {
      csrfTokenStore.delete(sessionId);
    }
  }
}

// Get session ID from request
function getSessionId(req: NextApiRequest): string | null {
  try {
    // Try to get from auth token
    const cookies = req.headers.cookie?.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const authToken = cookies?.['auth-token'];
    if (authToken) {
      const decoded = verifyJWT(authToken);
      return decoded.sessionId || decoded.userId;
    }

    // Fallback to session token
    const sessionToken = cookies?.['session-token'];
    return sessionToken || null;
  } catch {
    return null;
  }
}

// CSRF protection middleware
export function csrfProtection(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Skip CSRF for safe methods
    if (!PROTECTED_METHODS.includes(req.method || '')) {
      return handler(req, res);
    }

    // Get session ID
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No valid session found',
      });
    }

    // Get CSRF token from header or body
    const csrfToken =
      (req.headers[CSRF_HEADER_NAME] as string) ||
      req.body?.csrfToken ||
      (req.query?.csrfToken as string);

    if (!csrfToken) {
      return res.status(403).json({
        error: 'CSRF token missing',
        message: 'CSRF token is required for this request',
      });
    }

    // Validate CSRF token
    if (!validateCSRFToken(sessionId, csrfToken)) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'The CSRF token is invalid or expired',
      });
    }

    // Continue to handler
    return handler(req, res);
  };
}

// Middleware to set CSRF token cookie
export function setCSRFTokenCookie(
  req: NextApiRequest,
  res: NextApiResponse,
  sessionId: string,
): string {
  const token = generateCSRFToken();
  storeCSRFToken(sessionId, token);

  // Set CSRF token cookie (readable by JavaScript)
  const isDevelopment = process.env.NODE_ENV !== 'production';
  res.setHeader('Set-Cookie', [
    `${CSRF_COOKIE_NAME}=${token}; Path=/; SameSite=Strict; ${!isDevelopment ? 'Secure;' : ''} Max-Age=${CSRF_TOKEN_EXPIRY / 1000}`,
  ]);

  return token;
}

// Get CSRF token for a session
export function getCSRFToken(sessionId: string): string | null {
  const stored = csrfTokenStore.get(sessionId);

  if (!stored || Date.now() > stored.expires) {
    return null;
  }

  return stored.token;
}

// Middleware factory with options
export interface CSRFOptions {
  excludePaths?: string[];
  headerName?: string;
  cookieName?: string;
  tokenExpiry?: number;
}

export function createCSRFMiddleware(options: CSRFOptions = {}) {
  const {
    excludePaths = [],
    headerName = CSRF_HEADER_NAME,
    cookieName = CSRF_COOKIE_NAME,
    tokenExpiry = CSRF_TOKEN_EXPIRY,
  } = options;

  return (handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) => {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      // Check if path is excluded
      const path = req.url?.split('?')[0];
      if (path && excludePaths.includes(path)) {
        return handler(req, res);
      }

      // Skip CSRF for safe methods
      if (!PROTECTED_METHODS.includes(req.method || '')) {
        return handler(req, res);
      }

      // Get session ID
      const sessionId = getSessionId(req);
      if (!sessionId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'No valid session found',
        });
      }

      // Get CSRF token
      const csrfToken =
        (req.headers[headerName] as string) ||
        req.body?.csrfToken ||
        (req.query?.csrfToken as string);

      if (!csrfToken) {
        return res.status(403).json({
          error: 'CSRF token missing',
          message: 'CSRF token is required for this request',
        });
      }

      // Validate CSRF token
      if (!validateCSRFToken(sessionId, csrfToken)) {
        return res.status(403).json({
          error: 'Invalid CSRF token',
          message: 'The CSRF token is invalid or expired',
        });
      }

      // Continue to handler
      return handler(req, res);
    };
  };
}
