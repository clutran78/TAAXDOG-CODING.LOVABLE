import { Page, expect } from '@playwright/test';

export class TransactionsPage {
  constructor(private page: Page) {}

  // Locators
  private pageTitle = () =>
    this.page.locator('h1:has-text("Transactions"), h2:has-text("Transactions")');
  private addTransactionBtn = () =>
    this.page.locator('button:has-text("Add Transaction"), button:has-text("New Transaction")');
  private transactionsList = () =>
    this.page.locator('[data-testid="transactions-list"], .transactions-table, table');
  private transactionRow = (description: string) =>
    this.page.locator(`tr:has-text("${description}")`);
  private searchInput = () =>
    this.page.locator('input[placeholder*="Search"], input[type="search"]');
  private categoryFilter = () =>
    this.page.locator('select[aria-label*="Category"], .category-filter');
  private dateRangeFilter = () =>
    this.page.locator('[data-testid="date-range"], .date-range-picker');
  private exportButton = () => this.page.locator('button:has-text("Export")');

  // Modal locators
  private modal = () => this.page.locator('[role="dialog"], .modal.show');
  private descriptionInput = () => this.modal().locator('input[name="description"], #description');
  private amountInput = () => this.modal().locator('input[name="amount"], #amount');
  private typeSelect = () => this.modal().locator('select[name="type"], input[name="type"]');
  private categorySelect = () => this.modal().locator('select[name="category"], #category');
  private dateInput = () => this.modal().locator('input[name="date"], #date');
  private merchantInput = () => this.modal().locator('input[name="merchant"], #merchant');
  private notesTextarea = () => this.modal().locator('textarea[name="notes"], #notes');
  private receiptUpload = () => this.modal().locator('input[type="file"]');
  private saveButton = () =>
    this.modal().locator('button:has-text("Save"), button:has-text("Add Transaction")');
  private cancelButton = () => this.modal().locator('button:has-text("Cancel")');

  // Pagination
  private paginationNext = () =>
    this.page.locator('button[aria-label="Next page"], .pagination .next');
  private paginationPrev = () =>
    this.page.locator('button[aria-label="Previous page"], .pagination .prev');
  private paginationInfo = () => this.page.locator('.pagination-info');

  // Actions
  async goto() {
    await this.page.goto('/dashboard/transactions');
    await this.page.waitForLoadState('networkidle');
  }

  async addTransaction(data: {
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date?: string;
    merchant?: string;
    notes?: string;
    receipt?: string;
  }) {
    await this.addTransactionBtn().click();
    await this.modal().waitFor({ state: 'visible' });

    await this.descriptionInput().fill(data.description);
    await this.amountInput().fill(data.amount.toString());

    // Handle type selection - could be select or radio buttons
    const typeSelectElement = await this.typeSelect();
    if (await typeSelectElement.evaluate((el) => el.tagName === 'SELECT')) {
      await typeSelectElement.selectOption(data.type);
    } else {
      await this.modal().locator(`input[value="${data.type}"]`).check();
    }

    await this.categorySelect().selectOption(data.category);

    if (data.date) {
      await this.dateInput().fill(data.date);
    }

    if (data.merchant) {
      await this.merchantInput().fill(data.merchant);
    }

    if (data.notes) {
      await this.notesTextarea().fill(data.notes);
    }

    if (data.receipt) {
      await this.receiptUpload().setInputFiles(data.receipt);
    }

    await this.saveButton().click();
  }

  async editTransaction(
    description: string,
    updates: Partial<{
      description: string;
      amount: number;
      type: 'income' | 'expense';
      category: string;
      date: string;
      merchant: string;
      notes: string;
    }>,
  ) {
    const row = this.transactionRow(description);
    await row.locator('button[aria-label*="Edit"]').click();
    await this.modal().waitFor({ state: 'visible' });

    if (updates.description) {
      await this.descriptionInput().clear();
      await this.descriptionInput().fill(updates.description);
    }

    if (updates.amount !== undefined) {
      await this.amountInput().clear();
      await this.amountInput().fill(updates.amount.toString());
    }

    if (updates.type) {
      const typeSelectElement = await this.typeSelect();
      if (await typeSelectElement.evaluate((el) => el.tagName === 'SELECT')) {
        await typeSelectElement.selectOption(updates.type);
      } else {
        await this.modal().locator(`input[value="${updates.type}"]`).check();
      }
    }

    if (updates.category) {
      await this.categorySelect().selectOption(updates.category);
    }

    if (updates.date) {
      await this.dateInput().fill(updates.date);
    }

    if (updates.merchant) {
      await this.merchantInput().clear();
      await this.merchantInput().fill(updates.merchant);
    }

    if (updates.notes) {
      await this.notesTextarea().clear();
      await this.notesTextarea().fill(updates.notes);
    }

    await this.saveButton().click();
  }

