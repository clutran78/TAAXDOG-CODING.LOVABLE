'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Goal } from '@/lib/types/goal';
import { fetchGoals } from '@/lib/services/goals/client-goal-service';
import { logger } from '@/lib/logger';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);

const GoalsDashboardCard: React.FC<{ onOpenModal: () => void }> = ({ onOpenModal }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedGoals = await fetchGoals();
        setGoals(fetchedGoals);
      } catch (error) {
        logger.error('Error fetching goals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalSaved = useMemo(() => goals.reduce((sum, g) => sum + g.currentAmount, 0), [goals]);

  const totalTarget = useMemo(() => goals.reduce((sum, g) => sum + g.targetAmount, 0), [goals]);

  const overallProgress = useMemo(
    () => (totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0),
    [totalSaved, totalTarget],
  );

  const topGoals = useMemo(
    () =>
      [...goals]
        .sort((a, b) => {
          const aProg = a.currentAmount / a.targetAmount;
          const bProg = b.currentAmount / b.targetAmount;
          return bProg - aProg;
        })
        .slice(0, 3),
    [goals],
  );

  return (
    <div
      className={`card tile-card h-100 ${topGoals.length > 0 ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (topGoals.length > 0) {
          onOpenModal();
        }
      }}
      data-tile-type="goals"
      id="goals-card-"
    >
      <div className="card-header">
        <i className="fas fa-bullseye text-warning"></i>
      </div>
      <div className="card-body">
        {goals.length === 0 && loading ? (
          <div className="text-center p-5">
            <div
              className="spinner-border text-primary"
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading Goals data...</p>
          </div>
        ) : (
          <div className="scrollable-content">
            <h3>
              {goals.length} Active Goal{goals.length !== 1 ? 's' : ''}
            </h3>
            {overallProgress !== 0 && (
              <div className="stat-change positive-change mb-4">
                <i className="fas fa-check-circle"></i> {overallProgress.toFixed(0)}% Complete
              </div>
            )}

            {topGoals.length > 0 ? (
              topGoals.slice(0, 3).map((goal) => {
                const progress = (goal.currentAmount / goal.targetAmount) * 100;
                const due = new Date(goal.dueDate).toLocaleDateString();

                return (
                  <div
                    className="goal-item"
                    key={goal.id}
                  >
                    <div className="goal-details">
                      <span>{goal.name}</span>
                      <span className="text-success">{formatCurrency(goal.currentAmount)}</span>
                    </div>
                    <div className="progress">
                      <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        style={{ width: `${progress}%` }}
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      ></div>
                    </div>
                    <div className="d-flex justify-content-between">
                      <small>
                        {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                      </small>
                      <small>Due: {due}</small>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center mt-5">
                <i className="fas fa-bullseye fa-3x text-muted mb-3"></i>
                <p className="text-muted text-center  mt-4">
                  No goals yet.{' '}
                  <span
                    onClick={() => {
                      router.push('/goals');
                    }}
                    className="text-primary text-decoration-underline cursor-pointer"
                  >
                    Click here
                  </span>{' '}
                  to add your first financial goal!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalsDashboardCard;
