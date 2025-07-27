import { z } from 'zod';
import {
  MIN_LENGTH,
  MAX_LENGTH,
  AMOUNT_LIMITS,
  GOAL_CATEGORIES,
  PAYMENT_METHODS,
  TRANSFER_FREQUENCIES,
  ABN_FORMAT,
  PHONE_FORMAT,
  POSTCODE_FORMAT,
  VALIDATION_PATTERNS,
  VALIDATION_MESSAGES,
  type GoalCategory,
  type PaymentMethod,
  type TransferFrequency,
} from '@/lib/constants';

// Re-export auth schemas
export * from '@/lib/auth/validation';

// Helper function for ABN validation
function validateABN(abn: string): boolean {
  if (abn.length !== ABN_FORMAT.LENGTH) return false;

  const digits = abn.split('').map(Number);
  digits[0] -= 1;

  const sum = digits.reduce((acc, digit, index) => {
    return acc + digit * ABN_FORMAT.WEIGHTS[index];
  }, 0);

  return sum % ABN_FORMAT.MODULUS === 0;
}

// Australian-specific validations
export const abnSchema = z
  .string()
  .regex(ABN_FORMAT.PATTERN, VALIDATION_MESSAGES.INVALID_ABN)
  .transform((val) => val.replace(/\s/g, ''))
  .refine((abn) => validateABN(abn), VALIDATION_MESSAGES.INVALID_ABN);

export const phoneSchema = z
  .string()
  .regex(PHONE_FORMAT.PATTERN, VALIDATION_MESSAGES.INVALID_PHONE)
  .transform((val) => val.replace(/\s/g, ''));

export const postCodeSchema = z
  .string()
  .regex(POSTCODE_FORMAT.PATTERN, VALIDATION_MESSAGES.INVALID_POSTCODE);

// Currency validation
export const currencySchema = z
  .number()
  .positive(VALIDATION_MESSAGES.AMOUNT_TOO_SMALL)
  .multipleOf(
    Math.pow(10, -AMOUNT_LIMITS.DECIMAL_PLACES),
    `Amount must have at most ${AMOUNT_LIMITS.DECIMAL_PLACES} decimal places`,
  )
  .max(AMOUNT_LIMITS.MAX, VALIDATION_MESSAGES.AMOUNT_TOO_LARGE);

// Date validation
export const futureDateSchema = z
  .string()
  .refine((date) => new Date(date) > new Date(), VALIDATION_MESSAGES.DATE_IN_PAST);

export const pastDateSchema = z
  .string()
  .refine((date) => new Date(date) < new Date(), VALIDATION_MESSAGES.DATE_IN_FUTURE);

// Goal Form Schema
export const goalFormSchema = z
  .object({
    name: z
      .string()
      .min(MIN_LENGTH.GOAL_NAME, VALIDATION_MESSAGES.TOO_SHORT('Goal name', MIN_LENGTH.GOAL_NAME))
      .max(MAX_LENGTH.GOAL_NAME, VALIDATION_MESSAGES.TOO_LONG('Goal name', MAX_LENGTH.GOAL_NAME))
      .trim(),
    description: z
      .string()
      .max(
        MAX_LENGTH.DESCRIPTION,
        VALIDATION_MESSAGES.TOO_LONG('Description', MAX_LENGTH.DESCRIPTION),
      )
      .optional(),
    category: z.enum(GOAL_CATEGORIES as unknown as [string, ...string[]]),
    currentAmount: currencySchema,
    targetAmount: currencySchema,
    targetDate: futureDateSchema,
    autoDebit: z.boolean().default(false),
    transferAmount: currencySchema.optional(),
    transferFrequency: z
      .enum(['weekly', 'fortnightly', 'monthly'] as [TransferFrequency, ...TransferFrequency[]])
      .optional(),
    accountId: z.string().uuid('Invalid account').optional(),
  })
  .refine(
    (data) => {
      if (data.autoDebit) {
        return data.transferAmount && data.transferFrequency && data.accountId;
      }
      return true;
    },
    {
      message: 'Transfer details are required when auto-debit is enabled',
      path: ['autoDebit'],
    },
  )
  .refine((data) => data.targetAmount > data.currentAmount, {
    message: 'Target amount must be greater than current amount',
    path: ['targetAmount'],
  });

