import React, { useEffect, useRef, useState } from "react";
import { Goal } from "@/lib/types/goal";
import { fetchGoals } from "@/services/goal-service";

interface Props {
  onClose: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

const GoalsModal: React.FC<Props> = ({ onClose }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchedGoals = await fetchGoals();
        setGoals(fetchedGoals);
      } catch (error) {
        console.error("Error fetching goals:", error);
      }
    };

    fetchData();
  }, []);

  // Handle click outside
  const handleClickOutside = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallProgress =
    totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const topGoals = [...goals]
    .sort(
      (a, b) =>
        b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount
    )
    .slice(0, 3);

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      role="dialog"
      onClick={handleClickOutside}
    >
      <div className="modal-dialog modal-lg" role="document">
        <div className="modal-content" ref={modalRef}>
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-bullseye text-warning me-2"></i>Financial
              Goals Overview
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <strong>
                {goals.length} Active Goal{goals.length !== 1 ? "s" : ""}
              </strong>
              <div className="progress my-2" style={{ height: "12px" }}>
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

            {topGoals.length > 0 &&
              topGoals.map((goal) => {
                const progress = (goal.currentAmount / goal.targetAmount) * 100;
                const due = new Date(goal.dueDate).toLocaleDateString();

                return (
                  <div className="mb-4 border-bottom pb-3" key={goal.id}>
                    <div className="d-flex justify-content-between">
                      <strong>{goal.name}</strong>
                      <span className="text-success">
                        {formatCurrency(goal.currentAmount)}
                      </span>
                    </div>
                    <small className="text-muted">
                      {goal.description || "No description"}
                    </small>
                    <div className="progress my-2" style={{ height: "10px" }}>
                      <div
                        className="progress-bar bg-info"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <div className="d-flex justify-content-between text-muted small">
                      <span>
                        {formatCurrency(goal.currentAmount)} of{" "}
                        {formatCurrency(goal.targetAmount)}
                      </span>
                      <span>Due: {due}</span>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalsModal;
