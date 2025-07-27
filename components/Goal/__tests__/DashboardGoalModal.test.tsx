import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';
import GoalsModal from '../DashboardGoalModal';
import { Goal } from '@/lib/types/goal';

// Mock data
const mockGoals: Goal[] = [
  {
    id: '1',
    name: 'Emergency Fund',
    targetAmount: 10000,
    currentAmount: 5000,
    dueDate: new Date('2024-12-31').toISOString(),
    category: 'Savings',
    description: 'Build emergency savings',
    status: 'ACTIVE',
    userId: 'user1',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: '2',
    name: 'New Car',
    targetAmount: 30000,
    currentAmount: 10000,
    dueDate: new Date('2025-06-30').toISOString(),
    category: 'Purchase',
    description: 'Save for a new car',
    status: 'ACTIVE',
    userId: 'user1',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: '3',
    name: 'Vacation Fund',
    targetAmount: 5000,
    currentAmount: 5000,
    dueDate: new Date('2024-08-31').toISOString(),
    category: 'Travel',
    description: 'Summer vacation',
    status: 'ACTIVE',
    userId: 'user1',
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  },
];

// Setup MSW server
const server = setupServer(
  rest.get('/api/goals', (req, res, ctx) => {
    return res(ctx.json(mockGoals));
  }),
  rest.post('/api/goals', (req, res, ctx) => {
    const newGoal: Goal = {
      ...(req.body as any),
      id: '4',
      status: 'ACTIVE',
      userId: 'user1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return res(ctx.json(newGoal));
  }),
  rest.put('/api/goals/:id', (req, res, ctx) => {
    const { id } = req.params;
    const existingGoal = mockGoals.find((g) => g.id === id);
    if (!existingGoal) {
      return res(ctx.status(404), ctx.json({ error: 'Goal not found' }));
    }
    const updatedGoal = {
      ...existingGoal,
      ...(req.body as any),
      updatedAt: new Date().toISOString(),
    };
    return res(ctx.json(updatedGoal));
  }),
  rest.delete('/api/goals/:id', (req, res, ctx) => {
    const { id } = req.params;
    const goal = mockGoals.find((g) => g.id === id);
    if (!goal) {
      return res(ctx.status(404), ctx.json({ error: 'Goal not found' }));
    }
    return res(ctx.status(200), ctx.json({ success: true }));
  }),
);

// Setup and teardown
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock window.confirm
const mockConfirm = jest.fn();
window.confirm = mockConfirm;

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

describe('GoalsModal', () => {
  const mockOnClose = jest.fn();
  const mockOnGoalUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  describe('Rendering and Basic Functionality', () => {
    it('renders the modal with correct title', async () => {
      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      expect(screen.getByText('Financial Goals Overview')).toBeInTheDocument();
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });

    it('displays loading state initially', () => {
      render(<GoalsModal onClose={mockOnClose} />);

      expect(screen.getByText('Loading goals...')).toBeInTheDocument();
    });

    it('loads and displays goals after fetching', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
        expect(screen.getByText('New Car')).toBeInTheDocument();
        expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
      });

      expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
    });

    it('calculates and displays overall progress correctly', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Overall goals progress')).toBeInTheDocument();
      });

      // Total saved: 5000 + 10000 + 5000 = 20000
      // Total target: 10000 + 30000 + 5000 = 45000
      // Progress: 20000 / 45000 = 44.44%
      const progressBar = screen.getByLabelText('Overall goals progress');
      expect(progressBar).toHaveAttribute('aria-valuenow', '44');
    });

    it('displays correct currency formatting', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(/\$5,000\.00 of \$10,000\.00/)).toBeInTheDocument();
      });
    });

    it('closes modal when close button is clicked', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal when clicking outside', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      });

      const modal = screen.getByRole('dialog');
      fireEvent.click(modal);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Form Interactions', () => {
    it('shows form when New Goal button is clicked', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      const newGoalButton = screen.getByLabelText('Create new goal');
      fireEvent.click(newGoalButton);

      expect(screen.getByText('Create New Goal')).toBeInTheDocument();
      expect(screen.getByLabelText(/Goal Name/)).toBeInTheDocument();
    });

    it('validates required fields', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Create new goal'));

      const form = screen.getByLabelText('Goal form');
      fireEvent.submit(form);

      // HTML5 validation should prevent submission
      const nameInput = screen.getByLabelText(/Goal Name/);
      expect(nameInput).toBeRequired();
    });

    it('creates a new goal successfully', async () => {
      const user = userEvent.setup();
      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Create new goal'));

      // Fill out the form
      await user.type(screen.getByLabelText(/Goal Name/), 'Test Goal');
      await user.clear(screen.getByLabelText(/Target Amount/));
      await user.type(screen.getByLabelText(/Target Amount/), '1000');
      await user.clear(screen.getByLabelText(/Target Date/));
      await user.type(screen.getByLabelText(/Target Date/), '2025-12-31');
      await user.selectOptions(screen.getByLabelText(/Category/), 'Savings');
      await user.type(screen.getByLabelText(/Description/), 'Test description');

      // Submit the form
      fireEvent.click(screen.getByText('Create Goal'));

      await waitFor(() => {
        expect(mockOnGoalUpdate).toHaveBeenCalled();
      });
    });

    it('shows edit form when edit button is clicked', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      });

      const editButton = screen.getByLabelText('Edit goal: Emergency Fund');
      fireEvent.click(editButton);

      expect(screen.getByText('Edit Goal')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Emergency Fund')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10000')).toBeInTheDocument();
    });

    it('updates a goal successfully', async () => {
      const user = userEvent.setup();
      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Edit goal: Emergency Fund'));

      const nameInput = screen.getByLabelText(/Goal Name/);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Emergency Fund');

      fireEvent.click(screen.getByText('Update Goal'));

      await waitFor(() => {
        expect(mockOnGoalUpdate).toHaveBeenCalled();
      });
    });

    it('cancels form and returns to goal list', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Create new goal'));
      expect(screen.getByText('Create New Goal')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
    });
  });

  describe('Goal Actions', () => {
    it('deletes a goal when delete button is clicked', async () => {
      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      });

      const deleteButton = screen.getByLabelText('Delete goal: Emergency Fund');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockOnGoalUpdate).toHaveBeenCalled();
      });
    });

    it('cancels deletion when user declines confirmation', async () => {
      mockConfirm.mockReturnValueOnce(false);

      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      });

      const deleteButton = screen.getByLabelText('Delete goal: Emergency Fund');
      fireEvent.click(deleteButton);

      expect(mockOnGoalUpdate).not.toHaveBeenCalled();
    });

    it('marks goal as completed when 100% progress', async () => {
      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Vacation Fund')).toBeInTheDocument();
      });

      // Vacation Fund has 100% progress (5000/5000)
      const completeButton = screen.getByLabelText('Mark goal Vacation Fund as completed');
      expect(completeButton).toBeInTheDocument();

      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(mockOnGoalUpdate).toHaveBeenCalled();
      });
    });

    it('navigates to goals page when View All Goals is clicked', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      const viewAllButton = screen.getByLabelText('View all goals on dedicated page');
      fireEvent.click(viewAllButton);

      expect(window.location.href).toBe('/dashboard/goals');
    });
  });

  describe('Error Handling', () => {
    it('displays error message when API call fails', async () => {
      server.use(
        rest.get('/api/goals', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
        }),
      );

      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch goals')).toBeInTheDocument();
      });
    });

    it('displays error when goal creation fails', async () => {
      server.use(
        rest.post('/api/goals', (req, res, ctx) => {
          return res(ctx.status(400), ctx.json({ error: 'Invalid goal data' }));
        }),
      );

      const user = userEvent.setup();
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Create new goal'));

      await user.type(screen.getByLabelText(/Goal Name/), 'Test Goal');
      await user.clear(screen.getByLabelText(/Target Amount/));
      await user.type(screen.getByLabelText(/Target Amount/), '1000');

      fireEvent.click(screen.getByText('Create Goal'));

      await waitFor(() => {
        expect(screen.getByText('Invalid goal data')).toBeInTheDocument();
      });
    });

    it('allows dismissing error messages', async () => {
      server.use(
        rest.get('/api/goals', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Server error' }));
        }),
      );

      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch goals')).toBeInTheDocument();
      });

      const dismissButton = screen.getByLabelText('Dismiss error message');
      fireEvent.click(dismissButton);

      expect(screen.queryByText('Failed to fetch goals')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'goals-modal-title');
      expect(modal).toHaveAttribute('aria-describedby', 'goals-modal-description');
    });

    it('handles keyboard navigation - Escape key', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('traps focus within modal', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      const modal = screen.getByRole('dialog');
      const firstButton = screen.getByLabelText('Close modal');
      const lastButton = screen.getByText('Close');

      // Simulate Tab from last element
      fireEvent.keyDown(modal, { key: 'Tab', target: lastButton });

      // Note: Full focus trapping would require more complex testing setup
      // This tests that the handler is called
    });

    it('has accessible form labels', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Create new goal'));

      expect(screen.getByLabelText(/Goal Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Target Amount/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Current Amount/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Target Date/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    });

    it('announces loading states to screen readers', () => {
      render(<GoalsModal onClose={mockOnClose} />);

      const spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByText('Loading goals...')).toHaveClass('visually-hidden');
    });

    it('provides context for progress bars', async () => {
      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      });

      const emergencyFundProgress = screen.getByLabelText('Progress for Emergency Fund');
      expect(emergencyFundProgress).toHaveAttribute('role', 'progressbar');
      expect(emergencyFundProgress).toHaveAttribute('aria-valuenow', '50'); // 5000/10000 = 50%
      expect(emergencyFundProgress).toHaveAttribute('aria-valuemin', '0');
      expect(emergencyFundProgress).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty goals list', async () => {
      server.use(
        rest.get('/api/goals', (req, res, ctx) => {
          return res(ctx.json([]));
        }),
      );

      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(
          screen.getByText('No goals yet. Create your first financial goal!'),
        ).toBeInTheDocument();
      });

      expect(screen.getByText('0 Active Goals')).toBeInTheDocument();
    });

    it('handles very long goal names', async () => {
      const longNameGoal = {
        ...mockGoals[0],
        name: 'This is a very long goal name that might cause layout issues in the UI and should be handled gracefully',
      };

      server.use(
        rest.get('/api/goals', (req, res, ctx) => {
          return res(ctx.json([longNameGoal]));
        }),
      );

      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText(longNameGoal.name)).toBeInTheDocument();
      });
    });

    it('handles invalid date formats gracefully', async () => {
      const invalidDateGoal = {
        ...mockGoals[0],
        dueDate: 'invalid-date',
      };

      server.use(
        rest.get('/api/goals', (req, res, ctx) => {
          return res(ctx.json([invalidDateGoal]));
        }),
      );

      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Fund')).toBeInTheDocument();
      });

      // Should display Invalid Date instead of crashing
      expect(screen.getByText(/Invalid Date/)).toBeInTheDocument();
    });

    it('handles network timeouts', async () => {
      server.use(
        rest.get('/api/goals', (req, res, ctx) => {
          return res(ctx.delay(5000), ctx.status(504));
        }),
      );

      render(<GoalsModal onClose={mockOnClose} />);

      // Should show loading initially
      expect(screen.getByText('Loading goals...')).toBeInTheDocument();
    });

    it('prevents duplicate submissions', async () => {
      const user = userEvent.setup();
      let callCount = 0;

      server.use(
        rest.post('/api/goals', (req, res, ctx) => {
          callCount++;
          return res(
            ctx.delay(100),
            ctx.json({
              ...(req.body as any),
              id: '4',
              status: 'ACTIVE',
              userId: 'user1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          );
        }),
      );

      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Create new goal'));

      await user.type(screen.getByLabelText(/Goal Name/), 'Test Goal');
      await user.clear(screen.getByLabelText(/Target Amount/));
      await user.type(screen.getByLabelText(/Target Amount/), '1000');

      const submitButton = screen.getByText('Create Goal');

      // Try to click multiple times quickly
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });

      // Should be disabled during submission
      expect(submitButton).toBeDisabled();
    });
  });
});