// Receipt Form Schema
export const receiptFormSchema = z
  .object({
    merchant: z
      .string()
      .min(
        MIN_LENGTH.MERCHANT_NAME,
        VALIDATION_MESSAGES.TOO_SHORT('Merchant name', MIN_LENGTH.MERCHANT_NAME),
      )
      .max(
        MAX_LENGTH.MERCHANT_NAME,
        VALIDATION_MESSAGES.TOO_LONG('Merchant name', MAX_LENGTH.MERCHANT_NAME),
      )
      .trim(),
    merchantAbn: abnSchema.optional(),
    totalAmount: currencySchema,
    gstAmount: currencySchema.optional(),
    date: pastDateSchema,
    paymentMethod: z.enum(
      PAYMENT_METHODS.filter((m) => ['cash', 'card', 'eft', 'paypal', 'other'].includes(m)) as [
        PaymentMethod,
        ...PaymentMethod[],
      ],
    ),
    category: z.string().min(MIN_LENGTH.CATEGORY_NAME, VALIDATION_MESSAGES.REQUIRED('Category')),
    taxCategory: z.string().optional(),
    transactionId: z.string().uuid().optional(),
    notes: z
      .string()
      .max(MAX_LENGTH.NOTES, VALIDATION_MESSAGES.TOO_LONG('Notes', MAX_LENGTH.NOTES))
      .optional(),
    items: z
      .array(
        z.object({
          description: z
            .string()
            .min(MIN_LENGTH.CATEGORY_NAME, VALIDATION_MESSAGES.REQUIRED('Item description')),
          quantity: z.number().positive(VALIDATION_MESSAGES.AMOUNT_TOO_SMALL),
          unitPrice: currencySchema,
          totalPrice: currencySchema,
          gstIncluded: z.boolean().default(true),
        }),
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.gstAmount && data.gstAmount > data.totalAmount) {
        return false;
      }
      return true;
    },
    {
      message: 'GST amount cannot exceed total amount',
      path: ['gstAmount'],
    },
  );

// Budget Form Schema
export const budgetFormSchema = z
  .object({
    name: z
      .string()
      .min(
        MIN_LENGTH.BUDGET_NAME,
        VALIDATION_MESSAGES.TOO_SHORT('Budget name', MIN_LENGTH.BUDGET_NAME),
      )
      .max(
        MAX_LENGTH.BUDGET_NAME,
        VALIDATION_MESSAGES.TOO_LONG('Budget name', MAX_LENGTH.BUDGET_NAME),
      )
      .trim(),
    monthlyAmount: currencySchema,
    monthlyIncome: currencySchema,
    targetSavings: currencySchema.optional(),
    categories: z
      .array(
        z.object({
          name: z
            .string()
            .min(MIN_LENGTH.CATEGORY_NAME, VALIDATION_MESSAGES.REQUIRED('Category name')),
          amount: currencySchema,
          isEssential: z.boolean().default(false),
        }),
      )
      .min(1, 'At least one category is required'),
  })
  .refine(
    (data) => {
      const totalBudget = data.categories.reduce((sum, cat) => sum + cat.amount, 0);
      return totalBudget <= data.monthlyIncome;
    },
    {
      message: 'Total budget cannot exceed monthly income',
      path: ['categories'],
    },
  );

