import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanTestDatabase,
  getTestPrisma,
} from '../setup/test-database';
import { apiTest, makeAuthenticatedApiRequest } from '../helpers/api-test-helper';
import { authTest } from '../helpers/auth-test-helper';
import { DataFactory } from '../fixtures/data-factories';

// Import handlers
import createTransactionHandler from '@/pages/api/transactions/create';
import getTransactionsHandler from '@/pages/api/transactions/index';
import createGoalHandler from '@/pages/api/goals/index';
import updateGoalProgressHandler from '@/pages/api/goals/[id]/progress';
import createBudgetHandler from '@/pages/api/budgets/index';
import getDashboardHandler from '@/pages/api/dashboard';

describe('Financial Management E2E Flow', () => {
  const prisma = getTestPrisma();
  let testUser: any;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
    testUser = await authTest.createTestUser({
      email: 'finance@example.com',
      name: 'Finance User',
    });
  });

  describe('Transaction Management Flow', () => {
    it('should create, categorize, and track transactions', async () => {
      // Step 1: Create income transaction
      const incomeData = {
        amount: 5000,
        description: 'Monthly Salary',
        category: 'INCOME',
        type: 'INCOME',
        date: new Date().toISOString(),
      };

      const incomeResponse = await makeAuthenticatedApiRequest(
        createTransactionHandler,
        testUser.id,
        {
          method: 'POST',
          body: incomeData,
        },
      );

      apiTest.expectSuccess(incomeResponse, 201);
      expect(incomeResponse.data.transaction).toMatchObject({
        amount: 5000,
        category: 'INCOME',
        type: 'INCOME',
      });

      // Step 2: Create expense transactions
      const expenses = [
        { description: 'Woolworths', amount: -156.78, category: 'GROCERIES' },
        { description: 'Shell Petrol', amount: -85.0, category: 'TRANSPORT' },
        { description: 'Netflix', amount: -19.99, category: 'ENTERTAINMENT' },
      ];

      for (const expense of expenses) {
        const response = await makeAuthenticatedApiRequest(createTransactionHandler, testUser.id, {
          method: 'POST',
          body: {
            ...expense,
            type: 'EXPENSE',
            date: new Date().toISOString(),
          },
        });
        apiTest.expectSuccess(response, 201);
      }

      // Step 3: Get transaction summary
      const summaryResponse = await makeAuthenticatedApiRequest(
        getTransactionsHandler,
        testUser.id,
        {
          method: 'GET',
          query: { summary: 'true' },
        },
      );

      apiTest.expectSuccess(summaryResponse);
      expect(summaryResponse.data.summary).toMatchObject({
        totalIncome: 5000,
        totalExpenses: 261.77,
        netIncome: 4738.23,
        transactionCount: 4,
      });

      // Step 4: Get transactions by category
      const groceryResponse = await makeAuthenticatedApiRequest(
        getTransactionsHandler,
        testUser.id,
        {
          method: 'GET',
          query: { category: 'GROCERIES' },
        },
      );

      apiTest.expectSuccess(groceryResponse);
      expect(groceryResponse.data.transactions).toHaveLength(1);
      expect(groceryResponse.data.transactions[0].category).toBe('GROCERIES');
    });

    it('should calculate GST for Australian transactions', async () => {
      const transactionData = {
        amount: -110.0,
        description: 'Business Supplies',
        category: 'WORK_EXPENSES',
        type: 'EXPENSE',
        includesGst: true,
        date: new Date().toISOString(),
      };

      const response = await makeAuthenticatedApiRequest(createTransactionHandler, testUser.id, {
        method: 'POST',
        body: transactionData,
      });

      apiTest.expectSuccess(response, 201);
      expect(response.data.transaction.gstAmount).toBe(10.0); // 10% of $110
      expect(response.data.transaction.isDeductible).toBe(true);
    });
  });

  describe('Goal Management Flow', () => {
    it('should create goal, track progress, and achieve completion', async () => {
      // Step 1: Create savings goal
      const goalData = {
        name: 'Emergency Fund',
        description: 'Save for 6 months of expenses',
        targetAmount: 15000,
        targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        initialDeposit: 1000,
      };

      const createResponse = await makeAuthenticatedApiRequest(createGoalHandler, testUser.id, {
        method: 'POST',
        body: goalData,
      });

      apiTest.expectSuccess(createResponse, 201);
      const goal = createResponse.data.goal;
      expect(goal.currentAmount).toBe(1000);
      expect(goal.progressPercentage).toBeCloseTo(6.67, 1);

      // Step 2: Make monthly contributions
      const contributions = [500, 750, 1000, 1250];
      let currentAmount = 1000;

      for (const amount of contributions) {
        const progressResponse = await makeAuthenticatedApiRequest(
          updateGoalProgressHandler,
          testUser.id,
          {
            method: 'POST',
            query: { id: goal.id },
            body: { amount, note: 'Monthly contribution' },
          },
        );

        apiTest.expectSuccess(progressResponse);
        currentAmount += amount;
        expect(progressResponse.data.goal.currentAmount).toBe(currentAmount);
      }

      // Step 3: Make final contribution to achieve goal
      const finalAmount = 15000 - currentAmount;
      const finalResponse = await makeAuthenticatedApiRequest(
        updateGoalProgressHandler,
        testUser.id,
        {
          method: 'POST',
          query: { id: goal.id },
          body: { amount: finalAmount },
        },
      );

      apiTest.expectSuccess(finalResponse);
      expect(finalResponse.data.goal.status).toBe('COMPLETED');
      expect(finalResponse.data.goal.currentAmount).toBe(15000);
      expect(finalResponse.data.achievement).toBeDefined();

      // Verify goal progress history
      const progressHistory = await prisma.goalProgress.findMany({
        where: { goalId: goal.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(progressHistory).toHaveLength(6); // Initial + 4 contributions + final
      expect(progressHistory[0].amount).toBe(1000);
      expect(progressHistory[progressHistory.length - 1].amount).toBe(finalAmount);
    });

    it('should handle goal withdrawal', async () => {
      // Create completed goal
      const goal = await prisma.goal.create({
        data: {
          userId: testUser.id,
          name: 'Completed Goal',
          targetAmount: 10000,
          currentAmount: 10000,
          targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          status: 'COMPLETED',
        },
      });

      // Withdraw funds
      const withdrawalResponse = await makeAuthenticatedApiRequest(
        updateGoalProgressHandler,
        testUser.id,
        {
          method: 'POST',
          query: { id: goal.id },
          body: {
            amount: -3000,
            type: 'WITHDRAWAL',
            note: 'Emergency expense',
          },
        },
      );

      apiTest.expectSuccess(withdrawalResponse);
      expect(withdrawalResponse.data.goal.currentAmount).toBe(7000);
      expect(withdrawalResponse.data.progress.type).toBe('WITHDRAWAL');
    });
  });

  describe('Budget Management Flow', () => {
    it('should create budgets and track spending', async () => {
      // Step 1: Create monthly budgets
      const budgets = [
        { name: 'Groceries', category: 'GROCERIES', amount: 800 },
        { name: 'Transport', category: 'TRANSPORT', amount: 300 },
        { name: 'Entertainment', category: 'ENTERTAINMENT', amount: 200 },
      ];

      const createdBudgets = [];
      for (const budget of budgets) {
        const response = await makeAuthenticatedApiRequest(createBudgetHandler, testUser.id, {
          method: 'POST',
          body: {
            ...budget,
            period: 'MONTHLY',
            startDate: new Date().toISOString(),
          },
        });
        apiTest.expectSuccess(response, 201);
        createdBudgets.push(response.data.budget);
      }

      // Step 2: Create transactions that affect budgets
      const transactions = [
        { description: 'Coles', amount: -250, category: 'GROCERIES' },
        { description: 'Woolworths', amount: -180, category: 'GROCERIES' },
        { description: 'Uber', amount: -45, category: 'TRANSPORT' },
        { description: 'Cinema', amount: -35, category: 'ENTERTAINMENT' },
      ];

      for (const transaction of transactions) {
        await makeAuthenticatedApiRequest(createTransactionHandler, testUser.id, {
          method: 'POST',
          body: {
            ...transaction,
            type: 'EXPENSE',
            date: new Date().toISOString(),
          },
        });
      }

      // Step 3: Check budget status
      const budgetStatusResponse = await makeAuthenticatedApiRequest(
        createBudgetHandler,
        testUser.id,
        { method: 'GET' },
      );

      apiTest.expectSuccess(budgetStatusResponse);
      const budgetStatus = budgetStatusResponse.data.budgets;

      // Verify budget calculations
      const groceryBudget = budgetStatus.find((b: any) => b.category === 'GROCERIES');
      expect(groceryBudget.spent).toBe(430); // 250 + 180
      expect(groceryBudget.remaining).toBe(370); // 800 - 430
      expect(groceryBudget.percentageUsed).toBeCloseTo(53.75, 1);

      // Step 4: Check for budget alerts
      const alerts = budgetStatusResponse.data.alerts;
      expect(alerts).toBeDefined();
      // Should not have alerts yet as no budget is over 80% threshold
    });

    it('should trigger budget alerts when threshold exceeded', async () => {
      // Create budget with low amount
      const budgetResponse = await makeAuthenticatedApiRequest(createBudgetHandler, testUser.id, {
        method: 'POST',
        body: {
          name: 'Tight Budget',
          category: 'DINING',
          amount: 100,
          period: 'MONTHLY',
          alertThreshold: 80,
          startDate: new Date().toISOString(),
        },
      });

      const budget = budgetResponse.data.budget;

      // Create transaction that exceeds threshold
      await makeAuthenticatedApiRequest(createTransactionHandler, testUser.id, {
        method: 'POST',
        body: {
          description: 'Restaurant',
          amount: -85,
          category: 'DINING',
          type: 'EXPENSE',
          date: new Date().toISOString(),
        },
      });

      // Check budget status
      const statusResponse = await makeAuthenticatedApiRequest(createBudgetHandler, testUser.id, {
        method: 'GET',
        query: { id: budget.id },
      });

      apiTest.expectSuccess(statusResponse);
      expect(statusResponse.data.budget.percentageUsed).toBe(85);
      expect(statusResponse.data.alert).toMatchObject({
        type: 'BUDGET_EXCEEDED',
        message: expect.stringContaining('85% of your budget'),
      });
    });
  });

  describe('Dashboard Integration', () => {
    it('should aggregate all financial data in dashboard', async () => {
      // Create comprehensive financial data
      const scenario = DataFactory.createScenario('complete');

      // Insert data into database
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          subscriptionStatus: scenario.user.subscriptionStatus,
          subscriptionPlan: scenario.user.subscriptionPlan,
        },
      });

      await prisma.transaction.createMany({
        data: scenario.transactions.map((t) => ({ ...t, userId: testUser.id })),
      });

      await prisma.goal.createMany({
        data: scenario.goals.map((g) => ({ ...g, userId: testUser.id })),
      });

      await prisma.budget.createMany({
        data: scenario.budgets.map((b) => ({ ...b, userId: testUser.id })),
      });

      // Get dashboard data
      const dashboardResponse = await makeAuthenticatedApiRequest(
        getDashboardHandler,
        testUser.id,
        { method: 'GET' },
      );

      apiTest.expectSuccess(dashboardResponse);
      const dashboard = dashboardResponse.data;

      // Verify aggregated data
      expect(dashboard.summary).toBeDefined();
      expect(dashboard.summary.totalBalance).toBeDefined();
      expect(dashboard.summary.monthlyIncome).toBeGreaterThan(0);
      expect(dashboard.summary.monthlyExpenses).toBeGreaterThan(0);

      expect(dashboard.recentTransactions).toBeDefined();
      expect(dashboard.recentTransactions.length).toBeGreaterThan(0);

      expect(dashboard.activeGoals).toBeDefined();
      expect(dashboard.activeGoals.length).toBeGreaterThan(0);

      expect(dashboard.budgetStatus).toBeDefined();
      expect(dashboard.budgetStatus.length).toBeGreaterThan(0);

      expect(dashboard.insights).toBeDefined();
      expect(dashboard.categoryBreakdown).toBeDefined();
    });
  });

  describe('Tax Deduction Tracking', () => {
    it('should track tax-deductible expenses', async () => {
      const deductibleExpenses = [
        {
          description: 'Home Office Equipment',
          amount: -250,
          category: 'WORK_EXPENSES',
          taxCategory: 'D5',
        },
        {
          description: 'Professional Development Course',
          amount: -599,
          category: 'EDUCATION',
          taxCategory: 'D4',
        },
        { description: 'Charity Donation', amount: -100, category: 'DONATIONS', taxCategory: 'D9' },
      ];

      for (const expense of deductibleExpenses) {
        await makeAuthenticatedApiRequest(createTransactionHandler, testUser.id, {
          method: 'POST',
          body: {
            ...expense,
            type: 'EXPENSE',
            isDeductible: true,
            date: new Date().toISOString(),
          },
        });
      }

      // Get tax summary
      const taxSummaryResponse = await makeAuthenticatedApiRequest(
        getTransactionsHandler,
        testUser.id,
        {
          method: 'GET',
          query: {
            taxSummary: 'true',
            taxYear: '2023-2024',
          },
        },
      );

      apiTest.expectSuccess(taxSummaryResponse);
      expect(taxSummaryResponse.data.taxSummary).toMatchObject({
        totalDeductible: 949,
        byCategory: {
          D5: 250,
          D4: 599,
          D9: 100,
        },
      });
    });
  });
});
