import {
  validateRegistration,
  validateLogin,
  validatePasswordReset,
  validateProfileUpdate,
  validateABN,
  validateTFN,
  sanitizeUserInput,
  ValidationError,
} from '../validation';

describe('validation', () => {
  describe('validateRegistration', () => {
    it('validates correct registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'StrongP@ss123',
        name: 'Test User',
      };

      const result = validateRegistration(validData);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('validates with optional fields', () => {
      const validData = {
        email: 'test@example.com',
        password: 'StrongP@ss123',
        name: 'Test User',
        abn: '51824753556', // Valid ABN
        tfn: '123456789',
      };

      const result = validateRegistration(validData);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'StrongP@ss123',
        name: 'Test User',
      };

      const result = validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors?.email).toContain('Invalid email format');
    });

    it('rejects weak password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User',
      };

      const result = validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors?.password).toContain('Password must be at least 8 characters');
    });

    it('requires all mandatory fields', () => {
      const incompleteData = {
        email: 'test@example.com',
      };

      const result = validateRegistration(incompleteData as any);
      expect(result.valid).toBe(false);
      expect(result.errors?.password).toContain('Password is required');
      expect(result.errors?.name).toContain('Name is required');
    });

    it('validates name length', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'StrongP@ss123',
        name: 'A', // Too short
      };

      const result = validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors?.name).toContain('Name must be at least 2 characters');
    });

    it('sanitizes input data', () => {
      const dirtyData = {
        email: '  test@example.com  ',
        password: 'StrongP@ss123',
        name: '<script>Test User</script>',
      };

      const result = validateRegistration(dirtyData);
      expect(result.valid).toBe(true);
      expect(result.data?.email).toBe('test@example.com');
      expect(result.data?.name).toBe('Test User');
    });
  });

  describe('validateLogin', () => {
    it('validates correct login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = validateLogin(validData);
      expect(result.valid).toBe(true);
    });

    it('requires both email and password', () => {
      const result1 = validateLogin({ email: 'test@example.com' } as any);
      expect(result1.valid).toBe(false);
      expect(result1.errors?.password).toContain('Password is required');

      const result2 = validateLogin({ password: 'password123' } as any);
      expect(result2.valid).toBe(false);
      expect(result2.errors?.email).toContain('Email is required');
    });

    it('validates email format', () => {
      const result = validateLogin({
        email: 'not-an-email',
        password: 'password123',
      });

      expect(result.valid).toBe(false);
      expect(result.errors?.email).toContain('Invalid email format');
    });

    it('allows any password for login', () => {
      // Login doesn't enforce password strength, just presence
      const result = validateLogin({
        email: 'test@example.com',
        password: 'a', // Very weak, but allowed for login
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('validatePasswordReset', () => {
    it('validates password reset request', () => {
      const result = validatePasswordReset({ email: 'test@example.com' });
      expect(result.valid).toBe(true);
    });

    it('validates new password submission', () => {
      const result = validatePasswordReset({
        token: 'reset-token',
        newPassword: 'NewStr0ng!Pass',
        confirmPassword: 'NewStr0ng!Pass',
      });

      expect(result.valid).toBe(true);
    });

    it('ensures passwords match', () => {
      const result = validatePasswordReset({
        token: 'reset-token',
        newPassword: 'NewStr0ng!Pass',
        confirmPassword: 'DifferentPass',
      });

      expect(result.valid).toBe(false);
      expect(result.errors?.confirmPassword).toContain('Passwords do not match');
    });

    it('enforces strong password for reset', () => {
      const result = validatePasswordReset({
        token: 'reset-token',
        newPassword: 'weak',
        confirmPassword: 'weak',
      });

      expect(result.valid).toBe(false);
      expect(result.errors?.newPassword).toContain('Password must be at least 8 characters');
    });

    it('requires either email or token+passwords', () => {
      const result = validatePasswordReset({});

      expect(result.valid).toBe(false);
      expect(result.errors?.general).toContain('Invalid password reset data');
    });
  });

  describe('validateProfileUpdate', () => {
    it('validates profile update data', () => {
      const result = validateProfileUpdate({
        name: 'Updated Name',
        email: 'newemail@example.com',
        abn: '51824753556',
      });

      expect(result.valid).toBe(true);
    });

    it('allows partial updates', () => {
      const result = validateProfileUpdate({
        name: 'New Name Only',
      });

      expect(result.valid).toBe(true);
      expect(result.data?.name).toBe('New Name Only');
    });

    it('validates email if provided', () => {
      const result = validateProfileUpdate({
        email: 'invalid-email',
      });

      expect(result.valid).toBe(false);
      expect(result.errors?.email).toContain('Invalid email format');
    });

    it('validates ABN if provided', () => {
      const result = validateProfileUpdate({
        abn: '12345', // Invalid ABN
      });

      expect(result.valid).toBe(false);
      expect(result.errors?.abn).toContain('Invalid ABN format');
    });

    it('allows empty update', () => {
      const result = validateProfileUpdate({});
      expect(result.valid).toBe(true);
    });
  });

  describe('validateABN', () => {
    it('validates correct ABN format', () => {
      // Valid ABNs (with correct check digit)
      expect(validateABN('51824753556')).toBe(true);
      expect(validateABN('51 824 753 556')).toBe(true); // With spaces
    });

    it('rejects invalid ABN format', () => {
      expect(validateABN('12345')).toBe(false); // Too short
      expect(validateABN('123456789012')).toBe(false); // Too long
      expect(validateABN('abcdefghijk')).toBe(false); // Non-numeric
    });

    it('validates ABN check digit', () => {
      expect(validateABN('51824753557')).toBe(false); // Wrong check digit
    });

    it('handles edge cases', () => {
      expect(validateABN('')).toBe(false);
      expect(validateABN(null as any)).toBe(false);
      expect(validateABN(undefined as any)).toBe(false);
    });

    it('normalizes ABN format', () => {
      // These should all be treated as the same ABN
      const abn = '51824753556';
      expect(validateABN(abn)).toBe(true);
      expect(validateABN('51 824 753 556')).toBe(true);
      expect(validateABN('51-824-753-556')).toBe(true);
    });
  });

  describe('validateTFN', () => {
    it('validates correct TFN format', () => {
      expect(validateTFN('123456789')).toBe(true);
      expect(validateTFN('123 456 789')).toBe(true); // With spaces
    });

    it('rejects invalid TFN format', () => {
      expect(validateTFN('12345')).toBe(false); // Too short
      expect(validateTFN('1234567890')).toBe(false); // Too long
      expect(validateTFN('abc123def')).toBe(false); // Non-numeric
    });

    it('validates TFN check algorithm', () => {
      // TFN uses a specific check digit algorithm
      expect(validateTFN('123456782')).toBe(true); // Valid TFN
      expect(validateTFN('123456783')).toBe(false); // Invalid check digit
    });

    it('handles edge cases', () => {
      expect(validateTFN('')).toBe(false);
      expect(validateTFN(null as any)).toBe(false);
      expect(validateTFN(undefined as any)).toBe(false);
    });
  });

  describe('sanitizeUserInput', () => {
    it('removes HTML tags', () => {
      expect(sanitizeUserInput('<script>alert("xss")</script>test')).toBe('test');
      expect(sanitizeUserInput('<b>bold</b> text')).toBe('bold text');
    });

    it('escapes special characters', () => {
      expect(sanitizeUserInput('Hello & goodbye')).toBe('Hello &amp; goodbye');
      expect(sanitizeUserInput('"quoted" text')).toBe('&quot;quoted&quot; text');
      expect(sanitizeUserInput("it's mine")).toBe('it&#x27;s mine');
    });

    it('trims whitespace', () => {
      expect(sanitizeUserInput('  test  ')).toBe('test');
      expect(sanitizeUserInput('\n\ttest\n\t')).toBe('test');
    });

    it('handles various input types', () => {
      expect(sanitizeUserInput('')).toBe('');
      expect(sanitizeUserInput(null as any)).toBe('');
      expect(sanitizeUserInput(undefined as any)).toBe('');
      expect(sanitizeUserInput(123 as any)).toBe('123');
    });

    it('preserves safe characters', () => {
      const safeInput = 'Normal text with numbers 123 and punctuation!';
      expect(sanitizeUserInput(safeInput)).toBe(safeInput);
    });

    it('handles complex XSS attempts', () => {
      const xssAttempts = [
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>',
        'javascript:alert("xss")',
        '<iframe src="javascript:alert(\'xss\')">',
      ];

      xssAttempts.forEach((attempt) => {
        const sanitized = sanitizeUserInput(attempt);
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toContain('javascript:');
      });
    });
  });

  describe('ValidationError', () => {
    it('creates validation error with field errors', () => {
      const errors = {
        email: 'Invalid email',
        password: 'Too weak',
      };

      const error = new ValidationError('Validation failed', errors);

      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual(errors);
      expect(error.name).toBe('ValidationError');
    });

    it('is instanceof Error', () => {
      const error = new ValidationError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });
});
