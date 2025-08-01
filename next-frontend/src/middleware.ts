/**
 * TAAXDOG Secure Middleware
 * Implements proper authentication, CSRF protection, and security monitoring
 * Enhanced to prevent HTTP request smuggling attacks
 */

import { NextRequest, NextResponse } from 'next/server';

// Security configuration
const SECURITY_CONFIG = {
  // Rate limiting: max requests per IP per minute
  RATE_LIMIT_MAX: 60,
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute in milliseconds

  // Request size limits to prevent smuggling
  MAX_CONTENT_LENGTH: 50 * 1024 * 1024, // 50MB
  MAX_HEADER_COUNT: 50,
  MAX_HEADER_SIZE: 8192,

  // Public paths that don't require authentication
  PUBLIC_PATHS: ['/login', '/sign-up', '/forgot-password', '/api/auth/verify-token', '/api/public'],

  // Sensitive paths requiring extra security
  SENSITIVE_PATHS: ['/api/banking', '/api/financial', '/api/upload', '/api/user'],

  // Blocked user agents (security scanners, bots)
  BLOCKED_USER_AGENTS: ['sqlmap', 'nmap', 'nikto', 'w3af', 'acunetix', 'netsparker'],

  // Dangerous HTTP methods for smuggling
  DANGEROUS_METHODS: ['TRACE', 'TRACK', 'CONNECT'],
};

// In-memory rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Security logging function
function logSecurityEvent(
  event: string,
  level: 'info' | 'warn' | 'error',
  request: NextRequest,
  details?: Record<string, any>,
) {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    level,
    ip: getClientIP(request),
    userAgent: request.headers.get('user-agent'),
    path: request.nextUrl.pathname,
    method: request.method,
    ...details,
  };

  console.log(`[SECURITY][${level.toUpperCase()}]`, JSON.stringify(logData));
}

// Get client IP address with proxy support
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to localhost for development
  return '127.0.0.1';
}

// Rate limiting implementation
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW;

  const current = rateLimitStore.get(ip);

  if (!current || current.resetTime < windowStart) {
    rateLimitStore.set(ip, { count: 1, resetTime: now });
    return true;
  }

  if (current.count >= SECURITY_CONFIG.RATE_LIMIT_MAX) {
    return false;
  }

  current.count++;
  return true;
}

