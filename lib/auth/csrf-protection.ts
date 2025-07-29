import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { verifyJWT, getClientIP } from './auth-utils';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';
import { addSecurityHeaders } from '../security/sanitizer';

// Constants
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours
const TOKEN_HEADER = 'x-csrf-token';
const TOKEN_COOKIE_NAME = 'csrf-token';
const TOKEN_FORM_FIELD = '_csrf';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const SAME_SITE_STRICT = 'strict';
const TOKEN_HASH_ALGORITHM = 'sha256';

// Token storage interface
interface CSRFToken {
  token: string;
  hashedToken: string;
  expiresAt: Date;
  userId?: string;
  ipAddress?: string;
}

// In-memory token store (consider Redis for production)
const tokenStore = new Map<string, CSRFToken>();

// Generate CSRF token with hash
export function generateCSRFToken(): { token: string; hashedToken: string } {
  const token = crypto.randomBytes(TOKEN_LENGTH).toString('hex');
  const hashedToken = crypto
    .createHash(TOKEN_HASH_ALGORITHM)
    .update(token)
    .digest('hex');
  
  return { token, hashedToken };
}

// Store CSRF token with enhanced security
export function storeCSRFToken(
  sessionId: string, 
  token: string, 
  hashedToken: string,
  userId?: string,
  ipAddress?: string
): void {
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
  
  tokenStore.set(sessionId, {
    token,
    hashedToken,
    expiresAt,
    userId,
    ipAddress,
  });

  // Clean up expired tokens periodically
  if (Math.random() < 0.1) {
    cleanupExpiredTokens();
  }
}

// Validate CSRF token with timing-safe comparison
export function validateCSRFToken(
  sessionId: string, 
  token: string,
  ipAddress?: string
): boolean {
  const stored = tokenStore.get(sessionId);

  if (!stored) {
    return false;
  }

  // Check if token has expired
  if (stored.expiresAt < new Date()) {
    tokenStore.delete(sessionId);
    return false;
  }

  // Optionally validate IP address (for stricter security)
  if (stored.ipAddress && ipAddress && stored.ipAddress !== ipAddress) {
    logger.warn('CSRF token IP mismatch', {
      sessionId,
      storedIP: stored.ipAddress,
      requestIP: ipAddress,
    });
    return false;
  }

  // Hash the provided token and compare with stored hash
  const hashedToken = crypto
    .createHash(TOKEN_HASH_ALGORITHM)
    .update(token)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(stored.hashedToken), 
      Buffer.from(hashedToken)
    );
  } catch {
    return false;
  }
}

// Clean up expired tokens
function cleanupExpiredTokens(): void {
  const now = new Date();
  let cleaned = 0;
  
  for (const [sessionId, data] of tokenStore.entries()) {
    if (data.expiresAt < now) {
      tokenStore.delete(sessionId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug('Cleaned up expired CSRF tokens', { count: cleaned });
  }
}

// Periodic cleanup (every hour)
setInterval(() => {
  cleanupExpiredTokens();
}, 60 * 60 * 1000);

// Get CSRF token from request
function getTokenFromRequest(req: NextApiRequest): string | null {
  // Check header first (for AJAX requests)
  const headerToken = req.headers[TOKEN_HEADER];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken;
  }

  // Check body (for form submissions)
  if (req.body && typeof req.body === 'object' && TOKEN_FORM_FIELD in req.body) {
    return req.body[TOKEN_FORM_FIELD];
  }

  // Check query parameters (for special cases)
  if (req.query[TOKEN_FORM_FIELD] && typeof req.query[TOKEN_FORM_FIELD] === 'string') {
    return req.query[TOKEN_FORM_FIELD];
  }

  // Check cookie (for double-submit cookie pattern)
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies[TOKEN_COOKIE_NAME]) {
    return cookies[TOKEN_COOKIE_NAME];
  }

  return null;
}

// Parse cookies helper
function parseCookies(cookieString: string): Record<string, string> {
  return cookieString.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);
}

// Get session ID from request with multiple strategies
function getSessionId(req: NextApiRequest): string | null {
  try {
    const cookies = parseCookies(req.headers.cookie || '');

    // Try NextAuth session token
    const sessionToken = cookies['next-auth.session-token'] || cookies['__Secure-next-auth.session-token'];
    if (sessionToken) {
      return crypto.createHash('sha256').update(sessionToken).digest('hex');
    }

    // Try auth token
    const authToken = cookies['auth-token'];
    if (authToken) {
      try {
        const decoded = verifyJWT(authToken);
        return decoded.sessionId || decoded.userId || decoded.sub;
      } catch {
        // Invalid JWT, continue to next strategy
      }
    }

    // Generate session ID from IP + User-Agent (for anonymous users)
    const ip = getClientIP(req) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    return crypto
      .createHash('sha256')
      .update(`${ip}:${userAgent}`)
      .digest('hex');
  } catch (error) {
    logger.error('Error getting session ID', { error });
    return null;
  }
}

