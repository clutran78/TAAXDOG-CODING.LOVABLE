"use client";

import { useEffect, useState } from "react";
import { loadIncomeDetails, loadNetBalanceDetails, setupFinancialFeatureHandlers } from "@/services/helperFunction";
import NetIncomePage from "../NetIncome/netIncomePage";
import TotalExpensesPage from "../totalExpenses/totalExpensesPage";


const NetBalanceDetailsComponent = () => {
  const [showExpensesPage, setShowExpensesPage] = useState(false);
  const [showViewIncomePage, setShowViewIncomePage] = useState(false);


  useEffect(() => {
    setTimeout(() => {
      loadNetBalanceDetails();
      loadIncomeDetails()
      setupFinancialFeatureHandlers()
    }, 10);
  }, [showExpensesPage ,showViewIncomePage]);


  const handlePage = (type: string) => {
    if (type === 'View All Expenses') {
      setShowExpensesPage(true)
    } else if (type === 'net-income') {
      setShowViewIncomePage(true)
    }
  }

  const handleGoBack = () => {
    setShowExpensesPage(false);
    setShowViewIncomePage(false);
  };

  return (
    <>
       {/* Back button only when inside sub-pages */}
      {(showExpensesPage || showViewIncomePage) && (
        <div className="mb-3">
          <button className="btn btn-outline-secondary" onClick={handleGoBack}>
            <i className="fas fa-arrow-left me-1"></i>Back
          </button>
        </div>
      )}

      {showExpensesPage && <TotalExpensesPage />}

      {showViewIncomePage && <NetIncomePage />}


      {!showViewIncomePage && !showExpensesPage &&
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
                        onClick={() => handlePage('net-income')}
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
                      <button className="btn btn-outline-danger btn-sm"
                        // onClick={()=>openDetailedExpensesModal()}
                        onClick={() => handlePage('View All Expenses')}
                      >
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
        </div>
      }
    </>
  );
};

export default NetBalanceDetailsComponent;
