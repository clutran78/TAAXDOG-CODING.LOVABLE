import { Goal } from "@/lib/types/goal";
import React from "react";

interface GoalCardProps {
  goal: Goal;
  formatCurrency: (amount: number) => string;
  onEdit: (goalId: string) => void;
  onDelete: (goalId: string, goalName: string) => void;
  onUpdateProgress: (goalId: string) => void;
}

const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  formatCurrency,
  onEdit,
  onDelete,
  onUpdateProgress,
}) => {
  const progress =
    goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const dueDate = new Date(goal.dueDate).toLocaleDateString();

  const progressBarColor =
    progress < 25
      ? "bg-danger"
      : progress < 50
      ? "bg-warning"
      : progress < 75
      ? "bg-info"
      : "bg-success";

  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h5 className="mb-1">{goal.name}</h5>
            <span className="text-muted small">
              {goal.description || "No description"}
            </span>
          </div>
          <div className="text-end">
            <span
              className={`badge ${
                progress >= 100 ? "bg-success" : "bg-primary"
              }`}
            >
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
        <div className="progress mb-3" style={{ height: "10px" }}>
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
          <span className="text-muted">
            Current: {formatCurrency(goal.currentAmount)}
          </span>
          <span className="text-muted">
            Target: {formatCurrency(goal.targetAmount)}
          </span>
        </div>
        <div className="d-flex justify-content-between">
          <button
            className="btn btn-sm btn-success"
            onClick={() => onUpdateProgress(goal.id)}
          >
            <i className="fas fa-plus me-1"></i>Update Progress
          </button>
          <span className="text-muted small">Due: {dueDate}</span>
        </div>
      </div>
    </div>
  );
};

export default GoalCard;
