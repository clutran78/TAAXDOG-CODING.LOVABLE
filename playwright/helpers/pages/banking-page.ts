import { Page, expect } from '@playwright/test';

export class BankingPage {
  constructor(private page: Page) {}

  // Locators
  private pageTitle = () =>
    this.page.locator('h1:has-text("Banking"), h2:has-text("Bank Connections")');
  private connectBankBtn = () =>
    this.page.locator('button:has-text("Connect Bank"), button:has-text("Add Bank")');
  private connectedBanksList = () =>
    this.page.locator('[data-testid="connected-banks"], .banks-list');
  private bankCard = (bankName: string) => this.page.locator(`.bank-card:has-text("${bankName}")`);
  private accountsList = () =>
    this.page.locator('[data-testid="accounts-list"], .accounts-container');
  private accountCard = (accountName: string) =>
    this.page.locator(`.account-card:has-text("${accountName}")`);
  private syncButton = () =>
    this.page.locator('button:has-text("Sync"), button:has-text("Refresh")');
  private lastSyncTime = () => this.page.locator('.last-sync, [data-testid="last-sync"]');

  // Bank selection modal
  private bankSelectionModal = () => this.page.locator('[role="dialog"]:has-text("Select Bank")');
  private bankSearchInput = () => this.bankSelectionModal().locator('input[placeholder*="Search"]');
  private bankOption = (bankName: string) =>
    this.bankSelectionModal().locator(`button:has-text("${bankName}")`);

  // Consent flow
  private consentModal = () => this.page.locator('[role="dialog"]:has-text("Consent")');
  private agreeCheckbox = () => this.consentModal().locator('input[type="checkbox"]');
  private proceedButton = () =>
    this.consentModal().locator('button:has-text("Proceed"), button:has-text("Continue")');

  // Account selection
  private accountSelectionModal = () =>
    this.page.locator('[role="dialog"]:has-text("Select Accounts")');
  private accountCheckbox = (accountName: string) =>
    this.accountSelectionModal().locator(`input[type="checkbox"]:near(:text("${accountName}"))`);
  private selectAllCheckbox = () =>
    this.accountSelectionModal().locator('input[type="checkbox"]:has-text("Select All")');
  private confirmAccountsBtn = () =>
    this.accountSelectionModal().locator(
      'button:has-text("Confirm"), button:has-text("Connect Selected")',
    );

  // Actions
  async goto() {
    await this.page.goto('/dashboard/banking');
    await this.page.waitForLoadState('networkidle');
  }

  async connectBank(bankName: string, credentials?: { username: string; password: string }) {
    await this.connectBankBtn().click();
    await this.bankSelectionModal().waitFor({ state: 'visible' });

    // Search and select bank
    await this.bankSearchInput().fill(bankName);
    await this.bankOption(bankName).click();

    // Handle consent
    const consentVisible = await this.consentModal().isVisible({ timeout: 5000 });
    if (consentVisible) {
      await this.agreeCheckbox().check();
      await this.proceedButton().click();
    }

    // Handle credentials if bank requires direct input
    if (credentials) {
      const usernameInput = this.page.locator('input[name="username"], input[type="text"]').last();
      const passwordInput = this.page
        .locator('input[name="password"], input[type="password"]')
        .last();

      if (await usernameInput.isVisible({ timeout: 5000 })) {
        await usernameInput.fill(credentials.username);
        await passwordInput.fill(credentials.password);
        await this.page.locator('button[type="submit"]').last().click();
      }
    }

    // Handle OAuth flow if redirected
    const isOAuth =
      (await this.page.url().includes('auth')) || (await this.page.url().includes('oauth'));
    if (isOAuth) {
      // Wait for redirect back
      await this.page.waitForURL('**/dashboard/banking**', { timeout: 60000 });
    }
  }

  async selectAccountsToConnect(accountNames: string[]) {
    await this.accountSelectionModal().waitFor({ state: 'visible' });

    for (const accountName of accountNames) {
      await this.accountCheckbox(accountName).check();
    }

    await this.confirmAccountsBtn().click();
  }

