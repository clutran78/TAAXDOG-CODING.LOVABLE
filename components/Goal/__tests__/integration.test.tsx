import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import GoalsModal from '../DashboardGoalModal';
import { createMockGoals, dateHelpers, formatTestCurrency } from './test-utils';

/**
 * Integration tests for the DashboardGoalModal component
 * These tests verify complex user flows and interactions
 */

// Setup MSW server with dynamic handlers
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GoalsModal Integration Tests', () => {
  const mockOnClose = jest.fn();
  const mockOnGoalUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Workflows', () => {
    it('completes full goal creation workflow', async () => {
      const user = userEvent.setup();
      const mockGoals = createMockGoals(2);

      server.use(
        rest.get('/api/goals', (req, res, ctx) => res(ctx.json(mockGoals))),
        rest.post('/api/goals', async (req, res, ctx) => {
          const body = await req.json();
          const newGoal = {
            ...body,
            id: 'new-goal-id',
            status: 'ACTIVE',
            userId: 'user1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return res(ctx.json(newGoal));
        }),
      );

      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('2 Active Goals')).toBeInTheDocument();
      });

      // Open form
      await user.click(screen.getByLabelText('Create new goal'));

      // Fill form with valid data
      await user.type(screen.getByLabelText(/Goal Name/), 'Buy a House');
      await user.clear(screen.getByLabelText(/Target Amount/));
      await user.type(screen.getByLabelText(/Target Amount/), '500000');
      await user.clear(screen.getByLabelText(/Current Amount/));
      await user.type(screen.getByLabelText(/Current Amount/), '50000');
      await user.type(
        screen.getByLabelText(/Target Date/),
        dateHelpers.formatForInput(dateHelpers.addDays(new Date(), 730)),
      );
      await user.selectOptions(screen.getByLabelText(/Category/), 'Purchase');
      await user.type(screen.getByLabelText(/Description/), 'Save for house down payment');

      // Submit form
      await user.click(screen.getByText('Create Goal'));

      // Verify success
      await waitFor(() => {
        expect(mockOnGoalUpdate).toHaveBeenCalled();
        expect(screen.queryByText('Create New Goal')).not.toBeInTheDocument();
      });
    });

    it('handles edit-save-edit workflow correctly', async () => {
      const user = userEvent.setup();
      const mockGoals = createMockGoals(1, [
        {
          name: 'Original Goal',
          targetAmount: 1000,
          currentAmount: 500,
        },
      ]);

      let updatedGoal = { ...mockGoals[0] };

      server.use(
        rest.get('/api/goals', (req, res, ctx) => res(ctx.json([updatedGoal]))),
        rest.put('/api/goals/:id', async (req, res, ctx) => {
          const body = await req.json();
          updatedGoal = { ...updatedGoal, ...body, updatedAt: new Date().toISOString() };
          return res(ctx.json(updatedGoal));
        }),
      );

      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      // Wait for load
      await waitFor(() => {
        expect(screen.getByText('Original Goal')).toBeInTheDocument();
      });

      // First edit
      await user.click(screen.getByLabelText('Edit goal: Original Goal'));
      await user.clear(screen.getByLabelText(/Goal Name/));
      await user.type(screen.getByLabelText(/Goal Name/), 'Updated Goal');
      await user.click(screen.getByText('Update Goal'));

      await waitFor(() => {
        expect(mockOnGoalUpdate).toHaveBeenCalledTimes(1);
      });

      // Second edit
      await user.click(screen.getByLabelText('Edit goal: Updated Goal'));
      await user.clear(screen.getByLabelText(/Target Amount/));
      await user.type(screen.getByLabelText(/Target Amount/), '2000');
      await user.click(screen.getByText('Update Goal'));

      await waitFor(() => {
        expect(mockOnGoalUpdate).toHaveBeenCalledTimes(2);
      });
    });

    it('manages multiple goals with different states', async () => {
      const user = userEvent.setup();
      const mockGoals = [
        createMockGoals(1, [
          {
            name: 'Almost Complete',
            targetAmount: 1000,
            currentAmount: 950,
          },
        ])[0],
        createMockGoals(1, [
          {
            name: 'Just Started',
            targetAmount: 5000,
            currentAmount: 100,
          },
        ])[0],
        createMockGoals(1, [
          {
            name: 'Halfway There',
            targetAmount: 2000,
            currentAmount: 1000,
          },
        ])[0],
      ];

      server.use(
        rest.get('/api/goals', (req, res, ctx) => res(ctx.json(mockGoals))),
        rest.put('/api/goals/:id', async (req, res, ctx) => {
          const { id } = req.params;
          const body = await req.json();
          const goal = mockGoals.find((g) => g.id === id);
          return res(ctx.json({ ...goal, ...body }));
        }),
        rest.delete('/api/goals/:id', (req, res, ctx) => res(ctx.json({ success: true }))),
      );

      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      // Check progress calculations
      expect(screen.getByLabelText('Progress for Almost Complete')).toHaveAttribute(
        'aria-valuenow',
        '95',
      );
      expect(screen.getByLabelText('Progress for Just Started')).toHaveAttribute(
        'aria-valuenow',
        '2',
      );
      expect(screen.getByLabelText('Progress for Halfway There')).toHaveAttribute(
        'aria-valuenow',
        '50',
      );

      // Complete the almost complete goal
      await user.click(screen.getByLabelText('Mark goal Almost Complete as completed'));

      await waitFor(() => {
        expect(mockOnGoalUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Error Recovery Flows', () => {
    it('recovers from network errors gracefully', async () => {
      const user = userEvent.setup();
      let attemptCount = 0;

      server.use(
        rest.get('/api/goals', (req, res, ctx) => {
          attemptCount++;
          if (attemptCount === 1) {
            return res(ctx.status(500), ctx.json({ error: 'Network error' }));
          }
          return res(ctx.json(createMockGoals(2)));
        }),
      );

      const { rerender } = render(<GoalsModal onClose={mockOnClose} />);

      // First attempt fails
      await waitFor(() => {
        expect(screen.getByText('Failed to fetch goals')).toBeInTheDocument();
      });

      // Dismiss error
      await user.click(screen.getByLabelText('Dismiss error message'));

      // Rerender to trigger refetch
      rerender(<GoalsModal onClose={mockOnClose} />);

      // Second attempt succeeds
      await waitFor(() => {
        expect(screen.getByText('2 Active Goals')).toBeInTheDocument();
      });
    });

    it('handles validation errors and allows correction', async () => {
      const user = userEvent.setup();
      server.use(
        rest.get('/api/goals', (req, res, ctx) => res(ctx.json([]))),
        rest.post('/api/goals', async (req, res, ctx) => {
          const body = await req.json();

          // Simulate validation error for negative amounts
          if (body.targetAmount < 0) {
            return res(ctx.status(400), ctx.json({ error: 'Target amount must be positive' }));
          }

          return res(
            ctx.json({
              ...body,
              id: 'new-goal',
              status: 'ACTIVE',
              userId: 'user1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          );
        }),
      );

      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('0 Active Goals')).toBeInTheDocument();
      });

      // Open form
      await user.click(screen.getByLabelText('Create new goal'));

      // Submit with invalid data
      await user.type(screen.getByLabelText(/Goal Name/), 'Invalid Goal');
      await user.clear(screen.getByLabelText(/Target Amount/));
      await user.type(screen.getByLabelText(/Target Amount/), '-1000');
      await user.click(screen.getByText('Create Goal'));

      // Check error
      await waitFor(() => {
        expect(screen.getByText('Target amount must be positive')).toBeInTheDocument();
      });

      // Fix the error
      await user.clear(screen.getByLabelText(/Target Amount/));
      await user.type(screen.getByLabelText(/Target Amount/), '1000');

      // Dismiss error first
      await user.click(screen.getByLabelText('Dismiss error message'));

      // Resubmit
      await user.click(screen.getByText('Create Goal'));

      await waitFor(() => {
        expect(mockOnGoalUpdate).toHaveBeenCalled();
        expect(screen.queryByText('Target amount must be positive')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance and Large Data Sets', () => {
    it('handles large number of goals efficiently', async () => {
      const manyGoals = createMockGoals(50);

      server.use(rest.get('/api/goals', (req, res, ctx) => res(ctx.json(manyGoals))));

      const { container } = render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('50 Active Goals')).toBeInTheDocument();
      });

      // Should only display top 3 goals
      const goalElements = container.querySelectorAll('.mb-4.border-bottom');
      expect(goalElements).toHaveLength(3);

      // Should show "View All Goals" button
      expect(screen.getByLabelText('View all goals on dedicated page')).toBeInTheDocument();
    });

    it('updates UI optimistically for better UX', async () => {
      const user = userEvent.setup();
      const mockGoals = createMockGoals(1);

      server.use(
        rest.get('/api/goals', (req, res, ctx) => res(ctx.json(mockGoals))),
        rest.delete('/api/goals/:id', async (req, res, ctx) => {
          // Simulate slow network
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return res(ctx.json({ success: true }));
        }),
      );

      render(
        <GoalsModal
          onClose={mockOnClose}
          onGoalUpdate={mockOnGoalUpdate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Goal 1')).toBeInTheDocument();
      });

      // Delete goal
      await user.click(screen.getByLabelText('Delete goal: Goal 1'));

      // Goal should be removed immediately (optimistic update)
      expect(screen.queryByText('Goal 1')).not.toBeInTheDocument();
      expect(screen.getByText('0 Active Goals')).toBeInTheDocument();

      // Callback should be called after server response
      await waitFor(
        () => {
          expect(mockOnGoalUpdate).toHaveBeenCalled();
        },
        { timeout: 2000 },
      );
    });
  });

  describe('Accessibility in Complex Scenarios', () => {
    it('maintains focus management during dynamic updates', async () => {
      const user = userEvent.setup();
      const mockGoals = createMockGoals(3);

      server.use(
        rest.get('/api/goals', (req, res, ctx) => res(ctx.json(mockGoals))),
        rest.delete('/api/goals/:id', (req, res, ctx) => res(ctx.json({ success: true }))),
      );

      render(<GoalsModal onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByText('3 Active Goals')).toBeInTheDocument();
      });

      // Focus on middle goal's delete button
      const deleteButton = screen.getByLabelText('Delete goal: Goal 2');
      deleteButton.focus();
      expect(document.activeElement).toBe(deleteButton);

      // Delete the goal
      await user.click(deleteButton);

      // Focus should move to a reasonable location
      await waitFor(() => {
        expect(screen.queryByText('Goal 2')).not.toBeInTheDocument();
      });

      // Check that focus is still within the modal
      const modal = screen.getByRole('dialog');
      expect(modal.contains(document.activeElement)).toBe(true);
    });

    it('announces dynamic content changes to screen readers', async () => {
      const user = userEvent.setup();
      const mockGoals = createMockGoals(2);

      server.use(
        rest.get('/api/goals', (req, res, ctx) => res(ctx.json(mockGoals))),
        rest.post('/api/goals', async (req, res, ctx) => {
          const body = await req.json();
          return res(
            ctx.json({
              ...body,
              id: 'new-goal',
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
        const goalCount = screen.getByText('2 Active Goals');
        expect(goalCount).toBeInTheDocument();
        expect(goalCount.parentElement).toHaveAttribute('aria-live', 'polite');
      });

      // Add a new goal
      await user.click(screen.getByLabelText('Create new goal'));
      await user.type(screen.getByLabelText(/Goal Name/), 'New Goal');
      await user.clear(screen.getByLabelText(/Target Amount/));
      await user.type(screen.getByLabelText(/Target Amount/), '1000');
      await user.click(screen.getByText('Create Goal'));

      // The goal count should update and be announced
      await waitFor(() => {
        const updatedCount = screen.getByText('3 Active Goals');
        expect(updatedCount).toBeInTheDocument();
        expect(updatedCount.parentElement).toHaveAttribute('aria-live', 'polite');
      });
    });
  });
});
