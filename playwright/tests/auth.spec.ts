import { test, expect } from '../helpers/test-base';
import { faker } from '@faker-js/faker';

test.describe('Authentication', () => {
  test.describe('User Registration', () => {
    test('should successfully register a new user', async ({ page, authPage }) => {
      await authPage.goto('register');

      const userData = {
        email: faker.internet.email(),
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        name: faker.person.fullName(),
        phone: '0412345678',
      };

      await authPage.register(userData);
      await authPage.expectRegisterSuccess();
    });

    test('should show validation errors for invalid inputs', async ({ authPage }) => {
      await authPage.goto('register');

      // Test empty form submission
      await authPage.register({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
      });

      await authPage.expectFieldError('email');
      await authPage.expectFieldError('password');
      await authPage.expectFieldError('name');
    });

    test('should validate password strength', async ({ authPage }) => {
      await authPage.goto('register');

      // Weak password
      await authPage.fillPasswordWithStrength('weak');
      await authPage.expectPasswordStrengthIndicator();

      // Strong password
      await authPage.fillPasswordWithStrength('SecurePass123!@#');
      await authPage.expectPasswordStrengthIndicator();
    });

    test('should prevent duplicate email registration', async ({ authPage }) => {
      await authPage.goto('register');

      const existingEmail = 'existing@example.com';

      await authPage.register({
        email: existingEmail,
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!',
        name: 'Test User',
      });

      await authPage.expectError('already registered');
    });

    test('should validate password confirmation match', async ({ authPage }) => {
      await authPage.goto('register');

      await authPage.register({
        email: faker.internet.email(),
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!',
        name: faker.person.fullName(),
      });

      await authPage.expectFieldError('confirmPassword', 'Passwords do not match');
    });
  });

  test.describe('User Login', () => {
    test('should successfully login with valid credentials', async ({ authPage }) => {
      await authPage.goto('login');

      // Use test user credentials
      await authPage.login('testuser@example.com', 'TestPass123!');
      await authPage.expectLoginSuccess();
    });

    test('should show error for invalid credentials', async ({ authPage }) => {
      await authPage.goto('login');

      await authPage.login('wrong@example.com', 'WrongPassword');
      await authPage.expectError('Invalid credentials');
    });

    test('should redirect to dashboard if already logged in', async ({
      page,
      authPage,
      authenticatedPage,
    }) => {
      // Use authenticated page fixture
      await page.goto('/auth/login');
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should handle account lockout after failed attempts', async ({ authPage }) => {
      await authPage.goto('login');

      const email = 'testuser@example.com';

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await authPage.login(email, 'WrongPassword');
        await page.waitForTimeout(500);
      }

      await authPage.expectError('Account locked');
    });
  });

  test.describe('Password Reset', () => {
    test('should send password reset email', async ({ authPage }) => {
      await authPage.goto('login');

      await authPage.requestPasswordReset('testuser@example.com');

      await expect(page.locator('.alert-success')).toContainText('reset email sent');
    });

    test('should reset password with valid token', async ({ authPage, page }) => {
      const resetToken = 'valid-reset-token';
      const newPassword = 'NewSecurePass123!';

      await authPage.resetPassword(resetToken, newPassword, newPassword);

      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.locator('.alert-success')).toContainText('Password reset successful');
    });

    test('should reject invalid or expired token', async ({ authPage }) => {
      const invalidToken = 'invalid-token';

      await authPage.resetPassword(invalidToken, 'NewPass123!', 'NewPass123!');

      await authPage.expectError('Invalid or expired token');
    });
  });

  test.describe('OAuth Login', () => {
    test.skip('should login with Google OAuth', async ({ authPage, page }) => {
      // Skip in CI as it requires real Google account
      await authPage.goto('login');

      // This would open Google OAuth flow
      await authPage.loginWithGoogle();

      // In real tests, you'd mock the OAuth response
      // or use test accounts
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page refreshes', async ({ page, authPage }) => {
      await authPage.goto('login');
      await authPage.login('testuser@example.com', 'TestPass123!');

      await page.reload();

      expect(await authPage.isLoggedIn()).toBe(true);
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should logout successfully', async ({ page, authPage, authenticatedPage }) => {
      await page.goto('/dashboard');

      await authPage.logout();

      await expect(page).toHaveURL(/\/auth\/login/);
      expect(await authPage.isLoggedIn()).toBe(false);
    });

    test('should handle session expiry', async ({ page, context }) => {
      // Simulate expired session
      await context.clearCookies();

      await page.goto('/dashboard');

      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.locator('.alert')).toContainText('Session expired');
    });
  });

  test.describe('Security Features', () => {
    test('should enforce secure password requirements', async ({ authPage }) => {
      await authPage.goto('register');

      const weakPasswords = [
        'short', // Too short
        'alllowercase', // No uppercase
        'ALLUPPERCASE', // No lowercase
        'NoNumbers!', // No numbers
        'NoSpecial123', // No special characters
      ];

      for (const password of weakPasswords) {
        await authPage.fillPasswordWithStrength(password);
        const saveBtn = page.locator('button[type="submit"]');
        await expect(saveBtn).toBeDisabled();
      }
    });

    test('should protect against XSS in login form', async ({ authPage, page }) => {
      await authPage.goto('login');

      const xssPayload = '<script>alert("XSS")</script>';

      await authPage.login(xssPayload, 'password');

      // Check that script is not executed
      const alerts = [];
      page.on('dialog', (dialog) => alerts.push(dialog));

      await page.waitForTimeout(1000);
      expect(alerts).toHaveLength(0);
    });

    test('should implement CSRF protection', async ({ page }) => {
      // Try to submit login form without CSRF token
      const response = await page.request.post('/api/auth/login', {
        data: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('CSRF');
    });
  });
});
