import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  // Locators
  private welcomeMessage = () =>
    this.page
      .locator('h1, h2')
      .filter({ hasText: /Welcome|Dashboard/i })
      .first();
  private totalBalanceCard = () =>
    this.page.locator('[data-testid="total-balance"], .card:has-text("Total Balance")');
  private incomeCard = () =>
    this.page.locator('[data-testid="total-income"], .card:has-text("Income")');
  private expensesCard = () =>
    this.page.locator('[data-testid="total-expenses"], .card:has-text("Expenses")');
  private savingsCard = () =>
    this.page.locator('[data-testid="total-savings"], .card:has-text("Savings")');
  private quickActionsSection = () =>
    this.page.locator('[data-testid="quick-actions"], .quick-actions');
  private recentTransactions = () =>
    this.page.locator('[data-testid="recent-transactions"], .recent-transactions');
  private goalsProgress = () =>
    this.page.locator('[data-testid="goals-progress"], .goals-progress');
  private chartContainer = () => this.page.locator('.recharts-wrapper, canvas, svg.chart');

  // Quick action buttons
  private addTransactionBtn = () => this.page.locator('button:has-text("Add Transaction")');
  private createGoalBtn = () => this.page.locator('button:has-text("Create Goal")');
  private connectBankBtn = () => this.page.locator('button:has-text("Connect Bank")');
  private viewReportsBtn = () => this.page.locator('button:has-text("View Reports")');

  // Actions
  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForDataLoad() {
    // Wait for key elements to be visible
    await this.totalBalanceCard().waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  async getFinancialSummary() {
    await this.waitForDataLoad();

    const getText = async (locator: any) => {
      const text = await locator.textContent();
      return text?.match(/[\d,]+\.?\d*/)?.[0] || '0';
    };

    return {
      totalBalance: await getText(this.totalBalanceCard()),
      income: await getText(this.incomeCard()),
      expenses: await getText(this.expensesCard()),
      savings: await getText(this.savingsCard()),
    };
  }

  async getRecentTransactions() {
    const transactions = await this.recentTransactions().locator('.transaction-item, tr').all();
    return Promise.all(
      transactions.map(async (tx) => {
        const description = await tx.locator('.description, td:nth-child(1)').textContent();
        const amount = await tx.locator('.amount, td:nth-child(2)').textContent();
        const date = await tx.locator('.date, td:nth-child(3)').textContent();
        return { description, amount, date };
      }),
    );
  }

  async getActiveGoals() {
    const goals = await this.goalsProgress().locator('.goal-item, .progress').all();
    return Promise.all(
      goals.map(async (goal) => {
        const name = await goal.locator('.goal-name, .title').textContent();
        const progress = await goal
          .locator('.progress-bar, [role="progressbar"]')
          .getAttribute('aria-valuenow');
        return { name, progress: parseInt(progress || '0') };
      }),
    );
  }

  async clickQuickAction(action: 'transaction' | 'goal' | 'bank' | 'reports') {
    const actions = {
      transaction: this.addTransactionBtn,
      goal: this.createGoalBtn,
      bank: this.connectBankBtn,
      reports: this.viewReportsBtn,
    };

    await actions[action]().click();
  }

  async refreshDashboard() {
    await this.page.locator('button:has-text("Refresh"), button[aria-label="Refresh"]').click();
    await this.waitForDataLoad();
  }

  async navigateToSection(section: 'transactions' | 'goals' | 'banking' | 'insights' | 'budget') {
    await this.page
      .locator(`nav a[href="/dashboard/${section}"], .sidebar a[href="/dashboard/${section}"]`)
      .click();
    await this.page.waitForURL(`**/dashboard/${section}`);
  }

  // Assertions
  async expectToBeVisible() {
    await expect(this.welcomeMessage()).toBeVisible();
    await expect(this.totalBalanceCard()).toBeVisible();
  }

  async expectFinancialCards() {
    await expect(this.totalBalanceCard()).toBeVisible();
    await expect(this.incomeCard()).toBeVisible();
    await expect(this.expensesCard()).toBeVisible();
    await expect(this.savingsCard()).toBeVisible();
  }

  async expectQuickActions() {
    await expect(this.quickActionsSection()).toBeVisible();
    await expect(this.addTransactionBtn()).toBeVisible();
    await expect(this.createGoalBtn()).toBeVisible();
  }

  async expectChartsToLoad() {
    await expect(this.chartContainer()).toBeVisible();
    // Wait for chart animation
    await this.page.waitForTimeout(1000);
  }

  async expectRecentTransactionsCount(count: number) {
    const transactions = await this.recentTransactions().locator('.transaction-item, tr').count();
    expect(transactions).toBe(count);
  }

  async expectGoalProgress(goalName: string, minProgress: number) {
    const goal = this.goalsProgress().locator(`.goal-item:has-text("${goalName}")`);
    await expect(goal).toBeVisible();

    const progressBar = goal.locator('[role="progressbar"]');
    const progress = await progressBar.getAttribute('aria-valuenow');
    expect(parseInt(progress || '0')).toBeGreaterThanOrEqual(minProgress);
  }

  async expectNotification(type: 'success' | 'error' | 'info', message?: string) {
    const notification = this.page.locator(`.alert-${type}, [role="alert"].${type}`);
    await expect(notification).toBeVisible();
    if (message) {
      await expect(notification).toContainText(message);
    }
  }

  // Utilities
  async waitForChartAnimation() {
    await this.page.waitForTimeout(1500);
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/dashboard-${name}.png`,
      fullPage: true,
    });
  }

  async checkMobileResponsiveness() {
    // Check if mobile menu button is visible
    const mobileMenuBtn = this.page.locator('[aria-label="Menu"], .mobile-menu-btn');
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
      await expect(this.page.locator('.mobile-menu, .drawer')).toBeVisible();
    }
  }
}
