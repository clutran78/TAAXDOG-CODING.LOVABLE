import { Page, expect } from '@playwright/test';

export class ProfilePage {
  constructor(private page: Page) {}

  // Locators
  private pageTitle = () =>
    this.page.locator('h1:has-text("Profile"), h2:has-text("Account Settings")');
  private profileForm = () => this.page.locator('form[data-testid="profile-form"], .profile-form');

  // Personal Information
  private nameInput = () => this.page.locator('input[name="name"]');
  private emailInput = () => this.page.locator('input[name="email"]');
  private phoneInput = () => this.page.locator('input[name="phone"]');
  private abnInput = () => this.page.locator('input[name="abn"]');
  private tfnInput = () => this.page.locator('input[name="tfn"]');
  private taxResidencySelect = () => this.page.locator('select[name="taxResidency"]');

  // Security Settings
  private currentPasswordInput = () => this.page.locator('input[name="currentPassword"]');
  private newPasswordInput = () => this.page.locator('input[name="newPassword"]');
  private confirmPasswordInput = () => this.page.locator('input[name="confirmPassword"]');
  private twoFactorToggle = () =>
    this.page.locator('input[name="twoFactorEnabled"], [data-testid="2fa-toggle"]');

  // Subscription
  private subscriptionSection = () =>
    this.page.locator('[data-testid="subscription-section"], .subscription-info');
  private upgradePlanBtn = () =>
    this.page.locator('button:has-text("Upgrade Plan"), button:has-text("Change Plan")');
  private manageBillingBtn = () =>
    this.page.locator('button:has-text("Manage Billing"), button:has-text("Billing Portal")');

  // Preferences
  private currencySelect = () => this.page.locator('select[name="currency"]');
  private timezoneSelect = () => this.page.locator('select[name="timezone"]');
  private emailNotificationsToggle = () => this.page.locator('input[name="emailNotifications"]');
  private smsNotificationsToggle = () => this.page.locator('input[name="smsNotifications"]');

  // Action buttons
  private saveButton = () =>
    this.page.locator('button:has-text("Save"), button[type="submit"]:has-text("Update")');
  private cancelButton = () => this.page.locator('button:has-text("Cancel")');
  private deleteAccountBtn = () => this.page.locator('button:has-text("Delete Account")');

  // Actions
  async goto() {
    await this.page.goto('/dashboard/profile');
    await this.page.waitForLoadState('networkidle');
  }

  async updatePersonalInfo(data: {
    name?: string;
    phone?: string;
    abn?: string;
    tfn?: string;
    taxResidency?: 'RESIDENT' | 'NON_RESIDENT' | 'WORKING_HOLIDAY';
  }) {
    if (data.name) {
      await this.nameInput().clear();
      await this.nameInput().fill(data.name);
    }

    if (data.phone) {
      await this.phoneInput().clear();
      await this.phoneInput().fill(data.phone);
    }

    if (data.abn) {
      await this.abnInput().clear();
      await this.abnInput().fill(data.abn);
    }

    if (data.tfn) {
      await this.tfnInput().clear();
      await this.tfnInput().fill(data.tfn);
    }

    if (data.taxResidency) {
      await this.taxResidencySelect().selectOption(data.taxResidency);
    }

    await this.saveButton().click();
  }

  async changePassword(currentPassword: string, newPassword: string) {
    await this.currentPasswordInput().fill(currentPassword);
    await this.newPasswordInput().fill(newPassword);
    await this.confirmPasswordInput().fill(newPassword);

    // Find the save button in the security section
    const securitySection = this.page.locator(
      '.security-section, [data-testid="security-settings"]',
    );
    await securitySection.locator('button:has-text("Update Password")').click();
  }

  async enableTwoFactorAuth() {
    await this.twoFactorToggle().check();

    // Handle 2FA setup flow
    const modal = this.page.locator('[role="dialog"]:has-text("Two-Factor Authentication")');
    await modal.waitFor({ state: 'visible' });

    // Get QR code or secret
    const secret = await modal.locator('.secret-code, code').textContent();

    // In real tests, you'd use an authenticator library to generate the code
    // For now, we'll use a placeholder
    const verificationCode = '123456';
    await modal.locator('input[placeholder*="code"]').fill(verificationCode);
    await modal.locator('button:has-text("Verify")').click();

    return secret;
  }

  async disableTwoFactorAuth(verificationCode: string) {
    await this.twoFactorToggle().uncheck();

    // Confirm with verification code
    const modal = this.page.locator('[role="dialog"]');
    if (await modal.isVisible({ timeout: 2000 })) {
      await modal.locator('input[placeholder*="code"]').fill(verificationCode);
      await modal.locator('button:has-text("Confirm")').click();
    }
  }

