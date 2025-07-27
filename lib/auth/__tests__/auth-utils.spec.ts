import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  isPasswordStrong,
  sanitizeInput,
  validateEmail,
  generateResetToken,
  verifyResetToken,
} from '../auth-utils';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('auth-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });

  describe('hashPassword', () => {
    it('hashes password with correct salt rounds', async () => {
      const mockHash = 'hashed-password';
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(mockHash);

      const result = await hashPassword('password123');

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(result).toBe(mockHash);
    });

    it('throws error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await verifyPassword('password123', 'hashed-password');

      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(result).toBe(true);
    });

    it('returns false for non-matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const result = await verifyPassword('wrongpassword', 'hashed-password');

      expect(result).toBe(false);
    });

    it('handles bcrypt errors', async () => {
      (bcrypt.compare as jest.Mock).mockRejectedValueOnce(new Error('Bcrypt error'));

      await expect(verifyPassword('password', 'hash')).rejects.toThrow('Bcrypt error');
    });
  });

  describe('generateToken', () => {
    it('generates JWT token with correct payload', () => {
      const mockToken = 'jwt-token';
      (jwt.sign as jest.Mock).mockReturnValueOnce(mockToken);

      const payload = { userId: 'user-123', email: 'test@example.com' };
      const result = generateToken(payload);

      expect(jwt.sign).toHaveBeenCalledWith(payload, 'test-secret', { expiresIn: '7d' });
      expect(result).toBe(mockToken);
    });

    it('uses custom expiration when provided', () => {
      const mockToken = 'jwt-token';
      (jwt.sign as jest.Mock).mockReturnValueOnce(mockToken);

      generateToken({ userId: 'user-123' }, '1h');

      expect(jwt.sign).toHaveBeenCalledWith({ userId: 'user-123' }, 'test-secret', {
        expiresIn: '1h',
      });
    });

    it('throws error when secret is not set', () => {
      delete process.env.NEXTAUTH_SECRET;

      expect(() => generateToken({ userId: 'user-123' })).toThrow('JWT secret not configured');
    });
  });

  describe('verifyToken', () => {
    it('verifies and returns decoded token', () => {
      const mockDecoded = { userId: 'user-123', email: 'test@example.com' };
      (jwt.verify as jest.Mock).mockReturnValueOnce(mockDecoded);

      const result = verifyToken('jwt-token');

      expect(jwt.verify).toHaveBeenCalledWith('jwt-token', 'test-secret');
      expect(result).toEqual(mockDecoded);
    });

    it('throws error for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
    });

    it('handles expired tokens', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('Token expired') as any;
        error.name = 'TokenExpiredError';
        throw error;
      });

      expect(() => verifyToken('expired-token')).toThrow('Token expired');
    });
  });

  describe('isPasswordStrong', () => {
    it('validates strong passwords', () => {
      expect(isPasswordStrong('StrongP@ss123')).toBe(true);
      expect(isPasswordStrong('Complex!Pass456')).toBe(true);
    });

    it('rejects weak passwords', () => {
      expect(isPasswordStrong('password')).toBe(false); // No uppercase, numbers, special chars
      expect(isPasswordStrong('PASSWORD')).toBe(false); // No lowercase, numbers, special chars
      expect(isPasswordStrong('Password')).toBe(false); // No numbers, special chars
      expect(isPasswordStrong('Pass123')).toBe(false); // Too short, no special chars
      expect(isPasswordStrong('short')).toBe(false); // Too short
    });

    it('requires minimum length', () => {
      expect(isPasswordStrong('Sh@rt1')).toBe(false); // 6 chars, too short
      expect(isPasswordStrong('L0nger!!')).toBe(true); // 8 chars, meets requirements
    });
  });

  describe('sanitizeInput', () => {
    it('removes HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('');
      expect(sanitizeInput('<p>Hello</p>')).toBe('Hello');
    });

    it('trims whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
      expect(sanitizeInput('\n\ttest\n\t')).toBe('test');
    });

    it('escapes special characters', () => {
      expect(sanitizeInput('Hello & goodbye')).toBe('Hello &amp; goodbye');
      expect(sanitizeInput('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('handles empty input', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });
  });

  describe('validateEmail', () => {
    it('validates correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@example.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
      expect(validateEmail('123@example.com')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(validateEmail('notanemail')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('user@.com')).toBe(false);
      expect(validateEmail('user name@example.com')).toBe(false);
      expect(validateEmail('user@example')).toBe(false);
    });

    it('handles edge cases', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null as any)).toBe(false);
      expect(validateEmail(undefined as any)).toBe(false);
    });
  });

  describe('generateResetToken', () => {
    it('generates reset token with user ID and expiration', () => {
      const mockToken = 'reset-token';
      const mockSign = jwt.sign as jest.Mock;
      mockSign.mockReturnValueOnce(mockToken);

      const result = generateResetToken('user-123');

      expect(mockSign).toHaveBeenCalledWith(
        {
          userId: 'user-123',
          type: 'password-reset',
        },
        'test-secret',
        { expiresIn: '1h' },
      );
      expect(result).toBe(mockToken);
    });

    it('includes timestamp in payload', () => {
      const mockToken = 'reset-token';
      (jwt.sign as jest.Mock).mockReturnValueOnce(mockToken);

      generateResetToken('user-123');

      const callArgs = (jwt.sign as jest.Mock).mock.calls[0][0];
      expect(callArgs).toHaveProperty('timestamp');
      expect(typeof callArgs.timestamp).toBe('number');
    });
  });

  describe('verifyResetToken', () => {
    it('verifies valid reset token', () => {
      const mockDecoded = {
        userId: 'user-123',
        type: 'password-reset',
        timestamp: Date.now(),
      };
      (jwt.verify as jest.Mock).mockReturnValueOnce(mockDecoded);

      const result = verifyResetToken('reset-token');

      expect(result).toEqual({
        valid: true,
        userId: 'user-123',
      });
    });

    it('rejects token with wrong type', () => {
      const mockDecoded = {
        userId: 'user-123',
        type: 'access-token', // Wrong type
      };
      (jwt.verify as jest.Mock).mockReturnValueOnce(mockDecoded);

      const result = verifyResetToken('token');

      expect(result).toEqual({
        valid: false,
        error: 'Invalid token type',
      });
    });

    it('handles expired tokens', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        const error = new Error('jwt expired') as any;
        error.name = 'TokenExpiredError';
        throw error;
      });

      const result = verifyResetToken('expired-token');

      expect(result).toEqual({
        valid: false,
        error: 'Token expired',
      });
    });

    it('handles invalid tokens', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = verifyResetToken('invalid-token');

      expect(result).toEqual({
        valid: false,
        error: 'Invalid token',
      });
    });
  });
});
