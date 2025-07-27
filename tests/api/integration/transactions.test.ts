import { db } from '../helpers/database';
import {
  ApiTester,
  expectSuccess,
  expectError,
  expectPagination,
  expectSecurityHeaders,
} from '../helpers/api';
import {
  createAuthenticatedRequest,
  createMockResponse,
  mockSession,
  mockNoSession,
} from '../helpers/auth';
import { mockData } from '../fixtures/mockData';
import transactionsHandler from '../../../pages/api/basiq/transactions';
import { authMiddleware } from '../../../lib/middleware/auth';

describe('Transactions API Tests', () => {
  let testUser: any;
  let otherUser: any;
  let bankAccount: any;
  let transactions: any[];
  const api = new ApiTester(transactionsHandler);

  beforeEach(async () => {
    await db.cleanDatabase();

    // Create test users
    testUser = await db.createUser(mockData.users.regular);
    otherUser = await db.createUser({
      ...mockData.users.regular,
      email: 'other@example.com',
      id: 'other-user-id',
    });

    // Create bank account
    bankAccount = await db.createBankAccount(testUser.id, mockData.bankAccounts.checking);

    // Create test transactions
    transactions = await db.createTransactions(testUser.id, bankAccount.id, 20);

    // Create transactions for other user (for isolation testing)
    const otherAccount = await db.createBankAccount(otherUser.id, mockData.bankAccounts.savings);
    await db.createTransactions(otherUser.id, otherAccount.id, 5);
  });

  describe('GET /api/basiq/transactions', () => {
    it('should get user transactions with pagination', async () => {
      const req = createAuthenticatedRequest(
        'GET',
        null,
        { limit: '10', page: '1' },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
        headers: res._getHeaders(),
      };

      expectPagination(response, ['transactions']);
      expect(response.data.data.transactions).toHaveLength(10);
      expect(response.data.data.pagination.total).toBe(20);
      expect(response.data.data.pagination.hasMore).toBe(true);
    });

    it('should filter transactions by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();

      const req = createAuthenticatedRequest(
        'GET',
        null,
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      response.data.data.transactions.forEach((tx: any) => {
        const txDate = new Date(tx.date);
        expect(txDate).toBeWithinRange(startDate.getTime(), endDate.getTime());
      });
    });

    it('should filter transactions by category', async () => {
      const req = createAuthenticatedRequest(
        'GET',
        null,
        { category: 'Groceries' },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      response.data.data.transactions.forEach((tx: any) => {
        expect(tx.category).toBe('Groceries');
      });
    });

    it('should filter business expenses', async () => {
      const req = createAuthenticatedRequest(
        'GET',
        null,
        { isBusinessExpense: 'true' },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      response.data.data.transactions.forEach((tx: any) => {
        expect(tx.isBusinessExpense).toBe(true);
      });
    });

    it('should calculate spending summary', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.summary).toBeDefined();
      expect(response.data.data.summary).toMatchObject({
        totalIncome: expect.any(Number),
        totalExpenses: expect.any(Number),
        netCashFlow: expect.any(Number),
        averageTransaction: expect.any(Number),
        transactionCount: expect.any(Number),
      });
    });

    it('should include GST information', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      const transactionsWithGST = response.data.data.transactions.filter(
        (tx: any) => tx.gstAmount !== null,
      );
      expect(transactionsWithGST.length).toBeGreaterThan(0);

      transactionsWithGST.forEach((tx: any) => {
        expect(tx.gstAmount).toBeGreaterThanOrEqual(0);
        // GST should be roughly 10% of the amount
        const expectedGST = Math.abs(tx.amount) * 0.1;
        expect(tx.gstAmount).toBeWithinRange(expectedGST * 0.9, expectedGST * 1.1);
      });
    });

    it('should require authentication', async () => {
      mockNoSession();
      const response = await api.get();
      expectError(response, 401, 'Unauthorized');
    });

    it('should isolate user data', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      // Should only see own transactions
      expect(response.data.data.transactions).toHaveLength(Math.min(20, 20)); // Default limit
      response.data.data.transactions.forEach((tx: any) => {
        expect(tx.userId).toBe(testUser.id);
      });
    });

    it('should include security headers', async () => {
      const req = createAuthenticatedRequest('GET', null, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
        headers: res._getHeaders(),
      };

      expectSecurityHeaders(response);
    });
  });

  describe('POST /api/basiq/transactions', () => {
    it('should categorize transaction', async () => {
      const transaction = transactions[0];
      const req = createAuthenticatedRequest(
        'POST',
        {
          transactionId: transaction.id,
          category: 'Office Supplies',
          isBusinessExpense: true,
          taxCategory: 'D5',
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        id: transaction.id,
        category: 'Office Supplies',
        isBusinessExpense: true,
        taxCategory: 'D5',
      });

      // Verify in database
      const updated = await (global as any).prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(updated.category).toBe('Office Supplies');
      expect(updated.isBusinessExpense).toBe(true);
      expect(updated.taxCategory).toBe('D5');
    });

    it('should prevent updating other user transactions', async () => {
      // Get a transaction from other user
      const otherTransaction = await (global as any).prisma.transaction.findFirst({
        where: { userId: otherUser.id },
      });

      const req = createAuthenticatedRequest(
        'POST',
        {
          transactionId: otherTransaction.id,
          category: 'Hacked',
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 404, 'not found');
    });

    it('should log transaction updates', async () => {
      const transaction = transactions[0];
      const req = createAuthenticatedRequest(
        'POST',
        {
          transactionId: transaction.id,
          category: 'Updated Category',
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      expectSuccess({ status: res._getStatusCode(), data: res._getData() });

      // Check audit log
      const logs = await (global as any).prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          event: 'TRANSACTION_UPDATE',
        },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].metadata).toMatchObject({
        transactionId: transaction.id,
        changes: {
          category: 'Updated Category',
        },
      });
    });
  });

  describe('Validation Tests', () => {
    it('should validate date format', async () => {
      const req = createAuthenticatedRequest(
        'GET',
        null,
        { startDate: 'invalid-date' },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'Invalid date');
    });

    it('should validate pagination limits', async () => {
      const req = createAuthenticatedRequest(
        'GET',
        null,
        { limit: '200' }, // Exceeds max limit
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'Limit must be');
    });

    it('should validate tax category', async () => {
      const transaction = transactions[0];
      const req = createAuthenticatedRequest(
        'POST',
        {
          transactionId: transaction.id,
          taxCategory: 'INVALID',
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(transactionsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'Invalid tax category');
    });
  });
});
