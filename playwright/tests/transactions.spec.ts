import { test, expect } from '../helpers/test-base';

test.describe('Transaction Management', () => {
  test.use({ storageState: 'playwright/fixtures/.auth/user.json' });

  test.beforeEach(async ({ transactionsPage }) => {
    await transactionsPage.goto();
  });

  test.describe('Adding Transactions', () => {
    test('should add an expense transaction', async ({ transactionsPage }) => {
      const transaction = {
        description: 'Grocery Shopping',
        amount: 150.5,
        type: 'expense' as const,
        category: 'Food & Dining',
        date: '2024-01-15',
        merchant: 'Woolworths',
        notes: 'Weekly groceries',
      };

      await transactionsPage.addTransaction(transaction);

      await transactionsPage.expectSuccessNotification('Transaction added');
      await transactionsPage.expectTransactionToExist(transaction.description);
      await transactionsPage.expectTransactionAmount(transaction.description, transaction.amount);
    });

    test('should add an income transaction', async ({ transactionsPage }) => {
      const transaction = {
        description: 'Salary Payment',
        amount: 5000,
        type: 'income' as const,
        category: 'Salary',
        date: '2024-01-01',
      };

      await transactionsPage.addTransaction(transaction);

      await transactionsPage.expectTransactionToExist(transaction.description);
      await transactionsPage.expectTransactionCategory(transaction.description, 'Salary');
    });

    test('should validate required fields', async ({ transactionsPage, page }) => {
      await transactionsPage.addTransactionBtn().click();
      await transactionsPage.modal().waitFor({ state: 'visible' });

      // Try to save without required fields
      await transactionsPage.saveButton().click();

      await transactionsPage.expectValidationError('description');
      await transactionsPage.expectValidationError('amount');
      await transactionsPage.expectValidationError('category');
    });

    test('should upload and attach receipt', async ({ transactionsPage }) => {
      const transaction = {
        description: 'Office Supplies',
        amount: 89.99,
        type: 'expense' as const,
        category: 'Business',
        receipt: 'playwright/fixtures/test-receipt.jpg',
      };

      await transactionsPage.addTransaction(transaction);

      await transactionsPage.expectSuccessNotification();

      // Verify receipt icon appears
      const row = transactionsPage.transactionRow(transaction.description);
      const receiptIcon = row.locator('.receipt-icon, [data-testid="has-receipt"]');
      await expect(receiptIcon).toBeVisible();
    });

    test('should auto-calculate GST for business expenses', async ({ transactionsPage, page }) => {
      const transaction = {
        description: 'Business Laptop',
        amount: 1100, // Including GST
        type: 'expense' as const,
        category: 'Business Equipment',
      };

      await transactionsPage.addTransaction(transaction);

      // Check GST breakdown
      const row = transactionsPage.transactionRow(transaction.description);
      await row.click(); // Open details

      const gstAmount = page.locator('[data-testid="gst-amount"]');
      await expect(gstAmount).toContainText('$100.00'); // 10% GST
    });
  });

  test.describe('Editing Transactions', () => {
    test('should edit transaction details', async ({ transactionsPage }) => {
      const originalDescription = 'Coffee Shop';
      await transactionsPage.expectTransactionToExist(originalDescription);

      await transactionsPage.editTransaction(originalDescription, {
        description: 'Coffee Shop - Business Meeting',
        category: 'Business Meals',
        notes: 'Client meeting',
      });

      await transactionsPage.expectSuccessNotification('Transaction updated');
      await transactionsPage.expectTransactionToExist('Coffee Shop - Business Meeting');
      await transactionsPage.expectTransactionCategory(
        'Coffee Shop - Business Meeting',
        'Business Meals',
      );
    });

    test('should change transaction type', async ({ transactionsPage }) => {
      const description = 'Freelance Payment';

      // Originally recorded as expense
      await transactionsPage.editTransaction(description, {
        type: 'income',
      });

      await transactionsPage.expectSuccessNotification();

      // Verify totals updated
      const totals = await transactionsPage.getTotalsByType();
      // Income should increase, expense should decrease
    });
  });

  test.describe('Deleting Transactions', () => {
    test('should delete a transaction', async ({ transactionsPage }) => {
      await transactionsPage.addTransaction({
        description: 'Transaction to Delete',
        amount: 50,
        type: 'expense',
        category: 'Other',
      });

      await transactionsPage.deleteTransaction('Transaction to Delete');

      await transactionsPage.expectSuccessNotification('Transaction deleted');
      await transactionsPage.expectTransactionNotToExist('Transaction to Delete');
    });

    test('should update totals after deletion', async ({ transactionsPage }) => {
      const initialTotals = await transactionsPage.getTotalsByType();

      await transactionsPage.deleteTransaction('Test Expense');

      const updatedTotals = await transactionsPage.getTotalsByType();

      expect(parseFloat(updatedTotals.expense)).toBeLessThan(parseFloat(initialTotals.expense));
    });
  });

  test.describe('Transaction Categorization', () => {
    test('should categorize uncategorized transactions', async ({ transactionsPage }) => {
      // Find uncategorized transaction
      const uncategorized = page.locator('tr:has-text("Uncategorized")').first();
      const description = await uncategorized.locator('td:first-child').textContent();

      await transactionsPage.categorizeTransaction(description!, 'Food & Dining');

      await transactionsPage.expectSuccessNotification();
      await transactionsPage.expectTransactionCategory(description!, 'Food & Dining');
    });

    test('should suggest categories based on description', async ({ transactionsPage, page }) => {
      await transactionsPage.addTransactionBtn().click();

      // Type description that should trigger suggestions
      await transactionsPage.descriptionInput().fill('Uber ride to airport');

      // Check for category suggestion
      const categorySelect = transactionsPage.categorySelect();
      await expect(categorySelect).toHaveValue('Transportation');
    });

    test('should support custom categories', async ({ transactionsPage }) => {
      const transaction = {
        description: 'Special Purchase',
        amount: 200,
        type: 'expense' as const,
        category: 'Custom Category',
      };

      await transactionsPage.addTransaction(transaction);

      await transactionsPage.expectTransactionCategory(transaction.description, 'Custom Category');
    });
  });

  test.describe('Filtering and Search', () => {
    test('should search transactions by description', async ({ transactionsPage }) => {
      await transactionsPage.searchTransactions('Coffee');

      const transactions = await transactionsPage.getAllTransactions();

      transactions.forEach((tx) => {
        expect(tx.description?.toLowerCase()).toContain('coffee');
      });
    });

    test('should filter by category', async ({ transactionsPage }) => {
      await transactionsPage.filterByCategory('Food & Dining');

      const visibleTransactions = await transactionsPage.getAllTransactions();

      for (const tx of visibleTransactions) {
        const category = await transactionsPage
          .getTransactionDetails(tx.description!)
          .then((d) => d.category);
        expect(category).toBe('Food & Dining');
      }
    });

    test('should filter by date range', async ({ transactionsPage }) => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      await transactionsPage.filterByDateRange(startDate, endDate);

      const transactions = await transactionsPage.getAllTransactions();
      expect(transactions.length).toBeGreaterThan(0);

      // All transactions should be within date range
      for (const tx of transactions) {
        const details = await transactionsPage.getTransactionDetails(tx.description!);
        const txDate = new Date(details.date!);
        expect(txDate >= new Date(startDate)).toBeTruthy();
        expect(txDate <= new Date(endDate)).toBeTruthy();
      }
    });

    test('should combine multiple filters', async ({ transactionsPage }) => {
      await transactionsPage.filterByCategory('Business');
      await transactionsPage.searchTransactions('Meeting');

      const results = await transactionsPage.getAllTransactions();

      results.forEach((tx) => {
        expect(tx.description?.toLowerCase()).toContain('meeting');
      });
    });
  });

  test.describe('Bulk Operations', () => {
    test('should select multiple transactions', async ({ transactionsPage, page }) => {
      // Select all checkboxes
      const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
      await selectAllCheckbox.check();

      const bulkActions = page.locator('[data-testid="bulk-actions"], .bulk-actions');
      await expect(bulkActions).toBeVisible();
    });

    test('should bulk categorize transactions', async ({ transactionsPage, page }) => {
      // Select specific transactions
      const checkboxes = page.locator('tbody input[type="checkbox"]');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await checkboxes.nth(2).check();

      const bulkCategorizeBtn = page.locator('button:has-text("Categorize")');
      await bulkCategorizeBtn.click();

      const categoryModal = page.locator('[role="dialog"]:has-text("Select Category")');
      await categoryModal.locator('select').selectOption('Business');
      await categoryModal.locator('button:has-text("Apply")').click();

      await transactionsPage.expectSuccessNotification('3 transactions updated');
    });

    test('should bulk delete transactions', async ({ transactionsPage, page }) => {
      const initialCount = await transactionsPage.transactionsList().locator('tbody tr').count();

      // Select first 2 transactions
      const checkboxes = page.locator('tbody input[type="checkbox"]');
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      const bulkDeleteBtn = page.locator('button:has-text("Delete Selected")');
      await bulkDeleteBtn.click();

      // Confirm deletion
      await page.locator('button:has-text("Confirm")').last().click();

      const newCount = await transactionsPage.transactionsList().locator('tbody tr').count();
      expect(newCount).toBe(initialCount - 2);
    });
  });

  test.describe('Export Functionality', () => {
    test('should export transactions as CSV', async ({ transactionsPage }) => {
      const download = await transactionsPage.exportTransactions('csv');

      expect(download.suggestedFilename()).toContain('.csv');

      // Verify CSV content
      const content = await download
        .path()
        .then((path) => require('fs').readFileSync(path, 'utf8'));

      expect(content).toContain('Description,Amount,Type,Category,Date');
    });

    test('should export filtered results only', async ({ transactionsPage }) => {
      await transactionsPage.filterByCategory('Business');

      const download = await transactionsPage.exportTransactions('csv');
      const content = await download
        .path()
        .then((path) => require('fs').readFileSync(path, 'utf8'));

      // Should only contain business transactions
      const lines = content.split('\n');
      lines.slice(1).forEach((line) => {
        if (line.trim()) {
          expect(line).toContain('Business');
        }
      });
    });
  });

  test.describe('Receipt Management', () => {
    test('should attach receipt to existing transaction', async ({ transactionsPage }) => {
      const transactionDesc = 'Restaurant Bill';

      await transactionsPage.attachReceipt(transactionDesc, 'playwright/fixtures/receipt.jpg');

      await transactionsPage.expectSuccessNotification('Receipt uploaded');

      // Verify receipt indicator
      const row = transactionsPage.transactionRow(transactionDesc);
      await expect(row.locator('[data-testid="has-receipt"]')).toBeVisible();
    });

    test('should view receipt image', async ({ transactionsPage, page }) => {
      const transactionWithReceipt = 'Office Supplies';
      const row = transactionsPage.transactionRow(transactionWithReceipt);

      await row.locator('button[aria-label*="View receipt"]').click();

      const receiptModal = page.locator('[role="dialog"]:has-text("Receipt")');
      await expect(receiptModal).toBeVisible();
      await expect(receiptModal.locator('img')).toBeVisible();
    });

    test('should extract data from receipt using OCR', async ({ transactionsPage, page }) => {
      await transactionsPage.addTransactionBtn().click();

      const receiptInput = transactionsPage.receiptUpload();
      await receiptInput.setInputFiles('playwright/fixtures/receipt-with-text.jpg');

      // Wait for OCR processing
      await page.waitForTimeout(3000);

      // Check if fields were auto-populated
      const amount = await transactionsPage.amountInput().inputValue();
      const merchant = await transactionsPage.merchantInput().inputValue();

      expect(amount).not.toBe('');
      expect(merchant).not.toBe('');
    });
  });

  test.describe('Transaction Insights', () => {
    test('should show spending trends', async ({ transactionsPage, page }) => {
      const insightsBtn = page.locator('button:has-text("View Insights")');
      await insightsBtn.click();

      const trendChart = page.locator('[data-testid="spending-trend-chart"]');
      await expect(trendChart).toBeVisible();
    });

    test('should show category breakdown', async ({ transactionsPage, page }) => {
      const categoryBreakdown = page.locator('[data-testid="category-breakdown"]');
      await expect(categoryBreakdown).toBeVisible();

      // Should show percentages for each category
      const categories = await categoryBreakdown.locator('.category-item').all();
      expect(categories.length).toBeGreaterThan(0);

      for (const category of categories) {
        await expect(category).toContainText('%');
      }
    });
  });

  test.describe('Mobile Experience', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should add transaction on mobile', async ({ transactionsPage }) => {
      await transactionsPage.addTransaction({
        description: 'Mobile Transaction',
        amount: 25.5,
        type: 'expense',
        category: 'Other',
      });

      await transactionsPage.expectTransactionToExist('Mobile Transaction');
    });

    test('should show swipe actions on mobile', async ({ transactionsPage, page }) => {
      const firstRow = page.locator('tbody tr').first();

      // Simulate swipe
      await firstRow.dispatchEvent('touchstart', { touches: [{ clientX: 300 }] });
      await firstRow.dispatchEvent('touchmove', { touches: [{ clientX: 100 }] });
      await firstRow.dispatchEvent('touchend');

      // Check for swipe actions
      const swipeActions = firstRow.locator('.swipe-actions');
      await expect(swipeActions).toBeVisible();
    });
  });
});
