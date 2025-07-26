'use client';
import React, { useMemo, useState } from 'react';
import AddGoalForm from './AddGoalForm';
import UpdateProgressModal from './UpdateProgress';
import ConfirmModal from './ConfirmModal';
import GoalCard from './GoalsCard';
import { Goal } from '@/lib/types/goal';
import { useDarkMode } from '@/providers/dark-mode-provider';
import { logger } from '@/lib/logger';
import { useGoals, useDeleteGoal } from '@/hooks/queries/useGoals';

/**
 * Goal Page Component using React Query
 * Demonstrates optimized data fetching with caching and background updates
 */
const GoalPageWithQuery: React.FC = () => {
  const { darkMode } = useDarkMode();
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [goalToEdit, setGoalToEdit] = useState<Partial<Goal>>({});
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [goalIdToDelete, setGoalIdToDelete] = useState<string | null>(null);
  const [goalNameToDelete, setGoalNameToDelete] = useState<string>('');

  // Use React Query hook for fetching goals
  const { data: goals = [], isLoading, error, refetch } = useGoals();
  const deleteGoalMutation = useDeleteGoal();

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalSaved = useMemo(
    () => goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0),
    [goals],
  );
  const totalTarget = useMemo(
    () => goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0),
    [goals],
  );
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const sortedGoals = useMemo(() => {
    return [...goals].sort((a, b) => {
      const aProgress = a.targetAmount > 0 ? (a.currentAmount / a.targetAmount) * 100 : 0;
      const bProgress = b.targetAmount > 0 ? (b.currentAmount / b.targetAmount) * 100 : 0;
      return aProgress - bProgress;
    });
  }, [goals]);

  const handleEdit = (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    setGoalToEdit(goal);
    setEditGoalId(goalId);
    setShowGoalModal(true);
  };

  const handleDeleteClick = (goalId: string, goalName: string) => {
    setGoalIdToDelete(goalId);
    setGoalNameToDelete(goalName);
  };

  const handleManageAutoSave = (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    setGoalToEdit(goal);
    setEditGoalId(goalId);
    setShowGoalModal(true);
  };

  const confirmDelete = async () => {
    if (!goalIdToDelete) return;
    
    deleteGoalMutation.mutate(goalIdToDelete, {
      onSuccess: () => {
        setGoalIdToDelete(null);
        setGoalNameToDelete('');
      },
    });
  };

  const cancelDelete = () => {
    setGoalIdToDelete(null);
    setGoalNameToDelete('');
  };

  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-danger">
          <h4>Error Loading Goals</h4>
          <p>{error instanceof Error ? error.message : 'Failed to load goals'}</p>
          <button className="btn btn-primary mt-2" onClick={() => refetch()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AddGoalForm
        show={showGoalModal}
        onClose={() => {
          setShowGoalModal(false);
          setGoalToEdit({});
          setEditGoalId(null);
        }}
        onAdd={async () => {
          logger.info('Goal saved');
          // React Query will automatically refetch after mutation
        }}
        goalToEdit={goalToEdit}
        editGoalId={editGoalId}
      />

      <UpdateProgressModal
        show={showProgressModal}
        onClose={() => {
          setShowProgressModal(false);
          setSelectedGoal(null);
        }}
        goal={selectedGoal}
      />

      {goalIdToDelete && (
        <ConfirmModal
          title="Confirm Deletion"
          message={`Are you sure you want to delete the goal "${goalNameToDelete}"?`}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          deleteLoading={deleteGoalMutation.isPending}
        />
      )}

      <div className="container py-4">
        <h2 className="mb-4">
          <i className="fas fa-bullseye text-warning me-2"></i>Financial Goals
        </h2>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Your Goals</h5>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditGoalId(null);
              setGoalToEdit({});
              setShowGoalModal(true);
            }}
          >
            <i className="fas fa-plus me-1"></i> Add Goal
          </button>
        </div>
        
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading your financial goals...</p>
          </div>
        ) : (
          <div>
            {/* Overall Progress */}
            <div className="card mb-4">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Overall Progress</h5>
                  <span className="badge bg-primary">{overallProgress.toFixed(1)}%</span>
                </div>
                <div className="progress mb-3" style={{ height: '15px' }}>
                  <div
                    className="progress-bar bg-primary"
                    role="progressbar"
                    style={{ width: `${overallProgress}%` }}
                    aria-valuenow={overallProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  ></div>
                </div>
                <div className="d-flex justify-content-between">
                  <span className={`${darkMode ? 'text-secondary' : 'text-muted'}`}>
                    Total Saved: {formatCurrency(totalSaved)}
                  </span>
                  <span className={`${darkMode ? 'text-secondary' : 'text-muted'}`}>
                    Target: {formatCurrency(totalTarget)}
                  </span>
                </div>
              </div>
            </div>

            {/* Goals List */}
            <h5 className="mb-3">Your Active Goals ({goals.length})</h5>

            {sortedGoals.length === 0 ? (
              <div className="text-center py-4">
                <i
                  className={`fas fa-bullseye fa-3x ${
                    darkMode ? 'text-secondary' : 'text-muted'
                  } mb-3`}
                ></i>
                <p>No financial goals set yet. Click "Add Goal" to get started!</p>
              </div>
            ) : (
              sortedGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  formatCurrency={formatCurrency}
                  onEdit={(goalId) => handleEdit(goalId)}
                  onDelete={handleDeleteClick}
                  onUpdateProgress={(goalId) => {
                    const goalToUpdate = goals.find((g) => g.id === goalId);
                    if (goalToUpdate) {
                      setSelectedGoal(goalToUpdate);
                      setShowProgressModal(true);
                    }
                  }}
                  onManageAutoSave={handleManageAutoSave}
                />
              ))
            )}

            {/* Tip Section */}
            <div className="alert border mt-3">
              <div className="d-flex">
                <div className="me-3">
                  <i className="fas fa-lightbulb text-warning"></i>
                </div>
                <div>
                  <span className="small">
                    Setting SMART financial goals (Specific, Measurable, Achievable, Relevant,
                    Time-bound) can increase your chances of success by up to 76% according to
                    research.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GoalPageWithQuery;