import React from 'react';

interface Props {
  goToNextTab: (fromId: string, toId: string) => void;
}

const IncomeTabContent: React.FC<Props> = ({ goToNextTab }) => (
  <div
    className="tab-pane fade"
    id="income-content"
    role="tabpanel"
  >
    <h4 className="mb-3">Employment Income</h4>
    <div className="row g-3 mb-3">
      <div className="col-md-12">
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          id="add-employer"
        >
          <i className="fas fa-plus"></i> Add Employer
        </button>
      </div>
      <div
        className="col-md-12"
        id="employers-container"
      >
        {/* Employer details will be added here */}
      </div>
    </div>

    <h4 className="mb-3 mt-4">Investment Income</h4>
    <div className="row g-3">
      <div className="col-md-6">
        <label
          htmlFor="interest-income"
          className="form-label"
        >
          Interest from Bank Accounts
        </label>
        <input
          type="number"
          className="form-control"
          id="interest-income"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-md-6">
        <label
          htmlFor="dividend-income"
          className="form-label"
        >
          Dividends from Investments
        </label>
        <input
          type="number"
          className="form-control"
          id="dividend-income"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-md-6">
        <label
          htmlFor="trust-income"
          className="form-label"
        >
          Trust Distributions
        </label>
        <input
          type="number"
          className="form-control"
          id="trust-income"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-md-6">
        <label
          htmlFor="rental-income"
          className="form-label"
        >
          Rental Property Income
        </label>
        <input
          type="number"
          className="form-control"
          id="rental-income"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-md-6">
        <label
          htmlFor="capital-gains"
          className="form-label"
        >
          Capital Gains
        </label>
        <input
          type="number"
          className="form-control"
          id="capital-gains"
          min="0"
          step="0.01"
        />
        <small className="text-muted">Including cryptocurrency</small>
      </div>
    </div>

    <h4 className="mb-3 mt-4">Government Payments</h4>
    <div className="row g-3">
      <div className="col-md-6">
        <label
          htmlFor="govt-payment-type"
          className="form-label"
        >
          Types of Pensions or Benefits
        </label>
        <input
          type="text"
          className="form-control"
          id="govt-payment-type"
        />
      </div>
      <div className="col-md-3">
        <label
          htmlFor="govt-payment-amount"
          className="form-label"
        >
          Amount Received
        </label>
        <input
          type="number"
          className="form-control"
          id="govt-payment-amount"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-md-3">
        <label
          htmlFor="govt-payment-tax"
          className="form-label"
        >
          Tax Withheld
        </label>
        <input
          type="number"
          className="form-control"
          id="govt-payment-tax"
          min="0"
          step="0.01"
        />
      </div>
    </div>

    <h4 className="mb-3 mt-4">Other Income</h4>
    <div className="row g-3">
      <div className="col-md-6">
        <label
          htmlFor="foreign-income"
          className="form-label"
        >
          Foreign Income
        </label>
        <input
          type="number"
          className="form-control"
          id="foreign-income"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-md-6">
        <label
          htmlFor="business-income"
          className="form-label"
        >
          Business Income
        </label>
        <input
          type="number"
          className="form-control"
          id="business-income"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-md-6">
        <label
          htmlFor="super-income"
          className="form-label"
        >
          Superannuation Income
        </label>
        <input
          type="number"
          className="form-control"
          id="super-income"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-md-6">
        <label
          htmlFor="partnership-income"
          className="form-label"
        >
          Income from Partnerships and Trusts
        </label>
        <input
          type="number"
          className="form-control"
          id="partnership-income"
          min="0"
          step="0.01"
        />
      </div>
    </div>

    <div className="d-flex justify-content-between mt-4">
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={() => goToNextTab('income-tab', 'personal-tab')}
      >
        <i className="fas fa-arrow-left me-2"></i> Previous: Personal
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => goToNextTab('income-tab', 'deductions-tab')}
      >
        Next: Deductions <i className="fas fa-arrow-right ms-2"></i>
      </button>
    </div>
  </div>
);

export default IncomeTabContent;
