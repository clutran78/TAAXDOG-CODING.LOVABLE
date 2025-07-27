import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'http';
import {
  hashPassword,
  verifyPassword,
  generateJWT,
  verifyJWT,
  sanitizeUser,
  getClientIP,
  isAccountLocked,
  calculateLockoutDuration,
  generateSessionToken,
  getAuthCookieOptions,
} from '../auth-utils';

// Mock external dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Authentication Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('hashPassword', () => {
    it('hashes password with correct salt rounds', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword123';
      
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      
      const result = await hashPassword(password);
      
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('throws error when hashing fails', async () => {
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Hashing failed'));
      
      await expect(hashPassword('password')).rejects.toThrow('Hashing failed');
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      
      const result = await verifyPassword('password', 'hashedPassword');
      
      expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashedPassword');
      expect(result).toBe(true);
    });

    it('returns false for non-matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      
      const result = await verifyPassword('wrongPassword', 'hashedPassword');
      
      expect(result).toBe(false);
    });
  });

  describe('generateJWT', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret';
    });

    it('generates JWT with user payload', () => {
      const payload = {
        userId: '123',
        email: 'test@example.com',
        role: 'USER' as const,
      };
      const token = 'generated-token';
      
      (jwt.sign as jest.Mock).mockReturnValue(token);
      
      const result = generateJWT(payload);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        'test-secret',
        {
          expiresIn: '30d',
          issuer: 'taaxdog',
          audience: 'taaxdog-users',
        }
      );
      expect(result).toBe(token);
    });

    it('throws error when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      
      expect(() => generateJWT({ userId: '123', email: 'test@example.com', role: 'USER' }))
        .toThrow('JWT_SECRET is not configured');
    });
  });

  describe('verifyJWT', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret';
    });

    it('verifies and returns decoded token', () => {
      const token = 'valid-token';
      const decoded = {
        userId: '123',
        email: 'test@example.com',
        role: 'USER',
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(decoded);
      
      const result = verifyJWT(token);
      
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret', {
        issuer: 'taaxdog',
        audience: 'taaxdog-users',
      });
      expect(result).toEqual(decoded);
    });

    it('throws error for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      expect(() => verifyJWT('invalid-token')).toThrow('Invalid token');
    });
  });

  describe('sanitizeUser', () => {
    it('removes sensitive fields from user object', () => {
      const user = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword',
        role: 'USER' as const,
        emailVerified: true,
        createdAt: new Date(),
        twoFactorSecret: 'secret',
        refreshToken: 'token',
      };
      
      const sanitized = sanitizeUser(user);
      
      expect(sanitized).toEqual({
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        emailVerified: true,
        createdAt: user.createdAt,
      });
      expect(sanitized).not.toHaveProperty('password');
      expect(sanitized).not.toHaveProperty('twoFactorSecret');
      expect(sanitized).not.toHaveProperty('refreshToken');
    });
  });

  describe('getClientIP', () => {
    it('returns IP from x-forwarded-for header', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
        socket: {
          remoteAddress: '127.0.0.1',
        },
      } as unknown as IncomingMessage;
      
      expect(getClientIP(req)).toBe('192.168.1.1');
    });

    it('returns IP from x-real-ip header', () => {
      const req = {
        headers: {
          'x-real-ip': '192.168.1.2',
        },
        socket: {
          remoteAddress: '127.0.0.1',
        },
      } as unknown as IncomingMessage;
      
      expect(getClientIP(req)).toBe('192.168.1.2');
    });

    it('returns IP from socket.remoteAddress', () => {
      const req = {
        headers: {},
        socket: {
          remoteAddress: '192.168.1.3',
        },
      } as unknown as IncomingMessage;
      
      expect(getClientIP(req)).toBe('192.168.1.3');
    });

    it('returns null when no IP found', () => {
      const req = {
        headers: {},
        socket: {},
      } as unknown as IncomingMessage;
      
      expect(getClientIP(req)).toBeNull();
    });
  });

  describe('isAccountLocked', () => {
    it('returns true when account is locked', () => {
      const user = {
        lockedUntil: new Date(Date.now() + 60000), // 1 minute in future
      };
      
      expect(isAccountLocked(user)).toBe(true);
    });

    it('returns false when account is not locked', () => {
      const user = {
        lockedUntil: null,
      };
      
      expect(isAccountLocked(user)).toBe(false);
    });

    it('returns false when lockout has expired', () => {
      const user = {
        lockedUntil: new Date(Date.now() - 60000), // 1 minute in past
      };
      
      expect(isAccountLocked(user)).toBe(false);
    });
  });

  describe('calculateLockoutDuration', () => {
    it('returns correct duration for different attempt counts', () => {
      expect(calculateLockoutDuration(5)).toBe(5 * 60 * 1000); // 5 minutes
      expect(calculateLockoutDuration(10)).toBe(15 * 60 * 1000); // 15 minutes
      expect(calculateLockoutDuration(15)).toBe(30 * 60 * 1000); // 30 minutes
      expect(calculateLockoutDuration(20)).toBe(60 * 60 * 1000); // 60 minutes
    });

    it('caps duration at 60 minutes', () => {
      expect(calculateLockoutDuration(100)).toBe(60 * 60 * 1000);
    });
  });

  describe('generateSessionToken', () => {
    it('generates a 32-byte hex token', () => {
      const token = generateSessionToken();
      
      expect(token).toMatch(/^[a-f0-9]{64}$/); // 32 bytes = 64 hex chars
      expect(token.length).toBe(64);
    });

    it('generates unique tokens', () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('getAuthCookieOptions', () => {
    it('returns secure cookie options in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const options = getAuthCookieOptions();
      
      expect(options).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('returns non-secure cookie options in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const options = getAuthCookieOptions();
      
      expect(options.secure).toBe(false);
      
      process.env.NODE_ENV = originalEnv;
    });

    it('uses custom maxAge when provided', () => {
      const customMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const options = getAuthCookieOptions(customMaxAge);
      
      expect(options.maxAge).toBe(customMaxAge);
    });
  });
});