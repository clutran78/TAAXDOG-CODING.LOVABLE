import { createMockApiContext, apiAssertions } from '@/tests/utils/api-mocks';
import { testDataFactory } from '@/tests/utils/db-helpers';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// Import API handlers
import uploadReceiptHandler from '@/pages/api/receipts/upload';
import processReceiptHandler from '@/pages/api/ai/process-receipt';
import getReceiptsHandler from '@/pages/api/receipts/index';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    receipt: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/ai/service', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    processReceiptImage: jest.fn(),
  })),
}));

jest.mock('formidable', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    parse: jest.fn((req, cb) => {
      cb(
        null,
        {},
        {
          file: {
            filepath: '/tmp/test-receipt.jpg',
            originalFilename: 'receipt.jpg',
            mimetype: 'image/jpeg',
          },
        },
      );
    }),
  })),
}));

const mockPrisma = require('@/lib/prisma').prisma;
const { AIService } = require('@/lib/ai/service');

describe('Receipt Processing Flow Integration Tests', () => {
  let mockAIService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAIService = new AIService();
  });

  describe('Complete Receipt Upload and Processing Flow', () => {
    it('uploads, processes, and creates transaction from receipt', async () => {
      const userId = 'user-123';
      const user = testDataFactory.user({ id: userId });

      // Step 1: Upload receipt
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      mockPrisma.receipt.create.mockResolvedValueOnce({
        id: 'receipt-1',
        userId,
        fileName: 'receipt.jpg',
        fileUrl: 'https://storage.example.com/receipts/receipt-1.jpg',
        status: 'PENDING',
        createdAt: new Date(),
      });

      const { req: uploadReq, res: uploadRes } = createMockApiContext('POST');
      uploadReq.user = { id: userId };

      await uploadReceiptHandler(uploadReq, uploadRes);

      const uploadData = apiAssertions.expectSuccess(uploadRes, 201);
      expect(uploadData.receipt).toMatchObject({
        id: 'receipt-1',
        status: 'PENDING',
      });

      // Step 2: AI processes the receipt
      const extractedData = {
        merchant: 'Woolworths Supermarket',
        total: 156.78,
        gstAmount: 14.25,
        date: '2024-01-15',
        items: [
          { name: 'Milk 2L', price: 4.5, quantity: 2 },
          { name: 'Bread', price: 3.2, quantity: 1 },
          { name: 'Eggs 12pk', price: 7.5, quantity: 1 },
        ],
        category: 'GROCERIES',
      };

      mockAIService.processReceiptImage.mockResolvedValueOnce({
        success: true,
        data: extractedData,
      });

      mockPrisma.receipt.update.mockResolvedValueOnce({
        id: 'receipt-1',
        userId,
        status: 'PROCESSED',
        totalAmount: extractedData.total,
        merchantName: extractedData.merchant,
        extractedData,
        processedAt: new Date(),
      });

      const { req: processReq, res: processRes } = createMockApiContext('POST', {
        receiptId: 'receipt-1',
      });
      processReq.user = { id: userId };

      await processReceiptHandler(processReq, processRes);

      const processData = apiAssertions.expectSuccess(processRes);
      expect(processData.receipt).toMatchObject({
        status: 'PROCESSED',
        totalAmount: 156.78,
        merchantName: 'Woolworths Supermarket',
      });

      // Step 3: Create transaction from receipt
      mockPrisma.transaction.create.mockResolvedValueOnce({
        id: 'txn-1',
        userId,
        receiptId: 'receipt-1',
        amount: -156.78,
        description: 'Woolworths Supermarket',
        category: 'GROCERIES',
        date: new Date('2024-01-15'),
        type: 'EXPENSE',
      });

      // Verify transaction was created
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          receiptId: 'receipt-1',
          amount: -156.78,
          category: 'GROCERIES',
        }),
      });
    });

    it('handles duplicate receipt detection', async () => {
      const userId = 'user-123';
      const existingReceipt = testDataFactory.receipt({
        userId,
        merchantName: 'Test Store',
        totalAmount: 99.99,
        date: new Date('2024-01-15'),
      });

      // Upload new receipt
      mockPrisma.receipt.findMany.mockResolvedValueOnce([existingReceipt]);

      const extractedData = {
        merchant: 'Test Store',
        total: 99.99,
        date: '2024-01-15',
      };

      mockAIService.processReceiptImage.mockResolvedValueOnce({
        success: true,
        data: extractedData,
      });

      const { req, res } = createMockApiContext('POST', {
        checkDuplicates: true,
      });
      req.user = { id: userId };

      await processReceiptHandler(req, res);

      apiAssertions.expectError(res, 409, 'Duplicate receipt detected');
    });

    it('matches receipt to existing bank transaction', async () => {
      const userId = 'user-123';
      const receiptData = {
        merchant: 'WOOLWORTHS',
        total: 156.78,
        date: '2024-01-15',
      };

      // Existing bank transaction
      const bankTransaction = testDataFactory.transaction({
        userId,
        description: 'WOOLWORTHS SYDNEY NSW',
        amount: -156.78,
        date: new Date('2024-01-15'),
        receiptId: null,
      });

      mockPrisma.transaction.findFirst.mockResolvedValueOnce(bankTransaction);
      mockPrisma.transaction.update.mockResolvedValueOnce({
        ...bankTransaction,
        receiptId: 'receipt-1',
      });

      mockAIService.processReceiptImage.mockResolvedValueOnce({
        success: true,
        data: receiptData,
      });

      const { req, res } = createMockApiContext('POST', {
        receiptId: 'receipt-1',
        matchTransaction: true,
      });
      req.user = { id: userId };

      await processReceiptHandler(req, res);

      // Verify transaction was matched
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: bankTransaction.id },
        data: { receiptId: 'receipt-1' },
      });
    });
  });

  describe('Receipt List and Filtering', () => {
    it('retrieves user receipts with filtering', async () => {
      const userId = 'user-123';
      const receipts = [
        testDataFactory.receipt({
          userId,
          merchantName: 'Woolworths',
          category: 'GROCERIES',
          totalAmount: 156.78,
        }),
        testDataFactory.receipt({
          userId,
          merchantName: 'Shell',
          category: 'TRANSPORT',
          totalAmount: 85.0,
        }),
      ];

      mockPrisma.receipt.findMany.mockResolvedValueOnce(receipts);

      const { req, res } = createMockApiContext('GET', null, {
        category: 'GROCERIES',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });
      req.user = { id: userId };

      await getReceiptsHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.receipts).toHaveLength(1);
      expect(data.receipts[0].category).toBe('GROCERIES');

      expect(mockPrisma.receipt.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          category: 'GROCERIES',
          date: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31'),
          },
        },
        orderBy: { date: 'desc' },
      });
    });

    it('calculates receipt statistics', async () => {
      const userId = 'user-123';
      const receipts = [
        testDataFactory.receipt({ totalAmount: 100, category: 'GROCERIES' }),
        testDataFactory.receipt({ totalAmount: 200, category: 'GROCERIES' }),
        testDataFactory.receipt({ totalAmount: 150, category: 'TRANSPORT' }),
      ];

      mockPrisma.receipt.findMany.mockResolvedValueOnce(receipts);

      const { req, res } = createMockApiContext('GET', null, {
        includeStats: 'true',
      });
      req.user = { id: userId };

      await getReceiptsHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.stats).toMatchObject({
        totalAmount: 450,
        count: 3,
        byCategory: {
          GROCERIES: { amount: 300, count: 2 },
          TRANSPORT: { amount: 150, count: 1 },
        },
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles AI processing failure gracefully', async () => {
      const userId = 'user-123';

      mockAIService.processReceiptImage.mockResolvedValueOnce({
        success: false,
        error: 'Failed to extract data from image',
      });

      mockPrisma.receipt.update.mockResolvedValueOnce({
        id: 'receipt-1',
        status: 'FAILED',
        error: 'Failed to extract data from image',
      });

      const { req, res } = createMockApiContext('POST', {
        receiptId: 'receipt-1',
      });
      req.user = { id: userId };

      await processReceiptHandler(req, res);

      const data = apiAssertions.expectSuccess(res, 202);
      expect(data.receipt.status).toBe('FAILED');
      expect(data.receipt.error).toContain('Failed to extract data');
    });

    it('allows manual receipt data entry on failure', async () => {
      const userId = 'user-123';
      const manualData = {
        merchant: 'Manual Store',
        total: 50.0,
        date: '2024-01-15',
        category: 'OTHER',
      };

      mockPrisma.receipt.update.mockResolvedValueOnce({
        id: 'receipt-1',
        status: 'PROCESSED',
        extractedData: manualData,
        isManual: true,
      });

      const { req, res } = createMockApiContext('PATCH', {
        receiptId: 'receipt-1',
        manualData,
      });
      req.user = { id: userId };

      await processReceiptHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.receipt.isManual).toBe(true);
      expect(data.receipt.extractedData).toEqual(manualData);
    });

    it('retries failed receipt processing', async () => {
      const userId = 'user-123';
      const failedReceipt = testDataFactory.receipt({
        id: 'receipt-1',
        status: 'FAILED',
        retryCount: 1,
      });

      mockPrisma.receipt.findUnique.mockResolvedValueOnce(failedReceipt);

      // Second attempt succeeds
      mockAIService.processReceiptImage.mockResolvedValueOnce({
        success: true,
        data: { merchant: 'Retry Store', total: 75.0 },
      });

      mockPrisma.receipt.update.mockResolvedValueOnce({
        ...failedReceipt,
        status: 'PROCESSED',
        retryCount: 2,
      });

      const { req, res } = createMockApiContext('POST', {
        receiptId: 'receipt-1',
        retry: true,
      });
      req.user = { id: userId };

      await processReceiptHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.receipt.status).toBe('PROCESSED');
      expect(data.receipt.retryCount).toBe(2);
    });
  });

  describe('Bulk Receipt Operations', () => {
    it('processes multiple receipts in batch', async () => {
      const userId = 'user-123';
      const receiptIds = ['receipt-1', 'receipt-2', 'receipt-3'];

      const receipts = receiptIds.map((id) =>
        testDataFactory.receipt({ id, userId, status: 'PENDING' }),
      );

      mockPrisma.receipt.findMany.mockResolvedValueOnce(receipts);

      // Mock AI processing for each receipt
      receipts.forEach((receipt, index) => {
        mockAIService.processReceiptImage.mockResolvedValueOnce({
          success: true,
          data: {
            merchant: `Store ${index + 1}`,
            total: (index + 1) * 50,
          },
        });
      });

      const { req, res } = createMockApiContext('POST', {
        receiptIds,
        action: 'process',
      });
      req.user = { id: userId };

      await processReceiptHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.processed).toBe(3);
      expect(data.failed).toBe(0);
    });

    it('exports receipts for tax purposes', async () => {
      const userId = 'user-123';
      const taxYear = '2023-2024';

      const deductibleReceipts = [
        testDataFactory.receipt({
          category: 'WORK_EXPENSES',
          totalAmount: 250,
          taxCategory: 'D5',
        }),
        testDataFactory.receipt({
          category: 'DONATIONS',
          totalAmount: 100,
          taxCategory: 'D9',
        }),
      ];

      mockPrisma.receipt.findMany.mockResolvedValueOnce(deductibleReceipts);

      const { req, res } = createMockApiContext('GET', null, {
        export: 'tax',
        taxYear,
      });
      req.user = { id: userId };

      await getReceiptsHandler(req, res);

      const data = apiAssertions.expectSuccess(res);
      expect(data.export).toMatchObject({
        taxYear,
        totalDeductible: 350,
        categories: {
          D5: 250,
          D9: 100,
        },
        receipts: deductibleReceipts,
      });
    });
  });
});
