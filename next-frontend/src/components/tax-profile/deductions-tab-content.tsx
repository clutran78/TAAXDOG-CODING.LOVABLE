import React from "react";

interface Props {
  goToNextTab: (fromId: string, toId: string) => void;
}

const DeductionsTabContent: React.FC<Props> = ({ goToNextTab }) => (
  <div className="tab-pane fade" id="deductions-content" role="tabpanel">
    <h4 className="mb-3">Work-Related Expenses</h4>

    {/* Car Expenses */}
    <div className="card mb-3">
      <div className="card-header bg-light">
        <h5 className="mb-0">Car Expenses (D1)</h5>
      </div>
      <div className="card-body">
        <div className="row g-3">
          <div className="col-md-12">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="use-car-for-work"
              />
              <label className="form-check-label" htmlFor="use-car-for-work">
                I use my car for work purposes
              </label>
            </div>
          </div>
        </div>

        <div
          id="car-expense-details"
          className="row g-3 mt-2"
          style={{ display: "none" }}
        >
          <div className="col-md-4">
            <label htmlFor="car-make" className="form-label">
              Car Make and Model
            </label>
            <input type="text" className="form-control" id="car-make" />
          </div>
          <div className="col-md-4">
            <label htmlFor="car-registration" className="form-label">
              Registration Number
            </label>
            <input type="text" className="form-control" id="car-registration" />
          </div>
          <div className="col-md-4">
            <label htmlFor="car-method" className="form-label">
              Calculation Method
            </label>
            <select className="form-select" id="car-method">
              <option value="cents">Cents per Kilometer</option>
              <option value="logbook">Logbook Method</option>
            </select>
          </div>
          <div className="col-md-4">
            <label htmlFor="business-km" className="form-label">
              Business Kilometers
            </label>
            <input
              type="number"
              className="form-control"
              id="business-km"
              min="0"
            />
          </div>
          <div className="col-md-8">
            <label htmlFor="car-expenses" className="form-label">
              Total Car Expenses Claimed
            </label>
            <input
              type="number"
              className="form-control"
              id="car-expenses"
              min="0"
              step="0.01"
            />
          </div>
        </div>
      </div>
    </div>

    {/* Additional deduction sections */}
    <div className="alert alert-info">
      <i className="fas fa-info-circle me-2"></i> Additional deduction sections
      will include travel expenses, clothing expenses, self-education, and other
      work-related expenses.
    </div>

    <div className="d-flex justify-content-between mt-4">
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => goToNextTab("deductions-tab", "income-tab")}
      >
        <i className="fas fa-arrow-left me-2"></i> Previous: Income
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => goToNextTab("deductions-tab", "offsets-tab")}
      >
        Next: Tax Offsets <i className="fas fa-arrow-right ms-2"></i>
      </button>
    </div>
  </div>
);

export default DeductionsTabContent;
