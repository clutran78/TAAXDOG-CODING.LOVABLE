import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoalDashboardCard from '../GoalDashboardCard';
import { renderWithProviders } from '@/tests/utils/test-utils';

// Mock child components
jest.mock('../UpdateProgress', () => ({
  __esModule: true,
  default: ({ goal, onUpdate, onClose }: any) => (
    <div data-testid="update-progress-modal">
      <button onClick={() => onUpdate({ ...goal, currentAmount: goal.currentAmount + 100 })}>
        Update Progress
      </button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

jest.mock('../SubaccountDetailsModal', () => ({
  __esModule: true,
  default: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="subaccount-details-modal">
        <button onClick={onClose}>Close Details</button>
      </div>
    ) : null,
}));

const mockGoal = {
  id: 'goal-1',
  name: 'Emergency Fund',
  targetAmount: 10000,
  currentAmount: 2500,
  targetDate: '2025-12-31',
  description: 'Build emergency savings',
  status: 'ACTIVE' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  userId: 'user-1',
};

describe('GoalDashboardCard Component', () => {
  const mockOnUpdate = jest.fn();
  const mockOnDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders goal information correctly', () => {
    renderWithProviders(
      <GoalDashboardCard
        goal={mockGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
    expect(screen.getByText('Build emergency savings')).toBeInTheDocument();
    expect(screen.getByText('$2,500')).toBeInTheDocument();
    expect(screen.getByText('$10,000')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('displays correct progress bar width', () => {
    renderWithProviders(
      <GoalDashboardCard
        goal={mockGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '25');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('shows achievement status for completed goals', () => {
    const completedGoal = {
      ...mockGoal,
      currentAmount: 10000,
      status: 'COMPLETED' as const,
    };

    renderWithProviders(
      <GoalDashboardCard
        goal={completedGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText('Goal Achieved!')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('opens update progress modal when clicked', async () => {
    renderWithProviders(
      <GoalDashboardCard
        goal={mockGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );
    const user = userEvent.setup();

    const updateButton = screen.getByRole('button', { name: /update progress/i });
    await user.click(updateButton);

    expect(screen.getByTestId('update-progress-modal')).toBeInTheDocument();
  });

  it('handles progress update', async () => {
    renderWithProviders(
      <GoalDashboardCard
        goal={mockGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );
    const user = userEvent.setup();

    // Open modal
    const updateButton = screen.getByRole('button', { name: /update progress/i });
    await user.click(updateButton);

    // Update progress
    const updateInModalButton = screen.getByText('Update Progress');
    await user.click(updateInModalButton);

    expect(mockOnUpdate).toHaveBeenCalledWith({
      ...mockGoal,
      currentAmount: 2600,
    });
  });

  it('opens subaccount details modal', async () => {
    renderWithProviders(
      <GoalDashboardCard
        goal={mockGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );
    const user = userEvent.setup();

    const detailsButton = screen.getByRole('button', { name: /view details/i });
    await user.click(detailsButton);

    expect(screen.getByTestId('subaccount-details-modal')).toBeInTheDocument();
  });

  it('shows delete confirmation dialog', async () => {
    renderWithProviders(
      <GoalDashboardCard
        goal={mockGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );
    const user = userEvent.setup();

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(screen.getByText(/are you sure you want to delete this goal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('handles goal deletion', async () => {
    global.confirm = jest.fn(() => true);

    renderWithProviders(
      <GoalDashboardCard
        goal={mockGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );
    const user = userEvent.setup();

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('goal-1');
  });

  it('cancels deletion when user declines', async () => {
    global.confirm = jest.fn(() => false);

    renderWithProviders(
      <GoalDashboardCard
        goal={mockGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );
    const user = userEvent.setup();

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('calculates days remaining correctly', () => {
    const futureGoal = {
      ...mockGoal,
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    };

    renderWithProviders(
      <GoalDashboardCard
        goal={futureGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText(/30 days remaining/i)).toBeInTheDocument();
  });

  it('shows overdue status for past target dates', () => {
    const overdueGoal = {
      ...mockGoal,
      targetDate: '2023-01-01',
      status: 'ACTIVE' as const,
    };

    renderWithProviders(
      <GoalDashboardCard
        goal={overdueGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it('disables update button for completed goals', () => {
    const completedGoal = {
      ...mockGoal,
      currentAmount: 10000,
      status: 'COMPLETED' as const,
    };

    renderWithProviders(
      <GoalDashboardCard
        goal={completedGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );

    const updateButton = screen.getByRole('button', { name: /update progress/i });
    expect(updateButton).toBeDisabled();
  });

  it('shows monthly contribution suggestion', () => {
    renderWithProviders(
      <GoalDashboardCard
        goal={mockGoal}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );

    // Should calculate (10000 - 2500) / months remaining
    expect(screen.getByText(/suggested monthly: \$/i)).toBeInTheDocument();
  });
});
