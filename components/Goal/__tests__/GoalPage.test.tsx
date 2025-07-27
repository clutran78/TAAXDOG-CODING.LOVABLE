import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoalPage from '../GoalPage';
import { fetchGoals, deleteGoal } from '@/lib/services/goals/client-goal-service';
import { showToast } from '@/lib/utils/helpers';
import { Goal } from '@/lib/types/goal';

// Mock dependencies
jest.mock('@/lib/services/goals/client-goal-service');
jest.mock('@/lib/utils/helpers');
jest.mock('@/providers/dark-mode-provider', () => ({
  useDarkMode: () => ({ darkMode: false }),
}));

const mockGoals: Goal[] = [
  {
    id: '1',
    name: 'Emergency Fund',
    description: 'Save for emergencies',
    targetAmount: 10000,
    currentAmount: 5000,
    deadline: new Date('2024-12-31'),
    status: 'ACTIVE',
    priority: 'HIGH',
    category: 'SAVINGS',
    userId: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'Vacation Fund',
    description: 'Trip to Europe',
    targetAmount: 5000,
    currentAmount: 1000,
    deadline: new Date('2024-08-31'),
    status: 'ACTIVE',
    priority: 'MEDIUM',
    category: 'TRAVEL',
    userId: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

describe('GoalPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchGoals as jest.Mock).mockResolvedValue(mockGoals);
  });

  it('renders loading state initially', () => {
    render(<GoalPage />);
    
    expect(screen.getByText(/loading your financial goals/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders goals after loading', async () => {
    render(<GoalPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
    });
    
    expect(screen.getByText(/your active goals \(2\)/i)).toBeInTheDocument();
  });

  it('displays overall progress correctly', async () => {
    render(<GoalPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Overall Progress')).toBeInTheDocument();
    });
    
    // Total saved: 6000, Total target: 15000, Progress: 40%
    expect(screen.getByText('40.0%')).toBeInTheDocument();
    expect(screen.getByText(/total saved: \$6,000/i)).toBeInTheDocument();
    expect(screen.getByText(/target: \$15,000/i)).toBeInTheDocument();
  });

  it('handles goal creation', async () => {
    const user = userEvent.setup();
    render(<GoalPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
    });
    
    const addButton = screen.getByRole('button', { name: /add goal/i });
    await user.click(addButton);
    
    // Modal should open (mocked component)
    expect(screen.getByTestId('add-goal-form')).toBeInTheDocument();
  });

  it('handles goal editing', async () => {
    const user = userEvent.setup();
    render(<GoalPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
    });
    
    const editButton = screen.getAllByLabelText(/edit goal/i)[0];
    await user.click(editButton);
    
    // Modal should open with goal data
    expect(screen.getByTestId('add-goal-form')).toBeInTheDocument();
  });

  it('handles goal deletion', async () => {
    const user = userEvent.setup();
    (deleteGoal as jest.Mock).mockResolvedValue(undefined);
    (fetchGoals as jest.Mock)
      .mockResolvedValueOnce(mockGoals)
      .mockResolvedValueOnce([mockGoals[1]]); // After deletion
    
    render(<GoalPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
    });
    
    const deleteButton = screen.getAllByLabelText(/delete goal/i)[0];
    await user.click(deleteButton);
    
    // Confirm modal should appear
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    
    await waitFor(() => {
      expect(deleteGoal).toHaveBeenCalledWith('1');
      expect(showToast).toHaveBeenCalledWith(
        'Goal "Emergency Fund" deleted successfully.',
        'success'
      );
    });
  });

  it('handles error when fetching goals', async () => {
    (fetchGoals as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    render(<GoalPage />);
    
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Error fetching goals.', 'danger');
    });
  });

  it('handles progress update', async () => {
    const user = userEvent.setup();
    render(<GoalPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
    });
    
    const updateButton = screen.getAllByLabelText(/update progress/i)[0];
    await user.click(updateButton);
    
    // Progress modal should open
    expect(screen.getByTestId('update-progress-modal')).toBeInTheDocument();
  });

  it('displays empty state when no goals', async () => {
    (fetchGoals as jest.Mock).mockResolvedValue([]);
    
    render(<GoalPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/no financial goals set yet/i)).toBeInTheDocument();
      expect(screen.getByText(/click "add goal" to get started/i)).toBeInTheDocument();
    });
  });

  it('sorts goals by progress', async () => {
    render(<GoalPage />);
    
    await waitFor(() => {
      const goalCards = screen.getAllByTestId('goal-card');
      expect(goalCards).toHaveLength(2);
      
      // Vacation Fund (20% progress) should come before Emergency Fund (50% progress)
      expect(goalCards[0]).toHaveTextContent('Vacation Fund');
      expect(goalCards[1]).toHaveTextContent('Emergency Fund');
    });
  });

  it('formats currency correctly', async () => {
    render(<GoalPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/\$5,000\.00 of \$10,000\.00/i)).toBeInTheDocument();
      expect(screen.getByText(/\$1,000\.00 of \$5,000\.00/i)).toBeInTheDocument();
    });
  });
});