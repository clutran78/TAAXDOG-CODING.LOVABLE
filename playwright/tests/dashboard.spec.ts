import { test, expect } from '../helpers/test-base';

test.describe('Dashboard', () => {
  test.use({ storageState: 'playwright/fixtures/.auth/user.json' });

  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.waitForDataLoad();
  });

  test.describe('Dashboard Overview', () => {
    test('should display all financial summary cards', async ({ dashboardPage }) => {
      await dashboardPage.expectFinancialCards();

      const summary = await dashboardPage.getFinancialSummary();

      // Verify all values are present
      expect(summary.totalBalance).toBeTruthy();
      expect(summary.income).toBeTruthy();
      expect(summary.expenses).toBeTruthy();
      expect(summary.savings).toBeTruthy();
    });

    test('should display welcome message with user name', async ({ dashboardPage, page }) => {
      await dashboardPage.expectToBeVisible();

      const welcomeMsg = page.locator('h1, h2').filter({ hasText: /Welcome.*John/i });
      await expect(welcomeMsg).toBeVisible();
    });

    test('should load and display charts', async ({ dashboardPage }) => {
      await dashboardPage.expectChartsToLoad();

      // Check for specific chart types
      const spendingChart = page.locator('[data-testid="spending-chart"], .spending-chart');
      const incomeChart = page.locator('[data-testid="income-chart"], .income-chart');

      await expect(spendingChart).toBeVisible();
      await expect(incomeChart).toBeVisible();
    });

    test('should display recent transactions', async ({ dashboardPage }) => {
      const transactions = await dashboardPage.getRecentTransactions();

      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions.length).toBeLessThanOrEqual(5); // Usually shows top 5

      // Verify transaction structure
      transactions.forEach((tx) => {
        expect(tx.description).toBeTruthy();
        expect(tx.amount).toBeTruthy();
        expect(tx.date).toBeTruthy();
      });
    });

    test('should display active goals progress', async ({ dashboardPage }) => {
      const goals = await dashboardPage.getActiveGoals();

      expect(goals.length).toBeGreaterThan(0);

      // Verify goal structure
      goals.forEach((goal) => {
        expect(goal.name).toBeTruthy();
        expect(goal.progress).toBeGreaterThanOrEqual(0);
        expect(goal.progress).toBeLessThanOrEqual(100);
      });
    });
  });

  test.describe('Quick Actions', () => {
    test('should display all quick action buttons', async ({ dashboardPage }) => {
      await dashboardPage.expectQuickActions();
    });

    test('should navigate to add transaction', async ({ dashboardPage, page }) => {
      await dashboardPage.clickQuickAction('transaction');

      await expect(page).toHaveURL(/\/transactions/);
      // Or check for modal
      const modal = page.locator('[role="dialog"]:has-text("Add Transaction")');
      const isModal = await modal.isVisible({ timeout: 2000 });

      if (isModal) {
        await expect(modal).toBeVisible();
      }
    });

    test('should navigate to create goal', async ({ dashboardPage, page }) => {
      await dashboardPage.clickQuickAction('goal');

      await expect(page).toHaveURL(/\/goals/);
      // Or check for modal
      const modal = page.locator('[role="dialog"]:has-text("Create Goal")');
      const isModal = await modal.isVisible({ timeout: 2000 });

      if (isModal) {
        await expect(modal).toBeVisible();
      }
    });

    test('should navigate to connect bank', async ({ dashboardPage, page }) => {
      await dashboardPage.clickQuickAction('bank');
      await expect(page).toHaveURL(/\/banking/);
    });

    test('should navigate to view reports', async ({ dashboardPage, page }) => {
      await dashboardPage.clickQuickAction('reports');
      await expect(page).toHaveURL(/\/reports|insights/);
    });
  });

  test.describe('Data Refresh', () => {
    test('should refresh dashboard data', async ({ dashboardPage, page }) => {
      const initialSummary = await dashboardPage.getFinancialSummary();

      await dashboardPage.refreshDashboard();

      // Check for refresh indication
      await dashboardPage.expectNotification('success', 'Updated');

      // Data should be reloaded
      const updatedSummary = await dashboardPage.getFinancialSummary();
      expect(updatedSummary).toBeTruthy();
    });

    test('should show loading state during refresh', async ({ dashboardPage, page }) => {
      // Intercept API call to delay response
      await page.route('**/api/dashboard/**', async (route) => {
        await page.waitForTimeout(1000);
        await route.continue();
      });

      const refreshPromise = dashboardPage.refreshDashboard();

      // Check for loading indicator
      const spinner = page.locator('.spinner, .loading');
      await expect(spinner).toBeVisible();

      await refreshPromise;
      await expect(spinner).not.toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to all dashboard sections', async ({ dashboardPage, page }) => {
      const sections = ['transactions', 'goals', 'banking', 'insights', 'budget'];

      for (const section of sections) {
        await dashboardPage.navigateToSection(section as any);
        await expect(page).toHaveURL(new RegExp(`/dashboard/${section}`));

        // Navigate back to dashboard
        await dashboardPage.goto();
      }
    });

    test('should maintain state when navigating between sections', async ({
      dashboardPage,
      page,
    }) => {
      // Get initial data
      const initialSummary = await dashboardPage.getFinancialSummary();

      // Navigate away and back
      await dashboardPage.navigateToSection('transactions');
      await page.goBack();

      // Data should be preserved
      const currentSummary = await dashboardPage.getFinancialSummary();
      expect(currentSummary).toEqual(initialSummary);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display mobile menu on small screens', async ({ dashboardPage, page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await dashboardPage.checkMobileResponsiveness();
    });

    test('should stack cards vertically on mobile', async ({ dashboardPage, page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const cards = await page.locator('.card, [class*="card"]').all();

      // Get positions
      const positions = await Promise.all(cards.map((card) => card.boundingBox()));

      // Check if cards are stacked (same x position, different y)
      const xPositions = positions.map((pos) => pos?.x);
      const uniqueX = [...new Set(xPositions)];

      expect(uniqueX.length).toBeLessThanOrEqual(2); // Allow for padding differences
    });
  });

  test.describe('Real-time Updates', () => {
    test('should update transaction count when new transaction added', async ({
      dashboardPage,
      page,
    }) => {
      const initialTransactions = await dashboardPage.getRecentTransactions();
      const initialCount = initialTransactions.length;

      // Simulate real-time update via WebSocket or polling
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('transaction-added', {
            detail: { description: 'New Transaction', amount: 100 },
          }),
        );
      });

      await page.waitForTimeout(1000);

      const updatedTransactions = await dashboardPage.getRecentTransactions();
      expect(updatedTransactions.length).toBe(initialCount + 1);
    });

    test('should update goal progress in real-time', async ({ dashboardPage, page }) => {
      await dashboardPage.expectGoalProgress('Emergency Fund', 50);

      // Simulate goal update
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('goal-updated', {
            detail: { name: 'Emergency Fund', progress: 75 },
          }),
        );
      });

      await page.waitForTimeout(1000);

      await dashboardPage.expectGoalProgress('Emergency Fund', 75);
    });
  });

  test.describe('Error Handling', () => {
    test('should display error when data fails to load', async ({ dashboardPage, page }) => {
      // Intercept and fail API calls
      await page.route('**/api/dashboard/**', (route) => route.abort());

      await dashboardPage.goto();

      await dashboardPage.expectNotification('error', 'Failed to load');
    });

    test('should provide retry option on error', async ({ dashboardPage, page }) => {
      await page.route('**/api/dashboard/**', (route) => route.abort());

      await dashboardPage.goto();

      const retryButton = page.locator('button:has-text("Retry")');
      await expect(retryButton).toBeVisible();

      // Fix the route and retry
      await page.unroute('**/api/dashboard/**');
      await retryButton.click();

      await dashboardPage.expectToBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load dashboard within acceptable time', async ({ dashboardPage, page }) => {
      const startTime = Date.now();

      await dashboardPage.goto();
      await dashboardPage.waitForDataLoad();

      const loadTime = Date.now() - startTime;

      // Dashboard should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should implement lazy loading for charts', async ({ dashboardPage, page }) => {
      await dashboardPage.goto();

      // Charts below the fold should not be loaded initially
      const lazyCharts = await page.locator('[data-lazy="true"]').count();
      expect(lazyCharts).toBeGreaterThan(0);

      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      await page.waitForTimeout(500);

      // All charts should now be loaded
      const loadedCharts = await page.locator('.chart-loaded').count();
      expect(loadedCharts).toBe(lazyCharts);
    });
  });
});