// Validate session token with NextAuth
async function validateSessionToken(token: string): Promise<boolean> {
  try {
    // Validate with NextAuth session endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/session`, {
      method: 'GET',
      headers: {
        Cookie: `next-auth.session-token=${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data && data.user && data.expires && new Date(data.expires) > new Date();
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

// CRITICAL: Check for HTTP request smuggling indicators
function detectRequestSmuggling(request: NextRequest): boolean {
  const headers = request.headers;

  // Check for multiple Content-Length headers (classic smuggling)
  const contentLengthValues = headers.get('content-length');
  if (contentLengthValues && contentLengthValues.split(',').length > 1) {
    return true;
  }

  // Check for Transfer-Encoding and Content-Length conflict
  const transferEncoding = headers.get('transfer-encoding');
  const contentLength = headers.get('content-length');
  if (transferEncoding && contentLength) {
    return true;
  }

  // Check for folded headers (space/tab continuation)
  let hasFoldedHeaders = false;
  headers.forEach((value, key) => {
    if (
      value.includes('\r') ||
      value.includes('\n') ||
      value.includes('\t') ||
      value.includes(' \r') ||
      value.includes(' \n')
    ) {
      hasFoldedHeaders = true;
    }
  });
  if (hasFoldedHeaders) return true;

  // Check for dangerous HTTP methods
  if (SECURITY_CONFIG.DANGEROUS_METHODS.includes(request.method)) {
    return true;
  }

  // Check header count and sizes
  // Get header count
  let headerCount = 0;
  headers.forEach(() => headerCount++);
  if (headerCount > SECURITY_CONFIG.MAX_HEADER_COUNT) {
    return true;
  }

  // Check individual header sizes
  let headerSizeExceeded = false;
  headers.forEach((value, key) => {
    if ((key + value).length > SECURITY_CONFIG.MAX_HEADER_SIZE) {
      headerSizeExceeded = true;
    }
  });
  if (headerSizeExceeded) return true;

  return false;
}

// Check for malicious patterns in URL and headers
function detectMaliciousPatterns(request: NextRequest): boolean {
  const suspiciousPatterns = [
    /<script[^>]*>.*?<\/script>/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /(union|select|insert|update|delete|drop)\s+/i,
    /file:\/\//i,
    // Additional HTTP smuggling patterns
    /\r\n\r\n/,
    /\x00/,
    /\x0d\x0a/,
  ];

  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;
  const searchParams = request.nextUrl.searchParams.toString();

  // Check for directory traversal
  if (pathname.includes('../') || pathname.includes('..\\')) {
    return true;
  }

  // Check for null bytes
  if (pathname.includes('\x00') || searchParams.includes('\x00')) {
    return true;
  }

  // Check patterns in URL and search params
  const testString = `${pathname} ${searchParams} ${userAgent}`;

  return suspiciousPatterns.some((pattern) => pattern.test(testString));
}

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;

  try {
    // 1. CRITICAL: Check for HTTP request smuggling
    if (detectRequestSmuggling(request)) {
      logSecurityEvent('http_request_smuggling_detected', 'error', request, {
        headers: (() => {
          const headersObj: Record<string, string> = {};
          request.headers.forEach((value, key) => {
            headersObj[key] = value;
          });
          return headersObj;
        })(),
        method: request.method,
      });
      return NextResponse.json({ error: 'Malformed request' }, { status: 400 });
    }

    // 2. Block malicious user agents
    for (const blockedAgent of SECURITY_CONFIG.BLOCKED_USER_AGENTS) {
      if (userAgent.toLowerCase().includes(blockedAgent)) {
        logSecurityEvent('blocked_user_agent', 'warn', request, { userAgent });
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // 3. Rate limiting check
    if (!checkRateLimit(clientIP)) {
      logSecurityEvent('rate_limit_exceeded', 'warn', request, { ip: clientIP });
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 4. Detect malicious patterns
    if (detectMaliciousPatterns(request)) {
      logSecurityEvent('malicious_pattern_detected', 'error', request, {
        pathname,
        searchParams: request.nextUrl.searchParams.toString(),
      });
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    // 5. Check if path requires authentication
    const isPublicPath = SECURITY_CONFIG.PUBLIC_PATHS.some((path) => pathname.startsWith(path));

    if (isPublicPath) {
      logSecurityEvent('public_access', 'info', request);
      return NextResponse.next();
    }

    // 6. Extract and validate authentication token
    const sessionToken =
      request.cookies.get('next-auth.session-token')?.value ||
      request.cookies.get('__Secure-next-auth.session-token')?.value;

    if (!sessionToken) {
      logSecurityEvent('missing_auth_token', 'warn', request);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 7. Validate token with NextAuth
    const isValidToken = await validateSessionToken(sessionToken);

    if (!isValidToken) {
      logSecurityEvent('invalid_auth_token', 'warn', request, {
        tokenLength: sessionToken.length,
      });

      // Clear invalid token and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('next-auth.session-token');
      response.cookies.delete('__Secure-next-auth.session-token');
      return response;
    }

    // 8. Extra security for sensitive endpoints
    const isSensitivePath = SECURITY_CONFIG.SENSITIVE_PATHS.some((path) =>
      pathname.startsWith(path),
    );

    if (isSensitivePath) {
      // Require CSRF token for sensitive operations
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        const csrfToken = request.headers.get('x-csrf-token');
        if (!csrfToken) {
          logSecurityEvent('missing_csrf_token', 'warn', request);
          return NextResponse.json({ error: 'CSRF token required' }, { status: 403 });
        }
      }

      logSecurityEvent('sensitive_access', 'info', request, {
        method: request.method,
      });
    }

    // 9. Log successful authentication
    const processingTime = Date.now() - startTime;
    logSecurityEvent('auth_success', 'info', request, {
      processingTime,
    });

    // Add security headers to response
    const response = NextResponse.next();

    // Enhanced security headers to prevent smuggling
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-Request-ID', crypto.randomUUID());
    response.headers.set('Connection', 'close'); // Prevent connection reuse for smuggling
    response.headers.set('X-Request-Processing-Time', `${Date.now() - startTime}ms`);

    return response;
  } catch (error) {
    logSecurityEvent('middleware_error', 'error', request, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Fail securely - redirect to login on any error
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
