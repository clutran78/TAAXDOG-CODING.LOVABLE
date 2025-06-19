'use client';

import React from 'react';

interface FinancialGoal {
  goal_type: string;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  timeline_months: number;
  monthly_target: number;
  priority: string;
  achievability_score: number;
  action_steps: string[];
}

interface FinancialGoalsPanelProps {
  goals: FinancialGoal[] | undefined;
}

/**
 * Financial Goals Panel Component
 * Displays financial goals with progress tracking and recommendations
 */
export const FinancialGoalsPanel: React.FC<FinancialGoalsPanelProps> = ({ goals }) => {
  if (!goals || goals.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <p>No financial goals available. Generate insights to see personalized goal recommendations.</p>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'HIGH': return 'bg-danger';
      case 'MEDIUM': return 'bg-warning';
      case 'LOW': return 'bg-success';
      default: return 'bg-secondary';
    }
  };

  return (
    <div className="row">
      {goals.map((goal, index) => (
        <div key={index} className="col-md-6 mb-4">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h6 className="card-title mb-0">{goal.title}</h6>
              <span className={`badge ${getPriorityColor(goal.priority)}`}>
                {goal.priority}
              </span>
            </div>
            <div className="card-body">
              <p className="card-text">{goal.description}</p>
              
              {/* Progress bar */}
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1">
                  <small>Progress</small>
                  <small>{((goal.current_amount / goal.target_amount) * 100).toFixed(1)}%</small>
                </div>
                <div className="progress">
                  <div 
                    className="progress-bar bg-primary"
                    style={{ 
                      width: `${Math.min((goal.current_amount / goal.target_amount) * 100, 100)}%` 
                    }}
                  />
                </div>
              </div>

              {/* Goal details */}
              <div className="row">
                <div className="col-6">
                  <small className="text-muted">Current</small>
                  <div className="fw-bold">${goal.current_amount.toLocaleString()}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Target</small>
                  <div className="fw-bold">${goal.target_amount.toLocaleString()}</div>
                </div>
              </div>

              <div className="row mt-2">
                <div className="col-6">
                  <small className="text-muted">Monthly Target</small>
                  <div className="fw-bold">${goal.monthly_target.toLocaleString()}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Timeline</small>
                  <div className="fw-bold">{goal.timeline_months} months</div>
                </div>
              </div>

              {/* Action steps */}
              {goal.action_steps && goal.action_steps.length > 0 && (
                <div className="mt-3">
                  <small className="text-muted">Action Steps:</small>
                  <ul className="list-unstyled mt-1">
                    {goal.action_steps.slice(0, 3).map((step, stepIndex) => (
                      <li key={stepIndex} className="small">
                        • {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}; 