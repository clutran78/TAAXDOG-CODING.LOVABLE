import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../Dashboard';
import { renderWithProviders } from '@/tests/utils/test-utils';

// Mock child components
jest.mock('../GridBoxes', () => ({
  __esModule: true,
  default: () => <div data-testid="grid-boxes">Grid Boxes</div>,
}));

jest.mock('../net-income', () => ({
  __esModule: true,
  default: () => <div data-testid="net-income">Net Income</div>,
}));

jest.mock('../total-expenses', () => ({
  __esModule: true,
  default: () => <div data-testid="total-expenses">Total Expenses</div>,
}));

// Mock API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockDashboardData = {
  user: {
    name: 'John Doe',
    email: 'john@example.com',
    subscription: {
      plan: 'TAAX_PRO',
      status: 'ACTIVE',
    },
  },
  summary: {
    totalBalance: 25000.5,
    monthlyIncome: 8500.0,
    monthlyExpenses: 4200.0,
    netSavings: 4300.0,
    savingsRate: 50.59,
  },
  recentTransactions: [
    {
      id: 'txn-1',
      description: 'Salary Payment',
      amount: 4250.0,
      date: '2024-01-15',
      category: 'INCOME',
    },
    {
      id: 'txn-2',
      description: 'Woolworths',
      amount: -156.78,
      date: '2024-01-14',
      category: 'GROCERIES',
    },
  ],
  goals: [
    {
      id: 'goal-1',
      name: 'Emergency Fund',
      targetAmount: 10000,
      currentAmount: 7500,
      progress: 75,
    },
  ],
  insights: [
    {
      id: 'insight-1',
      type: 'SAVINGS',
      message: 'You saved 15% more than last month!',
      priority: 'HIGH',
    },
  ],
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with user greeting', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/welcome back, john/i)).toBeInTheDocument();
    });
  });

  it('displays financial summary cards', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Balance')).toBeInTheDocument();
      expect(screen.getByText('$25,000.50')).toBeInTheDocument();
      expect(screen.getByText('Monthly Income')).toBeInTheDocument();
      expect(screen.getByText('$8,500.00')).toBeInTheDocument();
      expect(screen.getByText('Monthly Expenses')).toBeInTheDocument();
      expect(screen.getByText('$4,200.00')).toBeInTheDocument();
      expect(screen.getByText('Savings Rate')).toBeInTheDocument();
      expect(screen.getByText('50.59%')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    renderWithProviders(<Dashboard />);

    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('displays recent transactions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
      expect(screen.getByText('Salary Payment')).toBeInTheDocument();
      expect(screen.getByText('+$4,250.00')).toBeInTheDocument();
      expect(screen.getByText('Woolworths')).toBeInTheDocument();
      expect(screen.getByText('-$156.78')).toBeInTheDocument();
    });
  });

  it('shows goals progress', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Your Goals')).toBeInTheDocument();
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('$7,500 of $10,000')).toBeInTheDocument();
    });
  });

  it('displays insights and recommendations', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Insights')).toBeInTheDocument();
      expect(screen.getByText('You saved 15% more than last month!')).toBeInTheDocument();
    });
  });

  it('shows subscription status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('TAAX Pro')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('handles empty data states', async () => {
    const emptyData = {
      ...mockDashboardData,
      recentTransactions: [],
      goals: [],
      insights: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => emptyData,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/no recent transactions/i)).toBeInTheDocument();
      expect(screen.getByText(/no active goals/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create your first goal/i })).toBeInTheDocument();
    });
  });

  it('refreshes dashboard data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('$25,000.50')).toBeInTheDocument();
    });

    // Mock updated data
    const updatedData = {
      ...mockDashboardData,
      summary: {
        ...mockDashboardData.summary,
        totalBalance: 26000.0,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => updatedData,
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('$26,000.00')).toBeInTheDocument();
    });
  });

  it('navigates to detailed views', async () => {
    const mockRouter = { push: jest.fn() };
    jest.mocked(require('next/router').useRouter).mockReturnValue(mockRouter);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    });

    const viewAllTransactionsLink = screen.getByRole('link', { name: /view all transactions/i });
    await user.click(viewAllTransactionsLink);

    expect(mockRouter.push).toHaveBeenCalledWith('/transactions');
  });

  it('shows quick actions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add income/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload receipt/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create goal/i })).toBeInTheDocument();
    });
  });

  it('displays spending breakdown chart', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Spending Breakdown')).toBeInTheDocument();
      expect(screen.getByTestId('spending-chart')).toBeInTheDocument();
    });
  });

  it('shows tax savings opportunities', async () => {
    const dataWithTaxInfo = {
      ...mockDashboardData,
      taxInfo: {
        estimatedRefund: 2500.0,
        deductibleExpenses: 1200.0,
        suggestions: ['Consider salary sacrificing to super', 'Track work-related expenses'],
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => dataWithTaxInfo,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Tax Insights')).toBeInTheDocument();
      expect(screen.getByText('Estimated Refund: $2,500.00')).toBeInTheDocument();
      expect(screen.getByText('Consider salary sacrificing to super')).toBeInTheDocument();
    });
  });

  it('handles real-time updates via websocket', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    // Mock WebSocket
    const mockWebSocket = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn(),
    };
    global.WebSocket = jest.fn(() => mockWebSocket) as any;

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('$25,000.50')).toBeInTheDocument();
    });

    // Simulate WebSocket message
    const messageHandler = mockWebSocket.addEventListener.mock.calls.find(
      (call) => call[0] === 'message',
    )?.[1];

    messageHandler?.({
      data: JSON.stringify({
        type: 'BALANCE_UPDATE',
        data: { totalBalance: 25500.0 },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('$25,500.00')).toBeInTheDocument();
    });
  });
});
