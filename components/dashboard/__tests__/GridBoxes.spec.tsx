import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GridBoxes from '../GridBoxes';
import { renderWithProviders } from '@/tests/utils/test-utils';

const mockData = {
  income: {
    current: 8500.0,
    previous: 8000.0,
    change: 6.25,
    trend: 'up' as const,
  },
  expenses: {
    current: 4200.0,
    previous: 4500.0,
    change: -6.67,
    trend: 'down' as const,
  },
  savings: {
    current: 4300.0,
    previous: 3500.0,
    change: 22.86,
    trend: 'up' as const,
  },
  investments: {
    current: 15000.0,
    previous: 14000.0,
    change: 7.14,
    trend: 'up' as const,
  },
};

describe('GridBoxes Component', () => {
  it('renders all metric boxes', () => {
    renderWithProviders(<GridBoxes data={mockData} />);

    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();
    expect(screen.getByText('Investments')).toBeInTheDocument();
  });

  it('displays current values correctly', () => {
    renderWithProviders(<GridBoxes data={mockData} />);

    expect(screen.getByText('$8,500.00')).toBeInTheDocument();
    expect(screen.getByText('$4,200.00')).toBeInTheDocument();
    expect(screen.getByText('$4,300.00')).toBeInTheDocument();
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();
  });

  it('shows percentage changes with correct colors', () => {
    renderWithProviders(<GridBoxes data={mockData} />);

    // Positive changes (green)
    const incomeChange = screen.getByText('+6.25%');
    expect(incomeChange).toHaveClass('text-green-600');

    const savingsChange = screen.getByText('+22.86%');
    expect(savingsChange).toHaveClass('text-green-600');

    // Negative change (red for expenses is good)
    const expensesChange = screen.getByText('-6.67%');
    expect(expensesChange).toHaveClass('text-green-600'); // Lower expenses is positive
  });

  it('displays trend indicators', () => {
    renderWithProviders(<GridBoxes data={mockData} />);

    const upArrows = screen.getAllByTestId('trend-up');
    expect(upArrows).toHaveLength(3); // Income, Savings, Investments

    const downArrows = screen.getAllByTestId('trend-down');
    expect(downArrows).toHaveLength(1); // Expenses
  });

  it('handles missing data gracefully', () => {
    const partialData = {
      income: mockData.income,
      expenses: mockData.expenses,
      // Missing savings and investments
    };

    renderWithProviders(<GridBoxes data={partialData as any} />);

    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument(); // Default for missing data
  });

  it('shows comparison period selector', async () => {
    const onPeriodChange = jest.fn();
    renderWithProviders(
      <GridBoxes
        data={mockData}
        onPeriodChange={onPeriodChange}
      />,
    );
    const user = userEvent.setup();

    const periodSelector = screen.getByRole('combobox', { name: /comparison period/i });
    expect(periodSelector).toHaveValue('month');

    await user.selectOptions(periodSelector, 'quarter');
    expect(onPeriodChange).toHaveBeenCalledWith('quarter');
  });

  it('displays tooltips on hover', async () => {
    renderWithProviders(<GridBoxes data={mockData} />);
    const user = userEvent.setup();

    const incomeBox = screen.getByText('Income').closest('.metric-box');
    const infoIcon = incomeBox?.querySelector('[data-testid="info-icon"]');

    await user.hover(infoIcon!);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText(/compared to last month/i)).toBeInTheDocument();
    });
  });

  it('handles click events on boxes', async () => {
    const onBoxClick = jest.fn();
    renderWithProviders(
      <GridBoxes
        data={mockData}
        onBoxClick={onBoxClick}
      />,
    );
    const user = userEvent.setup();

    const incomeBox = screen.getByText('Income').closest('.metric-box');
    await user.click(incomeBox!);

    expect(onBoxClick).toHaveBeenCalledWith('income');
  });

  it('shows loading state', () => {
    renderWithProviders(<GridBoxes loading />);

    const skeletons = screen.getAllByTestId('metric-skeleton');
    expect(skeletons).toHaveLength(4);
  });

  it('animates value changes', async () => {
    const { rerender } = renderWithProviders(<GridBoxes data={mockData} />);

    expect(screen.getByText('$8,500.00')).toBeInTheDocument();

    const updatedData = {
      ...mockData,
      income: {
        ...mockData.income,
        current: 9000.0,
      },
    };

    rerender(<GridBoxes data={updatedData} />);

    // Should animate from 8500 to 9000
    await waitFor(() => {
      expect(screen.getByText('$9,000.00')).toBeInTheDocument();
    });
  });

  it('formats large numbers appropriately', () => {
    const largeData = {
      income: {
        current: 1500000.0,
        previous: 1400000.0,
        change: 7.14,
        trend: 'up' as const,
      },
      expenses: mockData.expenses,
      savings: mockData.savings,
      investments: mockData.investments,
    };

    renderWithProviders(<GridBoxes data={largeData} />);

    expect(screen.getByText('$1.5M')).toBeInTheDocument();
  });

  it('highlights significant changes', () => {
    const significantData = {
      income: {
        current: 8500.0,
        previous: 5000.0,
        change: 70.0, // 70% increase
        trend: 'up' as const,
      },
      expenses: mockData.expenses,
      savings: mockData.savings,
      investments: mockData.investments,
    };

    renderWithProviders(<GridBoxes data={significantData} />);

    const significantChange = screen.getByText('+70.00%');
    expect(significantChange).toHaveClass('font-bold');
    expect(significantChange.parentElement).toHaveClass('animate-pulse');
  });

  it('shows currency selector for international users', async () => {
    const onCurrencyChange = jest.fn();
    renderWithProviders(
      <GridBoxes
        data={mockData}
        showCurrencySelector
        onCurrencyChange={onCurrencyChange}
      />,
    );
    const user = userEvent.setup();

    const currencySelector = screen.getByRole('combobox', { name: /currency/i });
    await user.selectOptions(currencySelector, 'USD');

    expect(onCurrencyChange).toHaveBeenCalledWith('USD');
  });

  it('displays year-to-date summary', () => {
    const dataWithYTD = {
      ...mockData,
      yearToDate: {
        income: 68000.0,
        expenses: 42000.0,
        savings: 26000.0,
        savingsRate: 38.24,
      },
    };

    renderWithProviders(<GridBoxes data={dataWithYTD as any} />);

    expect(screen.getByText('YTD Summary')).toBeInTheDocument();
    expect(screen.getByText('Income: $68,000')).toBeInTheDocument();
    expect(screen.getByText('Savings Rate: 38.24%')).toBeInTheDocument();
  });

  it('shows contextual alerts', () => {
    const dataWithAlerts = {
      ...mockData,
      alerts: [
        {
          type: 'warning',
          message: 'Expenses increased by 15% this month',
        },
        {
          type: 'success',
          message: 'Savings goal achieved!',
        },
      ],
    };

    renderWithProviders(<GridBoxes data={dataWithAlerts as any} />);

    expect(screen.getByText('Expenses increased by 15% this month')).toBeInTheDocument();
    expect(screen.getByText('Savings goal achieved!')).toBeInTheDocument();
  });
});
