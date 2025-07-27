import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddGoalForm from '../AddGoalForm';
import { renderWithProviders } from '@/tests/utils/test-utils';

// Mock API call
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('AddGoalForm Component', () => {
  const mockOnClose = jest.fn();
  const mockOnGoalAdded = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form with all fields', () => {
    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );

    expect(screen.getByLabelText(/goal name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/initial amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create goal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );
    const user = userEvent.setup();

    const submitButton = screen.getByRole('button', { name: /create goal/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/goal name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/target amount is required/i)).toBeInTheDocument();
      expect(screen.getByText(/target date is required/i)).toBeInTheDocument();
    });
  });

  it('validates target amount is positive', async () => {
    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );
    const user = userEvent.setup();

    const targetAmountInput = screen.getByLabelText(/target amount/i);
    await user.type(targetAmountInput, '-100');

    const submitButton = screen.getByRole('button', { name: /create goal/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/target amount must be positive/i)).toBeInTheDocument();
    });
  });

  it('validates target date is in the future', async () => {
    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );
    const user = userEvent.setup();

    const targetDateInput = screen.getByLabelText(/target date/i);
    const pastDate = '2020-01-01';
    await user.type(targetDateInput, pastDate);

    const submitButton = screen.getByRole('button', { name: /create goal/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/target date must be in the future/i)).toBeInTheDocument();
    });
  });

  it('successfully creates a goal', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'new-goal-id',
        name: 'New Car',
        targetAmount: 30000,
        currentAmount: 5000,
        targetDate: '2025-12-31',
      }),
    });

    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );
    const user = userEvent.setup();

    // Fill in form
    await user.type(screen.getByLabelText(/goal name/i), 'New Car');
    await user.type(screen.getByLabelText(/description/i), 'Save for a new electric car');
    await user.type(screen.getByLabelText(/target amount/i), '30000');
    await user.type(screen.getByLabelText(/target date/i), '2025-12-31');
    await user.type(screen.getByLabelText(/initial amount/i), '5000');

    const submitButton = screen.getByRole('button', { name: /create goal/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Car',
          description: 'Save for a new electric car',
          targetAmount: 30000,
          targetDate: '2025-12-31',
          initialAmount: 5000,
        }),
      });

      expect(mockOnGoalAdded).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to create goal' }),
    });

    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );
    const user = userEvent.setup();

    // Fill in minimal valid form
    await user.type(screen.getByLabelText(/goal name/i), 'Test Goal');
    await user.type(screen.getByLabelText(/target amount/i), '1000');
    await user.type(screen.getByLabelText(/target date/i), '2025-12-31');

    const submitButton = screen.getByRole('button', { name: /create goal/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to create goal/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ id: 'test' }),
              }),
            100,
          ),
        ),
    );

    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );
    const user = userEvent.setup();

    // Fill in minimal valid form
    await user.type(screen.getByLabelText(/goal name/i), 'Test Goal');
    await user.type(screen.getByLabelText(/target amount/i), '1000');
    await user.type(screen.getByLabelText(/target date/i), '2025-12-31');

    const submitButton = screen.getByRole('button', { name: /create goal/i });
    await user.click(submitButton);

    expect(screen.getByText(/creating goal/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText(/creating goal/i)).not.toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', async () => {
    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );
    const user = userEvent.setup();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('formats currency input correctly', async () => {
    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );
    const user = userEvent.setup();

    const targetAmountInput = screen.getByLabelText(/target amount/i);
    await user.type(targetAmountInput, '1234.56');

    // Check that the input accepts decimal values
    expect(targetAmountInput).toHaveValue(1234.56);
  });

  it('calculates monthly savings suggestion', async () => {
    renderWithProviders(
      <AddGoalForm
        onClose={mockOnClose}
        onGoalAdded={mockOnGoalAdded}
      />,
    );
    const user = userEvent.setup();

    // Set target amount and date
    await user.type(screen.getByLabelText(/target amount/i), '12000');

    // Set date 12 months from now
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 12);
    const dateString = futureDate.toISOString().split('T')[0];
    await user.type(screen.getByLabelText(/target date/i), dateString);

    await waitFor(() => {
      expect(screen.getByText(/suggested monthly savings: \$1,000/i)).toBeInTheDocument();
    });
  });
});
