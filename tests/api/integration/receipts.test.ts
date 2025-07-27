import { db } from '../helpers/database';
import { ApiTester, expectSuccess, expectError, expectPagination } from '../helpers/api';
import { createAuthenticatedRequest, createMockResponse, mockSession } from '../helpers/auth';
import { mockData } from '../fixtures/mockData';
import processReceiptHandler from '../../../pages/api/ai/process-receipt';
import receiptsHandler from '../../../pages/api/receipts/index';
import receiptDetailHandler from '../../../pages/api/receipts/[id]';
import { authMiddleware } from '../../../lib/middleware/auth';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { Readable } from 'stream';

// Mock the AI service
jest.mock('../../../lib/ai/service', () => ({
  AIService: {
    processWithFallback: jest.fn().mockResolvedValue({
      success: true,
      data: {
        merchant: 'Test Store',
        amount: 99.99,
        date: new Date().toISOString(),
        category: 'Groceries',
        items: [
          { description: 'Milk', amount: 4.99 },
          { description: 'Bread', amount: 3.5 },
        ],
        taxAmount: 9.09,
        paymentMethod: 'Card',
      },
    }),
  },
}));

describe('Receipts API Tests', () => {
  let testUser: any;
  let otherUser: any;
  let testReceipt: any;
  const processApi = new ApiTester(processReceiptHandler);
  const receiptsApi = new ApiTester(receiptsHandler);

  beforeEach(async () => {
    await db.cleanDatabase();

    // Create test users
    testUser = await db.createUser(mockData.users.regular);
    otherUser = await db.createUser({
      ...mockData.users.regular,
      email: 'other@example.com',
      id: 'other-user-id',
    });

    // Create a test receipt
    testReceipt = await (global as any).prisma.receipt.create({
      data: {
        userId: testUser.id,
        fileName: 'test-receipt.jpg',
        fileUrl: '/uploads/test-receipt.jpg',
        fileSize: 1024,
        fileHash: 'abc123',
        status: 'PROCESSED',
        extractedData: {
          merchant: 'Existing Store',
          amount: 50.0,
          date: new Date().toISOString(),
          category: 'Shopping',
        },
        confidence: 0.95,
      },
    });
  });

  describe('POST /api/ai/process-receipt', () => {
    it('should process a receipt file', async () => {
      // Create a mock file buffer
      const fileBuffer = Buffer.from('fake image data');
      const fileName = 'receipt.jpg';

      // Create form data
      const form = new FormData();
      form.append('file', fileBuffer, {
        filename: fileName,
        contentType: 'image/jpeg',
      });

      // Create mock request with multipart data
      const req = createAuthenticatedRequest(
        'POST',
        null,
        null,
        {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
        testUser,
      );

      // Convert form to buffer
      const chunks: Buffer[] = [];
      const stream = form as unknown as Readable;

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      (req as any).body = Buffer.concat(chunks);
      (req as any).headers['content-length'] = (req as any).body.length;

      const res = createMockResponse();

      // Mock formidable to parse our test data
      jest.doMock('formidable', () => ({
        IncomingForm: jest.fn().mockImplementation(() => ({
          parse: jest.fn((req, callback) => {
            callback(
              null,
              {},
              {
                file: {
                  originalFilename: fileName,
                  mimetype: 'image/jpeg',
                  size: fileBuffer.length,
                  filepath: '/tmp/test-file',
                },
              },
            );
          }),
        })),
      }));

      // Mock fs.readFile
      jest.spyOn(fs.promises, 'readFile').mockResolvedValue(fileBuffer);

      await authMiddleware.authenticated(processReceiptHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response, 201);
      expect(response.data.data).toMatchObject({
        fileName,
        status: 'PROCESSED',
        extractedData: {
          merchant: 'Test Store',
          amount: 99.99,
          category: 'Groceries',
        },
      });
      expect(response.data.data.id).toBeUUID();
    });

    it('should detect duplicate receipts', async () => {
      // Create a receipt with a known hash
      const existingHash = 'duplicate123';
      await (global as any).prisma.receipt.create({
        data: {
          userId: testUser.id,
          fileName: 'existing.jpg',
          fileUrl: '/uploads/existing.jpg',
          fileSize: 1024,
          fileHash: existingHash,
          status: 'PROCESSED',
        },
      });

      // Try to upload the same file
      const fileBuffer = Buffer.from('same file content');

      const form = new FormData();
      form.append('file', fileBuffer, {
        filename: 'duplicate.jpg',
        contentType: 'image/jpeg',
      });

      const req = createAuthenticatedRequest(
        'POST',
        null,
        null,
        {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
        testUser,
      );

      const chunks: Buffer[] = [];
      const stream = form as unknown as Readable;

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      (req as any).body = Buffer.concat(chunks);
      (req as any).headers['content-length'] = (req as any).body.length;

      const res = createMockResponse();

      // Mock the file hash to match existing
      jest.doMock('crypto', () => ({
        createHash: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(existingHash),
        }),
      }));

      await authMiddleware.authenticated(processReceiptHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 409, 'duplicate');
    });

    it('should validate file type', async () => {
      const form = new FormData();
      form.append('file', Buffer.from('not an image'), {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      });

      const req = createAuthenticatedRequest(
        'POST',
        null,
        null,
        {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
        testUser,
      );

      const chunks: Buffer[] = [];
      const stream = form as unknown as Readable;

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      (req as any).body = Buffer.concat(chunks);
      const res = createMockResponse();

      jest.doMock('formidable', () => ({
        IncomingForm: jest.fn().mockImplementation(() => ({
          parse: jest.fn((req, callback) => {
            callback(
              null,
              {},
              {
                file: {
                  originalFilename: 'document.pdf',
                  mimetype: 'application/pdf',
                  size: 1024,
                  filepath: '/tmp/test-file',
                },
              },
            );
          }),
        })),
      }));

      await authMiddleware.authenticated(processReceiptHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'file type');
    });

    it('should validate file size', async () => {
      const form = new FormData();
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      form.append('file', largeBuffer, {
        filename: 'large.jpg',
        contentType: 'image/jpeg',
      });

      const req = createAuthenticatedRequest(
        'POST',
        null,
        null,
        {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
        testUser,
      );

      const chunks: Buffer[] = [];
      const stream = form as unknown as Readable;

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      (req as any).body = Buffer.concat(chunks);
      const res = createMockResponse();

      jest.doMock('formidable', () => ({
        IncomingForm: jest.fn().mockImplementation(() => ({
          parse: jest.fn((req, callback) => {
            callback(
              null,
              {},
              {
                file: {
                  originalFilename: 'large.jpg',
                  mimetype: 'image/jpeg',
                  size: 11 * 1024 * 1024,
                  filepath: '/tmp/test-file',
                },
              },
            );
          }),
        })),
      }));

      await authMiddleware.authenticated(processReceiptHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 400, 'too large');
    });

    it('should handle AI processing failure gracefully', async () => {
      // Mock AI service to fail
      const AIService = require('../../../lib/ai/service').AIService;
      AIService.processWithFallback.mockRejectedValueOnce(new Error('AI service failed'));

      const fileBuffer = Buffer.from('image data');
      const form = new FormData();
      form.append('file', fileBuffer, {
        filename: 'receipt.jpg',
        contentType: 'image/jpeg',
      });

      const req = createAuthenticatedRequest(
        'POST',
        null,
        null,
        {
          'content-type': `multipart/form-data; boundary=${form.getBoundary()}`,
        },
        testUser,
      );

      const chunks: Buffer[] = [];
      const stream = form as unknown as Readable;

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      (req as any).body = Buffer.concat(chunks);
      const res = createMockResponse();

      jest.doMock('formidable', () => ({
        IncomingForm: jest.fn().mockImplementation(() => ({
          parse: jest.fn((req, callback) => {
            callback(
              null,
              {},
              {
                file: {
                  originalFilename: 'receipt.jpg',
                  mimetype: 'image/jpeg',
                  size: fileBuffer.length,
                  filepath: '/tmp/test-file',
                },
              },
            );
          }),
        })),
      }));

      jest.spyOn(fs.promises, 'readFile').mockResolvedValue(fileBuffer);

      await authMiddleware.authenticated(processReceiptHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      // Should still succeed but with PENDING status
      expectSuccess(response, 201);
      expect(response.data.data.status).toBe('PENDING');
      expect(response.data.data.error).toContain('Failed to process');
    });
  });

  describe('GET /api/receipts', () => {
    it('should get user receipts with pagination', async () => {
      // Create multiple receipts
      for (let i = 0; i < 15; i++) {
        await (global as any).prisma.receipt.create({
          data: {
            userId: testUser.id,
            fileName: `receipt-${i}.jpg`,
            fileUrl: `/uploads/receipt-${i}.jpg`,
            fileSize: 1024,
            fileHash: `hash-${i}`,
            status: 'PROCESSED',
          },
        });
      }

      const req = createAuthenticatedRequest(
        'GET',
        null,
        { limit: '10', page: '1' },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectPagination(response, ['receipts']);
      expect(response.data.data.receipts).toHaveLength(10);
      expect(response.data.data.pagination.total).toBe(16); // Including testReceipt
      expect(response.data.data.pagination.hasMore).toBe(true);
    });

    it('should filter by status', async () => {
      // Create receipts with different statuses
      await (global as any).prisma.receipt.create({
        data: {
          userId: testUser.id,
          fileName: 'pending.jpg',
          fileUrl: '/uploads/pending.jpg',
          fileSize: 1024,
          fileHash: 'pending-hash',
          status: 'PENDING',
        },
      });

      await (global as any).prisma.receipt.create({
        data: {
          userId: testUser.id,
          fileName: 'failed.jpg',
          fileUrl: '/uploads/failed.jpg',
          fileSize: 1024,
          fileHash: 'failed-hash',
          status: 'FAILED',
          error: 'Processing failed',
        },
      });

      const req = createAuthenticatedRequest('GET', null, { status: 'PROCESSED' }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.receipts).toHaveLength(1);
      expect(response.data.data.receipts[0].status).toBe('PROCESSED');
    });

    it('should isolate user data', async () => {
      // Create receipt for other user
      await (global as any).prisma.receipt.create({
        data: {
          userId: otherUser.id,
          fileName: 'other-receipt.jpg',
          fileUrl: '/uploads/other-receipt.jpg',
          fileSize: 1024,
          fileHash: 'other-hash',
          status: 'PROCESSED',
        },
      });

      const req = createAuthenticatedRequest('GET', null, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      // Should only see own receipt
      expect(response.data.data.receipts).toHaveLength(1);
      expect(response.data.data.receipts[0].userId).toBe(testUser.id);
    });

    it('should include spending summary', async () => {
      // Create receipts with extracted data
      await (global as any).prisma.receipt.createMany({
        data: [
          {
            userId: testUser.id,
            fileName: 'receipt1.jpg',
            fileUrl: '/uploads/receipt1.jpg',
            fileSize: 1024,
            fileHash: 'hash1',
            status: 'PROCESSED',
            extractedData: { amount: 100, category: 'Groceries' },
          },
          {
            userId: testUser.id,
            fileName: 'receipt2.jpg',
            fileUrl: '/uploads/receipt2.jpg',
            fileSize: 1024,
            fileHash: 'hash2',
            status: 'PROCESSED',
            extractedData: { amount: 200, category: 'Shopping' },
          },
        ],
      });

      const req = createAuthenticatedRequest('GET', null, null, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptsHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.summary).toBeDefined();
      expect(response.data.data.summary.totalAmount).toBe(350); // 50 + 100 + 200
      expect(response.data.data.summary.receiptCount).toBe(3);
      expect(response.data.data.summary.categoryBreakdown).toBeDefined();
    });
  });

  describe('GET /api/receipts/[id]', () => {
    it('should get receipt details', async () => {
      const req = createAuthenticatedRequest('GET', null, { id: testReceipt.id }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data).toMatchObject({
        id: testReceipt.id,
        fileName: testReceipt.fileName,
        status: testReceipt.status,
        extractedData: testReceipt.extractedData,
      });
    });

    it('should prevent access to other user receipts', async () => {
      const otherReceipt = await (global as any).prisma.receipt.create({
        data: {
          userId: otherUser.id,
          fileName: 'private.jpg',
          fileUrl: '/uploads/private.jpg',
          fileSize: 1024,
          fileHash: 'private-hash',
          status: 'PROCESSED',
        },
      });

      const req = createAuthenticatedRequest('GET', null, { id: otherReceipt.id }, null, testUser);
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 404, 'not found');
    });
  });

  describe('PATCH /api/receipts/[id]', () => {
    it('should update receipt data', async () => {
      const updateData = {
        extractedData: {
          merchant: 'Updated Store',
          amount: 75.0,
          category: 'Office Supplies',
          taxAmount: 6.82,
        },
      };

      const req = createAuthenticatedRequest(
        'PATCH',
        updateData,
        { id: testReceipt.id },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);
      expect(response.data.data.extractedData).toMatchObject(updateData.extractedData);

      // Verify in database
      const updated = await (global as any).prisma.receipt.findUnique({
        where: { id: testReceipt.id },
      });
      expect(updated.extractedData).toMatchObject(updateData.extractedData);
    });

    it('should prevent updating other user receipts', async () => {
      const otherReceipt = await (global as any).prisma.receipt.create({
        data: {
          userId: otherUser.id,
          fileName: 'other.jpg',
          fileUrl: '/uploads/other.jpg',
          fileSize: 1024,
          fileHash: 'other-hash',
          status: 'PROCESSED',
        },
      });

      const req = createAuthenticatedRequest(
        'PATCH',
        { extractedData: { amount: 999 } },
        { id: otherReceipt.id },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 404, 'not found');
    });

    it('should log receipt updates', async () => {
      const req = createAuthenticatedRequest(
        'PATCH',
        { extractedData: { category: 'Updated Category' } },
        { id: testReceipt.id },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptDetailHandler)(req, res);

      expectSuccess({ status: res._getStatusCode(), data: res._getData() });

      // Check audit log
      const logs = await (global as any).prisma.auditLog.findMany({
        where: {
          userId: testUser.id,
          event: 'RECEIPT_UPDATE',
        },
      });

      expect(logs.length).toBe(1);
      expect(logs[0].metadata).toMatchObject({
        receiptId: testReceipt.id,
        changes: {
          extractedData: { category: 'Updated Category' },
        },
      });
    });
  });

  describe('DELETE /api/receipts/[id]', () => {
    it('should soft delete receipt', async () => {
      const req = createAuthenticatedRequest(
        'DELETE',
        null,
        { id: testReceipt.id },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectSuccess(response);

      // Verify soft delete in database
      const deleted = await (global as any).prisma.receipt.findUnique({
        where: { id: testReceipt.id },
      });
      expect(deleted.deletedAt).toBeValidDate();

      // Should not appear in regular queries
      const receipts = await (global as any).prisma.receipt.findMany({
        where: { userId: testUser.id, deletedAt: null },
      });
      expect(receipts).toHaveLength(0);
    });

    it('should prevent deleting other user receipts', async () => {
      const otherReceipt = await (global as any).prisma.receipt.create({
        data: {
          userId: otherUser.id,
          fileName: 'other.jpg',
          fileUrl: '/uploads/other.jpg',
          fileSize: 1024,
          fileHash: 'other-hash',
          status: 'PROCESSED',
        },
      });

      const req = createAuthenticatedRequest(
        'DELETE',
        null,
        { id: otherReceipt.id },
        null,
        testUser,
      );
      const res = createMockResponse();

      await authMiddleware.authenticated(receiptDetailHandler)(req, res);

      const response = {
        status: res._getStatusCode(),
        data: res._getData(),
      };

      expectError(response, 404, 'not found');
    });
  });
});
