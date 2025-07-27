import { Goal } from '@/lib/types/goal';

/**
 * Test utility functions and mock data for Goal component tests
 */

// Mock goal factory
export const createMockGoal = (overrides?: Partial<Goal>): Goal => {
  const baseGoal: Goal = {
    id: Math.random().toString(36).substr(2, 9),
    name: 'Test Goal',
    targetAmount: 1000,
    currentAmount: 500,
    dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
    category: 'Savings',
    description: 'Test goal description',
    status: 'ACTIVE',
    userId: 'test-user-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { ...baseGoal, ...overrides };
};

// Create multiple mock goals
export const createMockGoals = (count: number, overrides?: Partial<Goal>[]): Goal[] => {
  return Array.from({ length: count }, (_, index) => {
    const goalOverrides = overrides?.[index] || {};
    return createMockGoal({
      id: `goal-${index + 1}`,
      name: `Goal ${index + 1}`,
      ...goalOverrides,
    });
  });
};

// Common test goals with different states
export const testGoals = {
  activeGoal: createMockGoal({
    id: 'active-1',
    name: 'Active Goal',
    status: 'ACTIVE',
    currentAmount: 500,
    targetAmount: 1000,
  }),
  completedGoal: createMockGoal({
    id: 'completed-1',
    name: 'Completed Goal',
    status: 'COMPLETED',
    currentAmount: 1000,
    targetAmount: 1000,
  }),
  overdueGoal: createMockGoal({
    id: 'overdue-1',
    name: 'Overdue Goal',
    status: 'ACTIVE',
    dueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
  }),
  nearlyCompleteGoal: createMockGoal({
    id: 'nearly-1',
    name: 'Nearly Complete Goal',
    status: 'ACTIVE',
    currentAmount: 950,
    targetAmount: 1000,
  }),
  pausedGoal: createMockGoal({
    id: 'paused-1',
    name: 'Paused Goal',
    status: 'PAUSED',
  }),
};

// Format currency helper for tests
export const formatTestCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
};

// Calculate goal progress
export const calculateProgress = (goal: Goal): number => {
  if (goal.targetAmount === 0) return 0;
  return Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
};

// Calculate days remaining
export const calculateDaysRemaining = (dueDate: string): number => {
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Mock API responses
export const mockApiResponses = {
  success: (data: any) => ({
    ok: true,
    json: async () => data,
    status: 200,
  }),
  error: (status: number, message: string) => ({
    ok: false,
    json: async () => ({ error: message }),
    status,
  }),
  networkError: () => {
    throw new Error('Network error');
  },
};

// Wait for async updates
export const waitForAsync = (ms: number = 100): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Mock localStorage for tests
export class MockLocalStorage {
  private store: { [key: string]: string } = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value.toString();
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

// Test categories
export const goalCategories = [
  'Savings',
  'Investment',
  'Debt',
  'Purchase',
  'Education',
  'Travel',
  'Other',
];

// Accessibility test helpers
export const a11yHelpers = {
  // Check if element is focusable
  isFocusable: (element: HTMLElement): boolean => {
    const focusableElements = [
      'button',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];

    return focusableElements.some((selector) => element.matches(selector));
  },

  // Get all focusable elements in container
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    const selector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return Array.from(container.querySelectorAll(selector));
  },

  // Check if element has required ARIA attributes
  hasRequiredAria: (element: HTMLElement, attributes: string[]): boolean => {
    return attributes.every((attr) => element.hasAttribute(attr));
  },
};

// Date test helpers
export const dateHelpers = {
  // Format date for input
  formatForInput: (date: Date): string => {
    return date.toISOString().split('T')[0];
  },

  // Add days to date
  addDays: (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  // Get future date
  getFutureDate: (days: number): string => {
    return dateHelpers.addDays(new Date(), days).toISOString();
  },

  // Get past date
  getPastDate: (days: number): string => {
    return dateHelpers.addDays(new Date(), -days).toISOString();
  },
};

// Form test helpers
export const formHelpers = {
  // Fill goal form
  fillGoalForm: async (
    getByLabelText: (text: string | RegExp) => HTMLElement,
    values: Partial<{
      name: string;
      targetAmount: string;
      currentAmount: string;
      dueDate: string;
      category: string;
      description: string;
    }>,
  ) => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    if (values.name) {
      const input = getByLabelText(/Goal Name/);
      await user.clear(input);
      await user.type(input, values.name);
    }

    if (values.targetAmount) {
      const input = getByLabelText(/Target Amount/);
      await user.clear(input);
      await user.type(input, values.targetAmount);
    }

    if (values.currentAmount) {
      const input = getByLabelText(/Current Amount/);
      await user.clear(input);
      await user.type(input, values.currentAmount);
    }

    if (values.dueDate) {
      const input = getByLabelText(/Target Date/);
      await user.clear(input);
      await user.type(input, values.dueDate);
    }

    if (values.category) {
      await user.selectOptions(getByLabelText(/Category/), values.category);
    }

    if (values.description) {
      await user.type(getByLabelText(/Description/), values.description);
    }
  },
};
