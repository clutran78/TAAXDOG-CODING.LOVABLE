import { test as base, expect } from '@playwright/test';
import { AuthPage } from './pages/auth-page';
import { DashboardPage } from './pages/dashboard-page';
import { GoalsPage } from './pages/goals-page';
import { TransactionsPage } from './pages/transactions-page';
import { BankingPage } from './pages/banking-page';
import { ProfilePage } from './pages/profile-page';

/**
 * Custom test fixtures for TAAXDOG
 */
type MyFixtures = {
  authPage: AuthPage;
  dashboardPage: DashboardPage;
  goalsPage: GoalsPage;
  transactionsPage: TransactionsPage;
  bankingPage: BankingPage;
  profilePage: ProfilePage;
  authenticatedPage: any;
};

export const test = base.extend<MyFixtures>({
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  goalsPage: async ({ page }, use) => {
    await use(new GoalsPage(page));
  },

  transactionsPage: async ({ page }, use) => {
    await use(new TransactionsPage(page));
  },

  bankingPage: async ({ page }, use) => {
    await use(new BankingPage(page));
  },

  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },

  authenticatedPage: async ({ page, context }, use) => {
    // Set up authentication cookies/storage
    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'test-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // Or use storage state if available
    // await context.storageState({ path: 'playwright/fixtures/.auth/user.json' });

    await use(page);
  },
});

export { expect };

// Custom matchers
export const customExpect = {
  async toHaveSuccessNotification(page: any, message?: string) {
    const notification = page.locator('.alert-success, [role="alert"].success');
    await expect(notification).toBeVisible();
    if (message) {
      await expect(notification).toContainText(message);
    }
  },

  async toHaveErrorNotification(page: any, message?: string) {
    const notification = page.locator('.alert-danger, [role="alert"].error');
    await expect(notification).toBeVisible();
    if (message) {
      await expect(notification).toContainText(message);
    }
  },

  async toHaveCurrency(locator: any, amount: number) {
    const text = await locator.textContent();
    const formattedAmount = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
    expect(text).toContain(formattedAmount);
  },
};
