import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../Dashboard';
import { useFinancialSummary } from '@/hooks/useFinancialSummary';
import { useAccountBalances } from '@/hooks/useAccountBalances';
import { useRecentTransactions } from '@/hooks/useRecentTransactions';
import { useActiveGoals } from '@/hooks/useActiveGoals';
import { useInsights } from '@/hooks/useInsights';

// Mock dependencies
jest.mock('@/hooks/useFinancialSummary');
jest.mock('@/hooks/useAccountBalances');
jest.mock('@/hooks/useRecentTransactions');
jest.mock('@/hooks/useActiveGoals');
jest.mock('@/hooks/useInsights');
jest.mock('@/lib/monitoring/performance', () => ({
  PerformanceMonitor: {
    measureAsync: jest.fn((name, fn) => fn()),
  },
}));

const mockFinancialData = {
  netBalance: 15000,
  totalIncome: 5000,
  totalExpenses: 3000,
  netCashFlow: 2000,
  incomeChange: 10,
  expenseChange: -5,
  cashFlowChange: 15,
  period: 'month',
};

const mockAccountBalances = [
  {
    id: '1',
    name: 'Checking Account',
    balance: 10000,
    type: 'CHECKING',
    institution: 'Test Bank',
  },
  {
    id: '2',
    name: 'Savings Account',
    balance: 5000,
    type: 'SAVINGS',
    institution: 'Test Bank',
  },
];

const mockTransactions = [
  {
    id: '1',
    description: 'Grocery Store',
    amount: -150,
    date: new Date('2024-01-10'),
    category: 'Food & Dining',
    type: 'EXPENSE',
  },
  {
    id: '2',
    description: 'Salary',
    amount: 5000,
    date: new Date('2024-01-01'),
    category: 'Income',
    type: 'INCOME',
  },
];

const mockGoals = [
  {
    id: '1',
    name: 'Emergency Fund',
    targetAmount: 10000,
    currentAmount: 5000,
    progress: 50,
    daysRemaining: 90,
  },
];

const mockInsights = [
  {
    id: '1',
    title: 'Spending Alert',
    message: 'Your dining expenses increased by 25% this month',
    type: 'warning',
    priority: 'HIGH',
  },
];

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (useFinancialSummary as jest.Mock).mockReturnValue({
      data: mockFinancialData,
      loading: false,
      error: null,
    });
    
    (useAccountBalances as jest.Mock).mockReturnValue({
      data: mockAccountBalances,
      loading: false,
      error: null,
    });
    
    (useRecentTransactions as jest.Mock).mockReturnValue({
      data: mockTransactions,
      loading: false,
      error: null,
    });
    
    (useActiveGoals as jest.Mock).mockReturnValue({
      data: mockGoals,
      loading: false,
      error: null,
    });
    
    (useInsights as jest.Mock).mockReturnValue({
      data: mockInsights,
      loading: false,
      error: null,
    });
  });

  it('renders dashboard header correctly', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Financial Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('displays financial summary cards', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Net Balance')).toBeInTheDocument();
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();
    
    expect(screen.getByText('Total Income')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    expect(screen.getByText('+10.0%')).toBeInTheDocument();
    
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('$3,000.00')).toBeInTheDocument();
    expect(screen.getByText('-5.0%')).toBeInTheDocument();
  });

  it('displays account balances', () => {
    render(<Dashboard />);
    
    const accountsSection = screen.getByTestId('accounts-section');
    expect(within(accountsSection).getByText('Bank Accounts')).toBeInTheDocument();
    expect(within(accountsSection).getByText('Checking Account')).toBeInTheDocument();
    expect(within(accountsSection).getByText('$10,000.00')).toBeInTheDocument();
    expect(within(accountsSection).getByText('Savings Account')).toBeInTheDocument();
    expect(within(accountsSection).getByText('$5,000.00')).toBeInTheDocument();
  });

  it('displays recent transactions', () => {
    render(<Dashboard />);
    
    const transactionsSection = screen.getByTestId('transactions-section');
    expect(within(transactionsSection).getByText('Recent Transactions')).toBeInTheDocument();
    expect(within(transactionsSection).getByText('Grocery Store')).toBeInTheDocument();
    expect(within(transactionsSection).getByText('-$150.00')).toBeInTheDocument();
    expect(within(transactionsSection).getByText('Salary')).toBeInTheDocument();
    expect(within(transactionsSection).getByText('+$5,000.00')).toBeInTheDocument();
  });

  it('displays active goals', () => {
    render(<Dashboard />);
    
    const goalsSection = screen.getByTestId('goals-section');
    expect(within(goalsSection).getByText('Active Goals')).toBeInTheDocument();
    expect(within(goalsSection).getByText('Emergency Fund')).toBeInTheDocument();
    expect(within(goalsSection).getByText('50%')).toBeInTheDocument();
    expect(within(goalsSection).getByText('90 days remaining')).toBeInTheDocument();
  });

  it('displays insights', () => {
    render(<Dashboard />);
    
    const insightsSection = screen.getByTestId('insights-section');
    expect(within(insightsSection).getByText('AI Insights')).toBeInTheDocument();
    expect(within(insightsSection).getByText('Spending Alert')).toBeInTheDocument();
    expect(within(insightsSection).getByText(/dining expenses increased/i)).toBeInTheDocument();
  });

  it('handles loading states', () => {
    (useFinancialSummary as jest.Mock).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    
    render(<Dashboard />);
    
    expect(screen.getAllByTestId('skeleton-loader')).toHaveLength(4); // 4 summary cards
  });

  it('handles error states', () => {
    (useFinancialSummary as jest.Mock).mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to fetch data',
    });
    
    render(<Dashboard />);
    
    expect(screen.getByText(/error loading financial data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('handles empty states', () => {
    (useRecentTransactions as jest.Mock).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    });
    
    (useActiveGoals as jest.Mock).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    });
    
    render(<Dashboard />);
    
    expect(screen.getByText(/no recent transactions/i)).toBeInTheDocument();
    expect(screen.getByText(/no active goals/i)).toBeInTheDocument();
  });

  it('handles period change', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const periodSelector = screen.getByRole('combobox', { name: /period/i });
    await user.selectOptions(periodSelector, 'week');
    
    await waitFor(() => {
      expect(useFinancialSummary).toHaveBeenCalledWith({ period: 'week' });
    });
  });

  it('navigates to view all pages', async () => {
    const user = userEvent.setup();
    render(<Dashboard />);
    
    const viewAllButtons = screen.getAllByText(/view all/i);
    expect(viewAllButtons).toHaveLength(4); // transactions, accounts, goals, insights
    
    // Test navigation functionality would require router mocking
  });

  it('refreshes data on pull to refresh', async () => {
    const user = userEvent.setup();
    const mockRefresh = jest.fn();
    
    (useFinancialSummary as jest.Mock).mockReturnValue({
      data: mockFinancialData,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });
    
    render(<Dashboard />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);
    
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('displays correct formatting for negative values', () => {
    (useFinancialSummary as jest.Mock).mockReturnValue({
      data: {
        ...mockFinancialData,
        netCashFlow: -1000,
        cashFlowChange: -20,
      },
      loading: false,
      error: null,
    });
    
    render(<Dashboard />);
    
    expect(screen.getByText('-$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('-20.0%')).toBeInTheDocument();
  });
});