  async deleteTransaction(description: string) {
    const row = this.transactionRow(description);
    await row.locator('button[aria-label*="Delete"]').click();

    // Handle confirmation
    await this.page.on('dialog', (dialog) => dialog.accept());

    const confirmBtn = this.page
      .locator('button:has-text("Confirm"), button:has-text("Delete")')
      .last();
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
    }
  }

  async searchTransactions(query: string) {
    await this.searchInput().fill(query);
    await this.page.keyboard.press('Enter');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByCategory(category: string) {
    await this.categoryFilter().selectOption(category);
    await this.page.waitForLoadState('networkidle');
  }

  async filterByDateRange(startDate: string, endDate: string) {
    const dateRange = this.dateRangeFilter();
    await dateRange.click();

    // Handle date range picker
    const startInput = this.page.locator('input[placeholder*="Start"]').last();
    const endInput = this.page.locator('input[placeholder*="End"]').last();

    await startInput.fill(startDate);
    await endInput.fill(endDate);

    await this.page.locator('button:has-text("Apply")').last().click();
    await this.page.waitForLoadState('networkidle');
  }

  async exportTransactions(format: 'csv' | 'pdf' | 'excel') {
    await this.exportButton().click();
    await this.page.locator(`button:has-text("${format.toUpperCase()}")`).click();

    // Wait for download
    const download = await this.page.waitForEvent('download');
    return download;
  }

  async categorizeTransaction(description: string, category: string) {
    const row = this.transactionRow(description);
    const categoryCell = row.locator('.category-cell, td:nth-child(4)');

    // Click to edit inline if supported
    await categoryCell.click();
    const inlineSelect = categoryCell.locator('select');

    if (await inlineSelect.isVisible({ timeout: 1000 })) {
      await inlineSelect.selectOption(category);
      await this.page.keyboard.press('Enter');
    } else {
      // Fall back to edit modal
      await this.editTransaction(description, { category });
    }
  }

  async attachReceipt(description: string, receiptPath: string) {
    const row = this.transactionRow(description);
    const attachBtn = row.locator('button[aria-label*="Attach"], button:has-text("Receipt")');
    await attachBtn.click();

    const fileInput = this.page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(receiptPath);

    // Wait for upload
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToNextPage() {
    await this.paginationNext().click();
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToPreviousPage() {
    await this.paginationPrev().click();
    await this.page.waitForLoadState('networkidle');
  }

  // Assertions
  async expectTransactionToExist(description: string) {
    await expect(this.transactionRow(description)).toBeVisible();
  }

  async expectTransactionNotToExist(description: string) {
    await expect(this.transactionRow(description)).not.toBeVisible();
  }

  async expectTransactionCount(count: number) {
    const rows = await this.transactionsList().locator('tbody tr').count();
    expect(rows).toBe(count);
  }

  async expectTransactionAmount(description: string, amount: number) {
    const row = this.transactionRow(description);
    const amountCell = row.locator('.amount, td:has-text("$")');
    const formattedAmount = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
    await expect(amountCell).toContainText(formattedAmount);
  }

  async expectTransactionCategory(description: string, category: string) {
    const row = this.transactionRow(description);
    const categoryCell = row.locator('.category, td:nth-child(4)');
    await expect(categoryCell).toContainText(category);
  }

  async expectSuccessNotification(message?: string) {
    const notification = this.page.locator('.alert-success, [role="alert"].success');
    await expect(notification).toBeVisible();
    if (message) {
      await expect(notification).toContainText(message);
    }
  }

  async expectValidationError(fieldName: string) {
    const field = this.modal().locator(`[name="${fieldName}"]`);
    const errorMsg = field.locator('~ .invalid-feedback, ~ .error-message');
    await expect(errorMsg).toBeVisible();
  }

  // Utilities
  async getTransactionDetails(description: string) {
    const row = this.transactionRow(description);

    const amount = await row.locator('.amount, td:nth-child(2)').textContent();
    const type = await row.locator('.type, td:nth-child(3)').textContent();
    const category = await row.locator('.category, td:nth-child(4)').textContent();
    const date = await row.locator('.date, td:nth-child(5)').textContent();

    return {
      description,
      amount: amount?.trim(),
      type: type?.trim(),
      category: category?.trim(),
      date: date?.trim(),
    };
  }

  async getAllTransactions() {
    const rows = await this.transactionsList().locator('tbody tr').all();
    return Promise.all(
      rows.map(async (row) => {
        const description = await row.locator('td:first-child').textContent();
        const amount = await row.locator('.amount, td:nth-child(2)').textContent();
        return {
          description: description?.trim(),
          amount: amount?.trim(),
        };
      }),
    );
  }

  async getTotalsByType() {
    const incomeTotal = await this.page
      .locator('[data-testid="income-total"], .income-total')
      .textContent();
    const expenseTotal = await this.page
      .locator('[data-testid="expense-total"], .expense-total')
      .textContent();

    return {
      income: incomeTotal?.replace(/[^0-9.-]/g, '') || '0',
      expense: expenseTotal?.replace(/[^0-9.-]/g, '') || '0',
    };
  }
}
