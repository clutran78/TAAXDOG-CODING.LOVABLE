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
    .withMessage('ABN must be 11 digits'),
    
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