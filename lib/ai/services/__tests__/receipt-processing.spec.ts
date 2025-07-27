import { ReceiptProcessor } from '../receipt-processing';
import { AIService } from '../../service';
import { testDataFactory } from '@/tests/utils/db-helpers';

// Mock dependencies
jest.mock('../../service');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    receipt: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('ReceiptProcessor', () => {
  let receiptProcessor: ReceiptProcessor;
  let mockAIService: jest.Mocked<AIService>;
  const mockPrisma = require('@/lib/prisma').prisma;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAIService = new AIService() as jest.Mocked<AIService>;
    receiptProcessor = new ReceiptProcessor(mockAIService);
  });

  describe('processReceipt', () => {
    const mockUserId = 'test-user-id';
    const mockImageData = 'base64imagedata';
    const mockFileName = 'receipt.jpg';

    it('successfully processes a receipt', async () => {
      const mockExtractedData = {
        merchant: 'Woolworths',
        total: 156.78,
        date: '2024-01-15',
        items: [
          { name: 'Milk', price: 4.5, quantity: 2 },
          { name: 'Bread', price: 3.2, quantity: 1 },
        ],
        gstAmount: 14.25,
      };

      mockAIService.processReceiptImage = jest.fn().mockResolvedValueOnce({
        success: true,
        data: mockExtractedData,
      });

      mockPrisma.receipt.create.mockResolvedValueOnce({
        id: 'receipt-1',
        userId: mockUserId,
        ...mockExtractedData,
        status: 'PROCESSED',
      });

      const result = await receiptProcessor.processReceipt(mockUserId, mockImageData, mockFileName);

      expect(result.success).toBe(true);
      expect(result.receipt).toBeDefined();
      expect(result.receipt.merchant).toBe('Woolworths');
      expect(result.receipt.status).toBe('PROCESSED');

      expect(mockPrisma.receipt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          fileName: mockFileName,
          totalAmount: 156.78,
          merchantName: 'Woolworths',
          status: 'PROCESSED',
        }),
      });
    });

    it('handles AI extraction failure', async () => {
      mockAIService.processReceiptImage = jest.fn().mockResolvedValueOnce({
        success: false,
        error: 'Failed to extract data',
      });

      mockPrisma.receipt.create.mockResolvedValueOnce({
        id: 'receipt-1',
        userId: mockUserId,
        status: 'FAILED',
      });

      const result = await receiptProcessor.processReceipt(mockUserId, mockImageData, mockFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to extract data');

      expect(mockPrisma.receipt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'Failed to extract data',
        }),
      });
    });

    it('validates extracted data', async () => {
      const invalidData = {
        merchant: 'Test Store',
        total: -50, // Invalid negative amount
        date: 'invalid-date',
      };

      mockAIService.processReceiptImage = jest.fn().mockResolvedValueOnce({
        success: true,
        data: invalidData,
      });

      const result = await receiptProcessor.processReceipt(mockUserId, mockImageData, mockFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid receipt data');
    });

    it('creates associated transaction when enabled', async () => {
      const mockExtractedData = {
        merchant: 'Coles',
        total: 89.99,
        date: '2024-01-20',
        category: 'GROCERIES',
      };

      mockAIService.processReceiptImage = jest.fn().mockResolvedValueOnce({
        success: true,
        data: mockExtractedData,
      });

      mockPrisma.receipt.create.mockResolvedValueOnce({
        id: 'receipt-1',
        ...mockExtractedData,
      });

      mockPrisma.transaction.create.mockResolvedValueOnce({
        id: 'transaction-1',
        ...mockExtractedData,
      });

      const result = await receiptProcessor.processReceipt(
        mockUserId,
        mockImageData,
        mockFileName,
        { createTransaction: true },
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          amount: 89.99,
          description: 'Coles',
          category: 'GROCERIES',
          type: 'EXPENSE',
          receiptId: 'receipt-1',
        }),
      });
    });

    it('handles duplicate receipt detection', async () => {
      const existingReceipt = testDataFactory.receipt({
        merchantName: 'Duplicate Store',
        totalAmount: 50.0,
        date: new Date('2024-01-15'),
      });

      mockPrisma.receipt.findMany = jest.fn().mockResolvedValueOnce([existingReceipt]);

      mockAIService.processReceiptImage = jest.fn().mockResolvedValueOnce({
        success: true,
        data: {
          merchant: 'Duplicate Store',
          total: 50.0,
          date: '2024-01-15',
        },
      });

      const result = await receiptProcessor.processReceipt(mockUserId, mockImageData, mockFileName);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Duplicate receipt detected');
    });

    it('extracts GST information for Australian receipts', async () => {
      const mockExtractedData = {
        merchant: 'Australian Business',
        total: 110.0,
        gstAmount: 10.0,
        date: '2024-01-15',
      };

      mockAIService.processReceiptImage = jest.fn().mockResolvedValueOnce({
        success: true,
        data: mockExtractedData,
      });

      mockPrisma.receipt.create.mockResolvedValueOnce({
        id: 'receipt-1',
        ...mockExtractedData,
      });

      const result = await receiptProcessor.processReceipt(mockUserId, mockImageData, mockFileName);

      expect(result.success).toBe(true);
      expect(result.receipt.gstAmount).toBe(10.0);
      expect(mockPrisma.receipt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gstAmount: 10.0,
        }),
      });
    });

    it('categorizes receipts based on merchant', async () => {
      const merchantCategories = [
        { merchant: 'Woolworths', expectedCategory: 'GROCERIES' },
        { merchant: 'Shell', expectedCategory: 'TRANSPORT' },
        { merchant: 'Medicare', expectedCategory: 'HEALTHCARE' },
      ];

      for (const { merchant, expectedCategory } of merchantCategories) {
        jest.clearAllMocks();

        mockAIService.processReceiptImage = jest.fn().mockResolvedValueOnce({
          success: true,
          data: { merchant, total: 50, date: '2024-01-15' },
        });

        mockPrisma.receipt.create.mockResolvedValueOnce({
          id: 'receipt-1',
          category: expectedCategory,
        });

        const result = await receiptProcessor.processReceipt(
          mockUserId,
          mockImageData,
          mockFileName,
        );

        expect(result.receipt.category).toBe(expectedCategory);
      }
    });
  });

  describe('reprocessReceipt', () => {
    it('reprocesses a failed receipt', async () => {
      const failedReceipt = testDataFactory.receipt({
        id: 'failed-receipt-1',
        status: 'FAILED',
        fileUrl: 'https://example.com/receipt.jpg',
      });

      mockPrisma.receipt.findUnique.mockResolvedValueOnce(failedReceipt);

      mockAIService.processReceiptImage = jest.fn().mockResolvedValueOnce({
        success: true,
        data: {
          merchant: 'Reprocessed Store',
          total: 75.5,
          date: '2024-01-20',
        },
      });

      mockPrisma.receipt.update.mockResolvedValueOnce({
        ...failedReceipt,
        status: 'PROCESSED',
        merchantName: 'Reprocessed Store',
        totalAmount: 75.5,
      });

      const result = await receiptProcessor.reprocessReceipt('failed-receipt-1');

      expect(result.success).toBe(true);
      expect(mockPrisma.receipt.update).toHaveBeenCalledWith({
        where: { id: 'failed-receipt-1' },
        data: expect.objectContaining({
          status: 'PROCESSED',
          merchantName: 'Reprocessed Store',
          totalAmount: 75.5,
        }),
      });
    });

    it('prevents reprocessing of already processed receipts', async () => {
      const processedReceipt = testDataFactory.receipt({
        id: 'processed-receipt-1',
        status: 'PROCESSED',
      });

      mockPrisma.receipt.findUnique.mockResolvedValueOnce(processedReceipt);

      const result = await receiptProcessor.reprocessReceipt('processed-receipt-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already processed');
      expect(mockAIService.processReceiptImage).not.toHaveBeenCalled();
    });
  });

  describe('matchReceiptToTransaction', () => {
    it('matches receipt to existing transaction', async () => {
      const receipt = testDataFactory.receipt({
        id: 'receipt-1',
        totalAmount: 99.99,
        date: new Date('2024-01-15'),
        merchantName: 'Test Store',
      });

      const matchingTransaction = testDataFactory.transaction({
        id: 'transaction-1',
        amount: 99.99,
        date: new Date('2024-01-15'),
        description: 'TEST STORE SYDNEY',
        receiptId: null,
      });

      mockPrisma.receipt.findUnique.mockResolvedValueOnce(receipt);
      mockPrisma.transaction.findMany.mockResolvedValueOnce([matchingTransaction]);

      const result = await receiptProcessor.matchReceiptToTransaction('receipt-1');

      expect(result.success).toBe(true);
      expect(result.matchedTransactionId).toBe('transaction-1');
    });

    it('handles no matching transactions', async () => {
      const receipt = testDataFactory.receipt({
        id: 'receipt-1',
        totalAmount: 99.99,
        date: new Date('2024-01-15'),
      });

      mockPrisma.receipt.findUnique.mockResolvedValueOnce(receipt);
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);

      const result = await receiptProcessor.matchReceiptToTransaction('receipt-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No matching transaction found');
    });
  });
});
