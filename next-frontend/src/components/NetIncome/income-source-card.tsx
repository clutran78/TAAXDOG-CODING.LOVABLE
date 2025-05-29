import React from "react";
import { formatCurrency } from "@/services/helperFunction";
import { IncomeSource } from "@/lib/types/transactions";

interface IncomeSourceCardProps {
  source: IncomeSource;
  onClick: () => void;
}

const IncomeSourceCard: React.FC<IncomeSourceCardProps> = ({
  source,
  onClick,
}) => {
  return (
    <div onClick={onClick} className="cursor-pointer card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{source.name}</h5>
          <span className="badge bg-success">
            {source.percentage.toFixed(1)}%
          </span>
        </div>
        <div className="d-flex justify-content-between align-items-center mt-2">
          <div className="text-muted">Monthly income</div>
          <h4 className="text-success mb-0">{formatCurrency(source.amount)}</h4>
        </div>
        <div className="progress mt-3" style={{ height: "6px" }}>
          <div
            className="progress-bar bg-success"
            style={{ width: `${source.percentage}%` }}
            role="progressbar"
            aria-valuenow={source.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default IncomeSourceCard;
