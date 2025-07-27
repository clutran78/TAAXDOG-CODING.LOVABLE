import { z } from 'zod';

/**
 * Common validation test cases
 */
export const validationTests = {
  email: {
    valid: ['test@example.com', 'user+tag@domain.co.uk', 'firstname.lastname@company.com.au'],
    invalid: [
      'invalid-email',
      '@example.com',
      'test@',
      'test..double@example.com',
      'test @example.com',
    ],
  },

  phone: {
    valid: ['0412345678', '0298765432', '+61412345678', '02 9876 5432'],
    invalid: [
      '12345',
      'abcdefghij',
      '041234567', // Too short
      '04123456789', // Too long
    ],
  },

  abn: {
    valid: ['51824753556', '51 824 753 556'],
    invalid: [
      '12345678901', // Invalid checksum
      '518247535567', // Too long
      '5182475355', // Too short
      'ABN12345678',
    ],
  },

  amount: {
    valid: [100, 100.5, 0.01, 9999999.99],
    invalid: [0, -100, 'abc', null, undefined],
  },

  percentage: {
    valid: [0, 50, 100, 10.5, 99.99],
    invalid: [-1, 101, 150, 'fifty'],
  },

  date: {
    valid: ['2024-01-01', '2024-12-31T23:59:59Z', new Date().toISOString()],
    invalid: [
      '2024-13-01', // Invalid month
      '2024-01-32', // Invalid day
      '01-01-2024', // Wrong format
      'yesterday',
    ],
  },

  uuid: {
    valid: ['550e8400-e29b-41d4-a716-446655440000', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'],
    invalid: [
      '550e8400-e29b-41d4-a716-44665544000', // Too short
      '550e8400-e29b-41d4-a716-4466554400000', // Too long
      'not-a-uuid',
      '550e8400-xxxx-41d4-a716-446655440000', // Invalid characters
    ],
  },
};

/**
 * Test validation for a field
 */
export function testFieldValidation(
  fieldName: string,
  schema: z.ZodSchema,
  validValues: any[],
  invalidValues: any[],
) {
  describe(`${fieldName} validation`, () => {
    validValues.forEach((value) => {
      it(`should accept valid value: ${JSON.stringify(value)}`, () => {
        const result = schema.safeParse({ [fieldName]: value });
        expect(result.success).toBe(true);
      });
    });

    invalidValues.forEach((value) => {
      it(`should reject invalid value: ${JSON.stringify(value)}`, () => {
        const result = schema.safeParse({ [fieldName]: value });
        expect(result.success).toBe(false);
      });
    });
  });
}

/**
 * Test required fields
 */
export function testRequiredFields(schema: z.ZodSchema, requiredFields: string[]) {
  describe('Required fields validation', () => {
    requiredFields.forEach((field) => {
      it(`should require ${field}`, () => {
        const data = {};
        const result = schema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          const fieldErrors = result.error.flatten().fieldErrors;
          expect(fieldErrors[field]).toBeDefined();
        }
      });
    });
  });
}

/**
 * Test string length constraints
 */
export function testStringLength(
  fieldName: string,
  schema: z.ZodSchema,
  minLength?: number,
  maxLength?: number,
) {
  describe(`${fieldName} length validation`, () => {
    if (minLength !== undefined) {
      it(`should reject strings shorter than ${minLength}`, () => {
        const shortString = 'a'.repeat(Math.max(0, minLength - 1));
        const result = schema.safeParse({ [fieldName]: shortString });
        expect(result.success).toBe(false);
      });

      it(`should accept strings of exactly ${minLength} characters`, () => {
        const exactString = 'a'.repeat(minLength);
        const result = schema.safeParse({ [fieldName]: exactString });
        expect(result.success).toBe(true);
      });
    }

    if (maxLength !== undefined) {
      it(`should reject strings longer than ${maxLength}`, () => {
        const longString = 'a'.repeat(maxLength + 1);
        const result = schema.safeParse({ [fieldName]: longString });
        expect(result.success).toBe(false);
      });

      it(`should accept strings of exactly ${maxLength} characters`, () => {
        const exactString = 'a'.repeat(maxLength);
        const result = schema.safeParse({ [fieldName]: exactString });
        expect(result.success).toBe(true);
      });
    }
  });
}

/**
 * Test numeric range constraints
 */
export function testNumericRange(
  fieldName: string,
  schema: z.ZodSchema,
  min?: number,
  max?: number,
) {
  describe(`${fieldName} range validation`, () => {
    if (min !== undefined) {
      it(`should reject values less than ${min}`, () => {
        const result = schema.safeParse({ [fieldName]: min - 1 });
        expect(result.success).toBe(false);
      });

      it(`should accept values equal to ${min}`, () => {
        const result = schema.safeParse({ [fieldName]: min });
        expect(result.success).toBe(true);
      });
    }

    if (max !== undefined) {
      it(`should reject values greater than ${max}`, () => {
        const result = schema.safeParse({ [fieldName]: max + 1 });
        expect(result.success).toBe(false);
      });

      it(`should accept values equal to ${max}`, () => {
        const result = schema.safeParse({ [fieldName]: max });
        expect(result.success).toBe(true);
      });
    }
  });
}

/**
 * Test enum validation
 */
export function testEnumValidation(
  fieldName: string,
  schema: z.ZodSchema,
  validValues: string[],
  invalidValues: string[] = ['invalid', 'unknown', ''],
) {
  describe(`${fieldName} enum validation`, () => {
    validValues.forEach((value) => {
      it(`should accept valid enum value: ${value}`, () => {
        const result = schema.safeParse({ [fieldName]: value });
        expect(result.success).toBe(true);
      });
    });

    invalidValues.forEach((value) => {
      it(`should reject invalid enum value: ${value}`, () => {
        const result = schema.safeParse({ [fieldName]: value });
        expect(result.success).toBe(false);
      });
    });
  });
}

/**
 * Validate Australian-specific formats
 */
export const australianValidators = {
  /**
   * Validate Australian phone number
   */
  isValidAustralianPhone(phone: string): boolean {
    const cleaned = phone.replace(/\s|-/g, '');
    const mobileRegex = /^(\+61|0)4\d{8}$/;
    const landlineRegex = /^(\+61|0)[2378]\d{8}$/;
    return mobileRegex.test(cleaned) || landlineRegex.test(cleaned);
  },

  /**
   * Validate Australian postcode
   */
  isValidPostcode(postcode: string): boolean {
    const postcodeRegex = /^\d{4}$/;
    const code = parseInt(postcode);
    return postcodeRegex.test(postcode) && code >= 200 && code <= 9999;
  },

  /**
   * Validate Australian state code
   */
  isValidState(state: string): boolean {
    const validStates = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
    return validStates.includes(state.toUpperCase());
  },

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  },
};
