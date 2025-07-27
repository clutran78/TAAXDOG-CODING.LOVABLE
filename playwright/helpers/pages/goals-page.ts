import { Page, expect } from '@playwright/test';

export class GoalsPage {
  constructor(private page: Page) {}

  // Locators
  private pageTitle = () =>
    this.page.locator('h1:has-text("Goals"), h2:has-text("Financial Goals")');
  private createGoalBtn = () =>
    this.page.locator('button:has-text("New Goal"), button:has-text("Create Goal")');
  private goalsList = () => this.page.locator('[data-testid="goals-list"], .goals-container');
  private goalCard = (name: string) =>
    this.page.locator(`.goal-card:has-text("${name}"), .goal-item:has-text("${name}")`);
  private activeGoalsTab = () => this.page.locator('button[role="tab"]:has-text("Active")');
  private completedGoalsTab = () => this.page.locator('button[role="tab"]:has-text("Completed")');

  // Modal locators
  private modal = () => this.page.locator('[role="dialog"], .modal.show');
  private modalTitle = () => this.modal().locator('.modal-title, h2, h3').first();
  private goalNameInput = () => this.modal().locator('input[name="name"], #goal-name');
  private targetAmountInput = () =>
    this.modal().locator('input[name="targetAmount"], #target-amount');
  private currentAmountInput = () =>
    this.modal().locator('input[name="currentAmount"], #current-amount');
  private dueDateInput = () => this.modal().locator('input[name="dueDate"], #target-date');
  private categorySelect = () => this.modal().locator('select[name="category"], #goal-category');
  private descriptionInput = () =>
    this.modal().locator('textarea[name="description"], #goal-description');
  private saveButton = () =>
    this.modal().locator(
      'button:has-text("Create Goal"), button:has-text("Save"), button:has-text("Update Goal")',
    );
  private cancelButton = () => this.modal().locator('button:has-text("Cancel")');
  private deleteButton = () => this.page.locator('button[aria-label*="Delete"]');

  // Actions
  async goto() {
    await this.page.goto('/dashboard/goals');
    await this.page.waitForLoadState('networkidle');
  }

