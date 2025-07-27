import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  // Locators
  private emailInput = () => this.page.locator('input[name="email"], input[type="email"]');
  private passwordInput = () => this.page.locator('input[name="password"]').first();
  private confirmPasswordInput = () =>
    this.page.locator('input[name="confirmPassword"], input[placeholder*="Re-enter"]');
  private nameInput = () => this.page.locator('input[name="name"]');
  private phoneInput = () => this.page.locator('input[name="phone"]');
  private loginButton = () =>
    this.page.locator(
      'button[type="submit"]:has-text("Sign In"), button[type="submit"]:has-text("Login")',
    );
  private registerButton = () =>
    this.page.locator(
      'button[type="submit"]:has-text("Create account"), button[type="submit"]:has-text("Sign Up"), button[type="submit"]:has-text("Register")',
    );
  private googleLoginButton = () => this.page.locator('button:has-text("Continue with Google")');
  private forgotPasswordLink = () => this.page.locator('a:has-text("Forgot password")');
  private signUpLink = () =>
    this.page.locator('a:has-text("Sign up"), a:has-text("Create account")');
  private errorMessage = () => this.page.locator('.alert-danger, [role="alert"]');

  // Actions
  async goto(path: 'login' | 'register' | 'forgot-password' = 'login') {
    await this.page.goto(`/auth/${path}`);
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.loginButton().click();
  }

  async register(userData: {
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    phone?: string;
  }) {
    await this.emailInput().fill(userData.email);
    await this.nameInput().fill(userData.name);
    if (userData.phone) {
      await this.phoneInput().fill(userData.phone);
    }
    await this.passwordInput().fill(userData.password);
    await this.confirmPasswordInput().fill(userData.confirmPassword);

    // Check for terms checkbox
    await this.acceptTerms();

    // Scroll to button and click
    await this.registerButton().scrollIntoViewIfNeeded();
    await this.registerButton().click();
  }

  async loginWithGoogle() {
    await this.googleLoginButton().click();
    // Handle Google OAuth flow in tests
  }

  async requestPasswordReset(email: string) {
    await this.forgotPasswordLink().click();
    await this.page.waitForURL('**/auth/forgot-password');
    await this.emailInput().fill(email);
    await this.page.locator('button[type="submit"]').click();
  }

  async resetPassword(token: string, newPassword: string, confirmPassword: string) {
    await this.page.goto(`/auth/reset-password?token=${token}`);
    await this.passwordInput().fill(newPassword);
    await this.confirmPasswordInput().fill(confirmPassword);
    await this.page.locator('button[type="submit"]').click();
  }

  // Assertions
  async expectLoginSuccess() {
    await expect(this.page).toHaveURL(/\/dashboard/);
    await expect(this.page.locator('h1, h2').first()).toContainText(/Dashboard|Overview/i);
  }

  async expectRegisterSuccess() {
    // Check for success message or redirect
    const successMessage = this.page.locator('.alert-success, text=/verify|confirm/i');
    const isDashboard = this.page.url().includes('/dashboard');

    if (await successMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(successMessage).toBeVisible();
    } else {
      await expect(this.page).toHaveURL(/\/dashboard/);
    }
  }

  async expectError(message?: string) {
    await expect(this.errorMessage()).toBeVisible();
    if (message) {
      await expect(this.errorMessage()).toContainText(message);
    }
  }

  async expectPasswordStrengthIndicator() {
    const strengthIndicator = this.page.locator('[role="progressbar"], .password-strength');
    await expect(strengthIndicator).toBeVisible();
  }

  async expectFieldError(fieldName: string, errorMessage?: string) {
    const fieldError = this.page.locator(
      `[name="${fieldName}"] ~ .invalid-feedback, [name="${fieldName}"] ~ .text-danger`,
    );
    await expect(fieldError).toBeVisible();
    if (errorMessage) {
      await expect(fieldError).toContainText(errorMessage);
    }
  }

  // Utilities
  async isLoggedIn(): Promise<boolean> {
    // Check for auth cookie or localStorage
    const cookies = await this.page.context().cookies();
    return cookies.some((cookie) => cookie.name.includes('next-auth'));
  }

  async logout() {
    await this.page.goto('/api/auth/signout');
    await this.page.locator('button:has-text("Sign out")').click();
    await this.page.waitForURL('**/auth/login');
  }

  async fillPasswordWithStrength(password: string) {
    await this.passwordInput().fill(password);
    await this.page.waitForTimeout(500); // Wait for strength calculation
  }

  async acceptTerms() {
    const termsCheckbox = this.page.locator('input[type="checkbox"][name="terms"]');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }
  }
}
