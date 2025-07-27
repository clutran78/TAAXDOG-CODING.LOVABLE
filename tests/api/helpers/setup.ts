import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// Disable logging during tests
if (process.env.CI) {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// Global test timeout
jest.setTimeout(30000);

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock email service
jest.mock('../../../lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
  sendReceiptEmail: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock AI services
jest.mock('../../../lib/ai/service', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockResolvedValue({
      content: 'Mocked AI response',
      provider: 'mock',
      model: 'mock-model',
      tokensUsed: { input: 100, output: 50, total: 150 },
      cost: 0.001,
      responseTimeMs: 100,
    }),
  })),
}));

// Mock BASIQ client
jest.mock('../../../lib/basiq/client', () => ({
  basiqClient: {
    createUser: jest.fn().mockResolvedValue({ id: 'mock-basiq-user-id' }),
    getUser: jest.fn().mockResolvedValue({ id: 'mock-basiq-user-id' }),
    createConnection: jest.fn().mockResolvedValue({ id: 'mock-connection-id' }),
    getAccounts: jest.fn().mockResolvedValue({ data: [] }),
    getTransactions: jest.fn().mockResolvedValue({ data: [], synced: 0 }),
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
  },
}));

// Mock Stripe
jest.mock('../../../lib/stripe/service', () => ({
  StripeService: {
    createCustomer: jest.fn().mockResolvedValue({ id: 'cus_mock' }),
    createSubscription: jest.fn().mockResolvedValue({ id: 'sub_mock' }),
    cancelSubscription: jest.fn().mockResolvedValue({ id: 'sub_mock', status: 'canceled' }),
    createPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_mock' }),
  },
}));

// Global database client for tests
let prisma: PrismaClient;

beforeAll(async () => {
  // Initialize Prisma client
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.DEBUG ? ['query', 'error', 'warn'] : [],
  });

  // Ensure database is connected
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from database
  await prisma.$disconnect();
});

// Make prisma available globally
(global as any).prisma = prisma;

// Add custom matchers
expect.extend({
  toBeValidDate(received: any) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    return {
      pass,
      message: () => `expected ${received} to be a valid Date`,
    };
  },
  toBeUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () => `expected ${received} to be a valid UUID`,
    };
  },
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeUUID(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}
