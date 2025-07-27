import { Goal } from '@/lib/types/goal';
import { SubaccountSummary } from '@/lib/types/subaccount';
import { useDarkMode } from '@/providers/dark-mode-provider';
import React, { useState, useEffect } from 'react';
import subaccountService from '@/lib/services/goals/subaccount-service';
import { logger } from '@/lib/logger';

interface GoalCardProps {
  goal: Goal;
  formatCurrency: (amount: number) => string;
  onEdit: (goalId: string) => void;
  onDelete: (goalId: string, goalName: string) => void;
  onUpdateProgress: (goalId: string) => void;
  onManageAutoSave?: (goalId: string) => void;
  onViewSubaccountDetails?: (goalId: string, subaccountId: string) => void;
  onCreateSubaccount?: (goalId: string) => void;
}

const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  formatCurrency,
  onEdit,
  onDelete,
  onUpdateProgress,
  onManageAutoSave,
  onViewSubaccountDetails,
  onCreateSubaccount,
}) => {
  const { darkMode } = useDarkMode();

  // Subaccount state management
  const [subaccountSummary, setSubaccountSummary] = useState<SubaccountSummary | null>(null);
  const [loadingSubaccount, setLoadingSubaccount] = useState<boolean>(false);
  const [subaccountError, setSubaccountError] = useState<string | null>(null);

  // Load subaccount data if enabled for this goal
  useEffect(() => {
    const loadSubaccountData = async () => {
      if (!goal.subaccount?.isEnabled || !goal.subaccount?.subaccountId) {
        return;
      }

      setLoadingSubaccount(true);
      setSubaccountError(null);

      try {
        const response = await subaccountService.getSubaccountSummary(goal.subaccount.subaccountId);
        if (response.success && response.data) {
          setSubaccountSummary(response.data);
        } else {
          setSubaccountError(response.error || 'Failed to load subaccount data');
        }
      } catch (error) {
        setSubaccountError('Error loading subaccount information');
        logger.error('Failed to load subaccount summary:', error);
      } finally {
        setLoadingSubaccount(false);
      }
    };

    loadSubaccountData();
  }, [goal.subaccount?.subaccountId, goal.subaccount?.isEnabled]);

  // Calculate progress based on subaccount balance if enabled
  const effectiveAmount =
    goal.subaccount?.useSubaccountBalance && subaccountSummary
      ? subaccountSummary.currentBalance
      : goal.currentAmount;

  const progress = goal.targetAmount > 0 ? (effectiveAmount / goal.targetAmount) * 100 : 0;
  const dueDate = new Date(goal.dueDate).toLocaleDateString();

  const progressBarColor =
    progress < 25
      ? 'bg-danger'
      : progress < 50
        ? 'bg-warning'
        : progress < 75
          ? 'bg-info'
          : 'bg-success';

  // Direct debit helpers
  const formatFrequency = (frequency: string): string => {
    switch (frequency) {
      case 'weekly':
        return 'Weekly';
      case 'bi-weekly':
        return 'Bi-weekly';
      case 'monthly':
        return 'Monthly';
      default:
        return frequency;
    }
  };

  const formatNextTransferDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getTransferAmountDisplay = (directDebit: NonNullable<Goal['directDebit']>): string => {
    if (directDebit.transferType === 'percentage') {
      return `${directDebit.transferAmount}%`;
    }
    return formatCurrency(directDebit.transferAmount);
  };

  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h5 className="mb-0">{goal.name}</h5>
              {goal.directDebit?.isEnabled && (
                <span className="badge bg-success">
                  <i className="fas fa-robot me-1"></i>Auto-Save
                </span>
              )}
              {goal.subaccount?.isEnabled && (
                <span className="badge bg-info">
                  <i className="fas fa-piggy-bank me-1"></i>Subaccount
                </span>
              )}
            </div>
            <span className={`${darkMode ? 'text-secondary' : 'text-muted'} small`}>
              {goal.description || 'No description'}
            </span>
            {goal.directDebit?.isEnabled && (
              <div className="mt-1">
                <small className={`${darkMode ? 'text-info' : 'text-primary'}`}>
                  <i className="fas fa-calendar-alt me-1"></i>
                  Next transfer: {formatNextTransferDate(goal.directDebit.nextTransferDate)} (
                  {getTransferAmountDisplay(goal.directDebit)}{' '}
                  {formatFrequency(goal.directDebit.frequency)})
                </small>
              </div>
            )}

            {/* Subaccount Information */}
            {goal.subaccount?.isEnabled && (
              <div
                className="mt-2 p-2 rounded"
                style={{ backgroundColor: darkMode ? '#1a1a1a' : '#f8f9fa' }}
              >
                {loadingSubaccount ? (
                  <div className="text-center">
                    <small className="text-muted">
                      <i className="fas fa-spinner fa-spin me-1"></i>Loading subaccount...
                    </small>
                  </div>
                ) : subaccountError ? (
                  <div className="text-center">
                    <small className="text-danger">
                      <i className="fas fa-exclamation-triangle me-1"></i>
                      {subaccountError}
                    </small>
                  </div>
                ) : subaccountSummary ? (
                  <div>
                    <div className="row">
                      <div className="col-6">
                        <small className={`${darkMode ? 'text-secondary' : 'text-muted'}`}>
                          Subaccount Balance:
                        </small>
                        <div className="fw-bold text-success">
                          {formatCurrency(subaccountSummary.currentBalance)}
                        </div>
                      </div>
                      <div className="col-6">
                        <small className={`${darkMode ? 'text-secondary' : 'text-muted'}`}>
                          Interest This Month:
                        </small>
                        <div className="fw-bold text-info">
                          {formatCurrency(subaccountSummary.interestEarnedThisMonth)}
                        </div>
                      </div>
                    </div>
                    {subaccountSummary.recentTransactions.length > 0 && (
                      <div className="mt-2">
                        <small className={`${darkMode ? 'text-secondary' : 'text-muted'}`}>
                          Recent: {subaccountSummary.recentTransactions[0].description}(
                          {formatCurrency(subaccountSummary.recentTransactions[0].amount)})
                        </small>
                      </div>
                    )}
                  </div>
                ) : !goal.subaccount?.subaccountId && onCreateSubaccount ? (
                  <div className="text-center">
                    <button
                      className="btn btn-sm btn-outline-info"
                      onClick={() => onCreateSubaccount(goal.id)}
                    >
                      <i className="fas fa-plus me-1"></i>Create Subaccount
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <div className="text-end">
            <span className={`badge ${progress >= 100 ? 'bg-success' : 'bg-primary'}`}>
              {progress.toFixed(1)}%
            </span>
            <div className="mt-1">
              <button
                className="btn btn-sm btn-outline-primary me-1"
                onClick={() => onEdit(goal.id)}
              >
                <i className="fas fa-edit"></i>
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => onDelete(goal.id, goal.name)}
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
        <div
          className="progress mb-3"
          style={{ height: '10px' }}
        >
          <div
            className={`progress-bar ${progressBarColor}`}
            role="progressbar"
            style={{ width: `${progress}%` }}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          ></div>
        </div>
        <div className="d-flex justify-content-between mb-2">
          <div>
            <span className={`${darkMode ? 'text-secondary' : 'text-muted'}`}>
              Current: {formatCurrency(effectiveAmount)}
            </span>
            {goal.subaccount?.useSubaccountBalance && subaccountSummary && (
              <div>
                <small className="text-muted">(Goal: {formatCurrency(goal.currentAmount)})</small>
              </div>
            )}
          </div>
          <span className={`${darkMode ? 'text-secondary' : 'text-muted'}`}>
            Target: {formatCurrency(goal.targetAmount)}
          </span>
        </div>
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-success"
              onClick={() => onUpdateProgress(goal.id)}
            >
              <i className="fas fa-plus me-1"></i>Update Progress
            </button>
            {onManageAutoSave && (
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => onManageAutoSave(goal.id)}
                title="Manage automated savings"
              >
                <i className="fas fa-cog me-1"></i>Auto-Save
              </button>
            )}
            {goal.subaccount?.isEnabled &&
              goal.subaccount?.subaccountId &&
              onViewSubaccountDetails && (
                <button
                  className="btn btn-sm btn-outline-info"
                  onClick={() => onViewSubaccountDetails(goal.id, goal.subaccount?.subaccountId!)}
                  title="View subaccount details"
                >
                  <i className="fas fa-chart-line me-1"></i>Subaccount
                </button>
              )}
          </div>
          <span className={`${darkMode ? 'text-secondary' : 'text-muted'} small`}>
            Due: {dueDate}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GoalCard;
