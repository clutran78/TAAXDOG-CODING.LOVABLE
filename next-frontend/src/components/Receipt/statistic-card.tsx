import React from "react";

interface StatisticCardProps {
  title: string;
  value: string | number;
  id: string;
  parentStyleClass?: string;
  loading?: boolean;
}

const StatisticCard: React.FC<StatisticCardProps> = ({
  title,
  value,
  id,
  parentStyleClass,
  loading = false,
}) => {
  return (
    <div className={`col-md-6 col-lg-3 ${parentStyleClass}`}>
      <div className="card border-0 bg-light h-100">
        <div className="card-body text-center">
          <h6 className="text-muted mb-2">{title}</h6>
          {loading ? (
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          ) : (
            <h3 id={id}>{value}</h3>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatisticCard;
