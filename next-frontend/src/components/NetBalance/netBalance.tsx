"use client";

import { useEffect, useState } from "react";
import { loadIncomeDetails, loadNetBalanceDetails, openDetailedExpensesModal, setupFinancialFeatureHandlers } from "@/services/helperFunction";
import NetIncomeModal from "@/shared/modals/NetIncomeModal";


const NetBalanceDetailsComponent = () => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      loadNetBalanceDetails();
      loadIncomeDetails()
      setupFinancialFeatureHandlers()
    }, 10);
  }, [showNetIncomeModal]);

  const handleCloseNetIncomeModal = () => {
    setShowNetIncomeModal(!showNetIncomeModal);
  };


  return (
    <div className="container py-4" id="net-balance-page">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>
          <i className="fas fa-balance-scale text-primary me-2"></i>Net Balance
          Details
        </h3>
        {/* <button className="btn btn-outline-secondary" onClick={handleClose}>
          Close
        </button> */}
      </div>

      {/* Net Balance Card */}
      <div className="card bg-primary text-white mb-4">
        <div className="card-body d-flex justify-content-between align-items-center">
          <h4 className="mb-0">Net Balance</h4>
          <h3 className="mb-0" id="modal-net-balance-value">
            $0.00
          </h3>
        </div>
      </div>

      <div className="row">
        {/* Income Section */}
        <div className="col-md-6 mb-3">
          <div className="card h-100">
            <div className="card-header bg-success bg-opacity-10 text-success d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Total Income</h5>
              <i className="fas fa-arrow-circle-up"></i>
            </div>
            <div className="card-body">
              <h3 className="text-success" id="modal-balance-income-value">
                $0.00
              </h3>
              <div className="mt-3">
                <h6>Top Income Sources:</h6>
                <div id="balance-income-sources"></div>
                <div className="mt-3">
                  <button
                    className="btn btn-outline-success btn-sm"
                    onClick={handleCloseNetIncomeModal}
                  >
                    <i className="fas fa-list me-1"></i> View All Income
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses Section */}
        <div className="col-md-6 mb-3">
          <div className="card h-100">
            <div className="card-header bg-danger bg-opacity-10 text-danger d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Total Expenses</h5>
              <i className="fas fa-arrow-circle-down"></i>
            </div>
            <div className="card-body">
              <h3 className="text-danger" id="modal-balance-expenses-value">
                $0.00
              </h3>
              <div className="mt-3">
                <h6>Top Expense Categories:</h6>
                <div id="balance-expense-categories"></div>
                <div className="mt-3">
                  <button className="btn btn-outline-danger btn-sm"  onClick={()=>openDetailedExpensesModal()}>
                    <i className="fas fa-list me-1"></i> View All Expenses
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Balance Trend */}
      <div className="card mt-4">
        <div className="card-header bg-light">
          <h5 className="mb-0">
            <i className="fas fa-chart-line me-2"></i>Monthly Balance Trend
          </h5>
        </div>
        <div className="card-body text-center py-3">
          <i className="fas fa-chart-line fa-3x text-primary mb-3"></i>
          <p>Balance trend visualization would appear here</p>
        </div>
      </div>

      {/* Detailed Expenses Section (static container) */}
      {/* <div className="card mt-5" id="detailed-expenses-section">
        <div className="card-header">
          <h5 className="mb-0">
            <i className="fas fa-receipt text-danger me-2"></i>Detailed Expenses
          </h5>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-6">
              <div className="card bg-light">
                <div className="card-body d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Total Expenses</h4>
                  <h3 className="text-danger mb-0" id="modal-detailed-expenses-value">
                    $0.00
                  </h3>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  id="expense-search"
                  placeholder="Search expenses..."
                />
                <button className="btn btn-primary" id="expense-search-btn">
                  <i className="fas fa-search"></i>
                </button>
              </div>
            </div>
          </div>

          <div id="no-expenses-message" className="alert alert-info d-none">
            <i className="fas fa-info-circle me-2"></i>No expenses found. Connect your bank account to see your
            expenses.
          </div>

          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody id="expenses-table-body">
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-footer d-flex justify-content-end">
          <button className="btn btn-primary" id="view-expense-categories-btn">
            <i className="fas fa-chart-pie me-2"></i>View Expense Categories
          </button>
        </div>
      </div> */}

      {/* Optional Modals for extra views */}
      <NetIncomeModal show={showNetIncomeModal} handleClose={handleCloseNetIncomeModal} />

{/* Detailed Expenses */}
        <div className="modal fade" id="detailed-expenses-modal"  aria-labelledby="detailed-expenses-modal-label"
        aria-hidden="true">
        <div className="modal-dialog modal-xl">
            <div className="modal-content">
                <div className="modal-header">
                    <h5 className="modal-title" id="detailed-expenses-modal-label">
                        <i className="fas fa-receipt text-danger me-2"></i>Detailed Expenses
                    </h5>
                    <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div className="modal-body">
                    <div className="row mb-4">
                        <div className="col-md-6">
                            <div className="card bg-light">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h4 className="mb-0">Total Expenses</h4>
                                        <h3 className="text-danger mb-0" id="modal-detailed-expenses-value">$0.00</h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="input-group">
                                <input type="text" className="form-control" id="expense-search"
                                    placeholder="Search expenses..." />
                                <button className="btn btn-primary" type="button" id="expense-search-btn">
                                    <i className="fas fa-search"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div id="no-expenses-message" className="alert alert-info d-none">
                        <i className="fas fa-info-circle me-2"></i>No expenses found. Connect your bank account to see your
                        expenses.
                    </div>

                    <div className="table-responsive">
                        <table className="table table-hover">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Merchant</th>
                                    <th>Category</th>
                                    <th>Account</th>
                                    <th className="text-end">Amount</th>
                                </tr>
                            </thead>
                            <tbody id="expenses-table-body">
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" className="btn btn-primary" id="view-expense-categories-btn">
                        <i className="fas fa-chart-pie me-2"></i>View Expense Categories
                    </button>
                </div>
            </div>
        </div>
       </div>
       
    </div>
  );
};

export default NetBalanceDetailsComponent;
