import { test, expect } from '../helpers/test-base';

test.describe('Goal Management', () => {
  test.use({ storageState: 'playwright/fixtures/.auth/user.json' });

  test.beforeEach(async ({ goalsPage }) => {
    await goalsPage.goto();
  });

  test.describe('Creating Goals', () => {
    test('should create a new savings goal', async ({ goalsPage }) => {
      const goalData = {
        name: 'Emergency Fund',
        targetAmount: 10000,
        currentAmount: 1000,
        dueDate: '2024-12-31',
        category: 'Savings',
        description: 'Build 6-month emergency fund',
      };

      await goalsPage.createGoal(goalData);

      await goalsPage.expectSuccessNotification('Goal created successfully');
      await goalsPage.expectGoalToExist(goalData.name);
      await goalsPage.expectGoalProgress(goalData.name, 10); // 1000/10000 = 10%
    });

    test('should validate required fields', async ({ goalsPage, page }) => {
      await goalsPage.createGoalBtn().click();
      await goalsPage.expectModalToBeVisible();

      // Try to save without filling required fields
      await goalsPage.saveButton().click();

      await goalsPage.expectValidationError('name');
      await goalsPage.expectValidationError('targetAmount');
      await goalsPage.expectValidationError('dueDate');
    });

    test('should prevent negative amounts', async ({ goalsPage }) => {
      await goalsPage.createGoal({
        name: 'Invalid Goal',
        targetAmount: -1000,
        dueDate: '2024-12-31',
      });

      await goalsPage.expectValidationError('targetAmount');
    });

    test('should calculate initial progress correctly', async ({ goalsPage }) => {
      await goalsPage.createGoal({
        name: 'Half Complete Goal',
        targetAmount: 2000,
        currentAmount: 1000,
        dueDate: '2024-12-31',
      });

      await goalsPage.expectGoalProgress('Half Complete Goal', 50);
    });
  });

  test.describe('Editing Goals', () => {
    test('should edit goal details', async ({ goalsPage }) => {
      // Assume a goal exists
      const goalName = 'Vacation Fund';
      await goalsPage.expectGoalToExist(goalName);

      await goalsPage.editGoal(goalName, {
        name: 'Europe Vacation Fund',
        targetAmount: 5000,
        description: 'Summer 2025 Europe trip',
      });

      await goalsPage.expectSuccessNotification('Goal updated');
      await goalsPage.expectGoalToExist('Europe Vacation Fund');
      await goalsPage.expectGoalNotToExist(goalName);
    });

    test('should update goal progress', async ({ goalsPage }) => {
      const goalName = 'New Car Fund';
      await goalsPage.expectGoalToExist(goalName);

      await goalsPage.updateGoalProgress(goalName, 5000);

      await goalsPage.expectSuccessNotification();
      const details = await goalsPage.getGoalDetails(goalName);
      expect(details.currentAmount).toContain('5,000');
    });

    test('should not allow due date in the past', async ({ goalsPage }) => {
      await goalsPage.editGoal('Vacation Fund', {
        dueDate: '2020-01-01',
      });

      await goalsPage.expectValidationError('dueDate');
    });
  });

  test.describe('Completing Goals', () => {
    test('should mark goal as complete when 100% achieved', async ({ goalsPage }) => {
      // Create a goal that's ready to complete
      await goalsPage.createGoal({
        name: 'Completed Goal Test',
        targetAmount: 1000,
        currentAmount: 1000,
        dueDate: '2024-12-31',
      });

      await goalsPage.markGoalComplete('Completed Goal Test');

      await goalsPage.expectSuccessNotification('Goal completed');

      // Switch to completed tab
      await goalsPage.switchToCompletedGoals();
      await goalsPage.expectGoalToExist('Completed Goal Test');
    });

    test('should show completion celebration', async ({ goalsPage, page }) => {
      await goalsPage.createGoal({
        name: 'Achievement Test',
        targetAmount: 1000,
        currentAmount: 1000,
        dueDate: '2024-12-31',
      });

      await goalsPage.markGoalComplete('Achievement Test');

      // Check for celebration animation or modal
      const celebration = page.locator('.celebration, [data-testid="goal-celebration"]');
      await expect(celebration).toBeVisible();
    });
  });

  test.describe('Deleting Goals', () => {
    test('should delete a goal with confirmation', async ({ goalsPage }) => {
      await goalsPage.createGoal({
        name: 'Goal to Delete',
        targetAmount: 1000,
        dueDate: '2024-12-31',
      });

      await goalsPage.deleteGoal('Goal to Delete');

      await goalsPage.expectSuccessNotification('Goal deleted');
      await goalsPage.expectGoalNotToExist('Goal to Delete');
    });

    test('should not delete without confirmation', async ({ goalsPage, page }) => {
      const goalName = 'Important Goal';
      await goalsPage.expectGoalToExist(goalName);

      // Override dialog handler to cancel
      page.on('dialog', (dialog) => dialog.dismiss());

      await goalsPage.deleteGoal(goalName);

      // Goal should still exist
      await goalsPage.expectGoalToExist(goalName);
    });
  });

  test.describe('Goal Filtering and Search', () => {
    test('should filter goals by category', async ({ goalsPage }) => {
      await goalsPage.filterByCategory('Savings');

      const goals = await goalsPage.getAllGoals();

      // Should only show savings goals
      for (const goal of goals) {
        const details = await goalsPage.getGoalDetails(goal);
        // Verify category through UI or other means
      }
    });

    test('should search goals by name', async ({ goalsPage }) => {
      await goalsPage.searchGoals('Emergency');

      const goals = await goalsPage.getAllGoals();

      // All results should contain search term
      goals.forEach((goal) => {
        expect(goal.toLowerCase()).toContain('emergency');
      });
    });

    test('should switch between active and completed goals', async ({ goalsPage }) => {
      // Active goals
      await goalsPage.switchToActiveGoals();
      const activeGoals = await goalsPage.getAllGoals();
      expect(activeGoals.length).toBeGreaterThan(0);

      // Completed goals
      await goalsPage.switchToCompletedGoals();
      const completedGoals = await goalsPage.getAllGoals();

      // Lists should be different
      expect(activeGoals).not.toEqual(completedGoals);
    });
  });

  test.describe('Goal Progress Tracking', () => {
    test('should show visual progress indicators', async ({ goalsPage, page }) => {
      const goalName = 'Emergency Fund';
      await goalsPage.expectGoalToExist(goalName);

      const goalCard = page.locator(`.goal-card:has-text("${goalName}")`);
      const progressBar = goalCard.locator('[role="progressbar"]');

      await expect(progressBar).toBeVisible();

      const progress = await progressBar.getAttribute('aria-valuenow');
      const width = await progressBar.locator('.progress-bar').evaluate((el) => {
        return window.getComputedStyle(el).width;
      });

      expect(parseInt(width)).toBeGreaterThan(0);
    });

    test('should show days remaining', async ({ goalsPage, page }) => {
      const goalName = 'Vacation Fund';
      const goalCard = page.locator(`.goal-card:has-text("${goalName}")`);

      const daysRemaining = goalCard.locator('.days-remaining, .due-date');
      await expect(daysRemaining).toBeVisible();
      await expect(daysRemaining).toContainText(/\d+ days/);
    });

    test('should highlight overdue goals', async ({ goalsPage }) => {
      // Create an overdue goal
      await goalsPage.createGoal({
        name: 'Overdue Goal',
        targetAmount: 1000,
        currentAmount: 500,
        dueDate: '2020-01-01',
      });

      const goalCard = page.locator('.goal-card:has-text("Overdue Goal")');

      // Should have overdue styling
      await expect(goalCard).toHaveClass(/overdue|danger|warning/);
    });
  });

  test.describe('Goal Categories', () => {
    const categories = [
      'Savings',
      'Investment',
      'Debt',
      'Purchase',
      'Education',
      'Travel',
      'Other',
    ];

    test('should support all goal categories', async ({ goalsPage }) => {
      for (const category of categories) {
        await goalsPage.createGoal({
          name: `${category} Goal`,
          targetAmount: 1000,
          dueDate: '2024-12-31',
          category: category,
        });

        await goalsPage.expectGoalToExist(`${category} Goal`);
      }
    });

    test('should display category icons', async ({ goalsPage, page }) => {
      const goalCard = page.locator('.goal-card').first();
      const categoryIcon = goalCard.locator('.category-icon, [data-testid="category-icon"]');

      await expect(categoryIcon).toBeVisible();
    });
  });

  test.describe('Goal Insights', () => {
    test('should show total savings progress', async ({ goalsPage, page }) => {
      const insightsSection = page.locator('[data-testid="goals-insights"], .goals-summary');
      await expect(insightsSection).toBeVisible();

      const totalSaved = insightsSection.locator('.total-saved');
      const totalTarget = insightsSection.locator('.total-target');

      await expect(totalSaved).toContainText('$');
      await expect(totalTarget).toContainText('$');
    });

    test('should show goal achievement rate', async ({ goalsPage, page }) => {
      const achievementRate = page.locator('[data-testid="achievement-rate"]');
      await expect(achievementRate).toBeVisible();
      await expect(achievementRate).toContainText('%');
    });
  });

  test.describe('Mobile Experience', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('should be usable on mobile devices', async ({ goalsPage }) => {
      await goalsPage.createGoal({
        name: 'Mobile Goal',
        targetAmount: 1000,
        dueDate: '2024-12-31',
      });

      await goalsPage.expectGoalToExist('Mobile Goal');
    });

    test('should show mobile-optimized goal cards', async ({ goalsPage, page }) => {
      const goalCards = await page.locator('.goal-card').all();

      for (const card of goalCards) {
        const box = await card.boundingBox();
        // Cards should be full width on mobile
        expect(box?.width).toBeGreaterThan(350);
      }
    });
  });
});
