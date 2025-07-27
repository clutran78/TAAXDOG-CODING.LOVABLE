import { db } from '../helpers/database';
import { ApiTester, expectSuccess, expectError } from '../helpers/api';
import { mockSession, mockNoSession, authScenarios } from '../helpers/auth';
import { mockData } from '../fixtures/mockData';
import loginHandler from '../../../pages/api/auth/login';
import registerHandler from '../../../pages/api/auth/register';
import profileHandler from '../../../pages/api/auth/profile';
import forgotPasswordHandler from '../../../pages/api/auth/forgot-password';
import bcrypt from 'bcryptjs';

describe('Authentication API Tests', () => {
  let testUser: any;
  const loginApi = new ApiTester(loginHandler);
  const registerApi = new ApiTester(registerHandler);
  const profileApi = new ApiTester(profileHandler);
  const forgotPasswordApi = new ApiTester(forgotPasswordHandler);

  beforeEach(async () => {
    await db.cleanDatabase();
    // Create a test user
    testUser = await db.createUser({
      email: 'auth-test@example.com',
      name: 'Auth Test User',
      password: await bcrypt.hash('Test123!@#', 10),
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'New User',
      };

      const response = await registerApi.post(newUser);
      expectSuccess(response, 201);

      expect(response.data.data).toMatchObject({
        user: {
          email: newUser.email,
          name: newUser.name,
          role: 'USER',
        },
      });
      expect(response.data.data.user.id).toBeUUID();
      expect(response.data.data.user.password).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      const response = await registerApi.post({
        email: testUser.email,
        password: 'AnotherPass123!',
        name: 'Duplicate User',
      });

      expectError(response, 409, 'already exists');
    });

    it('should validate password strength', async () => {
      const response = await registerApi.post({
        email: 'weak@example.com',
        password: 'weak',
        name: 'Weak Password',
      });

      expectError(response, 400, 'Password');
    });

    it('should validate email format', async () => {
      const response = await registerApi.post({
        email: 'invalid-email',
        password: 'ValidPass123!',
        name: 'Invalid Email',
      });

      expectError(response, 400, 'Invalid email');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await loginApi.post({
        email: testUser.email,
        password: 'Test123!@#',
      });

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        user: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        },
      });
    });

    it('should reject invalid password', async () => {
      const response = await loginApi.post({
        email: testUser.email,
        password: 'WrongPassword',
      });

      expectError(response, 401, 'Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const response = await loginApi.post({
        email: 'nonexistent@example.com',
        password: 'AnyPassword123!',
      });

      expectError(response, 401, 'Invalid credentials');
    });

    it('should track failed login attempts', async () => {
      // Make multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await loginApi.post({
          email: testUser.email,
          password: 'WrongPassword',
        });
      }

      // Check audit logs
      const logs = await (global as any).prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          event: 'LOGIN_FAILED',
        },
      });

      expect(logs.length).toBe(3);
    });

    it('should handle suspended accounts', async () => {
      // Suspend the user
      await (global as any).prisma.user.update({
        where: { id: testUser.id },
        data: { suspended: true },
      });

      const response = await loginApi.post({
        email: testUser.email,
        password: 'Test123!@#',
      });

      expectError(response, 403, 'suspended');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get authenticated user profile', async () => {
      mockSession(testUser);
      const response = await profileApi.get();

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
      });
      expect(response.data.data.password).toBeUndefined();
    });

    it('should require authentication', async () => {
      mockNoSession();
      const response = await profileApi.get();

      expectError(response, 401, 'Unauthorized');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const response = await forgotPasswordApi.post({
        email: testUser.email,
      });

      expectSuccess(response);
      expect(response.data.message).toContain('reset link');

      // Check that reset token was created
      const updatedUser = await (global as any).prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser.resetToken).toBeTruthy();
      expect(updatedUser.resetTokenExpiry).toBeValidDate();
    });

    it('should handle non-existent email gracefully', async () => {
      const response = await forgotPasswordApi.post({
        email: 'nonexistent@example.com',
      });

      // Should still return success to prevent email enumeration
      expectSuccess(response);
      expect(response.data.message).toContain('reset link');
    });

    it('should rate limit password reset requests', async () => {
      // Make multiple requests
      for (let i = 0; i < 5; i++) {
        const response = await forgotPasswordApi.post({
          email: testUser.email,
        });
        if (i < 3) {
          expectSuccess(response);
        }
      }

      // Next request should be rate limited
      const response = await forgotPasswordApi.post({
        email: testUser.email,
      });
      expectError(response, 429, 'Too many');
    });
  });

  describe('Security Tests', () => {
    it('should hash passwords properly', async () => {
      const plainPassword = 'TestPassword123!';
      const response = await registerApi.post({
        email: 'hashtest@example.com',
        password: plainPassword,
        name: 'Hash Test',
      });

      expectSuccess(response, 201);

      // Check database
      const user = await (global as any).prisma.user.findUnique({
        where: { email: 'hashtest@example.com' },
      });

      expect(user.password).not.toBe(plainPassword);
      expect(user.password).toMatch(/^\$2[aby]\$\d{2}\$/);

      // Verify password can be checked
      const isValid = await bcrypt.compare(plainPassword, user.password);
      expect(isValid).toBe(true);
    });

    it('should sanitize user input', async () => {
      const response = await registerApi.post({
        email: 'xss@example.com',
        password: 'ValidPass123!',
        name: '<script>alert("XSS")</script>',
      });

      expectSuccess(response, 201);
      expect(response.data.data.user.name).toBe('alert("XSS")');
    });

    it('should include security headers', async () => {
      mockSession(testUser);
      const response = await profileApi.get();

      const headers = response.headers;
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['cache-control']).toContain('no-store');
    });
  });
});
