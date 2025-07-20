/**
 * Comprehensive API input validation utility
 * Provides runtime validation and sanitization for API endpoints
 */

import { z } from 'zod';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Common validation schemas
 */
export const validators = {
  // Email validation
  email: z.string().email().toLowerCase().trim(),
  
  // Password validation (matches the regex from validation.ts)
  password: z.string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  
  // Australian phone number
  phoneNumber: z.string()
    .regex(
      /^(\+61|0)[2-478](?:[ -]?[0-9]){8}$/,
      'Invalid Australian phone number'
    ),
  
  // Australian postcode
  postcode: z.string().regex(/^\d{4}$/, 'Australian postcode must be 4 digits'),
  
  // ABN validation
  abn: z.string()
    .regex(/^\d{11}$/, 'ABN must be 11 digits')
    .refine((abn) => validateABNChecksum(abn), 'Invalid ABN - checksum verification failed'),
  
  // Amount validation
  amount: z.number().positive().finite(),
  
  // UUID validation
  uuid: z.string().uuid(),
  
  // Date validation
  date: z.string().datetime(),
  
  // URL validation
  url: z.string().url(),
  
  // Safe string (no HTML/script tags)
  safeString: z.string().transform((val) => sanitizeString(val)),
  
  // Page number for pagination
  page: z.number().int().positive().default(1),
  
  // Limit for pagination
  limit: z.number().int().positive().max(100).default(20),
  
  // Sort order
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Boolean
  boolean: z.boolean(),
  
  // Tax year (Australian)
  taxYear: z.number().int().min(2000).max(new Date().getFullYear() + 1),
};

/**
 * ABN checksum validation (from validation.ts)
 */
function validateABNChecksum(abn: string): boolean {
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
 * Sanitize string to prevent XSS
 */
function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Create a validated API handler
 */
export function createValidatedHandler<TBody = any, TQuery = any>(
  config: {
    bodySchema?: z.ZodSchema<TBody>;
    querySchema?: z.ZodSchema<TQuery>;
    allowedMethods?: string[];
  },
  handler: (
    req: NextApiRequest & { validatedBody?: TBody; validatedQuery?: TQuery },
    res: NextApiResponse
  ) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Check allowed methods
    if (config.allowedMethods && !config.allowedMethods.includes(req.method || '')) {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
      // Validate body
      if (config.bodySchema && req.body) {
        const validatedBody = config.bodySchema.parse(req.body);
        (req as any).validatedBody = validatedBody;
      }
      
      // Validate query
      if (config.querySchema && req.query) {
        const validatedQuery = config.querySchema.parse(req.query);
        (req as any).validatedQuery = validatedQuery;
      }
      
      // Call the handler with validated data
      await handler(req as any, res);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Return validation errors
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      
      // Re-throw other errors
      throw error;
    }
  };
}

/**
 * Common request schemas
 */
export const commonSchemas = {
  // Login request
  loginRequest: z.object({
    email: validators.email,
    password: validators.password,
  }),
  
  // Registration request
  registerRequest: z.object({
    email: validators.email,
    password: validators.password,
    name: validators.safeString.min(1).max(100),
    phoneNumber: validators.phoneNumber.optional(),
    abn: validators.abn.optional(),
  }),
  
  // Pagination query
  paginationQuery: z.object({
    page: validators.page,
    limit: validators.limit,
    sortBy: z.string().optional(),
    sortOrder: validators.sortOrder,
  }),
  
  // ID parameter
  idParam: z.object({
    id: validators.uuid,
  }),
  
  // Transaction creation
  transactionRequest: z.object({
    amount: validators.amount,
    description: validators.safeString.max(500),
    category: validators.safeString.max(50),
    date: validators.date,
    isDeductible: validators.boolean.optional(),
  }),
  
  // Goal creation
  goalRequest: z.object({
    title: validators.safeString.min(1).max(100),
    description: validators.safeString.max(500).optional(),
    targetAmount: validators.amount,
    targetDate: validators.date,
  }),
};

/**
 * Validate and sanitize request data
 */
export async function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: any }> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      };
    }
    throw error;
  }
}

/**
 * Example usage:
 * 
 * export default createValidatedHandler(
 *   {
 *     bodySchema: commonSchemas.loginRequest,
 *     allowedMethods: ['POST'],
 *   },
 *   async (req, res) => {
 *     const { email, password } = req.validatedBody!;
 *     // Handle login with validated data
 *   }
 * );
 */