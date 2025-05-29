import React from "react";

interface StatCardProps {
  id: string;
  dataCard: string;
  title: string;
  iconClass: string;
  value: string;
  valueId: string;
  loading?: boolean;
  change: string | React.JSX.Element;
  changeType: "positive" | "negative" | "neutral";
  arrowIcon?: React.JSX.Element;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  id,
  dataCard,
  title,
  iconClass,
  value,
  valueId,
  change,
  changeType,
  arrowIcon,
  onClick,
  loading = false,
}) => {
  return (
    <div
      className="col-12 col-md-6 col-lg-3 mb-4 cursor-pointer"
      onClick={onClick}
    >
      <div className="card stats-card h-100" id={id} data-card={dataCard}>
        <div className="card-header">
          {title}
          <i className={iconClass}></i>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="stat-value" id={valueId}>
                {value}
              </div>
              <div
                className={`stat-change ${changeType}-change cursor-pointer`}
              >
                {arrowIcon} {change}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
