import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// Configure DOMPurify for different content types
const createSanitizer = (config: any = {}) => {
  const purify = DOMPurify;

  // Default configuration - very strict
  const defaultConfig = {
    ALLOWED_TAGS: [], // No HTML tags by default
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    FORCE_BODY: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
    IN_PLACE: false,
    ...config,
  };

  return (dirty: string): string => {
    return purify.sanitize(dirty, defaultConfig) as unknown as string;
  };
};

// Sanitizers for different content types
export const sanitizers = {
  // Plain text - strips all HTML
  plainText: createSanitizer(),

  // Basic formatting - allows only safe formatting tags
  basicFormat: createSanitizer({
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'],
    ALLOWED_ATTR: [],
  }),

  // Rich text - allows more formatting but still safe
  richText: createSanitizer({
    ALLOWED_TAGS: [
      'b',
      'i',
      'em',
      'strong',
      'u',
      'br',
      'p',
      'div',
      'span',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'a',
      'img',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
    ALLOW_DATA_ATTR: false,
    // Only allow http/https URLs
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?:)?\/\/)/i,
  }),

  // URL sanitizer
  url: (url: string): string => {
    try {
      const parsed = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      return parsed.toString();
    } catch {
      return '';
    }
  },

  // Email sanitizer
  email: (email: string): string => {
    const trimmed = email.trim().toLowerCase();
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmed) ? trimmed : '';
  },

  // File name sanitizer
  fileName: (fileName: string): string => {
    // Remove any path traversal attempts and dangerous characters
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_')
      .replace(/^\./, '_')
      .slice(0, 255); // Limit length
  },
};

// Content Security Policy configuration
export const CSP_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.stripe.com https://checkout.stripe.com wss://",
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; '),
};

// Security headers for API responses
export const SECURITY_HEADERS = {
  ...CSP_HEADERS,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// File upload validation
export const fileValidation: {
  maxSizes: Record<string, number>;
  allowedTypes: Record<string, string[]>;
  validate: (
    file: { name: string; type: string; size: number },
    category: string,
  ) => { valid: boolean; error?: string };
} = {
  // Maximum file sizes in bytes
  maxSizes: {
    image: 5 * 1024 * 1024, // 5MB
    document: 10 * 1024 * 1024, // 10MB
    receipt: 5 * 1024 * 1024, // 5MB
  },

  // Allowed MIME types
  allowedTypes: {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    document: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    receipt: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
  },

  // Validate file
  validate: (
    file: { name: string; type: string; size: number },
    category: keyof typeof fileValidation.allowedTypes,
  ) => {
    const errors: string[] = [];

    // Check file size
    const maxSize = fileValidation.maxSizes[category];
    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum of ${maxSize / (1024 * 1024)}MB`);
    }

    // Check file type
    const allowedTypes = fileValidation.allowedTypes[category];
    if (!allowedTypes.includes(file.type)) {
      errors.push(
        `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // Check file name
    const sanitizedName = sanitizers.fileName(file.name);
    if (sanitizedName !== file.name) {
      errors.push('File name contains invalid characters');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedName,
    };
  },
};

// Middleware to add security headers
export function addSecurityHeaders(res: any) {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

// Enhanced Zod schemas with sanitization
export const createSanitizedString = (sanitizer: (str: string) => string) => {
  return z.string().transform(sanitizer);
};

export const sanitizedSchemas = {
  plainText: createSanitizedString(sanitizers.plainText),
  basicFormat: createSanitizedString(sanitizers.basicFormat),
  richText: createSanitizedString(sanitizers.richText),
  url: createSanitizedString(sanitizers.url),
  email: createSanitizedString(sanitizers.email),
  fileName: createSanitizedString(sanitizers.fileName),
};

// Helper to sanitize an entire object
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  schema: Record<
    keyof T,
    'plainText' | 'basicFormat' | 'richText' | 'url' | 'email' | 'fileName' | 'skip'
  >,
): T {
  const sanitized = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    const sanitizerType = schema[key as keyof T];

    if (sanitizerType === 'skip' || !sanitizerType) {
      sanitized[key as keyof T] = value;
    } else if (typeof value === 'string') {
      sanitized[key as keyof T] = (sanitizers as any)[sanitizerType](value) as any;
    } else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}
