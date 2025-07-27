import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSummary from '../AccountSummary';
import { renderWithProviders } from '@/tests/utils/test-utils';

// Mock API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockAccounts = [
  {
    id: 'acc-1',
    accountNumber: '12345678',
    accountName: 'Everyday Account',
    balance: 2500.5,
    available: 2500.5,
    currency: 'AUD',
    type: 'TRANSACTION',
    institution: 'Commonwealth Bank',
    lastUpdated: '2024-01-15T10:00:00Z',
  },
  {
    id: 'acc-2',
    accountNumber: '87654321',
    accountName: 'Savings Account',
    balance: 15000.0,
    available: 15000.0,
    currency: 'AUD',
    type: 'SAVINGS',
    institution: 'Commonwealth Bank',
    lastUpdated: '2024-01-15T10:00:00Z',
  },
];

describe('AccountSummary Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    renderWithProviders(<AccountSummary />);

    expect(screen.getByText(/loading accounts/i)).toBeInTheDocument();
  });

  it('renders accounts list after loading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    renderWithProviders(<AccountSummary />);

    await waitFor(() => {
      expect(screen.getByText('Everyday Account')).toBeInTheDocument();
      expect(screen.getByText('Savings Account')).toBeInTheDocument();
      expect(screen.getByText('$2,500.50')).toBeInTheDocument();
      expect(screen.getByText('$15,000.00')).toBeInTheDocument();
    });
  });

  it('displays total balance', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    renderWithProviders(<AccountSummary />);

    await waitFor(() => {
      expect(screen.getByText('Total Balance')).toBeInTheDocument();
      expect(screen.getByText('$17,500.50')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to fetch accounts' }),
    });

    renderWithProviders(<AccountSummary />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load accounts/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('allows retry on error', async () => {
    // First call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Network error' }),
    });

    renderWithProviders(<AccountSummary />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText(/failed to load accounts/i)).toBeInTheDocument();
    });

    // Second call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Everyday Account')).toBeInTheDocument();
    });
  });

  it('handles empty accounts list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: [] }),
    });

    renderWithProviders(<AccountSummary />);

    await waitFor(() => {
      expect(screen.getByText(/no accounts connected/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /connect account/i })).toBeInTheDocument();
    });
  });

  it('refreshes account data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    renderWithProviders(<AccountSummary />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Everyday Account')).toBeInTheDocument();
    });

    // Mock updated data
    const updatedAccounts = [
      { ...mockAccounts[0], balance: 3000.0 },
      { ...mockAccounts[1], balance: 16000.0 },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: updatedAccounts }),
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('$3,000.00')).toBeInTheDocument();
      expect(screen.getByText('$16,000.00')).toBeInTheDocument();
    });
  });

  it('filters accounts by type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    renderWithProviders(<AccountSummary />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Everyday Account')).toBeInTheDocument();
      expect(screen.getByText('Savings Account')).toBeInTheDocument();
    });

    // Filter to show only savings accounts
    const filterSelect = screen.getByRole('combobox', { name: /account type/i });
    await user.selectOptions(filterSelect, 'SAVINGS');

    expect(screen.queryByText('Everyday Account')).not.toBeInTheDocument();
    expect(screen.getByText('Savings Account')).toBeInTheDocument();
  });

  it('displays account institution logos', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    renderWithProviders(<AccountSummary />);

    await waitFor(() => {
      const logos = screen.getAllByAltText(/commonwealth bank/i);
      expect(logos).toHaveLength(2);
    });
  });

  it('shows last updated time', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    renderWithProviders(<AccountSummary />);

    await waitFor(() => {
      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      expect(screen.getByText(/15 Jan 2024/i)).toBeInTheDocument();
    });
  });

  it('handles account click for details', async () => {
    const mockOnAccountClick = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: mockAccounts }),
    });

    renderWithProviders(<AccountSummary onAccountClick={mockOnAccountClick} />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Everyday Account')).toBeInTheDocument();
    });

    const accountCard = screen.getByText('Everyday Account').closest('div[role="button"]');
    await user.click(accountCard!);

    expect(mockOnAccountClick).toHaveBeenCalledWith(mockAccounts[0]);
  });

  it('shows connection status', async () => {
    const accountsWithStatus = mockAccounts.map((acc) => ({
      ...acc,
      connectionStatus: 'ACTIVE' as const,
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accounts: accountsWithStatus }),
    });

    renderWithProviders(<AccountSummary />);

    await waitFor(() => {
      const statusIndicators = screen.getAllByText(/active/i);
      expect(statusIndicators).toHaveLength(2);
    });
  });

  it('handles permission denied error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Permission denied' }),
    });

    renderWithProviders(<AccountSummary />);

    await waitFor(() => {
      expect(screen.getByText(/reconnect your bank account/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
    });
  });
});
