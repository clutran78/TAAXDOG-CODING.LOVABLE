/**
 * Comprehensive Input Validation and Sanitization
 * Provides validation for forms, API endpoints, and financial data
 */

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

// Custom error messages
export const ValidationErrors = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_ABN: 'Please enter a valid ABN',
  INVALID_TFN: 'Please enter a valid TFN',
  INVALID_BSB: 'Please enter a valid BSB',
  INVALID_ACCOUNT: 'Please enter a valid account number',
  INVALID_AMOUNT: 'Please enter a valid amount',
  INVALID_DATE: 'Please enter a valid date',
  INVALID_TAX_YEAR: 'Please enter a valid tax year',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
  PASSWORD_TOO_WEAK: 'Password must include uppercase, lowercase, number, and special character',
  INVALID_URL: 'Please enter a valid URL',
  INVALID_JSON: 'Invalid JSON format',
  FILE_TOO_LARGE: 'File size exceeds maximum allowed',
  INVALID_FILE_TYPE: 'File type not allowed',
  INVALID_POSTCODE: 'Please enter a valid Australian postcode',
  INVALID_STATE: 'Please enter a valid Australian state',
  SQL_INJECTION: 'Invalid characters detected',
  XSS_DETECTED: 'Potentially unsafe content detected',
  INVALID_CURRENCY: 'Please enter a valid currency amount',
  FUTURE_DATE: 'Date cannot be in the future',
  PAST_DATE: 'Date cannot be in the past',
  INVALID_PERCENTAGE: 'Percentage must be between 0 and 100',
  INVALID_TAX_CATEGORY: 'Invalid tax category',
} as const;

// Australian specific validators
export const AustralianValidators = {
  // Validate ABN (Australian Business Number)
  isValidABN: (abn: string): boolean => {
    const cleanABN = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanABN)) return false;

    // ABN validation algorithm
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const digits = cleanABN.split('').map(Number);
    digits[0] -= 1;

    const sum = digits.reduce((acc, digit, idx) => acc + digit * weights[idx], 0);
    return sum % 89 === 0;
  },

  // Validate TFN (Tax File Number)
  isValidTFN: (tfn: string): boolean => {
    const cleanTFN = tfn.replace(/\s/g, '');
    if (!/^\d{8,9}$/.test(cleanTFN)) return false;

    // TFN validation algorithm
    const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10];
    const digits = cleanTFN.split('').map(Number);
    
    const sum = digits.reduce((acc, digit, idx) => acc + digit * weights[idx], 0);
    return sum % 11 === 0;
  },

  // Validate BSB (Bank State Branch)
  isValidBSB: (bsb: string): boolean => {
    const cleanBSB = bsb.replace(/[-\s]/g, '');
    return /^\d{6}$/.test(cleanBSB);
  },

  // Validate Australian phone number
  isValidAustralianPhone: (phone: string): boolean => {
    try {
      return isValidPhoneNumber(phone, 'AU');
    } catch {
      return false;
    }
  },

  // Validate Australian postcode
  isValidPostcode: (postcode: string): boolean => {
    return /^(0[289][0-9]{2}|[1-9][0-9]{3})$/.test(postcode);
  },

  // Validate Australian state
  isValidState: (state: string): boolean => {
    const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
    return states.includes(state.toUpperCase());
  },

  // Validate tax year
  isValidTaxYear: (year: string | number): boolean => {
    const yearNum = typeof year === 'string' ? parseInt(year) : year;
    const currentYear = new Date().getFullYear();
    return yearNum >= 2000 && yearNum <= currentYear + 1;
  },
};

// Financial validators
export const FinancialValidators = {
  // Validate currency amount
  isValidCurrency: (amount: string | number): boolean => {
    const amountStr = amount.toString();
    return /^\d+(\.\d{1,2})?$/.test(amountStr) && parseFloat(amountStr) >= 0;
  },

  // Validate percentage
  isValidPercentage: (percentage: string | number): boolean => {
    const percentNum = typeof percentage === 'string' ? parseFloat(percentage) : percentage;
    return !isNaN(percentNum) && percentNum >= 0 && percentNum <= 100;
  },

  // Validate account number
  isValidAccountNumber: (accountNumber: string): boolean => {
    const cleanAccount = accountNumber.replace(/[-\s]/g, '');
    return /^\d{5,10}$/.test(cleanAccount);
  },

  // Validate tax category
  isValidTaxCategory: (category: string): boolean => {
    const validCategories = [
      'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10',
      'D11', 'D12', 'D13', 'D14', 'D15', 'P8'
    ];
    return validCategories.includes(category.toUpperCase());
  },
};

