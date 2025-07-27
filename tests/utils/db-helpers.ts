import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Create a mock Prisma client for testing
export type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
};

export const createMockContext = (): MockContext => {
  return {
    prisma: mockDeep<PrismaClient>(),
  };
};

// Helper to reset mocks between tests
export const resetMockContext = (mockContext: MockContext) => {
  mockReset(mockContext.prisma);
};

// Common test data factories
export const testDataFactory = {
  user: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-password',
    role: 'USER',
    emailVerified: new Date(),
    atoId: null,
    abn: null,
    tfn: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    encryptedTfn: null,
    encryptedAbn: null,
    ...overrides,
  }),

  transaction: (overrides = {}) => ({
    id: 'test-transaction-id',
    userId: 'test-user-id',
    amount: 100.0,
    currency: 'AUD',
    description: 'Test Transaction',
    category: 'GENERAL',
    type: 'EXPENSE',
    status: 'COMPLETED',
    date: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  goal: (overrides = {}) => ({
    id: 'test-goal-id',
    userId: 'test-user-id',
    name: 'Test Goal',
    targetAmount: 1000.0,
    currentAmount: 250.0,
    targetDate: new Date('2025-12-31'),
    description: 'Test goal description',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  budget: (overrides = {}) => ({
    id: 'test-budget-id',
    userId: 'test-user-id',
    name: 'Test Budget',
    amount: 500.0,
    period: 'MONTHLY',
    category: 'GENERAL',
    startDate: new Date(),
    endDate: new Date('2025-12-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  receipt: (overrides = {}) => ({
    id: 'test-receipt-id',
    userId: 'test-user-id',
    fileName: 'test-receipt.jpg',
    fileUrl: 'https://example.com/receipt.jpg',
    totalAmount: 50.0,
    merchantName: 'Test Merchant',
    date: new Date(),
    status: 'PROCESSED',
    extractedData: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
