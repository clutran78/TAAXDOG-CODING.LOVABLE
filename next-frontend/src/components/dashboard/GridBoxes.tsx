"use client";
import ExpenseCategoriesModal from "@/shared/modals/ExtenseCategoryModal";
import ManageSubscriptionsModal from "@/shared/modals/ManageSubscriptionsModalWrapper";
import NetBalanceDetails from "@/shared/modals/NetBalanceDetailsModal";
import NetIncomeModal from "@/shared/modals/NetIncomeModal";
import React, { useState } from "react";

const GridBoxes = () => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);
  const handleShowNetIncomeModal = () => setShowNetIncomeModal(true);
  const handleCloseNetIncomeModal = () => setShowNetIncomeModal(false);

  const [showNetBalanceDetailsModal, setShowNetBalanceDetailsModal] =
    useState(false);
  const handleShowNetBalanceDetails = () => setShowNetBalanceDetailsModal(true);
  const handleCloseNetBalanceDetails = () =>
    setShowNetBalanceDetailsModal(false);

  const [showExpenseCategoriesModal, setShowExpenseCategoriesModal] =
    useState(false);
  const handleShowExpenseCategoriesModal = () =>
    setShowExpenseCategoriesModal(true);
  const handleCloseExpenseCategoriesModal = () =>
    setShowExpenseCategoriesModal(false);

  const [showManageSubscriptionsModal, setShowManageSubscriptionsModal] =
    useState(false);

  // Function to open the modal
  const handleOpenManageSubscriptionsModal = () =>
    setShowManageSubscriptionsModal(true);

  // Function to close the modal
  const handleCloseManageSubscriptionsModal = () =>
    setShowManageSubscriptionsModal(false);
  return (
    <>
      <div className="col-md-3 mb-4">
        <div
          className="card stats-card h-100"
          id="net-income-card"
          data-card="net-income"
        >
          <div className="card-header">
            Net Income
            <i className="fas fa-arrow-circle-up income-icon"></i>
          </div>
          <div className="card-body">
            <div className="stat-value" id="net-income-value">
              $0.00
            </div>
            <div
              className="stat-change positive-change cursor-pointer"
              onClick={handleShowNetIncomeModal}
            >
              <i className="fas fa-arrow-up"></i> +12.3% from last month
            </div>
          </div>
        </div>
      </div>
      <div className="col-md-3 mb-4">
        <div
          className="card stats-card h-100"
          id="total-expenses-card"
          data-card="total-expenses"
        >
          <div className="card-header">
            Total Expenses
            <i className="fas fa-arrow-circle-down expense-icon"></i>
          </div>
          <div className="card-body">
            <div className="stat-value" id="total-expenses-value">
              $0.00
            </div>
            <div
              className="stat-change negative-change cursor-pointer"
              onClick={handleShowExpenseCategoriesModal}
            >
              <i className="fas fa-arrow-down"></i> -8.1% from last month
            </div>
          </div>
        </div>
      </div>
      <div className="col-md-3 mb-4">
        <div
          className="card stats-card h-100"
          id="net-balance-card"
          data-card="net-balance"
        >
          <div className="card-header">
            Net Balance
            <i className="fas fa-balance-scale balance-icon"></i>
          </div>
          <div className="card-body">
            <div className="stat-value" id="net-balance-value">
              $0.00
            </div>
            <div
              className="stat-change positive-change cursor-pointer"
              onClick={handleShowNetBalanceDetails}
            >
              <i className="fas fa-arrow-up"></i> +15.2% from last month
            </div>
          </div>
        </div>
      </div>
      <div className="col-md-3 mb-4">
        <div
          className="card stats-card h-100"
          id="subscriptions-card"
          data-card="subscriptions"
        >
          <div className="card-header">
            Subscriptions
            <i className="fas fa-repeat subscription-icon"></i>
          </div>
          <div className="card-body">
            <div className="stat-value">
              $<span id="total-subscriptions-value">0.00</span>
            </div>
            <div
              className="stat-change neutral-change"
              onClick={handleOpenManageSubscriptionsModal}
            >
              <span id="subscription-count">0</span> active subscriptions
            </div>
          </div>
        </div>
      </div>
      {/* NetIncomeModal component */}
      <NetIncomeModal
        show={showNetIncomeModal}
        handleClose={handleCloseNetIncomeModal}
      />

      <ExpenseCategoriesModal
        show={showExpenseCategoriesModal}
        handleClose={handleCloseExpenseCategoriesModal}
      />

      <NetBalanceDetails
        show={showNetBalanceDetailsModal}
        handleClose={handleCloseNetBalanceDetails}
      />

      <ManageSubscriptionsModal
        show={showManageSubscriptionsModal}
        handleClose={handleCloseManageSubscriptionsModal}
      />
    </>
  );
};

export default GridBoxes;
