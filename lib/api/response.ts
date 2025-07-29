/**
 * Standardized API Response Utilities
 * Provides consistent response formats across all API endpoints
 */

import { NextApiResponse } from 'next';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';

// Base response types
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
    field?: string;
    stack?: string;
  };
  timestamp: string;
  requestId?: string;
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

export interface ApiBatchResponse<T = unknown> extends ApiSuccessResponse<T[]> {
  batch: {
    total: number;
    successful: number;
    failed: number;
    errors?: Array<{
      index: number;
      error: string;
      item?: unknown;
    }>;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Error codes enum
export enum ApiErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  CONFLICT = 'CONFLICT',
  GONE = 'GONE',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  
  // Business logic errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  PRECONDITION_FAILED = 'PRECONDITION_FAILED',
  
  // Auth specific
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // External service errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
}

// Error messages map
const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  [ApiErrorCode.BAD_REQUEST]: 'Bad request',
  [ApiErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ApiErrorCode.FORBIDDEN]: 'Access denied',
  [ApiErrorCode.NOT_FOUND]: 'Resource not found',
  [ApiErrorCode.METHOD_NOT_ALLOWED]: 'Method not allowed',
  [ApiErrorCode.CONFLICT]: 'Resource conflict',
  [ApiErrorCode.GONE]: 'Resource no longer available',
  [ApiErrorCode.UNPROCESSABLE_ENTITY]: 'Unprocessable entity',
  [ApiErrorCode.TOO_MANY_REQUESTS]: 'Too many requests',
  [ApiErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ApiErrorCode.NOT_IMPLEMENTED]: 'Not implemented',
  [ApiErrorCode.BAD_GATEWAY]: 'Bad gateway',
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [ApiErrorCode.GATEWAY_TIMEOUT]: 'Gateway timeout',
  [ApiErrorCode.VALIDATION_ERROR]: 'Validation failed',
  [ApiErrorCode.BUSINESS_RULE_VIOLATION]: 'Business rule violation',
  [ApiErrorCode.DUPLICATE_RESOURCE]: 'Duplicate resource',
  [ApiErrorCode.RESOURCE_EXHAUSTED]: 'Resource exhausted',
  [ApiErrorCode.PRECONDITION_FAILED]: 'Precondition failed',
  [ApiErrorCode.TOKEN_EXPIRED]: 'Token expired',
  [ApiErrorCode.TOKEN_INVALID]: 'Invalid token',
  [ApiErrorCode.SESSION_EXPIRED]: 'Session expired',
  [ApiErrorCode.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
  [ApiErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ApiErrorCode.PAYMENT_FAILED]: 'Payment processing failed',
  [ApiErrorCode.EMAIL_SEND_FAILED]: 'Failed to send email',
};

// HTTP status code mapping
const ERROR_STATUS_CODES: Record<ApiErrorCode, number> = {
  [ApiErrorCode.BAD_REQUEST]: 400,
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.FORBIDDEN]: 403,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ApiErrorCode.CONFLICT]: 409,
  [ApiErrorCode.GONE]: 410,
  [ApiErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ApiErrorCode.TOO_MANY_REQUESTS]: 429,
  [ApiErrorCode.INTERNAL_ERROR]: 500,
  [ApiErrorCode.NOT_IMPLEMENTED]: 501,
  [ApiErrorCode.BAD_GATEWAY]: 502,
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ApiErrorCode.GATEWAY_TIMEOUT]: 504,
  [ApiErrorCode.VALIDATION_ERROR]: 422,
  [ApiErrorCode.BUSINESS_RULE_VIOLATION]: 422,
  [ApiErrorCode.DUPLICATE_RESOURCE]: 409,
  [ApiErrorCode.RESOURCE_EXHAUSTED]: 429,
  [ApiErrorCode.PRECONDITION_FAILED]: 412,
  [ApiErrorCode.TOKEN_EXPIRED]: 401,
  [ApiErrorCode.TOKEN_INVALID]: 401,
  [ApiErrorCode.SESSION_EXPIRED]: 401,
  [ApiErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ApiErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ApiErrorCode.PAYMENT_FAILED]: 402,
  [ApiErrorCode.EMAIL_SEND_FAILED]: 500,
};

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public message: string,
    public statusCode?: number,
    public details?: unknown,
    public field?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode || ERROR_STATUS_CODES[code] || 500;
  }

  toJSON(): ApiErrorResponse['error'] {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      field: this.field,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

/**
 * API Response Helper Class
 */
export class ApiResponseHelper {
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send a successful response
   */
  static success<T>(
    res: NextApiResponse<ApiSuccessResponse<T>>,
    data: T,
    options?: {
      message?: string;
      statusCode?: number;
      metadata?: Record<string, unknown>;
      requestId?: string;
    }
  ): void {
    const { message, statusCode = 200, metadata, requestId } = options || {};
    
    res.status(statusCode).json({
      success: true,
      data,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      requestId: requestId || this.generateRequestId(),
    });
  }

  /**
   * Send an error response
   */
  static error(
    res: NextApiResponse<ApiErrorResponse>,
    error: ApiError | Error | string,
    options?: {
      statusCode?: number;
      details?: unknown;
      field?: string;
      requestId?: string;
    }
  ): void {
    const { statusCode, details, field, requestId } = options || {};
    
    let errorResponse: ApiErrorResponse['error'];
    let status: number;

    if (error instanceof ApiError) {
      errorResponse = error.toJSON();
      status = error.statusCode;
    } else if (error instanceof Error) {
      errorResponse = {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: error.message,
        details: details || error,
        field,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
      status = statusCode || 500;
    } else {
      errorResponse = {
        code: ApiErrorCode.INTERNAL_ERROR,
        message: error,
        details,
        field,
      };
      status = statusCode || 500;
    }

    // Log errors for monitoring
    if (status >= 500) {
      logger.error('API Error Response', {
        status,
        error: errorResponse,
        requestId,
      });
    }

    res.status(status).json({
      success: false,
      error: errorResponse,
      timestamp: new Date().toISOString(),
      requestId: requestId || this.generateRequestId(),
    });
  }

  /**
   * Send a paginated response
   */
  static paginated<T>(
    res: NextApiResponse<ApiPaginatedResponse<T>>,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    options?: {
      message?: string;
      metadata?: Record<string, unknown>;
      requestId?: string;
    }
  ): void {
    const { page, limit, total } = pagination;
    const { message, metadata, requestId } = options || {};
    const pages = Math.ceil(total / limit);
    
    res.status(200).json({
      success: true,
      data,
      message,
      metadata,
      pagination: {
        page,
        limit,
        total,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
      requestId: requestId || this.generateRequestId(),
    });
  }

  /**
   * Send a batch response
   */
  static batch<T>(
    res: NextApiResponse<ApiBatchResponse<T>>,
    results: T[],
    batch: {
      total: number;
      successful: number;
      failed: number;
      errors?: Array<{
        index: number;
        error: string;
        item?: unknown;
      }>;
    },
    options?: {
      message?: string;
      metadata?: Record<string, unknown>;
      requestId?: string;
    }
  ): void {
    const { message, metadata, requestId } = options || {};
    
    res.status(207).json({ // 207 Multi-Status
      success: true,
      data: results,
      message,
      metadata,
      batch,
      timestamp: new Date().toISOString(),
      requestId: requestId || this.generateRequestId(),
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
    message?: string,
    options?: {
      location?: string;
      requestId?: string;
    }
  ): void {
    const { location, requestId } = options || {};
    
    if (location) {
      res.setHeader('Location', location);
    }
    
    this.success(res, data, { message, statusCode: 201, requestId });
  }

  /**
   * Send an accepted response (for async operations)
   */
  static accepted<T>(
    res: NextApiResponse<ApiSuccessResponse<T>>,
    data: T,
    options?: {
      message?: string;
      location?: string;
      retryAfter?: number;
      requestId?: string;
    }
  ): void {
    const { message = 'Request accepted for processing', location, retryAfter, requestId } = options || {};
    
    if (location) {
      res.setHeader('Location', location);
    }
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
    
    this.success(res, data, { message, statusCode: 202, requestId });
  }

  /**
   * Handle validation errors (including Zod)
   */
  static validationError(
    res: NextApiResponse<ApiErrorResponse>,
    errors: unknown,
    options?: {
      message?: string;
      requestId?: string;
    }
  ): void {
    const { message = 'Validation failed', requestId } = options || {};
    
    let details: unknown;
    
    if (errors instanceof ZodError) {
      details = errors.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));
    } else {
      details = errors;
    }
    
    const apiError = new ApiError(
      ApiErrorCode.VALIDATION_ERROR,
      message,
      422,
      details
    );
    
    this.error(res, apiError, { requestId });
  }

  /**
   * Common error responses
   */
  static unauthorized(res: NextApiResponse<ApiErrorResponse>, message?: string, requestId?: string): void {
    const apiError = new ApiError(
      ApiErrorCode.UNAUTHORIZED,
      message || ERROR_MESSAGES[ApiErrorCode.UNAUTHORIZED]
    );
    this.error(res, apiError, { requestId });
  }

  static forbidden(res: NextApiResponse<ApiErrorResponse>, message?: string, requestId?: string): void {
    const apiError = new ApiError(
      ApiErrorCode.FORBIDDEN,
      message || ERROR_MESSAGES[ApiErrorCode.FORBIDDEN]
    );
    this.error(res, apiError, { requestId });
  }

  static notFound(res: NextApiResponse<ApiErrorResponse>, resource?: string, requestId?: string): void {
    const apiError = new ApiError(
      ApiErrorCode.NOT_FOUND,
      resource ? `${resource} not found` : ERROR_MESSAGES[ApiErrorCode.NOT_FOUND]
    );
    this.error(res, apiError, { requestId });
  }

  static conflict(res: NextApiResponse<ApiErrorResponse>, message?: string, requestId?: string): void {
    const apiError = new ApiError(
      ApiErrorCode.CONFLICT,
      message || ERROR_MESSAGES[ApiErrorCode.CONFLICT]
    );
    this.error(res, apiError, { requestId });
  }

  static badRequest(res: NextApiResponse<ApiErrorResponse>, message?: string, requestId?: string): void {
    const apiError = new ApiError(
      ApiErrorCode.BAD_REQUEST,
      message || ERROR_MESSAGES[ApiErrorCode.BAD_REQUEST]
    );
    this.error(res, apiError, { requestId });
  }

  static tooManyRequests(
    res: NextApiResponse<ApiErrorResponse>,
    message?: string,
    retryAfter?: number,
    requestId?: string
  ): void {
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
    
    const apiError = new ApiError(
      ApiErrorCode.TOO_MANY_REQUESTS,
      message || ERROR_MESSAGES[ApiErrorCode.TOO_MANY_REQUESTS],
      429,
      { retryAfter }
    );
    this.error(res, apiError, { requestId });
  }

  static methodNotAllowed(
    res: NextApiResponse<ApiErrorResponse>,
    allowedMethods: string[],
    requestId?: string
  ): void {
    res.setHeader('Allow', allowedMethods.join(', '));
    
    const apiError = new ApiError(
      ApiErrorCode.METHOD_NOT_ALLOWED,
      ERROR_MESSAGES[ApiErrorCode.METHOD_NOT_ALLOWED],
      405,
      { allowedMethods }
    );
    this.error(res, apiError, { requestId });
  }

  static serviceUnavailable(
    res: NextApiResponse<ApiErrorResponse>,
    retryAfter?: number,
    requestId?: string
  ): void {
    if (retryAfter) {
      res.setHeader('Retry-After', retryAfter.toString());
    }
    
    const apiError = new ApiError(
      ApiErrorCode.SERVICE_UNAVAILABLE,
      ERROR_MESSAGES[ApiErrorCode.SERVICE_UNAVAILABLE],
      503,
      { retryAfter }
    );
    this.error(res, apiError, { requestId });
  }

  /**
   * Handle any error type
   */
  static handleError(
    res: NextApiResponse<ApiErrorResponse>,
    error: unknown,
    requestId?: string
  ): void {
    if (error instanceof ApiError) {
      this.error(res, error, { requestId });
    } else if (error instanceof ZodError) {
      this.validationError(res, error, { requestId });
    } else if (error instanceof Error) {
      // Map common error messages to appropriate responses
      const message = error.message.toLowerCase();
      
      if (message.includes('unauthorized') || message.includes('authentication')) {
        this.unauthorized(res, error.message, requestId);
      } else if (message.includes('forbidden') || message.includes('permission')) {
        this.forbidden(res, error.message, requestId);
      } else if (message.includes('not found')) {
        this.notFound(res, error.message, requestId);
      } else if (message.includes('validation') || message.includes('invalid')) {
        this.validationError(res, error.message, { requestId });
      } else if (message.includes('duplicate') || message.includes('already exists')) {
        this.conflict(res, error.message, requestId);
      } else {
        this.error(res, error, { statusCode: 500, requestId });
      }
    } else {
      this.error(res, String(error), { statusCode: 500, requestId });
    }
  }
}

// Export a shorter alias
export const apiResponse = ApiResponseHelper;

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

// Utility functions
export function createApiError(
  code: ApiErrorCode,
  message?: string,
  details?: unknown,
  field?: string
): ApiError {
  return new ApiError(
    code,
    message || ERROR_MESSAGES[code],
    ERROR_STATUS_CODES[code],
    details,
    field
  );
}

// Response formatter for client-side use
export class ApiResponseFormatter {
  static formatError(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object') {
      if ('error' in error && typeof (error as any).error === 'object') {
        const apiError = (error as ApiErrorResponse).error;
        return apiError.message || 'An error occurred';
      }
      
      if ('message' in error) {
        return (error as Error).message;
      }
    }
    
    return 'An unexpected error occurred';
  }

  static getErrorCode(error: unknown): string | undefined {
    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = (error as ApiErrorResponse).error;
      return apiError.code;
    }
    return undefined;
  }

  static getErrorDetails(error: unknown): unknown {
    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = (error as ApiErrorResponse).error;
      return apiError.details;
    }
    return undefined;
  }
}

// Export error codes for client use
export const ERROR_CODES = ApiErrorCode;

// Backward compatibility
export const sendPaginatedSuccess = ApiResponseHelper.paginated;
export const sendError = ApiResponseHelper.error;