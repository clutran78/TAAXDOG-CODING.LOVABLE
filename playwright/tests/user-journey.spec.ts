import { test, expect } from '../helpers/test-base';
import { faker } from '@faker-js/faker';

test.describe('Complete User Journey', () => {
  test.describe('New User Onboarding Flow', () => {
    test('complete journey from registration to first transaction', async ({
      page,
      authPage,
      dashboardPage,
      bankingPage,
      transactionsPage,
      goalsPage,
    }) => {
      // Step 1: User Registration
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

      // Step 2: First Login & Dashboard Tour
      await dashboardPage.expectToBeVisible();

      // Check for welcome tour or onboarding
      const tourModal = page.locator('[data-testid="welcome-tour"], .tour-modal');
      if (await tourModal.isVisible({ timeout: 5000 })) {
        await page.locator('button:has-text("Skip"), button:has-text("Next")').click();
      }

      // Verify empty state
      const emptyState = page.locator('[data-testid="empty-state"], .empty-dashboard');
      await expect(emptyState).toBeVisible();

      // Step 3: Connect First Bank Account
      await dashboardPage.clickQuickAction('bank');
      await bankingPage.connectBank('Commonwealth Bank');

      // Select accounts to sync
      await bankingPage.selectAccountsToConnect(['Everyday Account', 'Savings Account']);

      // Wait for initial sync
      await bankingPage.waitForBankingDataLoad();
      await bankingPage.expectSyncSuccess();

      // Step 4: Review Imported Transactions
      await dashboardPage.navigateToSection('transactions');

      // Verify transactions were imported
      const transactionCount = await transactionsPage
        .transactionsList()
        .locator('tbody tr')
        .count();
      expect(transactionCount).toBeGreaterThan(0);

      // Categorize first uncategorized transaction
      const uncategorized = page.locator('tr:has-text("Uncategorized")').first();
      if (await uncategorized.isVisible()) {
        const description = await uncategorized.locator('td:first-child').textContent();
        await transactionsPage.categorizeTransaction(description!, 'Food & Dining');
      }

      // Step 5: Create First Financial Goal
      await dashboardPage.navigateToSection('goals');

      await goalsPage.createGoal({
        name: 'Emergency Fund',
        targetAmount: 5000,
        currentAmount: 0,
        dueDate: '2024-12-31',
        category: 'Savings',
        description: 'Build 3-month emergency fund',
      });

      await goalsPage.expectGoalToExist('Emergency Fund');

      // Step 6: Return to Dashboard - See Updated View
      await dashboardPage.goto();

      // Dashboard should now show data
      await dashboardPage.expectFinancialCards();
      await dashboardPage.expectRecentTransactionsCount(5);
      await dashboardPage.expectGoalProgress('Emergency Fund', 0);

      // Step 7: Add Manual Transaction
      await dashboardPage.clickQuickAction('transaction');

      await transactionsPage.addTransaction({
        description: 'Initial Savings Deposit',
        amount: 500,
        type: 'income',
        category: 'Savings',
        notes: 'Starting emergency fund',
      });

      // Step 8: Update Goal Progress
      await dashboardPage.navigateToSection('goals');
      await goalsPage.updateGoalProgress('Emergency Fund', 500);

      // Verify progress updated
      await goalsPage.expectGoalProgress('Emergency Fund', 10); // 500/5000 = 10%

      // Step 9: Check Financial Summary
      await dashboardPage.goto();

      const summary = await dashboardPage.getFinancialSummary();
      expect(parseFloat(summary.totalBalance.replace(/[^0-9.-]/g, ''))).toBeGreaterThan(0);
      expect(parseFloat(summary.savings.replace(/[^0-9.-]/g, ''))).toBe(500);
    });
  });

  test.describe('Returning User Daily Flow', () => {
    test.use({ storageState: 'playwright/fixtures/.auth/user.json' });

    test('daily financial management routine', async ({
      page,
      dashboardPage,
      transactionsPage,
      goalsPage,
    }) => {
      // Step 1: Morning Login & Dashboard Check
      await dashboardPage.goto();
      await dashboardPage.waitForDataLoad();

      // Check overnight transactions (bank sync)
      const overnightNotification = page.locator('.notification:has-text("new transactions")');
      if (await overnightNotification.isVisible({ timeout: 3000 })) {
        await overnightNotification.click();
        await page.waitForURL('**/transactions**');

        // Review and categorize new transactions
        const uncategorizedCount = await page.locator('tr:has-text("Uncategorized")').count();
        console.log(`Found ${uncategorizedCount} uncategorized transactions`);
      }

      // Step 2: Add Morning Coffee Purchase
      await transactionsPage.goto();

      await transactionsPage.addTransaction({
        description: 'Morning Coffee',
        amount: 5.5,
        type: 'expense',
        category: 'Food & Dining',
        merchant: 'Local Cafe',
      });

      // Step 3: Check Daily Budget
      await dashboardPage.navigateToSection('budget');

      const dailyBudgetRemaining = page.locator('[data-testid="daily-budget-remaining"]');
      await expect(dailyBudgetRemaining).toBeVisible();

      // Step 4: Update Savings Goal
      await dashboardPage.navigateToSection('goals');

      // Add weekly savings contribution
      const savingsGoal = 'Emergency Fund';
      const currentDetails = await goalsPage.getGoalDetails(savingsGoal);
      const currentAmount = parseFloat(
        currentDetails.currentAmount?.replace(/[^0-9.-]/g, '') || '0',
      );

      await goalsPage.updateGoalProgress(savingsGoal, currentAmount + 100);

      // Step 5: Review Spending Insights
      await dashboardPage.navigateToSection('insights');

      const weeklySpending = page.locator('[data-testid="weekly-spending"]');
      await expect(weeklySpending).toBeVisible();

      // Check if on track
      const spendingAlert = page.locator('.alert:has-text("spending is higher")');
      if (await spendingAlert.isVisible()) {
        // Review categories with overspending
        const overspendingCategories = await page.locator('.overspending-category').all();
        console.log(`Overspending in ${overspendingCategories.length} categories`);
      }

      // Step 6: Evening Review
      await dashboardPage.goto();

      // Check daily summary
      const dailySummary = await dashboardPage.getFinancialSummary();

      // Take screenshot for records
      await page.screenshot({
        path: `test-results/daily-summary-${new Date().toISOString().split('T')[0]}.png`,
        fullPage: true,
      });
    });
  });

  test.describe('Tax Preparation Journey', () => {
    test.use({ storageState: 'playwright/fixtures/.auth/user.json' });

    test('complete tax return preparation flow', async ({
      page,
      dashboardPage,
      transactionsPage,
    }) => {
      // Step 1: Navigate to Tax Section
      await page.goto('/dashboard/tax');

      // Step 2: Start Tax Return
      const startTaxReturnBtn = page.locator('button:has-text("Start Tax Return")');
      await startTaxReturnBtn.click();

      // Select tax year
      const taxYearModal = page.locator('[role="dialog"]:has-text("Select Tax Year")');
      await taxYearModal.locator('select').selectOption('2023-2024');
      await taxYearModal.locator('button:has-text("Continue")').click();

      // Step 3: Review Income Summary
      const incomeSummary = page.locator('[data-testid="income-summary"]');
      await expect(incomeSummary).toBeVisible();

      // Verify all income sources
      const incomeSources = await page.locator('.income-source').all();
      expect(incomeSources.length).toBeGreaterThan(0);

      // Step 4: Review Deductions
      await page.locator('button:has-text("Next"), button:has-text("Deductions")').click();

      // Auto-categorized deductions
      const deductionsList = page.locator('[data-testid="deductions-list"]');
      await expect(deductionsList).toBeVisible();

      // Add missing deduction
      const addDeductionBtn = page.locator('button:has-text("Add Deduction")');
      await addDeductionBtn.click();

      const deductionModal = page.locator('[role="dialog"]:has-text("Add Deduction")');
      await deductionModal.locator('input[name="description"]').fill('Home Office Equipment');
      await deductionModal.locator('input[name="amount"]').fill('1200');
      await deductionModal.locator('select[name="category"]').selectOption('D5');
      await deductionModal.locator('button:has-text("Add")').click();

      // Step 5: Upload Supporting Documents
      await page.locator('button:has-text("Documents")').click();

      // Check for missing receipts
      const missingReceipts = page.locator('.missing-receipt');
      const missingCount = await missingReceipts.count();

      if (missingCount > 0) {
        // Upload receipt for first missing item
        const firstMissing = missingReceipts.first();
        await firstMissing.locator('button:has-text("Upload")').click();

        const fileInput = page.locator('input[type="file"]').last();
        await fileInput.setInputFiles('playwright/fixtures/receipt.pdf');

        await page.waitForTimeout(2000); // Wait for upload
      }

      // Step 6: Review Tax Calculation
      await page.locator('button:has-text("Calculate")').click();

      const taxSummary = page.locator('[data-testid="tax-summary"]');
      await expect(taxSummary).toBeVisible();

      // Check estimated refund/payment
      const taxResult = taxSummary.locator('.tax-result');
      await expect(taxResult).toContainText('$');

      // Step 7: Export for Tax Agent
      const exportBtn = page.locator('button:has-text("Export for Tax Agent")');
      await exportBtn.click();

      // Select export format
      const formatModal = page.locator('[role="dialog"]:has-text("Export Format")');
      await formatModal.locator('input[value="pdf"]').check();
      await formatModal.locator('button:has-text("Export")').click();

      // Wait for download
      const download = await page.waitForEvent('download');
      expect(download.suggestedFilename()).toContain('tax-return');
      expect(download.suggestedFilename()).toContain('2023-2024');
    });
  });

  test.describe('Financial Goal Achievement Journey', () => {
    test.use({ storageState: 'playwright/fixtures/.auth/user.json' });

    test('achieve and celebrate a financial goal', async ({
      page,
      goalsPage,
      transactionsPage,
      dashboardPage,
    }) => {
      // Setup: Create a goal that's almost complete
      await goalsPage.goto();

      await goalsPage.createGoal({
        name: 'New Laptop Fund',
        targetAmount: 2000,
        currentAmount: 1900,
        dueDate: '2024-06-30',
        category: 'Purchase',
        description: 'Save for MacBook Pro',
      });

      // Step 1: Make final contribution
      await transactionsPage.goto();

      await transactionsPage.addTransaction({
        description: 'Laptop Fund - Final Contribution',
        amount: 100,
        type: 'expense',
        category: 'Savings Transfer',
        notes: 'Final $100 to complete laptop fund',
      });

      // Step 2: Update goal with final amount
      await goalsPage.goto();
      await goalsPage.updateGoalProgress('New Laptop Fund', 2000);

      // Step 3: Mark goal as complete
      await goalsPage.markGoalComplete('New Laptop Fund');

      // Celebration should appear
      const celebration = page.locator('[data-testid="goal-celebration"], .celebration-modal');
      await expect(celebration).toBeVisible();

      // Check achievement details
      await expect(celebration).toContainText('Congratulations!');
      await expect(celebration).toContainText('New Laptop Fund');
      await expect(celebration).toContainText('$2,000');

      // Share achievement (optional)
      const shareBtn = celebration.locator('button:has-text("Share")');
      if (await shareBtn.isVisible()) {
        await shareBtn.click();
        // Handle share modal
      }

      // Close celebration
      await celebration.locator('button:has-text("Continue")').click();

      // Step 4: View completed goals
      await goalsPage.switchToCompletedGoals();
      await goalsPage.expectGoalToExist('New Laptop Fund');

      // Step 5: Create next goal
      const nextGoalBtn = page.locator('button:has-text("Create Next Goal")');
      if (await nextGoalBtn.isVisible()) {
        await nextGoalBtn.click();

        // System might suggest a new goal based on history
        const suggestedGoal = page.locator('[data-testid="suggested-goal"]');
        if (await suggestedGoal.isVisible()) {
          await suggestedGoal.locator('button:has-text("Accept")').click();
        }
      }

      // Step 6: Check achievement badge on dashboard
      await dashboardPage.goto();

      const achievementBadge = page.locator('[data-testid="achievement-badge"], .achievement');
      await expect(achievementBadge).toBeVisible();
      await expect(achievementBadge).toContainText('Goal Achiever');
    });
  });

  test.describe('Subscription Upgrade Journey', () => {
    test.use({ storageState: 'playwright/fixtures/.auth/user.json' });

    test('upgrade from free to pro subscription', async ({ page, dashboardPage, profilePage }) => {
      // Step 1: Hit free tier limit
      await dashboardPage.goto();

      // Trigger upgrade prompt (e.g., trying to connect 3rd bank)
      await dashboardPage.navigateToSection('banking');

      const connectBankBtn = page.locator('button:has-text("Connect Another Bank")');
      await connectBankBtn.click();

      // Should show upgrade modal
      const upgradeModal = page.locator('[role="dialog"]:has-text("Upgrade Required")');
      await expect(upgradeModal).toBeVisible();
      await expect(upgradeModal).toContainText('TAAX Pro');

      // Step 2: Compare plans
      const comparePlansBtn = upgradeModal.locator('button:has-text("Compare Plans")');
      await comparePlansBtn.click();

      const plansComparison = page.locator('[data-testid="plans-comparison"]');
      await expect(plansComparison).toBeVisible();

      // Verify features
      const proFeatures = plansComparison.locator('.pro-features li');
      expect(await proFeatures.count()).toBeGreaterThan(5);

      // Step 3: Select Pro plan
      const selectProBtn = plansComparison.locator('button:has-text("Start 7-Day Free Trial")');
      await selectProBtn.click();

      // Step 4: Enter payment details
      const stripeFrame = page.frameLocator('iframe[title="Secure payment input frame"]');

      // Fill card details
      await stripeFrame.locator('[placeholder="Card number"]').fill('4242 4242 4242 4242');
      await stripeFrame.locator('[placeholder="MM / YY"]').fill('12/25');
      await stripeFrame.locator('[placeholder="CVC"]').fill('123');

      // Fill billing details
      await page.locator('input[name="name"]').fill('John Doe');
      await page.locator('input[name="email"]').fill('john@example.com');
      await page.locator('input[name="address"]').fill('123 Test St');
      await page.locator('input[name="city"]').fill('Sydney');
      await page.locator('input[name="state"]').fill('NSW');
      await page.locator('input[name="postalCode"]').fill('2000');

      // Step 5: Confirm subscription
      const confirmBtn = page.locator('button:has-text("Start Free Trial")');
      await confirmBtn.click();

      // Wait for processing
      await page.waitForLoadState('networkidle');

      // Should show success
      const successModal = page.locator('[role="dialog"]:has-text("Welcome to TAAX Pro")');
      await expect(successModal).toBeVisible();

      // Step 6: Access pro features
      await successModal.locator('button:has-text("Explore Pro Features")').click();

      // Should redirect to dashboard with pro features enabled
      await expect(page).toHaveURL(/\/dashboard/);

      // Verify pro badge
      const proBadge = page.locator('[data-testid="pro-badge"], .pro-indicator');
      await expect(proBadge).toBeVisible();

      // Step 7: Verify billing in profile
      await profilePage.goto();
      await profilePage.expectSubscriptionPlan('TAAX Pro');

      // Check next billing date
      const subscriptionInfo = await profilePage.getSubscriptionInfo();
      expect(subscriptionInfo.status).toBe('Trial');
      expect(subscriptionInfo.nextBilling).toContain('7 days');
    });
  });
});
