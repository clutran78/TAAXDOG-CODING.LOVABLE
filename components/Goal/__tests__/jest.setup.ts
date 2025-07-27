/**
 * Jest setup file for Goal component tests
 */

import '@testing-library/jest-dom';
import { MockLocalStorage } from './test-utils';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock localStorage
const mockLocalStorage = new MockLocalStorage();
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock sessionStorage
const mockSessionStorage = new MockLocalStorage();
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

// Mock fetch if not using MSW for a specific test
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Mock scrollTo
window.scrollTo = jest.fn();

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    // Ignore React act() warnings
    if (typeof args[0] === 'string' && args[0].includes('Warning: An update to')) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    // Ignore specific warnings
    if (typeof args[0] === 'string' && args[0].includes('Warning: ReactDOM.render')) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  mockLocalStorage.clear();
  mockSessionStorage.clear();
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
  toHaveBeenCalledWithMatch(received: jest.Mock, expected: any) {
    const calls = received.mock.calls;
    const pass = calls.some((call) =>
      call.some((arg) => {
        if (typeof expected === 'object') {
          return Object.keys(expected).every((key) => arg[key] === expected[key]);
        }
        return arg === expected;
      }),
    );

    if (pass) {
      return {
        message: () =>
          `expected mock not to have been called with matching ${JSON.stringify(expected)}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected mock to have been called with matching ${JSON.stringify(expected)}`,
        pass: false,
      };
    }
  },
});

// Extend TypeScript types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveBeenCalledWithMatch(expected: any): R;
    }
  }
}

// Setup test environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
