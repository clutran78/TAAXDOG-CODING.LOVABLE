import { logger } from '@/lib/logger';

/**
 * Sanitized error logging utility
 * Prevents sensitive information from being exposed in logs
 */

interface SanitizedError {
  message: string;
  code?: string;
  type?: string;
  statusCode?: number;
  timestamp: string;
  requestId?: string;
  userId?: string;
  endpoint?: string;
}

/**
 * Sanitize error object for logging
 * Removes potentially sensitive information like stack traces,
 * internal paths, and detailed error messages in production
 */
export function sanitizeError(
  error: any,
  context?: {
    endpoint?: string;
    userId?: string;
    requestId?: string;
  },
): SanitizedError {
  const isProduction = process.env.NODE_ENV === 'production';

  const sanitized: SanitizedError = {
    message: 'An error occurred',
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (error) {
    // Only include error message in non-production environments
    if (!isProduction && error.message) {
      sanitized.message = error.message;
    } else if (error.code) {
      // In production, use error codes instead of messages
      sanitized.message = `Error code: ${error.code}`;
    }

    // Include safe error properties
    if (error.code) sanitized.code = error.code;
    if (error.type) sanitized.type = error.type;
    if (error.statusCode) sanitized.statusCode = error.statusCode;
  }

  return sanitized;
}

/**
 * Log error with sanitization
 */
export function logError(
  label: string,
  error: any,
  context?: {
    endpoint?: string;
    userId?: string;
    requestId?: string;
  },
): void {
  const sanitized = sanitizeError(error, context);
  logger.error(`[${label}]`, sanitized);
}

/**
 * Get client-safe error message
 * Returns generic messages in production to avoid information disclosure
 */
export function getClientErrorMessage(error: any): string {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction && error?.message) {
    // In development, return the actual error message for debugging
    return error.message;
  }

  // In production, return generic messages based on error type
  if (error?.code === 'UNAUTHORIZED') {
    return 'Authentication required';
  } else if (error?.code === 'FORBIDDEN') {
    return 'You do not have permission to perform this action';
  } else if (error?.code === 'NOT_FOUND') {
    return 'The requested resource was not found';
  } else if (error?.code === 'VALIDATION_ERROR') {
    return 'Invalid input provided';
  } else if (error?.statusCode === 429) {
    return 'Too many requests. Please try again later';
  } else if (error?.type === 'StripeCardError') {
    return 'Card payment failed. Please check your card details';
  } else if (error?.type === 'StripeInvalidRequestError') {
    return 'Invalid payment request';
  }

  // Default generic message
  return 'An unexpected error occurred. Please try again later or contact support if the issue persists';
}

/**
 * Create a standardized API error response
 */
export function createErrorResponse(
  error: any,
  statusCode = 500,
): {
  error: string;
  message: string;
  requestId?: string;
} {
  return {
    error: 'Request failed',
    message: getClientErrorMessage(error),
    ...(process.env.NODE_ENV !== 'production' && error?.requestId
      ? { requestId: error.requestId }
      : {}),
  };
}