  async updatePreferences(preferences: {
    currency?: string;
    timezone?: string;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
  }) {
    if (preferences.currency) {
      await this.currencySelect().selectOption(preferences.currency);
    }

    if (preferences.timezone) {
      await this.timezoneSelect().selectOption(preferences.timezone);
    }

    if (preferences.emailNotifications !== undefined) {
      if (preferences.emailNotifications) {
        await this.emailNotificationsToggle().check();
      } else {
        await this.emailNotificationsToggle().uncheck();
      }
    }

    if (preferences.smsNotifications !== undefined) {
      if (preferences.smsNotifications) {
        await this.smsNotificationsToggle().check();
      } else {
        await this.smsNotificationsToggle().uncheck();
      }
    }

    await this.saveButton().click();
  }

  async manageBilling() {
    await this.manageBillingBtn().click();

    // This typically opens Stripe billing portal
    // Wait for new tab or redirect
    const newPage = await this.page.context().waitForEvent('page');
    await newPage.waitForLoadState();
    return newPage;
  }

  async upgradePlan() {
    await this.upgradePlanBtn().click();

    // Wait for plan selection modal or navigation
    const modal = this.page.locator('[role="dialog"]:has-text("Choose Plan")');
    const isModal = await modal.isVisible({ timeout: 2000 });

    if (!isModal) {
      await this.page.waitForURL('**/subscription**');
    }
  }

  async downloadData() {
    const downloadBtn = this.page.locator('button:has-text("Download My Data")');
    await downloadBtn.click();

    // Wait for download
    const download = await this.page.waitForEvent('download');
    return download;
  }

  async deleteAccount(password: string) {
    await this.deleteAccountBtn().click();

    // Handle confirmation modal
    const modal = this.page.locator('[role="dialog"]:has-text("Delete Account")');
    await modal.waitFor({ state: 'visible' });

    // Type DELETE to confirm
    const confirmInput = modal.locator('input[placeholder*="DELETE"]');
    await confirmInput.fill('DELETE');

    // Enter password
    const passwordInput = modal.locator('input[type="password"]');
    await passwordInput.fill(password);

    // Confirm deletion
    await modal.locator('button:has-text("Delete My Account")').click();
  }

  // Assertions
  async expectSuccessNotification(message?: string) {
    const notification = this.page.locator('.alert-success, [role="alert"].success');
    await expect(notification).toBeVisible();
    if (message) {
      await expect(notification).toContainText(message);
    }
  }

  async expectValidationError(fieldName: string) {
    const field = this.page.locator(`[name="${fieldName}"]`);
    const errorMsg = field.locator('~ .invalid-feedback, ~ .error-message');
    await expect(errorMsg).toBeVisible();
  }

  async expectPasswordStrength(strength: 'weak' | 'medium' | 'strong') {
    const strengthIndicator = this.page.locator(
      '.password-strength, [data-testid="password-strength"]',
    );
    await expect(strengthIndicator).toHaveAttribute('data-strength', strength);
  }

  async expectSubscriptionPlan(planName: string) {
    await expect(this.subscriptionSection()).toContainText(planName);
  }

  async expectTwoFactorEnabled() {
    await expect(this.twoFactorToggle()).toBeChecked();
  }

  async expectFieldValue(fieldName: string, value: string) {
    const field = this.page.locator(`[name="${fieldName}"]`);
    await expect(field).toHaveValue(value);
  }

  // Utilities
  async getProfileData() {
    return {
      name: await this.nameInput().inputValue(),
      email: await this.emailInput().inputValue(),
      phone: await this.phoneInput().inputValue(),
      abn: await this.abnInput().inputValue(),
      tfn: await this.tfnInput().inputValue(),
      taxResidency: await this.taxResidencySelect().inputValue(),
    };
  }

  async getSubscriptionInfo() {
    const planName = await this.subscriptionSection().locator('.plan-name').textContent();
    const status = await this.subscriptionSection().locator('.status').textContent();
    const nextBilling = await this.subscriptionSection().locator('.next-billing').textContent();

    return {
      plan: planName?.trim(),
      status: status?.trim(),
      nextBilling: nextBilling?.trim(),
    };
  }

  async getSecuritySettings() {
    return {
      twoFactorEnabled: await this.twoFactorToggle().isChecked(),
      lastPasswordChange: await this.page.locator('.last-password-change').textContent(),
      activeSessions: await this.page.locator('.active-sessions-count').textContent(),
    };
  }

  async validateABN(abn: string) {
    await this.abnInput().fill(abn);
    await this.abnInput().blur();

    // Wait for validation
    await this.page.waitForTimeout(500);

    const isValid = await this.abnInput().evaluate((input: HTMLInputElement) => {
      return !input.classList.contains('is-invalid');
    });

    return isValid;
  }
}
