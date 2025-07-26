import { cleanTestDatabase } from './test-database';
import { authTest } from '../helpers/auth-test-helper';

// Clean up after each test
afterEach(async () => {
  // Clean up test users
  await authTest.cleanup();

  // Clear all mocks
  jest.clearAllMocks();
});

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  toBeValidABN(received: string) {
    // Simple ABN validation (11 digits)
    const abnRegex = /^[0-9]{11}$/;
    const pass = abnRegex.test(received.replace(/\s/g, ''));
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ABN`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ABN`,
        pass: false,
      };
    }
  },
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidUUID(): R;
      toBeValidABN(): R;
    }
  }
}