// Input sanitizers
export const Sanitizers = {
  // Sanitize HTML content
  sanitizeHTML: (input: string): string => {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href', 'target'],
    });
  },

  // Sanitize for SQL injection
  sanitizeSQL: (input: string): string => {
    return input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/xp_/gi, '')
      .replace(/union\s+select/gi, '');
  },

  // Sanitize filename
  sanitizeFilename: (filename: string): string => {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  },

  // Sanitize JSON
  sanitizeJSON: (input: string): string | null => {
    try {
      const parsed = JSON.parse(input);
      return JSON.stringify(parsed);
    } catch {
      return null;
    }
  },

  // Sanitize phone number
  sanitizePhone: (phone: string): string => {
    try {
      const parsed = parsePhoneNumber(phone, 'AU');
      return parsed ? parsed.format('E164') : phone.replace(/\D/g, '');
    } catch {
      return phone.replace(/\D/g, '');
    }
  },

  // Sanitize ABN
  sanitizeABN: (abn: string): string => {
    return abn.replace(/\D/g, '').substring(0, 11);
  },

  // Sanitize currency
  sanitizeCurrency: (amount: string): string => {
    return amount.replace(/[^\d.]/g, '').replace(/\.(?=.*\.)/g, '');
  },

  // Sanitize whitespace
  sanitizeWhitespace: (input: string): string => {
    return input.trim().replace(/\s+/g, ' ');
  },
};

// Zod schemas for common validations
export const CommonSchemas = {
  // Email schema
  email: z
    .string()
    .min(1, ValidationErrors.REQUIRED)
    .email(ValidationErrors.INVALID_EMAIL)
    .transform(val => val.toLowerCase().trim()),

  // Password schema
  password: z
    .string()
    .min(8, ValidationErrors.PASSWORD_TOO_SHORT)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      ValidationErrors.PASSWORD_TOO_WEAK
    ),

  // Phone schema
  phone: z
    .string()
    .min(1, ValidationErrors.REQUIRED)
    .refine(AustralianValidators.isValidAustralianPhone, ValidationErrors.INVALID_PHONE)
    .transform(Sanitizers.sanitizePhone),

  // ABN schema
  abn: z
    .string()
    .min(1, ValidationErrors.REQUIRED)
    .transform(Sanitizers.sanitizeABN)
    .refine(AustralianValidators.isValidABN, ValidationErrors.INVALID_ABN),

  // TFN schema
  tfn: z
    .string()
    .min(1, ValidationErrors.REQUIRED)
    .transform(val => val.replace(/\D/g, ''))
    .refine(AustralianValidators.isValidTFN, ValidationErrors.INVALID_TFN),

  // BSB schema
  bsb: z
    .string()
    .min(1, ValidationErrors.REQUIRED)
    .transform(val => val.replace(/\D/g, ''))
    .refine(AustralianValidators.isValidBSB, ValidationErrors.INVALID_BSB),

  // Account number schema
  accountNumber: z
    .string()
    .min(1, ValidationErrors.REQUIRED)
    .transform(val => val.replace(/\D/g, ''))
    .refine(FinancialValidators.isValidAccountNumber, ValidationErrors.INVALID_ACCOUNT),

  // Currency amount schema
  currency: z
    .union([z.string(), z.number()])
    .transform(val => {
      const str = val.toString();
      return Sanitizers.sanitizeCurrency(str);
    })
    .refine(FinancialValidators.isValidCurrency, ValidationErrors.INVALID_CURRENCY)
    .transform(val => parseFloat(val)),

  // Percentage schema
  percentage: z
    .union([z.string(), z.number()])
    .transform(val => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return Math.max(0, Math.min(100, num));
    })
    .refine(FinancialValidators.isValidPercentage, ValidationErrors.INVALID_PERCENTAGE),

  // Date schema
  date: z
    .union([z.string(), z.date()])
    .transform(val => {
      if (val instanceof Date) return val;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    })
    .refine(val => val !== null, ValidationErrors.INVALID_DATE),

  // Tax year schema
  taxYear: z
    .union([z.string(), z.number()])
    .transform(val => {
      const year = typeof val === 'string' ? parseInt(val) : val;
      return isNaN(year) ? null : year;
    })
    .refine(val => val !== null && AustralianValidators.isValidTaxYear(val), ValidationErrors.INVALID_TAX_YEAR),

  // URL schema
  url: z
    .string()
    .url(ValidationErrors.INVALID_URL)
    .transform(val => val.trim()),

  // Postcode schema
  postcode: z
    .string()
    .min(1, ValidationErrors.REQUIRED)
    .refine(AustralianValidators.isValidPostcode, ValidationErrors.INVALID_POSTCODE),

  // State schema
  state: z
    .string()
    .min(1, ValidationErrors.REQUIRED)
    .transform(val => val.toUpperCase())
    .refine(AustralianValidators.isValidState, ValidationErrors.INVALID_STATE),

  // Tax category schema
  taxCategory: z
    .string()
    .min(1, ValidationErrors.REQUIRED)
    .transform(val => val.toUpperCase())
    .refine(FinancialValidators.isValidTaxCategory, ValidationErrors.INVALID_TAX_CATEGORY),
};

