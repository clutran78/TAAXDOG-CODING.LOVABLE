/**
 * Validation Constants
 *
 * Centralized constants for input validation and data constraints
 */

// ============================================================================
// STRING LENGTH LIMITS
// ============================================================================

/** Minimum string lengths */
export const MIN_LENGTH = {
  NAME: 2,
  GOAL_NAME: 2,
  MERCHANT_NAME: 2,
  BUDGET_NAME: 2,
  CATEGORY_NAME: 1,
  DESCRIPTION: 0, // Optional fields
  PASSWORD: 8,
  USERNAME: 3,
} as const;

/** Maximum string lengths */
export const MAX_LENGTH = {
  NAME: 100,
  EMAIL: 255,
  DESCRIPTION: 500,
  NOTES: 1000,
  MERCHANT_NAME: 200,
  GOAL_NAME: 100,
  BUDGET_NAME: 100,
  FILE_NAME: 255,
  URL: 2048,
  PHONE: 20,
} as const;

// ============================================================================
// NUMERIC LIMITS
// ============================================================================

/** Currency and amount constraints */
export const AMOUNT_LIMITS = {
  MIN: 0.01,
  MAX: 999999999.99,
  DECIMAL_PLACES: 2,
  PERCENTAGE_MAX: 100,
  GST_PERCENTAGE_MAX: 50, // Safety limit for percentage-based transfers
} as const;

/** Item quantity limits */
export const QUANTITY_LIMITS = {
  MIN: 0.01,
  MAX: 99999,
  INTEGER_ONLY: false, // Allow decimal quantities
} as const;

/** Goal-specific limits */
export const GOAL_LIMITS = {
  MAX_ACTIVE_GOALS: 50,
  MIN_TARGET_AMOUNT: 0.01,
  MAX_TARGET_AMOUNT: 10000000, // 10 million
} as const;

/** Budget category limits */
export const BUDGET_LIMITS = {
  MIN_CATEGORIES: 1,
  MAX_CATEGORIES: 50,
  MIN_AMOUNT: 0,
  MAX_AMOUNT: 999999.99,
} as const;

// ============================================================================
// DATE CONSTRAINTS
// ============================================================================

/** Date validation rules */
export const DATE_CONSTRAINTS = {
  MIN_AGE_YEARS: 18,
  MAX_AGE_YEARS: 120,
  MAX_FUTURE_YEARS: 50, // For goal deadlines
  MAX_PAST_YEARS: 7, // For transaction history
} as const;

// ============================================================================
// AUSTRALIAN SPECIFIC FORMATS
// ============================================================================

/** Australian Business Number (ABN) format */
export const ABN_FORMAT = {
  LENGTH: 11,
  PATTERN: /^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/,
  DISPLAY_FORMAT: 'XX XXX XXX XXX',
  MODULUS: 89,
  WEIGHTS: [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
} as const;

/** Tax File Number (TFN) format */
export const TFN_FORMAT = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 9,
  PATTERN: /^\d{8,9}$/,
  MODULUS: 11,
  WEIGHTS: [1, 4, 3, 7, 5, 8, 6, 9, 10],
} as const;

/** Australian phone number format */
export const PHONE_FORMAT = {
  PATTERN: /^(\+61|0)[2-478](\s?\d){8}$/,
  MOBILE_PATTERN: /^(\+61|0)4\d{8}$/,
  LANDLINE_PATTERN: /^(\+61|0)[2378]\d{8}$/,
} as const;

/** Australian postcode format */
export const POSTCODE_FORMAT = {
  LENGTH: 4,
  PATTERN: /^\d{4}$/,
  MIN: 200, // Norfolk Island
  MAX: 9999,
} as const;

// ============================================================================
// CATEGORIES AND ENUMS
// ============================================================================

/** Goal categories */
export const GOAL_CATEGORIES = [
  'savings',
  'investment',
  'debt',
  'purchase',
  'emergency',
  'vacation',
  'education',
  'retirement',
  'other',
] as const;

/** Payment methods */
export const PAYMENT_METHODS = [
  'cash',
  'card',
  'eft',
  'paypal',
  'bpay',
  'direct_debit',
  'other',
] as const;

/** Transaction types */
export const TRANSACTION_TYPES = ['debit', 'credit', 'transfer'] as const;

/** Transfer frequencies */
export const TRANSFER_FREQUENCIES = [
  'daily',
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'annually',
] as const;

// ============================================================================
// REGEX PATTERNS
// ============================================================================

/** Common validation patterns */
export const VALIDATION_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  NUMERIC_ONLY: /^\d+$/,
  DECIMAL: /^\d+(\.\d{1,2})?$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

/** Validation error message templates */
export const VALIDATION_MESSAGES = {
  REQUIRED: (field: string) => `${field} is required`,
  TOO_SHORT: (field: string, min: number) => `${field} must be at least ${min} characters`,
  TOO_LONG: (field: string, max: number) => `${field} must be no more than ${max} characters`,
  INVALID_FORMAT: (field: string) => `Invalid ${field} format`,
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid Australian phone number',
  INVALID_ABN: 'Please enter a valid ABN',
  INVALID_POSTCODE: 'Please enter a valid Australian postcode',
  AMOUNT_TOO_SMALL: 'Amount must be greater than zero',
  AMOUNT_TOO_LARGE: 'Amount is too large',
  DATE_IN_PAST: 'Date must be in the future',
  DATE_IN_FUTURE: 'Date must be in the past',
  EXCEEDS_LIMIT: (current: number, max: number) => `Cannot exceed ${max} (current: ${current})`,
} as const;

// ============================================================================
// TYPES
// ============================================================================

export type GoalCategory = (typeof GOAL_CATEGORIES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type TransferFrequency = (typeof TRANSFER_FREQUENCIES)[number];
