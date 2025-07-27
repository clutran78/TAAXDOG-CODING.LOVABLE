import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '../utils/logger';
import {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
} from './index';

// Re-export for backward compatibility
export {
  AuthenticationError,
  NotFoundError,
} from './index';
import { logApiError } from './errorLogger';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  requestId?: string;
  code?: string;
  details?: any;
  timestamp?: string;
}

/**
 * Standard API success response format
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
}

/**
 * Get request ID from request object
 */
function getRequestId(req: NextApiRequest | AuthenticatedRequest): string | undefined {
  return (req as any).requestId;
}

/**
 * Get client IP from request
 */
function getClientIP(req: NextApiRequest | AuthenticatedRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim()
    : req.socket?.remoteAddress || 'unknown';
  return ip;
}

/**
 * Format error response consistently
 */
export function formatErrorResponse(error: Error | ApiError, requestId?: string): ApiErrorResponse {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiError) {
    return {
      error: error.constructor.name.replace('Error', ''),
      message: error.message,
      code: getErrorCode(error),
      details: error.details,
      requestId,
      timestamp,
    };
  }

  // Generic error
  return {
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    requestId,
    timestamp,
  };
}

/**
 * Get standardized error code
 */
function getErrorCode(error: ApiError): string {
  const errorCodes: Record<string, string> = {
    ValidationError: 'VALIDATION_ERROR',
    AuthenticationError: 'AUTH_FAILED',
    AuthorizationError: 'ACCESS_DENIED',
    NotFoundError: 'NOT_FOUND',
    ConflictError: 'CONFLICT',
    RateLimitError: 'RATE_LIMIT_EXCEEDED',
    ExternalServiceError: 'EXTERNAL_SERVICE_ERROR',
  };

  return errorCodes[error.constructor.name] || 'INTERNAL_ERROR';
}

/**
 * Handle API errors consistently
 */
export async function handleApiError(
  error: unknown,
  req: NextApiRequest | AuthenticatedRequest,
  res: NextApiResponse,
): Promise<void> {
  const requestId = getRequestId(req);
  const clientIp = getClientIP(req);
  const userId = (req as AuthenticatedRequest).userId;

  // Log the error
  logApiError(error, req.url || 'unknown', req.method || 'unknown', {
    userId,
    url: req.url,
    metadata: {
      clientIp,
      userAgent: req.headers['user-agent'],
      requestId,
    },
  });

  // Determine status code and format response
  let statusCode = 500;
  let errorResponse: ApiErrorResponse;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    errorResponse = formatErrorResponse(error, requestId);
  } else if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('Unique constraint')) {
      statusCode = 409;
      errorResponse = formatErrorResponse(
        new ConflictError('Resource already exists', { originalError: error.message }),
        requestId,
      );
    } else if (error.message.includes('Record to update not found')) {
      statusCode = 404;
      errorResponse = formatErrorResponse(new NotFoundError('Resource not found'), requestId);
    } else {
      errorResponse = formatErrorResponse(error, requestId);
    }
  } else {
    errorResponse = formatErrorResponse(new Error('An unexpected error occurred'), requestId);
  }

  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error handler wrapper for API routes
 */
export function withErrorHandler<T extends NextApiRequest = NextApiRequest>(
  handler: (req: T, res: NextApiResponse) => Promise<void>,
) {
  return async (req: T, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      await handleApiError(error, req, res);
    }
  };
}

/**
 * Try-catch wrapper with consistent error handling
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorMessage: string,
  context?: any,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(errorMessage, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      context,
    });

    // Re-throw as ApiError if it's not already one
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(errorMessage, 500, true, {
      originalError: error instanceof Error ? error.message : error,
      context,
    });
  }
}

/**
 * Validate required fields and throw ValidationError if missing
 */
export function validateRequired(data: Record<string, any>, requiredFields: string[]): void {
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`, {
      missingFields,
    });
  }
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T = any>(json: string, defaultValue?: T): T | undefined {
  try {
    return JSON.parse(json);
  } catch (error) {
    logger.warn('Failed to parse JSON', {
      error: error instanceof Error ? error.message : 'Unknown error',
      json: json.substring(0, 100), // Log first 100 chars only
    });
    return defaultValue;
  }
}

/**
 * Format success response consistently
 */
export function successResponse<T = any>(
  data: T,
  meta?: ApiSuccessResponse['meta'],
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}