// Form schemas
export const FormSchemas = {
  // Login form
  login: z.object({
    email: CommonSchemas.email,
    password: z.string().min(1, ValidationErrors.REQUIRED),
    rememberMe: z.boolean().optional(),
  }),

  // Registration form
  registration: z.object({
    email: CommonSchemas.email,
    password: CommonSchemas.password,
    confirmPassword: z.string().min(1, ValidationErrors.REQUIRED),
    firstName: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
    lastName: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
    phone: CommonSchemas.phone.optional(),
    acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  }),

  // Profile update form
  profileUpdate: z.object({
    firstName: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
    lastName: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
    phone: CommonSchemas.phone.optional(),
    address: z.string().optional().transform(val => val ? Sanitizers.sanitizeWhitespace(val) : val),
    postcode: CommonSchemas.postcode.optional(),
    state: CommonSchemas.state.optional(),
  }),

  // Bank details form
  bankDetails: z.object({
    accountName: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
    bsb: CommonSchemas.bsb,
    accountNumber: CommonSchemas.accountNumber,
  }),

  // Business details form
  businessDetails: z.object({
    businessName: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
    abn: CommonSchemas.abn,
    businessAddress: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
    businessPhone: CommonSchemas.phone,
    businessEmail: CommonSchemas.email,
  }),

  // Tax return form
  taxReturn: z.object({
    taxYear: CommonSchemas.taxYear,
    tfn: CommonSchemas.tfn,
    income: CommonSchemas.currency,
    deductions: z.array(z.object({
      category: CommonSchemas.taxCategory,
      amount: CommonSchemas.currency,
      description: z.string().transform(Sanitizers.sanitizeWhitespace),
    })),
    bankDetails: z.object({
      bsb: CommonSchemas.bsb,
      accountNumber: CommonSchemas.accountNumber,
    }),
  }),

  // Expense form
  expense: z.object({
    date: CommonSchemas.date,
    amount: CommonSchemas.currency,
    category: CommonSchemas.taxCategory,
    description: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
    receipt: z.string().optional(),
    gstIncluded: z.boolean().default(true),
  }),

  // Invoice form
  invoice: z.object({
    invoiceNumber: z.string().min(1, ValidationErrors.REQUIRED),
    date: CommonSchemas.date,
    dueDate: CommonSchemas.date,
    clientName: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
    clientEmail: CommonSchemas.email,
    items: z.array(z.object({
      description: z.string().min(1, ValidationErrors.REQUIRED).transform(Sanitizers.sanitizeWhitespace),
      quantity: z.number().positive(),
      rate: CommonSchemas.currency,
      gst: CommonSchemas.percentage,
    })).min(1, 'At least one item is required'),
  }),
};

