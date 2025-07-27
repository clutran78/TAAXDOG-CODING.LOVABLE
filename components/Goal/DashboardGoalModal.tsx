import React, { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import { Goal } from '@/lib/types/goal';
import { logger } from '@/lib/logger';

interface Props {
  onClose: () => void;
  onGoalUpdate?: () => void; // Callback to refresh parent component
}

interface GoalFormData {
  name: string;
  targetAmount: number;
  currentAmount: number;
  dueDate: string;
  category?: string;
  description?: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);

const GoalsModal: React.FC<Props> = ({ onClose, onGoalUpdate }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
  const lastFocusableElementRef = useRef<HTMLButtonElement>(null);

  // Form state
  const [formData, setFormData] = useState<GoalFormData>({
    name: '',
    targetAmount: 0,
    currentAmount: 0,
    dueDate: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
  });

  // Fetch goals from API
  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/goals', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch goals');
      }

      const data = await response.json();
      setGoals(data);
    } catch (error) {
      logger.error('Error fetching goals:', error);
      setError(error instanceof Error ? error.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new goal
  const createGoal = async (data: GoalFormData) => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create goal');
      }

      const newGoal = await response.json();

      // Optimistic update
      setGoals((prev) => [...prev, newGoal]);
      setShowForm(false);
      resetForm();

      // Notify parent component
      if (onGoalUpdate) {
        onGoalUpdate();
      }
    } catch (error) {
      logger.error('Error creating goal:', error);
      setError(error instanceof Error ? error.message : 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  // Update an existing goal
  const updateGoal = async (id: string, data: Partial<GoalFormData>) => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/goals/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update goal');
      }

      const updatedGoal = await response.json();

      // Optimistic update
      setGoals((prev) => prev.map((g) => (g.id === id ? updatedGoal : g)));
      setEditingGoal(null);
      resetForm();

      // Notify parent component
      if (onGoalUpdate) {
        onGoalUpdate();
      }
    } catch (error) {
      logger.error('Error updating goal:', error);
      setError(error instanceof Error ? error.message : 'Failed to update goal');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete a goal
  const deleteGoal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    try {
      setError(null);

      const response = await fetch(`/api/goals/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete goal');
      }

      // Optimistic update
      setGoals((prev) => prev.filter((g) => g.id !== id));

      // Notify parent component
      if (onGoalUpdate) {
        onGoalUpdate();
      }
    } catch (error) {
      logger.error('Error deleting goal:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete goal');
    }
  };

  // Mark goal as completed
  const completeGoal = async (goal: Goal) => {
    try {
      await updateGoal(goal.id, {
        status: 'COMPLETED',
        currentAmount: goal.targetAmount,
      });
    } catch (error) {
      logger.error('Error completing goal:', error);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      dueDate: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
    });
    setShowForm(false);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingGoal) {
      await updateGoal(editingGoal.id, formData);
    } else {
      await createGoal(formData);
    }
  };

  // Handle edit
  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      dueDate: new Date(goal.dueDate).toISOString().split('T')[0],
      category: goal.category || '',
      description: goal.description || '',
    });
    setShowForm(true);
  };

  // Handle click outside
  const handleClickOutside = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose();
    }

    // Trap focus within modal
    if (e.key === 'Tab') {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  useEffect(() => {
    fetchGoals();

    // Focus management
    const previouslyFocusedElement = document.activeElement as HTMLElement;
    firstFocusableElementRef.current?.focus();

    // Cleanup: restore focus when modal closes
    return () => {
      previouslyFocusedElement?.focus();
    };
  }, [fetchGoals]);

  // Calculate totals
  const activeGoals = goals.filter((g) => g.status === 'ACTIVE');
  const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const topGoals = [...activeGoals]
    .sort((a, b) => b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount)
    .slice(0, 3);

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="goals-modal-title"
      aria-describedby="goals-modal-description"
      onClick={handleClickOutside}
      onKeyDown={handleKeyDown}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="modal-dialog modal-lg"
        role="document"
      >
        <div
          className="modal-content"
          ref={modalRef}
        >
          <div className="modal-header">
            <h5
              className="modal-title"
              id="goals-modal-title"
            >
              <i
                className="fas fa-bullseye text-warning me-2"
                aria-hidden="true"
              ></i>
              Financial Goals Overview
            </h5>
            <button
              ref={firstFocusableElementRef}
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close modal"
            ></button>
          </div>

          <div className="modal-body">
            {error && (
              <div
                className="alert alert-danger alert-dismissible fade show"
                role="alert"
              >
                <span
                  role="img"
                  aria-label="Error"
                  className="visually-hidden"
                >
                  ⚠️
                </span>
                {error}
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setError(null)}
                  aria-label="Dismiss error message"
                ></button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-4">
                <div
                  className="spinner-border text-primary"
                  role="status"
                  aria-live="polite"
                >
                  <span className="visually-hidden">Loading goals...</span>
                </div>
              </div>
            ) : (
              <>
                {!showForm ? (
                  <>
                    <div
                      className="mb-3"
                      id="goals-modal-description"
                    >
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong aria-live="polite">
                          {activeGoals.length} Active Goal{activeGoals.length !== 1 ? 's' : ''}
                        </strong>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setShowForm(true)}
                          aria-label="Create new goal"
                        >
                          <i
                            className="fas fa-plus me-1"
                            aria-hidden="true"
                          ></i>
                          New Goal
                        </button>
                      </div>
                      <div
                        className="progress my-2"
                        style={{ height: '12px' }}
                        role="progressbar"
                        aria-label="Overall goals progress"
                        aria-valuenow={Math.round(overallProgress)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="progress-bar bg-success"
                          style={{ width: `${overallProgress}%` }}
                        ></div>
                      </div>
                      <div className="d-flex justify-content-between text-muted small">
                        <span>Total Saved: {formatCurrency(totalSaved)}</span>
                        <span>Target: {formatCurrency(totalTarget)}</span>
                      </div>
                    </div>

                    {topGoals.length > 0 ? (
                      topGoals.map((goal) => {
                        const progress = (goal.currentAmount / goal.targetAmount) * 100;
                        const due = new Date(goal.dueDate).toLocaleDateString('en-AU');
                        const daysLeft = Math.ceil(
                          (new Date(goal.dueDate).getTime() - new Date().getTime()) /
                            (1000 * 60 * 60 * 24),
                        );

                        return (
                          <div
                            className="mb-4 border-bottom pb-3"
                            key={goal.id}
                          >
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="flex-grow-1">
                                <strong>{goal.name}</strong>
                                <small className="text-muted d-block">
                                  {goal.description || goal.category || 'No description'}
                                </small>
                              </div>
                              <div className="d-flex gap-2">
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleEdit(goal)}
                                  aria-label={`Edit goal: ${goal.name}`}
                                >
                                  <i
                                    className="fas fa-edit"
                                    aria-hidden="true"
                                  ></i>
                                </button>
                                {progress >= 100 && (
                                  <button
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() => completeGoal(goal)}
                                    aria-label={`Mark goal ${goal.name} as completed`}
                                  >
                                    <i
                                      className="fas fa-check"
                                      aria-hidden="true"
                                    ></i>
                                  </button>
                                )}
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => deleteGoal(goal.id)}
                                  aria-label={`Delete goal: ${goal.name}`}
                                >
                                  <i
                                    className="fas fa-trash"
                                    aria-hidden="true"
                                  ></i>
                                </button>
                              </div>
                            </div>

                            <div
                              className="progress my-2"
                              style={{ height: '10px' }}
                              role="progressbar"
                              aria-label={`Progress for ${goal.name}`}
                              aria-valuenow={Math.round(progress)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className={`progress-bar ${progress >= 100 ? 'bg-success' : 'bg-info'}`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              ></div>
                            </div>

                            <div className="d-flex justify-content-between text-muted small">
                              <span>
                                {formatCurrency(goal.currentAmount)} of{' '}
                                {formatCurrency(goal.targetAmount)}
                                {progress >= 100 && ' ✓'}
                              </span>
                              <span>
                                {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'} • Due: {due}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-4 text-muted">
                        <p>No goals yet. Create your first financial goal!</p>
                      </div>
                    )}
                  </>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    aria-label="Goal form"
                  >
                    <h6
                      className="mb-3"
                      id="goal-form-title"
                    >
                      {editingGoal ? 'Edit Goal' : 'Create New Goal'}
                    </h6>

                    <div className="mb-3">
                      <label
                        htmlFor="goal-name"
                        className="form-label"
                      >
                        Goal Name <span aria-label="required">*</span>
                      </label>
                      <input
                        id="goal-name"
                        type="text"
                        className="form-control"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        aria-required="true"
                        aria-describedby="goal-name-help"
                        placeholder="e.g., Emergency Fund"
                      />
                      <span
                        id="goal-name-help"
                        className="visually-hidden"
                      >
                        Enter a descriptive name for your financial goal
                      </span>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label
                          htmlFor="target-amount"
                          className="form-label"
                        >
                          Target Amount <span aria-label="required">*</span>
                        </label>
                        <input
                          id="target-amount"
                          type="number"
                          className="form-control"
                          value={formData.targetAmount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              targetAmount: parseFloat(e.target.value) || 0,
                            })
                          }
                          required
                          aria-required="true"
                          aria-describedby="target-amount-help"
                          min="0"
                          step="0.01"
                        />
                        <span
                          id="target-amount-help"
                          className="visually-hidden"
                        >
                          Enter the total amount you want to save
                        </span>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label
                          htmlFor="current-amount"
                          className="form-label"
                        >
                          Current Amount
                        </label>
                        <input
                          id="current-amount"
                          type="number"
                          className="form-control"
                          value={formData.currentAmount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              currentAmount: parseFloat(e.target.value) || 0,
                            })
                          }
                          aria-describedby="current-amount-help"
                          min="0"
                          step="0.01"
                        />
                        <span
                          id="current-amount-help"
                          className="visually-hidden"
                        >
                          Enter the amount you have already saved
                        </span>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label
                          htmlFor="target-date"
                          className="form-label"
                        >
                          Target Date <span aria-label="required">*</span>
                        </label>
                        <input
                          id="target-date"
                          type="date"
                          className="form-control"
                          value={formData.dueDate}
                          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                          required
                          aria-required="true"
                          aria-describedby="target-date-help"
                          min={new Date().toISOString().split('T')[0]}
                        />
                        <span
                          id="target-date-help"
                          className="visually-hidden"
                        >
                          Select the date by which you want to achieve this goal
                        </span>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label
                          htmlFor="goal-category"
                          className="form-label"
                        >
                          Category
                        </label>
                        <select
                          id="goal-category"
                          className="form-select"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          aria-describedby="category-help"
                        >
                          <option value="">Select category</option>
                          <option value="Savings">Savings</option>
                          <option value="Investment">Investment</option>
                          <option value="Debt">Debt Repayment</option>
                          <option value="Purchase">Purchase</option>
                          <option value="Education">Education</option>
                          <option value="Travel">Travel</option>
                          <option value="Other">Other</option>
                        </select>
                        <span
                          id="category-help"
                          className="visually-hidden"
                        >
                          Choose a category that best describes your goal
                        </span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label
                        htmlFor="goal-description"
                        className="form-label"
                      >
                        Description
                      </label>
                      <textarea
                        id="goal-description"
                        className="form-control"
                        rows={2}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        aria-describedby="description-help"
                        placeholder="Add any notes about this goal..."
                      />
                      <span
                        id="description-help"
                        className="visually-hidden"
                      >
                        Optional: Add additional details about your goal
                      </span>
                    </div>

                    <div className="d-flex justify-content-end gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={resetForm}
                        disabled={submitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            ></span>
                            <span aria-live="polite">
                              {editingGoal ? 'Updating...' : 'Creating...'}
                            </span>
                          </>
                        ) : editingGoal ? (
                          'Update Goal'
                        ) : (
                          'Create Goal'
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              onClick={onClose}
              ref={activeGoals.length > 3 && !showForm ? undefined : lastFocusableElementRef}
            >
              Close
            </button>
            {activeGoals.length > 3 && !showForm && (
              <button
                className="btn btn-primary"
                onClick={() => (window.location.href = '/dashboard/goals')}
                ref={lastFocusableElementRef}
                aria-label="View all goals on dedicated page"
              >
                View All Goals
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalsModal;
