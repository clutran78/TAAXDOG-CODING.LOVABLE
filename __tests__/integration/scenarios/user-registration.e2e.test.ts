import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanTestDatabase,
  getTestPrisma,
} from '../setup/test-database';
import { apiTest, makeApiRequest } from '../helpers/api-test-helper';
import { authTest } from '../helpers/auth-test-helper';

// Import handlers
import signupHandler from '@/pages/api/auth/register';
import loginHandler from '@/pages/api/auth/login';
import verifyEmailHandler from '@/pages/api/auth/verify-email';

describe('User Registration E2E Flow', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
  });

  describe('Complete Registration Flow', () => {
    it('should register a new user, send verification email, verify email, and login', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'StrongPass123!@#',
        name: 'New User',
      };

      // Step 1: Register new user
      const signupResponse = await makeApiRequest(signupHandler, {
        method: 'POST',
        body: userData,
      });

      apiTest.expectSuccess(signupResponse, 201);
      expect(signupResponse.data.user).toMatchObject({
        email: userData.email,
        name: userData.name,
        emailVerified: false,
      });
      expect(signupResponse.data.message).toContain('verification email sent');

      // Verify user was created in database
      const createdUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(createdUser).toBeTruthy();
      expect(createdUser?.emailVerified).toBeNull();

      // Step 2: Verify verification token was created
      const verificationToken = await prisma.verificationToken.findFirst({
        where: { identifier: createdUser!.id },
      });
      expect(verificationToken).toBeTruthy();

      // Step 3: Verify email
      const verifyResponse = await makeApiRequest(verifyEmailHandler, {
        method: 'POST',
        body: {
          token: verificationToken!.token,
        },
      });

      apiTest.expectSuccess(verifyResponse);
      expect(verifyResponse.data.message).toContain('Email verified successfully');

      // Verify user email is now verified
      const verifiedUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(verifiedUser?.emailVerified).toBeTruthy();

      // Step 4: Login with verified account
      const loginResponse = await makeApiRequest(loginHandler, {
        method: 'POST',
        body: {
          email: userData.email,
          password: userData.password,
        },
      });

      apiTest.expectSuccess(loginResponse);
      expect(loginResponse.data.user).toMatchObject({
        email: userData.email,
        name: userData.name,
      });
      expect(loginResponse.data.token).toBeTruthy();

      // Verify audit logs were created
      const auditLogs = await prisma.auditLog.findMany({
        where: { userId: createdUser!.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(auditLogs).toHaveLength(3);
      expect(auditLogs[0].action).toBe('USER_REGISTERED');
      expect(auditLogs[1].action).toBe('EMAIL_VERIFIED');
      expect(auditLogs[2].action).toBe('USER_LOGIN');
    });

    it('should prevent registration with existing email', async () => {
      // Create existing user
      await authTest.createTestUser({
        email: 'existing@example.com',
      });

      // Attempt to register with same email
      const response = await makeApiRequest(signupHandler, {
        method: 'POST',
        body: {
          email: 'existing@example.com',
          password: 'Password123!',
          name: 'Duplicate User',
        },
      });

      apiTest.expectError(response, 400, 'Email already registered');
    });

    it('should enforce password strength requirements', async () => {
      const weakPasswords = [
        'short', // Too short
        'password123', // No uppercase or special chars
        'PASSWORD123', // No lowercase or special chars
        'Password', // No numbers or special chars
        'Pass123', // No special chars
      ];

      for (const password of weakPasswords) {
        const response = await makeApiRequest(signupHandler, {
          method: 'POST',
          body: {
            email: `test-${Date.now()}@example.com`,
            password,
            name: 'Test User',
          },
        });

        apiTest.expectValidationError(response, 'password');
      }
    });

    it('should handle rate limiting for registration attempts', async () => {
      // Make multiple registration attempts
      const attempts = 10;
      const responses = [];

      for (let i = 0; i < attempts; i++) {
        const response = await makeApiRequest(signupHandler, {
          method: 'POST',
          body: {
            email: `test${i}@example.com`,
            password: 'Password123!',
            name: `Test User ${i}`,
          },
          headers: {
            'X-Forwarded-For': '192.168.1.100', // Same IP
          },
        });
        responses.push(response);
      }

      // Some requests should be rate limited
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should prevent login without email verification', async () => {
      // Register user
      const userData = {
        email: 'unverified@example.com',
        password: 'Password123!',
        name: 'Unverified User',
      };

      await makeApiRequest(signupHandler, {
        method: 'POST',
        body: userData,
      });

      // Attempt to login without verifying email
      const loginResponse = await makeApiRequest(loginHandler, {
        method: 'POST',
        body: {
          email: userData.email,
          password: userData.password,
        },
      });

      apiTest.expectError(loginResponse, 403, 'Email not verified');
    });
  });

  describe('Registration with Australian Tax Information', () => {
    it('should register user with ABN and TFN', async () => {
      const userData = {
        email: 'business@example.com',
        password: 'Password123!',
        name: 'Business User',
        abn: '51824753556', // Valid ABN
        tfn: '123456782', // Valid TFN format
      };

      const response = await makeApiRequest(signupHandler, {
        method: 'POST',
        body: userData,
      });

      apiTest.expectSuccess(response, 201);

      // Verify tax information was encrypted
      const user = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      expect(user?.abn).toBeNull(); // Plain text should be null
      expect(user?.tfn).toBeNull();
      expect(user?.encryptedAbn).toBeTruthy(); // Encrypted values should exist
      expect(user?.encryptedTfn).toBeTruthy();
    });

    it('should validate ABN format', async () => {
      const response = await makeApiRequest(signupHandler, {
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
          abn: '12345', // Invalid ABN
        },
      });

      apiTest.expectValidationError(response, 'abn');
    });
  });

  describe('Email Verification Edge Cases', () => {
    it('should handle expired verification token', async () => {
      const user = await authTest.createTestUser({
        email: 'expired@example.com',
      });

      // Create expired token
      const expiredToken = await prisma.verificationToken.create({
        data: {
          identifier: user.id,
          token: 'expired-token',
          expires: new Date(Date.now() - 1000), // Already expired
        },
      });

      const response = await makeApiRequest(verifyEmailHandler, {
        method: 'POST',
        body: { token: expiredToken.token },
      });

      apiTest.expectError(response, 400, 'Token expired');
    });

    it('should handle invalid verification token', async () => {
      const response = await makeApiRequest(verifyEmailHandler, {
        method: 'POST',
        body: { token: 'invalid-token' },
      });

      apiTest.expectError(response, 400, 'Invalid token');
    });

    it('should prevent reusing verification token', async () => {
      const user = await authTest.createTestUser();
      const token = await authTest.createEmailVerificationToken(user.id);

      // First verification should succeed
      const firstResponse = await makeApiRequest(verifyEmailHandler, {
        method: 'POST',
        body: { token },
      });
      apiTest.expectSuccess(firstResponse);

      // Second verification should fail
      const secondResponse = await makeApiRequest(verifyEmailHandler, {
        method: 'POST',
        body: { token },
      });
      apiTest.expectError(secondResponse, 400, 'Invalid token');
    });
  });

  describe('Registration Security', () => {
    it('should sanitize user input', async () => {
      const userData = {
        email: 'xss@example.com',
        password: 'Password123!',
        name: '<script>alert("XSS")</script>',
      };

      const response = await makeApiRequest(signupHandler, {
        method: 'POST',
        body: userData,
      });

      apiTest.expectSuccess(response, 201);

      const user = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      // Name should be sanitized
      expect(user?.name).not.toContain('<script>');
      expect(user?.name).not.toContain('</script>');
    });

    it('should hash passwords securely', async () => {
      const userData = {
        email: 'secure@example.com',
        password: 'Password123!',
        name: 'Secure User',
      };

      await makeApiRequest(signupHandler, {
        method: 'POST',
        body: userData,
      });

      const user = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      // Password should be hashed
      expect(user?.password).not.toBe(userData.password);
      expect(user?.password).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern

      // Verify password can be verified
      const isValid = await authTest.verifyPassword(userData.password, user!.password);
      expect(isValid).toBe(true);
    });
  });
});
