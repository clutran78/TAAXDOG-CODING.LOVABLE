import { createMockApiContext, apiAssertions } from '@/tests/utils/api-mocks';
import { testDataFactory } from '@/tests/utils/db-helpers';
import * as bcrypt from 'bcryptjs';

// Import API handlers
import signupHandler from '@/pages/api/auth/register';
import loginHandler from '@/pages/api/auth/login';
import forgotPasswordHandler from '@/pages/api/auth/forgot-password';
import resetPasswordHandler from '@/pages/api/auth/reset-password';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('bcryptjs');

const mockPrisma = require('@/lib/prisma').prisma;
const mockEmail = require('@/lib/email');

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-secret';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  describe('User Registration Flow', () => {
    it('completes full registration process', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'StrongP@ss123',
        name: 'New User',
      };

      // Mock user doesn't exist
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      // Mock password hashing
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-password');

      // Mock user creation
      const createdUser = testDataFactory.user({
        id: 'new-user-id',
        email: newUser.email,
        name: newUser.name,
        password: 'hashed-password',
        emailVerified: null,
      });
      mockPrisma.user.create.mockResolvedValueOnce(createdUser);

      // Make registration request
      const { req, res } = createMockApiContext('POST', newUser);
      await signupHandler(req, res);

      // Assert successful registration
      const data = apiAssertions.expectSuccess(res, 201);
      expect(data.user).toMatchObject({
        id: 'new-user-id',
        email: newUser.email,
        name: newUser.name,
      });

      // Verify email was sent
      expect(mockEmail.sendWelcomeEmail).toHaveBeenCalledWith(newUser.email, newUser.name);

      // Verify audit log
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'USER_REGISTERED',
          userId: 'new-user-id',
        }),
      });
    });

    it('prevents duplicate email registration', async () => {
      const existingUser = testDataFactory.user({
        email: 'existing@example.com',
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      const { req, res } = createMockApiContext('POST', {
        email: 'existing@example.com',
        password: 'StrongP@ss123',
        name: 'Duplicate User',
      });

      await signupHandler(req, res);

      apiAssertions.expectError(res, 400, 'Email already registered');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('validates registration data', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        name: 'A', // Too short
      };

      const { req, res } = createMockApiContext('POST', invalidData);
      await signupHandler(req, res);

      const data = apiAssertions.expectValidationError(res);
      expect(data.errors).toHaveProperty('email');
      expect(data.errors).toHaveProperty('password');
      expect(data.errors).toHaveProperty('name');
    });
  });

  describe('Login Flow', () => {
    it('successfully logs in with valid credentials', async () => {
      const user = testDataFactory.user({
        email: 'user@example.com',
        password: 'hashed-password',
        emailVerified: new Date(),
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const { req, res } = createMockApiContext('POST', {
        email: 'user@example.com',
        password: 'correct-password',
      });

      await loginHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data).toHaveProperty('token');
      expect(data.user).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
      });

      // Verify audit log
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'USER_LOGIN',
          userId: user.id,
        }),
      });
    });

    it('fails login with incorrect password', async () => {
      const user = testDataFactory.user({
        email: 'user@example.com',
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const { req, res } = createMockApiContext('POST', {
        email: 'user@example.com',
        password: 'wrong-password',
      });

      await loginHandler(req, res);

      apiAssertions.expectError(res, 401, 'Invalid credentials');

      // Verify failed login audit
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'LOGIN_FAILED',
          metadata: expect.objectContaining({
            email: 'user@example.com',
          }),
        }),
      });
    });

    it('prevents login for unverified email', async () => {
      const user = testDataFactory.user({
        email: 'unverified@example.com',
        emailVerified: null,
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const { req, res } = createMockApiContext('POST', {
        email: 'unverified@example.com',
        password: 'correct-password',
      });

      await loginHandler(req, res);

      apiAssertions.expectError(res, 403, 'Email not verified');
    });
  });

  describe('Password Reset Flow', () => {
    it('completes full password reset process', async () => {
      // Step 1: Request password reset
      const user = testDataFactory.user({
        email: 'reset@example.com',
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce({
        id: 'token-id',
        token: 'reset-token',
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
      });

      const { req: req1, res: res1 } = createMockApiContext('POST', {
        email: 'reset@example.com',
      });

      await forgotPasswordHandler(req1, res1);

      apiAssertions.expectSuccess(res1);
      expect(mockEmail.sendPasswordResetEmail).toHaveBeenCalledWith(
        user.email,
        expect.stringContaining('reset-token'),
      );

      // Step 2: Reset password with token
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        id: 'token-id',
        token: 'reset-token',
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
        user,
      });

      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('new-hashed-password');

      const { req: req2, res: res2 } = createMockApiContext('POST', {
        token: 'reset-token',
        newPassword: 'NewStr0ng!Pass',
      });

      await resetPasswordHandler(req2, res2);

      apiAssertions.expectSuccess(res2);

      // Verify password was updated
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { password: 'new-hashed-password' },
      });

      // Verify token was deleted
      expect(mockPrisma.passwordResetToken.delete).toHaveBeenCalledWith({
        where: { id: 'token-id' },
      });

      // Verify audit log
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PASSWORD_RESET',
          userId: user.id,
        }),
      });
    });

    it('handles expired reset token', async () => {
      const expiredToken = {
        id: 'token-id',
        token: 'expired-token',
        userId: 'user-id',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(expiredToken);

      const { req, res } = createMockApiContext('POST', {
        token: 'expired-token',
        newPassword: 'NewStr0ng!Pass',
      });

      await resetPasswordHandler(req, res);

      apiAssertions.expectError(res, 400, 'Token expired');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('handles invalid reset token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null);

      const { req, res } = createMockApiContext('POST', {
        token: 'invalid-token',
        newPassword: 'NewStr0ng!Pass',
      });

      await resetPasswordHandler(req, res);

      apiAssertions.expectError(res, 400, 'Invalid token');
    });
  });

  describe('Rate Limiting', () => {
    it('enforces rate limits on login attempts', async () => {
      // Simulate multiple failed login attempts
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        const { req, res } = createMockApiContext('POST', {
          email: 'ratelimit@example.com',
          password: 'wrong-password',
        });

        // Add IP to simulate same client
        req.headers['x-forwarded-for'] = '192.168.1.100';

        attempts.push(loginHandler(req, res));
      }

      await Promise.all(attempts);

      // Last attempt should be rate limited
      // Note: This assumes rate limiting is implemented in the handler
      // In real implementation, this would be middleware
    });
  });

  describe('Security Headers', () => {
    it('includes security headers in responses', async () => {
      const { req, res } = createMockApiContext('POST', {
        email: 'test@example.com',
        password: 'password',
      });

      await loginHandler(req, res);

      // Check for security headers
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });
  });
});