// API endpoint schemas
export const ApiSchemas = {
  // Auth endpoints
  auth: {
    login: FormSchemas.login,
    register: FormSchemas.registration,
    resetPassword: z.object({
      email: CommonSchemas.email,
    }),
    changePassword: z.object({
      currentPassword: z.string().min(1, ValidationErrors.REQUIRED),
      newPassword: CommonSchemas.password,
      confirmPassword: z.string().min(1, ValidationErrors.REQUIRED),
    }).refine(data => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
  },

  // Banking endpoints
  banking: {
    connect: z.object({
      institutionId: z.string().min(1, ValidationErrors.REQUIRED),
      credentials: z.record(z.string()),
    }),
    transaction: z.object({
      accountId: z.string().min(1, ValidationErrors.REQUIRED),
      startDate: CommonSchemas.date.optional(),
      endDate: CommonSchemas.date.optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }),
  },

  // AI endpoints
  ai: {
    analyze: z.object({
      type: z.enum(['receipt', 'expense', 'tax', 'financial']),
      data: z.union([
        z.string(),
        z.object({
          image: z.string().optional(),
          text: z.string().optional(),
          amount: CommonSchemas.currency.optional(),
        }),
      ]),
    }),
    chat: z.object({
      message: z.string().min(1, ValidationErrors.REQUIRED).max(1000),
      context: z.record(z.unknown()).optional(),
    }),
  },

  // File upload
  fileUpload: z.object({
    filename: z.string().transform(Sanitizers.sanitizeFilename),
    mimetype: z.enum([
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]),
    size: z.number().max(10 * 1024 * 1024, ValidationErrors.FILE_TOO_LARGE), // 10MB max
  }),
};

// Validation utilities
export const ValidationUtils = {
  // Validate and sanitize input
  validateAndSanitize: async <T>(
    schema: z.ZodSchema<T>,
    data: unknown
  ): Promise<{ success: true; data: T } | { success: false; errors: z.ZodError }> => {
    try {
      const validated = await schema.parseAsync(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false, errors: error };
      }
      throw error;
    }
  },

  // Check for SQL injection patterns
  checkSQLInjection: (input: string): boolean => {
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(--|\/\*|\*\/|xp_|sp_)/gi,
      /(\b(and|or)\b\s*\d+\s*=\s*\d+)/gi,
    ];
    return sqlPatterns.some(pattern => pattern.test(input));
  },

  // Check for XSS patterns
  checkXSS: (input: string): boolean => {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
    ];
    return xssPatterns.some(pattern => pattern.test(input));
  },

  // Validate file upload
  validateFileUpload: (file: { name: string; type: string; size: number }): string | null => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(file.type)) {
      return ValidationErrors.INVALID_FILE_TYPE;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      return ValidationErrors.FILE_TOO_LARGE;
    }

    return null;
  },

  // Format validation errors for API response
  formatValidationErrors: (error: z.ZodError): Record<string, string> => {
    const formatted: Record<string, string> = {};
    
    error.errors.forEach(err => {
      const path = err.path.join('.');
      formatted[path] = err.message;
    });
    
    return formatted;
  },

  // Batch validate multiple fields
  batchValidate: async (
    validations: Array<{ field: string; value: unknown; schema: z.ZodSchema }>
  ): Promise<Record<string, string>> => {
    const errors: Record<string, string> = {};
    
    await Promise.all(
      validations.map(async ({ field, value, schema }) => {
        try {
          await schema.parseAsync(value);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors[field] = error.errors[0]?.message || 'Invalid value';
          }
        }
      })
    );
    
    return errors;
  },
};

// Export all validators
export const Validators = {
  ...AustralianValidators,
  ...FinancialValidators,
  isEmail: (email: string): boolean => validator.isEmail(email),
  isURL: (url: string): boolean => validator.isURL(url),
  isUUID: (uuid: string): boolean => validator.isUUID(uuid),
  isJSON: (json: string): boolean => validator.isJSON(json),
  isAlphanumeric: (str: string): boolean => validator.isAlphanumeric(str),
  isCreditCard: (card: string): boolean => validator.isCreditCard(card),
  isStrongPassword: (password: string): boolean => {
    return validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    });
  },
};

// Export everything
export default {
  ValidationErrors,
  Validators,
  Sanitizers,
  CommonSchemas,
  FormSchemas,
  ApiSchemas,
  ValidationUtils,
};