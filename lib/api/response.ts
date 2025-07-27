/**
 * Standardized API Response Utilities
 * Provides consistent response formats across all API endpoints
 */

import { NextApiResponse } from 'next';
import { logger } from '@/lib/logger';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: unknown;
  code?: string;
  timestamp: string;
}

export interface ApiPaginatedResponse<T = unknown> extends ApiSuccessResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * API Response Helper Class
 */
export class ApiResponseHelper {
  /**
   * Send a successful response
   */
  static success<T>(
    res: NextApiResponse<ApiSuccessResponse<T>>,
    data: T,
    message?: string,
    statusCode = 200,
    metadata?: Record<string, unknown>
  ): void {
    res.status(statusCode).json({
      success: true,
      data,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send an error response
   */
  static error(
    res: NextApiResponse<ApiErrorResponse>,
    error: string,
    statusCode = 400,
    details?: unknown,
    code?: string
  ): void {
    const errorResponse: ApiErrorResponse = {
      success: false,
      error,
      message: error,
      details,
      code,
      timestamp: new Date().toISOString(),
    };

    // Log errors for monitoring
    if (statusCode >= 500) {
      logger.error('API Error Response', {
        statusCode,
        error,
        details,
        code,
      });
    }

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Send a paginated response
   */
  static paginated<T>(
    res: NextApiResponse<ApiPaginatedResponse<T>>,
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
  ): void {
    const pages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      data,
      message,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send a no content response
   */
  static noContent(res: NextApiResponse): void {
    res.status(204).end();
  }

  /**
   * Send a created response
   */
  static created<T>(
    res: NextApiResponse<ApiSuccessResponse<T>>,
    data: T,
    message = 'Resource created successfully'
  ): void {
    this.success(res, data, message, 201);
  }

  /**
   * Send an unauthorized response
   */
  static unauthorized(
    res: NextApiResponse<ApiErrorResponse>,
    message = 'Unauthorized',
    details?: unknown
  ): void {
    this.error(res, message, 401, details, 'UNAUTHORIZED');
  }

  /**
   * Send a forbidden response
   */
  static forbidden(
    res: NextApiResponse<ApiErrorResponse>,
    message = 'Forbidden',
    details?: unknown
  ): void {
    this.error(res, message, 403, details, 'FORBIDDEN');
  }

  /**
   * Send a not found response
   */
  static notFound(
    res: NextApiResponse<ApiErrorResponse>,
    resource = 'Resource',
    details?: unknown
  ): void {
    this.error(res, `${resource} not found`, 404, details, 'NOT_FOUND');
  }

  /**
   * Send a validation error response
   */
  static validationError(
    res: NextApiResponse<ApiErrorResponse>,
    errors: unknown,
    message = 'Validation failed'
  ): void {
    this.error(res, message, 422, errors, 'VALIDATION_ERROR');
  }

  /**
   * Send a method not allowed response
   */
  static methodNotAllowed(
    res: NextApiResponse<ApiErrorResponse>,
    allowedMethods: string[]
  ): void {
    res.setHeader('Allow', allowedMethods.join(', '));
    this.error(
      res,
      'Method not allowed',
      405,
      { allowedMethods },
      'METHOD_NOT_ALLOWED'
    );
  }

  /**
   * Send a rate limit exceeded response
   */
  static rateLimitExceeded(
    res: NextApiResponse<ApiErrorResponse>,
    retryAfter?: number
  ): void {
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
    this.error(
      res,
      'Too many requests',
      429,
      { retryAfter },
      'RATE_LIMIT_EXCEEDED'
    );
  }

  /**
   * Send an internal server error response
   */
  static internalError(
    res: NextApiResponse<ApiErrorResponse>,
    error: unknown,
    message = 'Internal server error'
  ): void {
    // Log the actual error but don't expose details to client
    logger.error('Internal Server Error', error);
    
    this.error(
      res,
      message,
      500,
      process.env.NODE_ENV === 'development' ? error : undefined,
      'INTERNAL_ERROR'
    );
  }

  /**
   * Handle common HTTP errors
   */
  static handleError(
    res: NextApiResponse<ApiErrorResponse>,
    error: unknown
  ): void {
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('Unauthorized')) {
        this.unauthorized(res, error.message);
      } else if (error.message.includes('Forbidden')) {
        this.forbidden(res, error.message);
      } else if (error.message.includes('Not found')) {
        this.notFound(res, error.message);
      } else if (error.message.includes('Validation')) {
        this.validationError(res, error.message);
      } else {
        this.internalError(res, error);
      }
    } else {
      this.internalError(res, error);
    }
  }
}

// Export a shorter alias for convenience
export const apiResponse = ApiResponseHelper;

// Backward compatibility exports
export const sendPaginatedSuccess = ApiResponseHelper.paginated;
export const sendError = ApiResponseHelper.error;
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

// Type guards
export function isApiSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

export function isApiErrorResponse<T>(
  response: ApiResponse<T>
): response is ApiErrorResponse {
  return response.success === false;
}

// Utility function to create consistent error objects
export function createApiError(
  message: string,
  code?: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: message,
    message,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}