// Enhanced CSRF protection middleware
export function withCSRFProtection(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const requestId = (req as any).requestId || crypto.randomUUID();
    const method = req.method?.toUpperCase() || 'GET';
    const clientIp = getClientIP(req);
    
    // Add security headers
    addSecurityHeaders(res);

    // Get session ID
    const sessionId = getSessionId(req);
    if (!sessionId) {
      logger.warn('No session ID for CSRF check', {
        method,
        url: req.url,
        clientIp,
        requestId,
      });
      return apiResponse.unauthorized(res, 'No valid session found');
    }

    // Skip CSRF check for safe methods but generate token
    if (SAFE_METHODS.includes(method)) {
      // Generate and set token for subsequent requests
      let csrfToken = tokenStore.get(sessionId);
      
      if (!csrfToken || csrfToken.expiresAt < new Date()) {
        const { token, hashedToken } = generateCSRFToken();
        storeCSRFToken(sessionId, token, hashedToken, undefined, clientIp);
        csrfToken = tokenStore.get(sessionId)!;
      }
      
      // Set token in response header and cookie
      res.setHeader(TOKEN_HEADER, csrfToken.token);
      setCSRFCookie(res, csrfToken.token);
      
      return handler(req, res);
    }

    // For state-changing requests, validate CSRF token
    const token = getTokenFromRequest(req);
    
    if (!token) {
      logger.warn('CSRF token missing', {
        method,
        url: req.url,
        clientIp,
        userAgent: req.headers['user-agent'],
        requestId,
      });
      
      return apiResponse.forbidden(res, 'CSRF token missing');
    }

    if (!validateCSRFToken(sessionId, token, clientIp)) {
      logger.warn('Invalid CSRF token', {
        method,
        url: req.url,
        clientIp,
        userAgent: req.headers['user-agent'],
        requestId,
        sessionId,
      });
      
      return apiResponse.forbidden(res, 'Invalid CSRF token');
    }

    // Token is valid, proceed with request
    logger.debug('CSRF token validated', {
      method,
      url: req.url,
      clientIp,
      requestId,
    });

    // Regenerate token after successful validation (rotating tokens)
    const { token: newToken, hashedToken: newHashedToken } = generateCSRFToken();
    storeCSRFToken(sessionId, newToken, newHashedToken, undefined, clientIp);
    
    // Set new token in response
    res.setHeader(TOKEN_HEADER, newToken);
    setCSRFCookie(res, newToken);

    return handler(req, res);
  };
}

// Set CSRF token cookie
export function setCSRFCookie(res: NextApiResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const cookieOptions = [
    `${TOKEN_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${SAME_SITE_STRICT}`,
    `Max-Age=${TOKEN_EXPIRY_MS / 1000}`,
    isProduction ? 'Secure' : '',
  ].filter(Boolean).join('; ');
  
  res.setHeader('Set-Cookie', cookieOptions);
}

// Get CSRF token for current session (for SSR)
export async function getCSRFToken(req: NextApiRequest): Promise<string | null> {
  const sessionId = getSessionId(req);
  if (!sessionId) return null;
  
  const storedToken = tokenStore.get(sessionId);

  if (!storedToken || storedToken.expiresAt < new Date()) {
    const { token, hashedToken } = generateCSRFToken();
    const clientIp = getClientIP(req);
    storeCSRFToken(sessionId, token, hashedToken, undefined, clientIp);
    return token;
  }

  return storedToken.token;
}

// React hook for CSRF token (client-side)
export function useCSRFToken(): {
  token: string | null;
  getHeaders: () => Record<string, string>;
  addToFormData: (formData: FormData) => FormData;
} {
  if (typeof window === 'undefined') {
    return {
      token: null,
      getHeaders: () => ({}),
      addToFormData: (formData) => formData,
    };
  }

  // Get token from meta tag or cookie
  const getToken = (): string | null => {
    // Try meta tag first
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag && metaTag.getAttribute('content')) {
      return metaTag.getAttribute('content');
    }

    // Try cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === TOKEN_COOKIE_NAME) {
        return decodeURIComponent(value);
      }
    }

    // Try to get from API response header (stored in sessionStorage)
    const csrfHeader = sessionStorage.getItem('csrf-token');
    if (csrfHeader) {
      return csrfHeader;
    }

    return null;
  };

  const token = getToken();

  return {
    token,
    getHeaders: () => {
      if (!token) return {};
      return { [TOKEN_HEADER]: token };
    },
    addToFormData: (formData: FormData) => {
      if (token) {
        formData.append(TOKEN_FORM_FIELD, token);
      }
      return formData;
    },
  };
}

