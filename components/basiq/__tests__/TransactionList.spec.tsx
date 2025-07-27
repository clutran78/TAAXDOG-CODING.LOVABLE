import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionList from '../TransactionList';
import { renderWithProviders } from '@/tests/utils/test-utils';

// Mock API
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockTransactions = [
  {
    id: 'txn-1',
    accountId: 'acc-1',
    amount: -45.5,
    currency: 'AUD',
    description: 'WOOLWORTHS SYDNEY',
    category: 'GROCERIES',
    transactionDate: '2024-01-15',
    postDate: '2024-01-16',
    status: 'POSTED',
    merchantName: 'Woolworths',
    gstAmount: 4.14,
  },
  {
    id: 'txn-2',
    accountId: 'acc-1',
    amount: -120.0,
    currency: 'AUD',
    description: 'SHELL PETROL STATION',
    category: 'TRANSPORT',
    transactionDate: '2024-01-14',
    postDate: '2024-01-15',
    status: 'POSTED',
    merchantName: 'Shell',
    gstAmount: 10.91,
  },
  {
    id: 'txn-3',
    accountId: 'acc-2',
    amount: 2500.0,
    currency: 'AUD',
    description: 'SALARY PAYMENT',
    category: 'INCOME',
    transactionDate: '2024-01-12',
    postDate: '2024-01-12',
    status: 'POSTED',
    merchantName: 'ACME Corp',
  },
];

describe('TransactionList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders transactions list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 3,
        page: 1,
        pageSize: 20,
      }),
    });

    renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(screen.getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
      expect(screen.getByText('SHELL PETROL STATION')).toBeInTheDocument();
      expect(screen.getByText('SALARY PAYMENT')).toBeInTheDocument();
    });
  });

  it('displays transaction amounts correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 3,
      }),
    });

    renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(screen.getByText('-$45.50')).toBeInTheDocument();
      expect(screen.getByText('-$120.00')).toBeInTheDocument();
      expect(screen.getByText('+$2,500.00')).toBeInTheDocument();
    });
  });

  it('shows GST information for Australian transactions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 3,
      }),
    });

    renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(screen.getByText('GST: $4.14')).toBeInTheDocument();
      expect(screen.getByText('GST: $10.91')).toBeInTheDocument();
    });
  });

  it('filters transactions by category', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 3,
      }),
    });

    renderWithProviders(<TransactionList />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
    });

    // Filter by GROCERIES category
    const categoryFilter = screen.getByRole('combobox', { name: /category/i });
    await user.selectOptions(categoryFilter, 'GROCERIES');

    // Should trigger new API call with filter
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: [mockTransactions[0]],
        totalCount: 1,
      }),
    });

    await waitFor(() => {
      expect(screen.getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
      expect(screen.queryByText('SHELL PETROL STATION')).not.toBeInTheDocument();
      expect(screen.queryByText('SALARY PAYMENT')).not.toBeInTheDocument();
    });
  });

  it('searches transactions by description', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 3,
      }),
    });

    renderWithProviders(<TransactionList />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search transactions/i);
    await user.type(searchInput, 'WOOLWORTHS');

    // Debounced search
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=WOOLWORTHS'),
        expect.any(Object),
      );
    });
  });

  it('handles date range filtering', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 3,
      }),
    });

    renderWithProviders(<TransactionList />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
    });

    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    await user.type(startDateInput, '2024-01-14');
    await user.type(endDateInput, '2024-01-15');

    const applyButton = screen.getByRole('button', { name: /apply/i });
    await user.click(applyButton);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('startDate=2024-01-14&endDate=2024-01-15'),
      expect.any(Object),
    );
  });

  it('handles pagination', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 50,
        page: 1,
        pageSize: 20,
        totalPages: 3,
      }),
    });

    renderWithProviders(<TransactionList />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next page/i });
    await user.click(nextButton);

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('page=2'), expect.any(Object));
  });

  it('exports transactions to CSV', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 3,
      }),
    });

    // Mock CSV download
    const mockCreateElement = jest.spyOn(document, 'createElement');
    const mockClick = jest.fn();
    mockCreateElement.mockReturnValue({ click: mockClick } as any);

    renderWithProviders(<TransactionList />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export csv/i });
    await user.click(exportButton);

    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockClick).toHaveBeenCalled();
  });

  it('categorizes uncategorized transactions', async () => {
    const uncategorizedTxn = {
      ...mockTransactions[0],
      category: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: [uncategorizedTxn],
        totalCount: 1,
      }),
    });

    renderWithProviders(<TransactionList />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
      expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    });

    const categorizeButton = screen.getByRole('button', { name: /categorize/i });
    await user.click(categorizeButton);

    // Should show category selector
    const categorySelect = screen.getByRole('combobox', { name: /select category/i });
    await user.selectOptions(categorySelect, 'GROCERIES');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/transactions/${uncategorizedTxn.id}`),
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('GROCERIES'),
      }),
    );
  });

  it('shows transaction details modal', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 3,
      }),
    });

    renderWithProviders(<TransactionList />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
    });

    const transactionRow = screen.getByText('WOOLWORTHS SYDNEY').closest('tr');
    await user.click(transactionRow!);

    // Modal should appear with transaction details
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText('Transaction Details')).toBeInTheDocument();
    expect(within(modal).getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
    expect(within(modal).getByText('$45.50')).toBeInTheDocument();
    expect(within(modal).getByText('GST: $4.14')).toBeInTheDocument();
  });

  it('handles bulk actions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: mockTransactions,
        totalCount: 3,
      }),
    });

    renderWithProviders(<TransactionList />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('WOOLWORTHS SYDNEY')).toBeInTheDocument();
    });

    // Select multiple transactions
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // First transaction
    await user.click(checkboxes[2]); // Second transaction

    expect(screen.getByText('2 selected')).toBeInTheDocument();

    // Bulk categorize
    const bulkCategorizeButton = screen.getByRole('button', { name: /categorize selected/i });
    await user.click(bulkCategorizeButton);

    const categorySelect = screen.getByRole('combobox', { name: /category for selected/i });
    await user.selectOptions(categorySelect, 'BUSINESS');

    const applyButton = screen.getByRole('button', { name: /apply to selected/i });
    await user.click(applyButton);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/transactions/bulk-update',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('BUSINESS'),
      }),
    );
  });

  it('shows loading skeleton while fetching', () => {
    mockFetch.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    renderWithProviders(<TransactionList />);

    expect(screen.getByTestId('transaction-skeleton')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load transactions/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('shows empty state when no transactions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transactions: [],
        totalCount: 0,
      }),
    });

    renderWithProviders(<TransactionList />);

    await waitFor(() => {
      expect(screen.getByText(/no transactions found/i)).toBeInTheDocument();
      expect(screen.getByText(/try adjusting your filters/i)).toBeInTheDocument();
    });
  });
});