// Transaction Search Schema
export const transactionSearchSchema = z
  .object({
    search: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    amountMin: currencySchema.optional(),
    amountMax: currencySchema.optional(),
    category: z.string().optional(),
    taxCategory: z.string().optional(),
    type: z.enum(['debit', 'credit', 'all']).optional(),
    businessOnly: z.boolean().optional(),
    uncategorizedOnly: z.boolean().optional(),
    hasReceipt: z.boolean().optional(),
    accountId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return new Date(data.dateFrom) <= new Date(data.dateTo);
      }
      return true;
    },
    {
      message: 'Start date must be before end date',
      path: ['dateTo'],
    },
  )
  .refine(
    (data) => {
      if (data.amountMin && data.amountMax) {
        return data.amountMin <= data.amountMax;
      }
      return true;
    },
    {
      message: 'Minimum amount must be less than maximum amount',
      path: ['amountMax'],
    },
  );

// Profile Update Schema
export const profileUpdateSchema = z.object({
  name: z
    .string()
    .min(MIN_LENGTH.NAME, VALIDATION_MESSAGES.TOO_SHORT('Name', MIN_LENGTH.NAME))
    .max(100, 'Name is too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters')
    .trim(),
  phone: phoneSchema.optional(),
  abn: abnSchema.optional(),
  taxFileNumber: z
    .string()
    .regex(/^\d{8,9}$/, 'Invalid TFN format')
    .optional(),
  dateOfBirth: pastDateSchema.optional(),
  address: z
    .object({
      street: z.string().min(5, 'Street address is required'),
      suburb: z.string().min(2, 'Suburb is required'),
      state: z.enum(['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']),
      postcode: postCodeSchema,
    })
    .optional(),
  taxResidency: z.enum(['resident', 'foreign', 'temporary']).optional(),
  hasHELP: z.boolean().optional(),
  hasTSL: z.boolean().optional(),
  hasSFSS: z.boolean().optional(),
});

// Bank Connection Schema
export const bankConnectionSchema = z.object({
  institutionId: z.string().min(1, 'Bank selection is required'),
  credentials: z
    .object({
      username: z.string().min(1, 'Username is required'),
      password: z.string().min(1, 'Password is required'),
    })
    .optional(),
  consentDuration: z.number().min(1).max(365).default(90),
});

// Subscription Schema
export const subscriptionSchema = z.object({
  planId: z.enum(['taax-smart', 'taax-pro']),
  billingInterval: z.enum(['monthly', 'annually']),
  promoCode: z.string().optional(),
});

// Helper function to validate Australian Business Number
function validateABN(abn: string): boolean {
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const abnDigits = abn.split('').map(Number);

  // Subtract 1 from first digit
  abnDigits[0] -= 1;

  // Calculate weighted sum
  const sum = abnDigits.reduce((acc, digit, index) => acc + digit * weights[index], 0);

  // Check if divisible by 89
  return sum % 89 === 0;
}

// Type exports
export type GoalFormInput = z.infer<typeof goalFormSchema>;
export type ReceiptFormInput = z.infer<typeof receiptFormSchema>;
export type BudgetFormInput = z.infer<typeof budgetFormSchema>;
export type TransactionSearchInput = z.infer<typeof transactionSearchSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type BankConnectionInput = z.infer<typeof bankConnectionSchema>;
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

// Validation helpers
export function formatValidationErrors(errors: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  errors.errors.forEach((error) => {
    const path = error.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(error.message);
  });

  return formatted;
}

// Real-time validation helper
export function validateField<T extends Record<string, unknown>>(
  schema: z.ZodSchema<T>,
  field: keyof T,
  value: unknown,
): { isValid: boolean; errors: string[] } {
  try {
    // Access the shape property safely with proper typing
    const schemaShape = (schema as z.ZodObject<z.ZodRawShape>).shape;
    const fieldSchema = schemaShape[field as string];

    if (fieldSchema && fieldSchema instanceof z.ZodType) {
      fieldSchema.parse(value);
      return { isValid: true, errors: [] };
    }
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map((e) => e.message),
      };
    }
    return { isValid: false, errors: ['Validation failed'] };
  }
}
