import { NextApiRequest, NextApiResponse } from 'next';
import { body, query, param, validationResult, ValidationChain } from 'express-validator';

export interface ValidationRule {
  field: string;
  rules: ValidationChain;
}

export function validateRequest(rules: ValidationChain[]) {
  return async (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
    await Promise.all(rules.map(rule => rule.run(req)));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    
    next();
  };
}

/**
 * Validates an Australian Business Number (ABN) checksum
 * @param abn - The ABN to validate (as a string of 11 digits)
 * @returns true if the ABN checksum is valid, false otherwise
 */
function validateABNChecksum(abn: string): boolean {
  // ABN must be exactly 11 digits
  if (!/^\d{11}$/.test(abn)) {
    return false;
  }

  // Convert string to array of numbers
  const digits = abn.split('').map(Number);
  
  // Subtract 1 from the first digit
  digits[0] -= 1;
  
  // Apply weighting factors
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  
  // Calculate the sum of (digit * weight) for each position
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i];
  }
  
  // Check if sum is divisible by 89
  return sum % 89 === 0;
}

export const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .trim()
    .escape(),
    
  password: body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
  amount: body('amount')
    .isFloat({ min: 0 })
    .toFloat(),
    
  description: body('description')
    .trim()
    .escape()
    .isLength({ max: 1000 }),
    
  abn: body('abn')
    .optional()
    .matches(/^\d{11}$/)
    .withMessage('ABN must be 11 digits')
    .custom((value) => {
      if (!value) return true; // Optional field
      if (!validateABNChecksum(value)) {
        throw new Error('Invalid ABN - checksum verification failed');
      }
      return true;
    }),
    
  phoneNumber: body('phoneNumber')
    .optional()
    .matches(/^(\+61|0)[2-478](?:[ -]?[0-9]){8}$/)
    .withMessage('Invalid Australian phone number'),
    
  postcode: body('postcode')
    .optional()
    .matches(/^\d{4}$/)
    .withMessage('Australian postcode must be 4 digits'),
};

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/[<>]/g, '')
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

export function withValidation(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  validations: ValidationChain[] = []
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Sanitize input
    if (req.body) {
      req.body = sanitizeInput(req.body);
    }
    if (req.query) {
      req.query = sanitizeInput(req.query) as any;
    }
    
    // Run validations
    if (validations.length > 0) {
      await Promise.all(validations.map(validation => validation.run(req)));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }
    }
    
    // Execute handler
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}