  async createGoal(goalData: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    dueDate: string;
    category?: string;
    description?: string;
  }) {
    await this.createGoalBtn().click();
    await this.modal().waitFor({ state: 'visible' });

    await this.goalNameInput().fill(goalData.name);
    await this.targetAmountInput().fill(goalData.targetAmount.toString());

    if (goalData.currentAmount !== undefined) {
      await this.currentAmountInput().fill(goalData.currentAmount.toString());
    }

    await this.dueDateInput().fill(goalData.dueDate);

    if (goalData.category) {
      await this.categorySelect().selectOption(goalData.category);
    }

    if (goalData.description) {
      await this.descriptionInput().fill(goalData.description);
    }

    await this.saveButton().click();
  }

  async editGoal(
    goalName: string,
    updates: Partial<{
      name: string;
      targetAmount: number;
      currentAmount: number;
      dueDate: string;
      category: string;
      description: string;
    }>,
  ) {
    const goal = this.goalCard(goalName);
    await goal.locator('button[aria-label*="Edit"]').click();
    await this.modal().waitFor({ state: 'visible' });

    if (updates.name) {
      await this.goalNameInput().clear();
      await this.goalNameInput().fill(updates.name);
    }

    if (updates.targetAmount !== undefined) {
      await this.targetAmountInput().clear();
      await this.targetAmountInput().fill(updates.targetAmount.toString());
    }

    if (updates.currentAmount !== undefined) {
      await this.currentAmountInput().clear();
      await this.currentAmountInput().fill(updates.currentAmount.toString());
    }

    if (updates.dueDate) {
      await this.dueDateInput().fill(updates.dueDate);
    }

    if (updates.category) {
      await this.categorySelect().selectOption(updates.category);
    }

    if (updates.description) {
      await this.descriptionInput().clear();
      await this.descriptionInput().fill(updates.description);
    }

    await this.saveButton().click();
  }

  async deleteGoal(goalName: string) {
    const goal = this.goalCard(goalName);
    await goal.locator('button[aria-label*="Delete"]').click();

    // Handle confirmation dialog
    await this.page.on('dialog', (dialog) => dialog.accept());

    // Or if using a custom confirmation modal
    const confirmBtn = this.page
      .locator('button:has-text("Confirm"), button:has-text("Delete")')
      .last();
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
    }
  }

  async updateGoalProgress(goalName: string, newAmount: number) {
    const goal = this.goalCard(goalName);

    // Click on update progress button if available
    const updateBtn = goal.locator('button:has-text("Update Progress")');
    if (await updateBtn.isVisible()) {
      await updateBtn.click();
      const amountInput = this.page.locator('input[placeholder*="amount"]').last();
      await amountInput.fill(newAmount.toString());
      await this.page.locator('button:has-text("Update")').last().click();
    } else {
      // Otherwise, use edit functionality
      await this.editGoal(goalName, { currentAmount: newAmount });
    }
  }

  async markGoalComplete(goalName: string) {
    const goal = this.goalCard(goalName);
    const completeBtn = goal.locator(
      'button[aria-label*="Complete"], button:has-text("Mark Complete")',
    );
    await completeBtn.click();

    // Confirm if needed
    const confirmBtn = this.page.locator('button:has-text("Confirm")').last();
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
    }
  }

  async filterByCategory(category: string) {
    const categoryFilter = this.page.locator(
      'select[aria-label="Filter by category"], .category-filter',
    );
    await categoryFilter.selectOption(category);
  }

  async searchGoals(searchTerm: string) {
    const searchInput = this.page.locator('input[placeholder*="Search"], input[type="search"]');
    await searchInput.fill(searchTerm);
    await this.page.keyboard.press('Enter');
  }

  async switchToCompletedGoals() {
    await this.completedGoalsTab().click();
    await this.page.waitForLoadState('networkidle');
  }

  async switchToActiveGoals() {
    await this.activeGoalsTab().click();
    await this.page.waitForLoadState('networkidle');
  }

  // Assertions
  async expectGoalToExist(goalName: string) {
    await expect(this.goalCard(goalName)).toBeVisible();
  }

  async expectGoalNotToExist(goalName: string) {
    await expect(this.goalCard(goalName)).not.toBeVisible();
  }

  async expectGoalProgress(goalName: string, expectedProgress: number) {
    const goal = this.goalCard(goalName);
    const progressBar = goal.locator('[role="progressbar"]');
    const progress = await progressBar.getAttribute('aria-valuenow');
    expect(parseInt(progress || '0')).toBe(expectedProgress);
  }

  async expectGoalCount(count: number) {
    const goals = await this.goalsList().locator('.goal-card, .goal-item').count();
    expect(goals).toBe(count);
  }

  async expectSuccessNotification(message?: string) {
    const notification = this.page.locator('.alert-success, [role="alert"].success');
    await expect(notification).toBeVisible();
    if (message) {
      await expect(notification).toContainText(message);
    }
  }

  async expectModalToBeVisible() {
    await expect(this.modal()).toBeVisible();
  }

  async expectModalToBeHidden() {
    await expect(this.modal()).not.toBeVisible();
  }

  async expectValidationError(fieldName: string) {
    const field = this.modal().locator(`[name="${fieldName}"]`);
    const errorMsg = field.locator('~ .invalid-feedback, ~ .error-message');
    await expect(errorMsg).toBeVisible();
  }

  // Utilities
  async getGoalDetails(goalName: string) {
    const goal = this.goalCard(goalName);
    const amount = await goal.locator('.current-amount, .progress-text').textContent();
    const target = await goal.locator('.target-amount').textContent();
    const dueDate = await goal.locator('.due-date').textContent();
    const progressBar = goal.locator('[role="progressbar"]');
    const progress = await progressBar.getAttribute('aria-valuenow');

    return {
      currentAmount: amount,
      targetAmount: target,
      dueDate: dueDate,
      progress: parseInt(progress || '0'),
    };
  }

  async getAllGoals() {
    const goals = await this.goalsList().locator('.goal-card, .goal-item').all();
    return Promise.all(
      goals.map(async (goal) => {
        const name = await goal.locator('.goal-name, h3, h4').first().textContent();
        return name?.trim() || '';
      }),
    );
  }

  async closeModal() {
    const closeBtn = this.modal().locator('button[aria-label="Close"], .btn-close');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await this.expectModalToBeHidden();
  }
}
