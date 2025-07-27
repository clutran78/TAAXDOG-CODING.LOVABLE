import { NextApiResponse } from 'next';
import { logger } from './logger';

/**
 * Standard API Response Format
 *
 * This utility provides consistent response patterns across all API endpoints
 * following REST best practices and proper HTTP status codes
 */

// Response type definitions
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  version?: string;
  processingTime?: number;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Standard error codes
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Business logic
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
} as const;

// HTTP Status code mapping
const STATUS_CODE_MAP: Record<string, number> = {
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.INVALID_CREDENTIALS]: 401,
  [ERROR_CODES.TOKEN_EXPIRED]: 401,
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.INVALID_REQUEST]: 400,
  [ERROR_CODES.MISSING_REQUIRED_FIELDS]: 400,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.ALREADY_EXISTS]: 409,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 502,
  [ERROR_CODES.INSUFFICIENT_FUNDS]: 400,
  [ERROR_CODES.ACCOUNT_LOCKED]: 403,
  [ERROR_CODES.EMAIL_NOT_VERIFIED]: 403,
  [ERROR_CODES.OPERATION_NOT_ALLOWED]: 403,
};

/**
 * Send a successful response
 */
export function sendSuccess<T = any>(
  res: NextApiResponse,
  data: T,
  options?: {
    statusCode?: number;
    meta?: Partial<ResponseMeta>;
    headers?: Record<string, string>;
  },
): void {
  const statusCode = options?.statusCode || 200;
  const meta: ResponseMeta = {
    timestamp: new Date().toISOString(),
    ...options?.meta,
  };

  // Set any custom headers
  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  // Set standard security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, private');

  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta,
  };

  res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: NextApiResponse,
  errorCode: string,
  message: string,
  options?: {
    statusCode?: number;
    details?: any;
    meta?: Partial<ResponseMeta>;
    headers?: Record<string, string>;
  },
): void {
  const statusCode = options?.statusCode || STATUS_CODE_MAP[errorCode] || 500;
  const meta: ResponseMeta = {
    timestamp: new Date().toISOString(),
    ...options?.meta,
  };

  // Set any custom headers
  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  // Set standard security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, private');

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(options?.details && { details: options.details }),
    },
    meta,
  };

  // Log errors for monitoring
  if (statusCode >= 500) {
    logger.error('API Error Response', {
      errorCode,
      message,
      statusCode,
      details: options?.details,
      requestId: meta.requestId,
    });
  }

  res.status(statusCode).json(response);
}

/**
 * Send a paginated response
 */
export function sendPaginatedSuccess<T = any>(
  res: NextApiResponse,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  options?: {
    meta?: Partial<ResponseMeta>;
    additionalData?: Record<string, any>;
  },
): void {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const hasNext = pagination.page < totalPages;
  const hasPrevious = pagination.page > 1;

  const paginationMeta: PaginationMeta = {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    totalPages,
    hasNext,
    hasPrevious,
  };

  const responseData = options?.additionalData
    ? { items: data, ...options.additionalData }
    : { items: data };

  sendSuccess(res, responseData, {
    meta: {
      ...options?.meta,
      pagination: paginationMeta,
    },
  });
}

/**
 * Send a created resource response (201)
 */
export function sendCreated<T = any>(
  res: NextApiResponse,
  data: T,
  options?: {
    location?: string;
    meta?: Partial<ResponseMeta>;
  },
): void {
  const headers: Record<string, string> = {};
  if (options?.location) {
    headers.Location = options.location;
  }

  sendSuccess(res, data, {
    statusCode: 201,
    meta: options?.meta,
    headers,
  });
}

/**
 * Send a no content response (204)
 */
export function sendNoContent(
  res: NextApiResponse,
  options?: {
    headers?: Record<string, string>;
  },
): void {
  // Set any custom headers
  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  res.status(204).end();
}

/**
 * Send validation error with field details
 */
export function sendValidationError(
  res: NextApiResponse,
  errors: Array<{ field: string; message: string }>,
  options?: {
    message?: string;
    meta?: Partial<ResponseMeta>;
  },
): void {
  sendError(res, ERROR_CODES.VALIDATION_ERROR, options?.message || 'Validation failed', {
    details: { errors },
    meta: options?.meta,
  });
}

/**
 * Send not found error
 */
export function sendNotFound(
  res: NextApiResponse,
  resource: string,
  options?: {
    meta?: Partial<ResponseMeta>;
  },
): void {
  sendError(res, ERROR_CODES.NOT_FOUND, `${resource} not found`, {
    meta: options?.meta,
  });
}

/**
 * Send unauthorized error
 */
export function sendUnauthorized(
  res: NextApiResponse,
  message?: string,
  options?: {
    meta?: Partial<ResponseMeta>;
  },
): void {
  sendError(res, ERROR_CODES.UNAUTHORIZED, message || 'Authentication required', {
    meta: options?.meta,
  });
}

/**
 * Send forbidden error
 */
export function sendForbidden(
  res: NextApiResponse,
  message?: string,
  options?: {
    meta?: Partial<ResponseMeta>;
  },
): void {
  sendError(res, ERROR_CODES.FORBIDDEN, message || 'Access denied', {
    meta: options?.meta,
  });
}

/**
 * Send rate limit error
 */
export function sendRateLimitError(
  res: NextApiResponse,
  options?: {
    retryAfter?: number;
    meta?: Partial<ResponseMeta>;
  },
): void {
  const headers: Record<string, string> = {};
  if (options?.retryAfter) {
    headers['Retry-After'] = options.retryAfter.toString();
  }

  sendError(res, ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Too many requests. Please try again later.', {
    headers,
    meta: options?.meta,
  });
}

/**
 * Send internal server error
 */
export function sendInternalError(
  res: NextApiResponse,
  error: Error | unknown,
  options?: {
    message?: string;
    meta?: Partial<ResponseMeta>;
    includeDetails?: boolean;
  },
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const message = options?.message || 'An unexpected error occurred';

  const details =
    isDevelopment && options?.includeDetails && error instanceof Error
      ? {
          errorMessage: error.message,
          stack: error.stack,
        }
      : undefined;

  sendError(res, ERROR_CODES.INTERNAL_ERROR, message, {
    details,
    meta: options?.meta,
  });
}

/**
 * Handle method not allowed
 */
export function sendMethodNotAllowed(
  res: NextApiResponse,
  allowedMethods: string[],
  options?: {
    meta?: Partial<ResponseMeta>;
  },
): void {
  res.setHeader('Allow', allowedMethods.join(', '));

  sendError(
    res,
    ERROR_CODES.OPERATION_NOT_ALLOWED,
    `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
    {
      statusCode: 405,
      meta: options?.meta,
    },
  );
}
