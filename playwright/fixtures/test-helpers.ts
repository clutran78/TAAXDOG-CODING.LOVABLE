import { Page } from '@playwright/test';
import testData from './test-data.json';

/**
 * Test data helpers and utilities
 */

export class TestDataHelper {
  constructor(private page: Page) {}

  // Get test user by type
  getUser(type: 'test' | 'premium' | 'admin' = 'test') {
    const users = {
      test: testData.users.testUser,
      premium: testData.users.premiumUser,
      admin: testData.users.adminUser,
    };
    return users[type];
  }

  // Get random transaction
  getRandomTransaction(type: 'income' | 'expense') {
    const transactions = testData.transactions[type];
    return transactions[Math.floor(Math.random() * transactions.length)];
  }

  // Get test goal
  getGoal(index: number = 0) {
    return testData.goals[index];
  }

  // Get bank account
  getBankAccount(index: number = 0) {
    return testData.banks.testAccounts[index];
  }

  // Generate unique email
  generateUniqueEmail(prefix: string = 'test') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}-${timestamp}-${random}@example.com`;
  }

  // Generate Australian phone number
  generateAustralianPhone() {
    const prefixes = ['0412', '0413', '0414', '0415', '0416', '0417', '0418', '0419'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 900000 + 100000);
    return `${prefix}${suffix}`;
  }

  // Generate ABN (Australian Business Number)
  generateABN() {
    // Simple mock ABN - in real tests you'd use a valid ABN algorithm
    const base = Math.floor(Math.random() * 90000000000 + 10000000000);
    return base.toString();
  }

  // Format currency for assertions
  formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  }

  // Calculate GST
  calculateGST(amount: number, inclusive: boolean = true) {
    if (inclusive) {
      return amount / 11; // GST component of GST-inclusive amount
    }
    return amount * 0.1; // GST to add to GST-exclusive amount
  }

  // Get current Australian financial year
  getFinancialYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (month >= 6) {
      // July onwards
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }

  // Generate date in Australian format
  formatDateAU(date: Date) {
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Wait for API response
  async waitForApiResponse(endpoint: string, timeout: number = 10000) {
    return this.page.waitForResponse(
      (response) => response.url().includes(endpoint) && response.status() === 200,
      { timeout },
    );
  }

  // Mock successful payment
  async mockStripePayment() {
    await this.page.route('**/api/stripe/create-payment-intent', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clientSecret: 'pi_mock_secret_123',
          paymentIntentId: 'pi_mock_123',
        }),
      });
    });

    await this.page.route('**/api/stripe/confirm-payment', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'succeeded',
          subscriptionId: testData.mockApiResponses.stripe.subscriptionId,
        }),
      });
    });
  }

  // Mock bank connection
  async mockBankConnection(bankName: string) {
    await this.page.route('**/api/banking/connect', (route) => {
      if (route.request().postData()?.includes(bankName)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            connectionId: testData.mockApiResponses.basiq.connectionId,
            status: 'connected',
            accounts: testData.banks.testAccounts.filter((acc) => acc.bank === bankName),
          }),
        });
      } else {
        route.continue();
      }
    });
  }

  // Setup authenticated session
  async setupAuthenticatedSession(userType: 'test' | 'premium' | 'admin' = 'test') {
    const user = this.getUser(userType);

    // Set auth cookie
    await this.page.context().addCookies([
      {
        name: 'next-auth.session-token',
        value: `mock-session-${userType}`,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // Mock /api/auth/session response
    await this.page.route('**/api/auth/session', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: `user-${userType}`,
            email: user.email,
            name: user.name,
            role: user.role || 'USER',
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
    });
  }

  // Create test receipt file
  async createTestReceipt() {
    // In real tests, you'd have actual image files
    // This creates a mock file for upload testing
    const canvas = await this.page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 300;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 200, 300);

      ctx.fillStyle = 'black';
      ctx.font = '16px Arial';
      ctx.fillText('TEST RECEIPT', 50, 50);
      ctx.fillText('Amount: $100.00', 20, 100);
      ctx.fillText('Date: 01/01/2024', 20, 130);

      return canvas.toDataURL('image/png');
    });

    // Convert data URL to blob
    const base64Data = canvas.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    return {
      name: 'test-receipt.png',
      mimeType: 'image/png',
      buffer,
    };
  }
}

// Export categories and other constants
export const TAX_CATEGORIES = testData.categories.taxDeductible;
export const EXPENSE_CATEGORIES = testData.categories.expense;
export const INCOME_CATEGORIES = testData.categories.income;
export const SUBSCRIPTION_PLANS = testData.subscriptions.plans;
export const SUPPORTED_BANKS = testData.banks.supported;

// Utility functions
export function generateTransactionDescription() {
  const merchants = ['Coles', 'Woolworths', 'Bunnings', 'JB Hi-Fi', 'Target', 'Kmart'];
  const items = ['groceries', 'supplies', 'equipment', 'materials', 'items'];
  const merchant = merchants[Math.floor(Math.random() * merchants.length)];
  const item = items[Math.floor(Math.random() * items.length)];
  return `${merchant} - ${item}`;
}

export function generateRandomAmount(min: number = 10, max: number = 500) {
  return Math.floor(Math.random() * (max - min + 1) + min) + Math.random();
}

export function getFutureDate(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

export function getPastDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}
