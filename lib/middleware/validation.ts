import { NextApiRequest, NextApiResponse } from 'next';
import { z, ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger';
import { ApiError } from '../errors';
import DOMPurify from 'isomorphic-dompurify';
import { startMonitoring, completeMonitoring } from '../monitoring/api';

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  response?: ZodSchema;
  sanitize?: boolean;
  enableMonitoring?: boolean; // Default true
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize input to prevent XSS
 */
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim();
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (input && typeof input === 'object' && input.constructor === Object) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}

/**
 * Handle validation errors
 */
function handleValidationError(
  res: NextApiResponse,
  error: ZodError,
  type: 'query' | 'body' | 'params',
  requestId: string,
) {
  const errors = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  logger.warn('Validation failed', {
    requestId,
    type,
    errors,
  });

  return res.status(400).json({
    error: `Validation error in ${type}`,
    details: errors,
    requestId,
  });
}

/**
 * Validation middleware with Zod
 */
export function withValidation(options: ValidationOptions = {}) {
  return function (handler: any) {
    return async function validatedHandler(req: NextApiRequest, res: NextApiResponse) {
      const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
      const startTime = Date.now();

      // Start monitoring if enabled (default true)
      const monitoringData =
        options.enableMonitoring !== false
          ? startMonitoring(req, requestId, (req as any).userId)
          : null;

      try {
        // Add request ID to request object
        (req as any).requestId = requestId;

        // Log incoming request
        logger.info('API Request', {
          requestId,
          method: req.method,
          url: req.url,
          userId: (req as any).userId,
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        });

        // Sanitize inputs if enabled
        if (options.sanitize !== false) {
          if (req.body) {
            req.body = sanitizeInput(req.body);
          }
          if (req.query) {
            req.query = sanitizeInput(req.query) as any;
          }
        }

        // Validate query parameters
        if (options.query && req.query) {
          try {
            const validated = options.query.parse(req.query);
            req.query = validated as any;
            logger.debug('Query validation passed', { requestId, query: validated });
          } catch (error) {
            if (error instanceof ZodError) {
              return handleValidationError(res, error, 'query', requestId);
            }
            throw error;
          }
        }

        // Validate request body
        if (options.body && req.body) {
          try {
            req.body = options.body.parse(req.body);
            logger.debug('Body validation passed', { requestId });
          } catch (error) {
            if (error instanceof ZodError) {
              return handleValidationError(res, error, 'body', requestId);
            }
            throw error;
          }
        }

        // Validate path parameters
        if (options.params && req.query) {
          try {
            const params = options.params.parse(req.query);
            Object.assign(req.query, params);
            logger.debug('Params validation passed', { requestId, params });
          } catch (error) {
            if (error instanceof ZodError) {
              return handleValidationError(res, error, 'params', requestId);
            }
            throw error;
          }
        }

        // Store original methods for response validation and monitoring
        const originalJson = res.json;
        const originalStatus = res.status;
        let responseData: any;
        let statusCode = 200;

        // Override status method to capture status code
        res.status = function (code: number) {
          statusCode = code;
          return originalStatus.call(this, code);
        };

        // Override json method to capture and validate response
        res.json = function (data: any) {
          responseData = data;

          // Complete monitoring
          if (monitoringData) {
            const error = data?.error || (statusCode >= 400 ? data?.message : undefined);
            completeMonitoring(monitoringData, statusCode, error);
          }

          if (options.response) {
            try {
              const validatedData = options.response.parse(data);
              logger.debug('Response validation passed', { requestId });
              return originalJson.call(this, validatedData);
            } catch (error) {
              logger.error('Response validation failed', {
                requestId,
                error: error instanceof Error ? error.message : 'Unknown error',
                data,
              });

              // In development, throw error
              if (process.env.NODE_ENV === 'development') {
                return originalJson.call(this, {
                  error: 'Response validation failed',
                  details: error instanceof ZodError ? error.errors : undefined,
                  requestId,
                });
              }
            }
          }

          return originalJson.call(this, data);
        };

        // Add request ID to response headers
        res.setHeader('X-Request-ID', requestId);
        res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);

        // Call the actual handler
        const result = await handler(req, res);

        // Log successful response
        const duration = Date.now() - startTime;
        logger.info('API Response', {
          requestId,
          status: res.statusCode,
          duration,
          userId: (req as any).userId,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Complete monitoring with error
        if (monitoringData) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStatus = error instanceof ApiError ? error.statusCode : 500;
          completeMonitoring(monitoringData, errorStatus, errorMessage);
        }

        // Log error
        logger.error('API Error', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          userId: (req as any).userId,
          duration,
        });

        // Handle different error types
        if (error instanceof ApiError) {
          return res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
            requestId,
          });
        }

        if (error instanceof ZodError) {
          return handleValidationError(res, error, 'body', requestId);
        }

        // Default error response
        return res.status(500).json({
          error: 'Internal server error',
          requestId,
        });
      }
    };
  };
}

