import { NextRequest, NextResponse } from 'next/server';
import { getSecurityConfig } from '../config';
import prisma from '../prisma';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// Security configuration
const SECURITY_CONFIG = {
  // Rate limiting
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
  RATE_LIMITS: {
    default: 60,
    api: 100,
    auth: 20,
    sensitive: 10,
  },

  // Request validation
  MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_URL_LENGTH: 2048,
  MAX_HEADER_SIZE: 8192,

  // CSRF protection
  CSRF_TOKEN_LENGTH: 32,
  CSRF_HEADER: 'x-csrf-token',

  // Security headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  },
};

// Rate limiter with sliding window
class RateLimiter {
  private windows: Map<string, number[]> = new Map();

  check(key: string, limit: number): boolean {
    const now = Date.now();
    const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW;

    const timestamps = this.windows.get(key) || [];
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= limit) {
      return false;
    }

    validTimestamps.push(now);
    this.windows.set(key, validTimestamps);

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }

    return true;
  }

  private cleanup() {
    const now = Date.now();
    const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW;

    this.windows.forEach((timestamps, key) => {
      const validTimestamps = timestamps.filter((t) => t > windowStart);
      if (validTimestamps.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, validTimestamps);
      }
    });
  }
}

const rateLimiter = new RateLimiter();

// Input validation
export class InputValidator {
  // Validate email
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  // Validate Australian phone number
  static isValidAustralianPhone(phone: string): boolean {
    const phoneRegex = /^(\+61|0)[2-478](\d{8})$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  // Validate ABN (Australian Business Number)
  static isValidABN(abn: string): boolean {
    const cleanABN = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanABN)) return false;

    // ABN checksum validation
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    let sum = 0;

    for (let i = 0; i < 11; i++) {
      const digit = parseInt(cleanABN[i]);
      sum += digit * weights[i];
    }

    return sum % 89 === 0;
  }

  // Validate TFN (Tax File Number) format only
  static isValidTFNFormat(tfn: string): boolean {
    const cleanTFN = tfn.replace(/\s/g, '');
    return /^\d{8,9}$/.test(cleanTFN);
  }

  // Sanitize input
  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  }

  // Validate amount (cents)
  static isValidAmount(amount: number): boolean {
    return Number.isInteger(amount) && amount >= 0 && amount <= 999999999;
  }
}

// CSRF token management
export class CSRFProtection {
  // Generate CSRF token
  static generateToken(): string {
    return crypto.randomBytes(SECURITY_CONFIG.CSRF_TOKEN_LENGTH).toString('hex');
  }

  // Validate CSRF token
  static async validateToken(token: string, sessionId: string): Promise<boolean> {
    if (!token || !sessionId) return false;

    // In production, store in Redis or database
    // For now, we'll use a simple hash comparison
    const expectedToken = crypto
      .createHmac('sha256', process.env.NEXTAUTH_SECRET || '')
      .update(sessionId)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
  }
}

// Security middleware
export async function securityMiddleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  // 1. Check URL length
  if (request.url.length > SECURITY_CONFIG.MAX_URL_LENGTH) {
    return NextResponse.json({ error: 'URL too long' }, { status: 414 });
  }

  // 2. Rate limiting
  const rateLimitKey = `${ip}:${path}`;
  const limit = path.startsWith('/api/auth')
    ? SECURITY_CONFIG.RATE_LIMITS.auth
    : path.startsWith('/api/sensitive')
      ? SECURITY_CONFIG.RATE_LIMITS.sensitive
      : path.startsWith('/api')
        ? SECURITY_CONFIG.RATE_LIMITS.api
        : SECURITY_CONFIG.RATE_LIMITS.default;

  if (!rateLimiter.check(rateLimitKey, limit)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
        },
      },
    );
  }

  // 3. CSRF protection for state-changing operations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && path.startsWith('/api')) {
    const csrfToken = request.headers.get(SECURITY_CONFIG.CSRF_HEADER);
    const sessionToken = request.cookies.get('next-auth.session-token')?.value;

    if (!csrfToken || !sessionToken) {
      return NextResponse.json({ error: 'CSRF token required' }, { status: 403 });
    }

    const isValidCSRF = await CSRFProtection.validateToken(csrfToken, sessionToken);
    if (!isValidCSRF) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }
  }

  // 4. Add security headers
  const response = NextResponse.next();

  Object.entries(SECURITY_CONFIG.SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // 5. Add request ID for tracking
  response.headers.set('X-Request-ID', crypto.randomUUID());

  return response;
}

// Content validation middleware
export function validateContent(schema: any) {
  return async (req: any, res: any, next: any) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      res.status(400).json({
        error: 'Invalid request data',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

// SQL injection prevention
export function preventSQLInjection(input: string): string {
  // Remove or escape dangerous characters
  return input
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comments
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '') // Remove extended procedures
    .replace(/script/gi, ''); // Remove script tags
}

// XSS prevention
export function preventXSS(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return input.replace(/[&<>"'/]/g, (char) => map[char] || char);
}

// File upload validation
export function validateFileUpload(file: { name: string; size: number; type: string }): {
  valid: boolean;
  error?: string;
} {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/csv'];

  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'File too large' };
  }

  // Check file extension matches MIME type
  const extension = file.name.split('.').pop()?.toLowerCase();
  const expectedExtensions: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'application/pdf': ['pdf'],
    'text/csv': ['csv'],
  };

  const validExtensions = expectedExtensions[file.type] || [];
  if (!extension || !validExtensions.includes(extension)) {
    return { valid: false, error: 'File extension mismatch' };
  }

  return { valid: true };
}

// Audit logging
export async function auditLog({
  userId,
  action,
  resource,
  details,
  ip,
  userAgent,
}: {
  userId?: string;
  action: string;
  resource: string;
  details?: any;
  ip: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        event: action as any,
        ipAddress: ip,
        userAgent,
        metadata: details,
        success: true,
      },
    });
  } catch (error) {
    logger.error('Audit logging failed:', error);
  }
}
