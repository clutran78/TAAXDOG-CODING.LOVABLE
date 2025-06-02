"use client";

import { useEffect, useState } from "react";
import {
  loadNetBalanceDetails,
  setupFinancialFeatureHandlers,
} from "@/services/helperFunction";
import NetIncomePage from "../NetIncome/netIncomePage";
import TotalExpensesPage from "../totalExpenses/totalExpensesPage";
import BalanceCard from "../NetIncome/balance-card";

const NetBalanceDetailsComponent = () => {
  const [showExpensesPage, setShowExpensesPage] = useState(false);
  const [showViewIncomePage, setShowViewIncomePage] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      loadNetBalanceDetails();
      setupFinancialFeatureHandlers();
    }, 10);
  }, [showExpensesPage, showViewIncomePage]);

  const handlePage = (type: string) => {
    if (type === "View All Expenses") {
      setShowExpensesPage(true);
    } else if (type === "net-income") {
      setShowViewIncomePage(true);
    }
  };

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

      {!showViewIncomePage && !showExpensesPage && (
        <div className="container py-4" id="net-balance-page">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3>
              <i className="fas fa-balance-scale text-primary me-2"></i>Net
              Balance Details
            </h3>
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
              <BalanceCard
                title="Income"
                valueId="modal-balance-income-value"
                value="$0.00"
                iconClass="fas fa-arrow-circle-up"
                buttonClass="bg-success bg-opacity-10 text-success"
                onClick={() => handlePage("net-income")}
                categoriesId="balance-income-sources"
                buttonText="View All Income"
              />
            </div>

            {/* Expenses Section */}
            <div className="col-md-6 mb-3">
              <BalanceCard
                title="Expenses"
                valueId="modal-balance-expenses-value"
                value="$0.00"
                iconClass="fas fa-arrow-circle-down"
                buttonClass="bg-danger bg-opacity-10 text-danger"
                onClick={() => handlePage("View All Expenses")}
                categoriesId="balance-expense-categories"
                buttonText="View All Expenses"
              />
            </div>
          </div>

          {/* Monthly Balance Trend */}
          <div className="card mt-4">
            <div className="card-header">
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
      )}
    </>
  );
};

export default NetBalanceDetailsComponent;