// Helper to inject CSRF token into forms (for SSR)
export function injectCSRFToken(html: string, token: string): string {
  // Inject into meta tag
  const metaTag = `<meta name="csrf-token" content="${token}">`;
  html = html.replace('</head>', `${metaTag}</head>`);
  
  // Inject into forms
  const formRegex = /<form([^>]*)>/gi;
  html = html.replace(formRegex, (match, attributes) => {
    // Skip if form already has CSRF token
    if (attributes.includes('_csrf')) {
      return match;
    }
    
    const hiddenInput = `<input type="hidden" name="${TOKEN_FORM_FIELD}" value="${token}">`;
    return `<form${attributes}>${hiddenInput}`;
  });
  
  return html;
}

// Verify origin/referer for additional protection
export function verifyOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  
  if (!origin && !referer) {
    // No origin or referer, could be a direct API call
    return false;
  }
  
  const allowedOrigins = [
    process.env.NEXTAUTH_URL,
    `https://${host}`,
    `http://${host}`, // For development
  ].filter(Boolean);
  
  const requestOrigin = origin || referer;
  
  return allowedOrigins.some(allowed => 
    requestOrigin?.startsWith(allowed as string)
  );
}

// Double submit cookie pattern implementation
export function withDoubleSubmitCookie(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const method = req.method?.toUpperCase() || 'GET';
    
    if (SAFE_METHODS.includes(method)) {
      return handler(req, res);
    }
    
    // Get token from cookie
    const cookies = parseCookies(req.headers.cookie || '');
    const cookieToken = cookies[TOKEN_COOKIE_NAME];
    
    // Get token from request
    const requestToken = getTokenFromRequest(req);
    
    if (!cookieToken || !requestToken || cookieToken !== requestToken) {
      logger.warn('Double submit cookie validation failed', {
        hasCookieToken: !!cookieToken,
        hasRequestToken: !!requestToken,
        match: cookieToken === requestToken,
        url: req.url,
        method,
      });
      
      return apiResponse.forbidden(res, 'CSRF validation failed');
    }
    
    return handler(req, res);
  };
}

// Express-style middleware wrapper
export function csrfProtection(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) {
  const method = req.method?.toUpperCase() || 'GET';
  const sessionId = getSessionId(req);
  
  if (!sessionId) {
    return apiResponse.unauthorized(res, 'No valid session');
  }
  
  // Skip CSRF check for safe methods
  if (SAFE_METHODS.includes(method)) {
    let csrfToken = tokenStore.get(sessionId);
    
    if (!csrfToken || csrfToken.expiresAt < new Date()) {
      const { token, hashedToken } = generateCSRFToken();
      storeCSRFToken(sessionId, token, hashedToken);
      csrfToken = tokenStore.get(sessionId)!;
    }
    
    res.setHeader(TOKEN_HEADER, csrfToken.token);
    setCSRFCookie(res, csrfToken.token);
    
    return next();
  }

  // Validate token for state-changing requests
  const token = getTokenFromRequest(req);
  
  if (!token || !validateCSRFToken(sessionId, token)) {
    return apiResponse.forbidden(res, 'CSRF validation failed');
  }

  // Regenerate token
  const { token: newToken, hashedToken: newHashedToken } = generateCSRFToken();
  storeCSRFToken(sessionId, newToken, newHashedToken);
  
  res.setHeader(TOKEN_HEADER, newToken);
  setCSRFCookie(res, newToken);
  
  next();
}

// Middleware factory with options
export interface CSRFOptions {
  excludePaths?: string[];
  headerName?: string;
  cookieName?: string;
  tokenExpiry?: number;
  strictOriginCheck?: boolean;
  ipValidation?: boolean;
}

export function createCSRFMiddleware(options: CSRFOptions = {}) {
  const {
    excludePaths = [],
    headerName = TOKEN_HEADER,
    cookieName = TOKEN_COOKIE_NAME,
    strictOriginCheck = false,
    ipValidation = false,
  } = options;

  return (handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) => {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      // Check if path is excluded
      const path = req.url?.split('?')[0];
      if (path && excludePaths.some(excluded => path.startsWith(excluded))) {
        return handler(req, res);
      }

      // Check origin if strict mode enabled
      if (strictOriginCheck && !verifyOrigin(req)) {
        logger.warn('Origin check failed', {
          origin: req.headers.origin,
          referer: req.headers.referer,
          url: req.url,
        });
        return apiResponse.forbidden(res, 'Origin check failed');
      }

      // Delegate to main CSRF protection
      return withCSRFProtection(handler)(req, res);
    };
  };
}
