import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes user input to prevent XSS attacks
 * Removes all HTML tags and potentially dangerous content
 */
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

/**
 * Validates email format using secure regex pattern
 * Prevents email injection attacks
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 compliant email regex (simplified but secure)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validates password strength requirements
 * Ensures strong password policy for financial security
 */
export const validatePassword = (password: string): boolean => {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // Strong password requirements:
  // - At least 8 characters
  // - At least 1 uppercase letter
  // - At least 1 lowercase letter
  // - At least 1 number
  // - At least 1 special character
  // - Maximum 128 characters to prevent DoS
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

  return passwordRegex.test(password);
};

/**
 * Validates Australian ABN (Australian Business Number)
 * Critical for business compliance features
 */
export const validateABN = (abn: string): boolean => {
  if (!abn || typeof abn !== 'string') {
    return false;
  }

  // Remove spaces and check format
  const cleanABN = abn.replace(/\s/g, '');

  if (!/^\d{11}$/.test(cleanABN)) {
    return false;
  }

  // ABN checksum validation
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleanABN.split('').map(Number);

  // Subtract 1 from the first digit
  digits[0] -= 1;

  // Calculate checksum
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }

  return sum % 89 === 0;
};

/**
 * Validates Australian bank account BSB (Bank State Branch)
 * Ensures valid banking details for transfers
 */
export const validateBSB = (bsb: string): boolean => {
  if (!bsb || typeof bsb !== 'string') {
    return false;
  }

  // BSB format: XXX-XXX or XXXXXX (6 digits)
  const cleanBSB = bsb.replace(/[-\s]/g, '');
  return /^\d{6}$/.test(cleanBSB);
};

/**
 * Validates Australian bank account number
 * Supports various Australian bank account formats
 */
export const validateAccountNumber = (accountNumber: string): boolean => {
  if (!accountNumber || typeof accountNumber !== 'string') {
    return false;
  }

  // Australian account numbers are typically 4-10 digits
  const cleanAccountNumber = accountNumber.replace(/[-\s]/g, '');
  return /^\d{4,10}$/.test(cleanAccountNumber);
};

/**
 * Validates monetary amounts for financial transactions
 * Prevents injection and ensures valid currency format
 */
export const validateAmount = (amount: string | number): boolean => {
  if (amount === null || amount === undefined) {
    return false;
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Check if it's a valid number
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return false;
  }

  // Must be positive and reasonable for financial transactions
  // Maximum $10 million to prevent unrealistic values
  return numAmount >= 0 && numAmount <= 10000000;
};

/**
 * Type-safe financial data sanitization types
 */
type SanitizableValue = string | number | boolean | null | undefined;
type SanitizableObject = {
  [key: string]: SanitizableValue | SanitizableObject | SanitizableArray;
};
type SanitizableArray = Array<SanitizableValue | SanitizableObject | SanitizableArray>;
type SanitizableData = SanitizableValue | SanitizableObject | SanitizableArray;

/**
 * Sanitizes financial data objects recursively
 * Protects against object injection and XSS in nested data
 */
export const sanitizeFinancialData = <T extends SanitizableData>(data: T): T => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeInput(data) as T;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeFinancialData(item)) as T;
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Sanitize both key and value
        const sanitizedKey = sanitizeInput(key);
        sanitized[sanitizedKey] = sanitizeFinancialData((data as SanitizableObject)[key]);
      }
    }
    return sanitized as T;
  }

  return data;
};

/**
 * Validates transaction category for expense categorization
 * Prevents injection attacks on category data
 */
export const validateTransactionCategory = (category: string): boolean => {
  if (!category || typeof category !== 'string') {
    return false;
  }

  // Valid categories for Australian tax compliance
  const validCategories = [
    'office-supplies',
    'travel',
    'meals',
    'entertainment',
    'utilities',
    'rent',
    'insurance',
    'professional-services',
    'marketing',
    'equipment',
    'software',
    'education',
    'fuel',
    'repairs',
    'bank-fees',
    'other',
  ];

  return validCategories.includes(category.toLowerCase());
};

/**
 * Validates file upload extensions for receipt processing
 * Prevents malicious file uploads
 */
export const validateFileExtension = (filename: string): boolean => {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.gif'];
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));

  return allowedExtensions.includes(extension);
};

/**
 * Validates file size for uploads
 * Prevents DoS attacks through large file uploads
 */
export const validateFileSize = (fileSize: number): boolean => {
  if (!fileSize || typeof fileSize !== 'number') {
    return false;
  }

  // Maximum 10MB for receipt images
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  return fileSize > 0 && fileSize <= maxSize;
};

/**
 * Escapes SQL-like characters to prevent injection
 * Additional protection for database queries
 */
export const escapeSQLCharacters = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
};

/**
 * Rate limiting validation helper
 * Checks if request frequency is within acceptable limits
 */
export const validateRequestFrequency = (
  lastRequestTime: number,
  minInterval: number = 1000, // 1 second default
): boolean => {
  const now = Date.now();
  return now - lastRequestTime >= minInterval;
};
