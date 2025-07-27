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
} from '../errors';
import { logApiError } from '../errors/errorLogger';
import { AuthenticatedRequest } from './auth';

/**
 * Global error handling middleware for all API routes
 * Provides consistent error responses and logging
 */
export function errorHandlerMiddleware(
  handler: (req: NextApiRequest | AuthenticatedRequest, res: NextApiResponse) => Promise<void>,
) {
  return async (req: NextApiRequest | AuthenticatedRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      handleApiError(error, req, res);
    }
  };
}

/**
 * Handle API errors with consistent format and logging
 */
function handleApiError(
  error: unknown,
  req: NextApiRequest | AuthenticatedRequest,
  res: NextApiResponse,
): void {
  const requestId = (req as any).requestId;
  const userId = (req as AuthenticatedRequest).userId;
  const method = req.method || 'unknown';
  const url = req.url || 'unknown';
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

  // Log the error
  const context = {
    userId,
    requestId,
    method,
    url,
    clientIp,
    userAgent: req.headers['user-agent'],
  };

  logApiError(error, url, method, context);

  // Determine error response
  let statusCode = 500;
  let errorType = 'InternalServerError';
  let message = 'An unexpected error occurred';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    errorType = error.constructor.name.replace('Error', '');
    message = error.message;
    details = error.details;
    code = getErrorCode(error);
  } else if (error instanceof Error) {
    // Check for Prisma errors
    if (error.message.includes('P2002')) {
      statusCode = 409;
      errorType = 'Conflict';
      message = 'A resource with this identifier already exists';
      code = 'DUPLICATE_RESOURCE';
    } else if (error.message.includes('P2025')) {
      statusCode = 404;
      errorType = 'NotFound';
      message = 'The requested resource was not found';
      code = 'NOT_FOUND';
    } else if (error.message.includes('P2003')) {
      statusCode = 400;
      errorType = 'ValidationError';
      message = 'Invalid reference to related resource';
      code = 'INVALID_REFERENCE';
    } else {
      // Log full error in development
      if (process.env.NODE_ENV === 'development') {
        message = error.message;
        details = { stack: error.stack };
      }
    }
  }

  // Send standardized error response
  res.status(statusCode).json({
    error: errorType,
    message,
    code,
    details,
    requestId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get standardized error code for known error types
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
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends NextApiRequest = NextApiRequest>(
  fn: (req: T, res: NextApiResponse) => Promise<void>,
) {
  return async (req: T, res: NextApiResponse) => {
    try {
      await fn(req, res);
    } catch (error) {
      handleApiError(error, req, res);
    }
  };
}

/**
 * Try-catch wrapper with error transformation
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  errorType: typeof ApiError = ApiError,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(errorMessage, {
      originalError: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new errorType(
      errorMessage,
      500,
      true,
      error instanceof Error ? { originalError: error.message } : undefined,
    );
  }
}

/**
 * Validate and sanitize request data
 */
export function validateRequestData<T>(
  data: unknown,
  requiredFields: string[],
  optionalFields?: string[],
): T {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Invalid request data');
  }

  const requestData = data as Record<string, any>;
  const result: Record<string, any> = {};

  // Check required fields
  for (const field of requiredFields) {
    if (
      !(field in requestData) ||
      requestData[field] === undefined ||
      requestData[field] === null
    ) {
      throw new ValidationError(`Missing required field: ${field}`);
    }
    result[field] = requestData[field];
  }

  // Include optional fields if present
  if (optionalFields) {
    for (const field of optionalFields) {
      if (field in requestData && requestData[field] !== undefined) {
        result[field] = requestData[field];
      }
    }
  }

  return result as T;
}