/**
 * Validates an Australian Business Number (ABN) checksum
 */
export function validateABNChecksum(abn: string): boolean {
  if (!/^\d{11}$/.test(abn)) {
    return false;
  }

  const digits = abn.split('').map(Number);
  digits[0] -= 1;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }

  return sum % 89 === 0;
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z
      .union([z.string(), z.number()])
      .transform((v) => Number(v))
      .pipe(z.number().min(1))
      .default(1),
    limit: z
      .union([z.string(), z.number()])
      .transform((v) => Number(v))
      .pipe(z.number().min(1).max(100))
      .default(20),
  }),

  // ID validation
  id: z.string().uuid('Invalid ID format'),

  // Date range
  dateRange: z
    .object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    })
    .refine((data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    }, 'Start date must be before end date'),

  // Australian phone number
  phoneNumber: z.string().regex(/^(\+61|0)[2-478][\d]{8}$/, 'Invalid Australian phone number'),

  // ABN validation with checksum
  abn: z
    .string()
    .regex(/^\d{11}$/, 'ABN must be 11 digits')
    .refine(validateABNChecksum, 'Invalid ABN checksum'),

  // TFN validation
  tfn: z.string().regex(/^\d{8,9}$/, 'TFN must be 8 or 9 digits'),

  // Amount validation
  amount: z.number().positive('Amount must be positive').multipleOf(0.01),

  // Percentage validation
  percentage: z.number().min(0).max(100),

  // Email validation
  email: z.string().email().toLowerCase().trim(),

  // Password validation
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),

  // GST validation
  gstAmount: z.number().min(0).multipleOf(0.01).optional(),

  // Tax category validation
  taxCategory: z
    .enum([
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
      'D8',
      'D9',
      'D10',
      'D11',
      'D12',
      'D13',
      'D14',
      'D15',
      'P8',
    ])
    .optional(),

  // Australian postcode
  postcode: z.string().regex(/^\d{4}$/, 'Invalid Australian postcode'),

  // Australian state
  state: z.enum(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']),

  // Sort order
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // Boolean from string
  booleanString: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => v === 'true' || v === true),
};

/**
 * Response schemas
 */
export const responseSchemas = {
  // Success response
  success: <T extends ZodSchema>(dataSchema: T) =>
    z.object({
      success: z.literal(true),
      data: dataSchema,
    }),

  // Paginated response
  paginated: <T extends ZodSchema>(itemSchema: T, itemsKey: string = 'items') =>
    z.object({
      success: z.literal(true),
      data: z.object({
        [itemsKey]: z.array(itemSchema),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          pages: z.number(),
          hasMore: z.boolean(),
        }),
      }),
    }),

  // Error response
  error: z.object({
    error: z.string(),
    code: z.string().optional(),
    details: z
      .array(
        z.object({
          field: z.string(),
          message: z.string(),
          code: z.string(),
        }),
      )
      .optional(),
    requestId: z.string(),
  }),
};

/**
 * Method validation decorator
 */
export function validateMethod(allowedMethods: string[]) {
  return function (handler: any) {
    return async function (req: NextApiRequest, res: NextApiResponse) {
      if (!allowedMethods.includes(req.method || '')) {
        logger.warn('Method not allowed', {
          method: req.method,
          allowed: allowedMethods,
          url: req.url,
        });

        res.setHeader('Allow', allowedMethods.join(', '));
        return res.status(405).json({
          error: 'Method not allowed',
          allowed: allowedMethods,
        });
      }
      return handler(req, res);
    };
  };
}

/**
 * Compose multiple middlewares
 */
export function composeMiddleware(...middlewares: any[]) {
  return (handler: any) => {
    // Apply middlewares in reverse order so they execute in the order they were passed
    return middlewares.reduceRight((next, middleware) => {
      return (req: any, res: any) => {
        // Ensure req and res are passed through the middleware chain
        return middleware(next)(req, res);
      };
    }, handler);
  };
}
