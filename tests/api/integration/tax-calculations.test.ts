import { db } from '../helpers/database';
import { ApiTester, expectSuccess, expectError } from '../helpers/api';
import { createAuthenticatedRequest, createMockResponse, mockSession } from '../helpers/auth';
import { mockData } from '../fixtures/mockData';
import taxCalculateHandler from '../../../pages/api/tax/calculate';
import gstCalculateHandler from '../../../pages/api/compliance/gst/calculate';
import basReportHandler from '../../../pages/api/compliance/gst/bas-report';
import { authMiddleware } from '../../../lib/middleware/auth';
import { TaxCalculationService, TaxCategory } from '../../../lib/services/tax-calculations';

describe('Tax Calculations API Tests', () => {
  let testUser: any;
  let bankAccount: any;
  const taxApi = new ApiTester(taxCalculateHandler);
  const gstApi = new ApiTester(gstCalculateHandler);
  const basApi = new ApiTester(basReportHandler);

  beforeEach(async () => {
    await db.cleanDatabase();

    // Create test user
    testUser = await db.createUser(mockData.users.regular);

    // Create bank account and transactions for BAS testing
    bankAccount = await db.createBankAccount(testUser.id, mockData.bankAccounts.checking);

    // Create various transactions for tax testing
    await (global as any).prisma.transaction.createMany({
      data: [
        // GST inclusive sales
        {
          id: 'sale-1',
          userId: testUser.id,
          bankAccountId: bankAccount.id,
          description: 'Invoice #001',
          amount: 1100,
          date: new Date(),
          type: 'DEPOSIT',
          category: 'Sales',
          isBusinessExpense: false,
          gstAmount: 100,
        },
        // GST inclusive purchases
        {
          id: 'purchase-1',
          userId: testUser.id,
          bankAccountId: bankAccount.id,
          description: 'Office Supplies',
          amount: -550,
          date: new Date(),
          type: 'WITHDRAWAL',
          category: 'Office Supplies',
          isBusinessExpense: true,
          taxCategory: 'D5',
          gstAmount: 50,
        },
        // Capital purchase
        {
          id: 'capital-1',
          userId: testUser.id,
          bankAccountId: bankAccount.id,
          description: 'Computer Equipment',
          amount: -3300,
          date: new Date(),
          type: 'WITHDRAWAL',
          category: 'Equipment',
          isBusinessExpense: true,
          taxCategory: 'D5',
          gstAmount: 300,
        },
      ],
    });
  });

  describe('POST /api/tax/calculate', () => {
    describe('PAYG Calculations', () => {
      it('should calculate PAYG withholding', async () => {
        const req = createAuthenticatedRequest(
          'POST',
          {
            operation: 'PAYG_WITHHOLDING',
            income: 5000,
            frequency: 'MONTHLY',
          },
          null,
          null,
          testUser,
        );
        const res = createMockResponse();

        await authMiddleware.authenticated(taxCalculateHandler)(req, res);

        const response = {
          status: res._getStatusCode(),
          data: res._getData(),
        };

        expectSuccess(response);
        expect(response.data.data).toMatchObject({
          operation: 'PAYG_WITHHOLDING',
          result: {
            grossIncome: 5000,
            withholdingAmount: expect.any(Number),
            netIncome: expect.any(Number),
            effectiveRate: expect.any(Number),
          },
        });

        // Validate withholding is reasonable
        const withholding = response.data.data.result.withholdingAmount;
        expect(withholding).toBeGreaterThan(0);
        expect(withholding).toBeLessThan(5000);
      });

      it('should handle different payment frequencies', async () => {
        const frequencies = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY'];
        const results: any[] = [];

        for (const frequency of frequencies) {
          const req = createAuthenticatedRequest(
            'POST',
            {
              operation: 'PAYG_WITHHOLDING',
              income: 1000,
              frequency,
            },
            null,
            null,
            testUser,
          );
          const res = createMockResponse();

          await authMiddleware.authenticated(taxCalculateHandler)(req, res);

          const response = {
            status: res._getStatusCode(),
            data: res._getData(),
          };

          expectSuccess(response);
          results.push(response.data.data.result);
        }

        // Weekly withholding should be less than fortnightly
        expect(results[0].withholdingAmount).toBeLessThan(results[1].withholdingAmount);
        // Fortnightly should be less than monthly
        expect(results[1].withholdingAmount).toBeLessThan(results[2].withholdingAmount);
      });
    });

    describe('Deduction Calculations', () => {
      it('should calculate deductions with correct limits', async () => {
        const req = createAuthenticatedRequest(
          'POST',
          {
            operation: 'DEDUCTION_CALCULATION',
            category: TaxCategory.D1_MOTOR_VEHICLE,
            amount: 10000,
            businessUsePercentage: 80,
          },
          null,
          null,
          testUser,
        );
        const res = createMockResponse();

        await authMiddleware.authenticated(taxCalculateHandler)(req, res);

        const response = {
          status: res._getStatusCode(),
          data: res._getData(),
        };

        expectSuccess(response);
        expect(response.data.data.result).toMatchObject({
          category: TaxCategory.D1_MOTOR_VEHICLE,
          claimableAmount: 5000, // Limited to $5000 for D1
          appliedLimit: 5000,
          businessUsePercentage: 80,
        });
      });

      it('should handle categories without limits', async () => {
        const req = createAuthenticatedRequest(
          'POST',
          {
            operation: 'DEDUCTION_CALCULATION',
            category: TaxCategory.D5_OFFICE_EXPENSES,
            amount: 10000,
            businessUsePercentage: 100,
          },
          null,
          null,
          testUser,
        );
        const res = createMockResponse();

        await authMiddleware.authenticated(taxCalculateHandler)(req, res);

        const response = {
          status: res._getStatusCode(),
          data: res._getData(),
        };

        expectSuccess(response);
        expect(response.data.data.result.claimableAmount).toBe(10000);
        expect(response.data.data.result.appliedLimit).toBeNull();
      });
    });

    describe('ABN Validation', () => {
      it('should validate correct ABN', async () => {
        const req = createAuthenticatedRequest(
          'POST',
          {
            operation: 'ABN_VALIDATION',
            abn: '51824753556', // Valid ABN
          },
          null,
          null,
          testUser,
        );
        const res = createMockResponse();

        await authMiddleware.authenticated(taxCalculateHandler)(req, res);

        const response = {
          status: res._getStatusCode(),
          data: res._getData(),
        };

        expectSuccess(response);
        expect(response.data.data.result).toMatchObject({
          isValid: true,
          formatted: '51 824 753 556',
        });
      });

      it('should reject invalid ABN', async () => {
        const req = createAuthenticatedRequest(
          'POST',
          {
            operation: 'ABN_VALIDATION',
            abn: '12345678901', // Invalid checksum
          },
          null,
          null,
          testUser,
        );
        const res = createMockResponse();

        await authMiddleware.authenticated(taxCalculateHandler)(req, res);

        const response = {
          status: res._getStatusCode(),
          data: res._getData(),
        };

        expectSuccess(response);
        expect(response.data.data.result.isValid).toBe(false);
      });
    });

    describe('TFN Validation', () => {
      it('should validate TFN format', async () => {
        const req = createAuthenticatedRequest(
          'POST',
          {
            operation: 'TFN_VALIDATION',
            tfn: '123456782', // Valid format
          },
          null,
          null,
          testUser,
        );
        const res = createMockResponse();

        await authMiddleware.authenticated(taxCalculateHandler)(req, res);

        const response = {
          status: res._getStatusCode(),
          data: res._getData(),
        };

        expectSuccess(response);
        expect(response.data.data.result).toMatchObject({
          isValid: true,
          formatted: '123 456 782',
        });
      });
    });

    it('should validate required fields', async () => {
      const req = createAuthenticatedRequest(
        'POST',
        {
          operation: 'PAYG_WITHHOLDING',
          // Missing required fields
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(taxCalculateHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'required');
    });
  });

  describe('POST /api/compliance/gst/calculate', () => {
    it('should calculate GST for single transaction', async () => {
      const req = createAuthenticatedRequest(
        'POST',
        {
          amount: 110,
          gstInclusive: true,
          category: 'Office Supplies',
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(gstCalculateHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        amount: 110,
        gstAmount: 10,
        netAmount: 100,
        gstInclusive: true,
        gstRate: 0.1,
      });
    });

    it('should calculate GST exclusive amounts', async () => {
      const req = createAuthenticatedRequest(
        'POST',
        {
          amount: 100,
          gstInclusive: false,
          category: 'Professional Services',
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(gstCalculateHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        amount: 100,
        gstAmount: 10,
        netAmount: 100,
        totalAmount: 110,
        gstInclusive: false,
      });
    });

    it('should handle bulk calculations', async () => {
      const req = createAuthenticatedRequest(
        'POST',
        {
          transactions: [
            { amount: 110, category: 'Sales' },
            { amount: 220, category: 'Sales' },
            { amount: -55, category: 'Expenses' },
          ],
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(gstCalculateHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.results).toHaveLength(3);
      expect(response.data.data.summary).toMatchObject({
        totalGST: 25, // 10 + 20 - 5
        totalSalesGST: 30,
        totalPurchasesGST: 5,
        netGSTPayable: 25,
      });
    });

    it('should validate amount limits', async () => {
      const req = createAuthenticatedRequest(
        'POST',
        {
          transactions: new Array(101).fill({ amount: 100, category: 'Test' }),
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(gstCalculateHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'maximum');
    });
  });

  describe('GET /api/compliance/gst/bas-report', () => {
    it('should generate BAS report for current quarter', async () => {
      const req = createAuthenticatedRequest('GET', null, { taxPeriod: '2024Q1' }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(basReportHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        taxPeriod: '2024Q1',
        summary: {
          totalSales: 1100,
          totalPurchases: 3850,
          gstCollected: 100,
          gstPaid: 350,
          netGST: -250, // Refund position
        },
        fields: {
          G1: 1100, // Total sales
          G10: 3850, // Capital purchases
          G11: 3850, // Total purchases
          '1A': 100, // GST collected
          '1B': 350, // GST paid
        },
      });
    });

    it('should include detailed breakdowns', async () => {
      const req = createAuthenticatedRequest(
        'GET',
        null,
        {
          taxPeriod: '2024Q1',
          includeDetails: 'true',
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(basReportHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.salesDetails).toBeDefined();
      expect(response.data.data.purchaseDetails).toBeDefined();
      expect(response.data.data.salesDetails.transactions).toHaveLength(1);
      expect(response.data.data.purchaseDetails.transactions).toHaveLength(2);
    });

    it('should validate tax period format', async () => {
      const req = createAuthenticatedRequest('GET', null, { taxPeriod: 'invalid' }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(basReportHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'Invalid tax period');
    });

    it('should handle empty periods', async () => {
      // Request a future period with no transactions
      const req = createAuthenticatedRequest('GET', null, { taxPeriod: '2025Q4' }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(basReportHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.summary).toMatchObject({
        totalSales: 0,
        totalPurchases: 0,
        gstCollected: 0,
        gstPaid: 0,
        netGST: 0,
      });
    });

    it('should audit BAS report generation', async () => {
      const req = createAuthenticatedRequest('GET', null, { taxPeriod: '2024Q1' }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(basReportHandler)(req, res);

      expectSuccess({ status: res._getStatusCode(), data: res._getData() });

      // Check audit log
      const logs = await (global as any).prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          event: 'BAS_REPORT_GENERATED',
        },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].metadata).toMatchObject({
        taxPeriod: '2024Q1',
        netGST: -250,
      });
    });
  });

  describe('Tax Category Validation', () => {
    it('should validate all ATO tax categories', async () => {
      const validCategories = Object.values(TaxCategory);

      for (const category of validCategories) {
        const req = createAuthenticatedRequest(
          'POST',
          {
            operation: 'DEDUCTION_CALCULATION',
            category,
            amount: 1000,
            businessUsePercentage: 100,
          },
          null,
          null,
          testUser,
        );
        const res = createMockResponse();

        await authMiddleware.authenticated(taxCalculateHandler)(req, res);

        const response = {
          status: res._getStatusCode(),
          data: res._getData(),
        };

        expectSuccess(response);
        expect(response.data.data.result.category).toBe(category);
      }
    });

    it('should reject invalid tax category', async () => {
      const req = createAuthenticatedRequest(
        'POST',
        {
          operation: 'DEDUCTION_CALCULATION',
          category: 'INVALID_CATEGORY',
          amount: 1000,
          businessUsePercentage: 100,
        },
        null,
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(taxCalculateHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'Invalid');
    });
  });
});
