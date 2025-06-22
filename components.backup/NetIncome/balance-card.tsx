import React from "react";

interface BalanceCardProps {
  title: string;
  valueId: string;
  value: string;
  iconClass: string;
  buttonClass: string;
  onClick: () => void;
  categoriesId: string;
  buttonText: string;
}

const BalanceCard: React.FC<BalanceCardProps> = ({
  title,
  valueId,
  value,
  iconClass,
  buttonClass,
  onClick,
  categoriesId,
  buttonText,
}) => {
  return (
    <div className="card h-100">
      <div
        className={`card-header d-flex justify-content-between align-items-center ${buttonClass}`}
      >
        <h5 className="mb-0">{title}</h5>
        <i className={iconClass}></i>
      </div>
      <div className="card-body">
        <h3 className={buttonClass.split(" ")[1]} id={valueId}>
          {value}
        </h3>
        <div className="mt-3">
          <h6>Top {title} Categories:</h6>
          <div id={categoriesId}></div>
          <div className="mt-3">
            <button className={`btn btn-sm ${buttonClass}`} onClick={onClick}>
              <i className="fas fa-list me-1"></i> {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;