  async disconnectBank(bankName: string) {
    const bank = this.bankCard(bankName);
    await bank.locator('button[aria-label*="Disconnect"], button:has-text("Disconnect")').click();

    // Confirm disconnection
    const confirmBtn = this.page
      .locator('button:has-text("Confirm"), button:has-text("Disconnect")')
      .last();
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
    }
  }

  async syncBankData(bankName?: string) {
    if (bankName) {
      const bank = this.bankCard(bankName);
      await bank.locator('button:has-text("Sync")').click();
    } else {
      await this.syncButton().click();
    }

    // Wait for sync to complete
    await this.page.waitForLoadState('networkidle');

    // Wait for loading indicator to disappear
    const loadingIndicator = this.page.locator('.loading, .spinner, [data-testid="loading"]');
    await loadingIndicator.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }

  async viewAccountDetails(accountName: string) {
    const account = this.accountCard(accountName);
    await account.click();

    // Wait for account details or navigation
    const detailsModal = this.page.locator('[role="dialog"]:has-text("Account Details")');
    const isModal = await detailsModal.isVisible({ timeout: 2000 });

    if (!isModal) {
      await this.page.waitForURL('**/account/**');
    }
  }

  async viewAccountTransactions(accountName: string) {
    const account = this.accountCard(accountName);
    await account
      .locator('button:has-text("View Transactions"), a:has-text("Transactions")')
      .click();
    await this.page.waitForURL('**/transactions**');
  }

  async updateAccountSettings(
    accountName: string,
    settings: {
      nickname?: string;
      autoSync?: boolean;
      includeInBudget?: boolean;
    },
  ) {
    const account = this.accountCard(accountName);
    await account.locator('button[aria-label*="Settings"], button:has-text("Settings")').click();

    const settingsModal = this.page.locator('[role="dialog"]:has-text("Account Settings")');
    await settingsModal.waitFor({ state: 'visible' });

    if (settings.nickname) {
      const nicknameInput = settingsModal.locator('input[name="nickname"]');
      await nicknameInput.clear();
      await nicknameInput.fill(settings.nickname);
    }

    if (settings.autoSync !== undefined) {
      const autoSyncCheckbox = settingsModal.locator('input[name="autoSync"]');
      if (settings.autoSync) {
        await autoSyncCheckbox.check();
      } else {
        await autoSyncCheckbox.uncheck();
      }
    }

    if (settings.includeInBudget !== undefined) {
      const budgetCheckbox = settingsModal.locator('input[name="includeInBudget"]');
      if (settings.includeInBudget) {
        await budgetCheckbox.check();
      } else {
        await budgetCheckbox.uncheck();
      }
    }

    await settingsModal.locator('button:has-text("Save")').click();
  }

  // Assertions
  async expectBankToBeConnected(bankName: string) {
    await expect(this.bankCard(bankName)).toBeVisible();
  }

  async expectBankNotToBeConnected(bankName: string) {
    await expect(this.bankCard(bankName)).not.toBeVisible();
  }

  async expectAccountToExist(accountName: string) {
    await expect(this.accountCard(accountName)).toBeVisible();
  }

  async expectAccountBalance(accountName: string, expectedBalance: number) {
    const account = this.accountCard(accountName);
    const balanceElement = account.locator('.balance, [data-testid="balance"]');
    const formattedBalance = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(expectedBalance);
    await expect(balanceElement).toContainText(formattedBalance);
  }

  async expectSyncSuccess() {
    const notification = this.page.locator(
      '.alert-success:has-text("Sync"), [role="alert"]:has-text("updated")',
    );
    await expect(notification).toBeVisible();
  }

  async expectConnectionStatus(bankName: string, status: 'Active' | 'Error' | 'Syncing') {
    const bank = this.bankCard(bankName);
    const statusElement = bank.locator('.status, [data-testid="connection-status"]');
    await expect(statusElement).toContainText(status);
  }

  async expectLastSyncTime() {
    const syncTime = await this.lastSyncTime().textContent();
    expect(syncTime).toMatch(/\d+.*ago|just now/i);
  }

  async expectErrorMessage(message: string) {
    const error = this.page.locator('.alert-danger, [role="alert"].error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(message);
  }

  // Utilities
  async getConnectedBanks() {
    const banks = await this.connectedBanksList().locator('.bank-card').all();
    return Promise.all(
      banks.map(async (bank) => {
        const name = await bank.locator('.bank-name, h3, h4').first().textContent();
        const status = await bank.locator('.status').textContent();
        return {
          name: name?.trim(),
          status: status?.trim(),
        };
      }),
    );
  }

  async getAccountsList() {
    const accounts = await this.accountsList().locator('.account-card').all();
    return Promise.all(
      accounts.map(async (account) => {
        const name = await account.locator('.account-name, h4').first().textContent();
        const balance = await account.locator('.balance').textContent();
        const type = await account.locator('.account-type').textContent();
        return {
          name: name?.trim(),
          balance: balance?.trim(),
          type: type?.trim(),
        };
      }),
    );
  }

  async getTotalBalance() {
    const totalElement = this.page.locator('[data-testid="total-balance"], .total-balance');
    const balanceText = await totalElement.textContent();
    return balanceText?.replace(/[^0-9.-]/g, '') || '0';
  }

  async checkConnectionHealth(bankName: string) {
    const bank = this.bankCard(bankName);
    const healthIndicator = bank.locator('.health-indicator, [data-testid="health"]');

    const isHealthy = await healthIndicator.evaluate((el) => {
      return el.classList.contains('healthy') || el.classList.contains('success');
    });

    return isHealthy;
  }

  async waitForBankingDataLoad() {
    await this.page.waitForLoadState('networkidle');
    const spinner = this.page.locator('.spinner, .loading');
    await spinner.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }
}
