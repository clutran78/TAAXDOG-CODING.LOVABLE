"use client";
import React, { useEffect, useState } from "react";
import { displayTransactionSummary, formatCurrency, initializeMockData, loadBankAccountsContent, loadDetailedExpenses, loadIncomeDetails, openExpenseCategoriesModal, setupExpenseSearch, setupFinancialFeatureHandlers, updateBankConnectionsDisplay, updateElementText } from '@/services/helperFunction';
import AlertMessage from "@/shared/alerts";
import ExpenseCategoriesModal from "@/shared/modals/ExpenseCategoriesModal";
import ManageSubscriptionsModal from "@/shared/modals/ManageSubscriptionsModal";
import NetIncomeModal from "@/shared/modals/NetIncomeModal";
import NetBalanceDetails from "@/shared/modals/NetBalanceDetailsModal";

const GridBoxes = () => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);

  const [alert, setAlert] = useState<{ message: string; type: string } | null>(null);

  const [showNetBalanceDetailsModal, setShowNetBalanceDetailsModal] = useState(false)
  const [showExpenseCategoriesModal, setShowExpenseCategoriesModal] = useState(false)

  useEffect(() => {
    if (showNetIncomeModal) {
      // Give React time to render the modal content
      setTimeout(() => {
        loadIncomeDetails();
      }, 0);
    }
  }, [showNetIncomeModal]);

  useEffect(() => {
    // Give React time to render the modal content
    setTimeout(() => {
      setupFinancialFeatureHandlers()
      updateBankConnectionsDisplay()
    }, 0)
  }, [])


  const handleShowNetIncomeModal = () => {
    setShowNetIncomeModal(true)
  }

  const handleCloseNetIncomeModal = () => setShowNetIncomeModal(false);


  const handleShowExpenseCategoriesModal = () => setShowExpenseCategoriesModal(true)

  const handleCloseExpenseCategoriesModal = () => setShowExpenseCategoriesModal(false)


  const [showManageSubscriptionsModal, setShowManageSubscriptionsModal] =
    useState(false);

  // Function to open the modal
  const handleOpenManageSubscriptionsModal = () =>
    setShowManageSubscriptionsModal(true);

  // Function to close the modal
  const handleCloseManageSubscriptionsModal = () =>
    setShowManageSubscriptionsModal(false);

  useState(false);
  const handleShowNetBalanceDetails = () => setShowNetBalanceDetailsModal(true);

  const handleCloseNetBalanceDetails = () =>
    setShowNetBalanceDetailsModal(false);


  useEffect(() => {
    const initializeApp = () => {
      const dataCreated = initializeMockData();
      if (dataCreated) {
        setAlert({
          message: 'Demo data has been initialized. You can now explore the app features.',
          type: 'success',
        });
        // Auto-dismiss after 5 seconds
        setTimeout(() => setAlert(null), 3000);
      }
    };

    initializeApp();

    let transactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]');
    if (transactions) {
      displayTransactionSummary()
    }

  }, [])


  return (
    <>
      {alert && <AlertMessage message={alert.message} type={alert.type as any} />}

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
              id="view-expense-categories-btn"
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


      {/* <ExpenseCategoriesModal
        show={showExpenseCategoriesModal}
        handleClose={handleCloseExpenseCategoriesModal}
      /> */}

      <NetBalanceDetails
        show={showNetBalanceDetailsModal}
        handleClose={handleCloseNetBalanceDetails}
      />

      <ManageSubscriptionsModal
        show={showManageSubscriptionsModal}
        handleClose={handleCloseManageSubscriptionsModal}
      />

      {/* ////////////////////////////////////////////////////////////////////////////////////////////////  Goal Progress  */}

      {/* <!-- Second Row - Goals, Notifications, and Bank Accounts --> */}
      <div className="row mt-3">
        {/* <!-- Left Side - Goals --> */}
        <div className="col-md-6">
          {/* <!-- Goals Card --> */}
          <div className="card tile-card h-100 cursor-pointer" data-tile-type="goals" id="goals-card" >
            <div className="card-header">
              {/* Goals Progress */}
              <i className="fas fa-bullseye text-warning"></i>
            </div>
            <div className="card-body">
              <div className="scrollable-content">
                <h3>3 Active Goals</h3>
                <div className="stat-change positive-change mb-4">
                  <i className="fas fa-check-circle"></i> 60% Complete from last month
                </div>

                {/* <!-- Emergency Fund Goal --> */}
                <div className="goal-item">
                  <div className="goal-details">
                    <span>Emergency Fund</span>
                    <span className="text-success">$5000.00</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar bg-success" role="progressbar" style={{ width: "50%" }} aria-valuenow={50} aria-valuemin={0} aria-valuemax={100}>

                    </div>
                  </div>
                  <div className="d-flex justify-content-between">
                    <small>$5000.00 of $10000.00</small>
                    <small>Due: 30/06/2024</small>
                  </div>
                </div>

                {/* <!-- New Car Goal --> */}
                <div className="goal-item">
                  <div className="goal-details">
                    <span>New Car</span>
                    <span className="text-success">$2500.00</span>
                  </div>
                  <div className="progress">
                    <div className="progress-bar bg-success" role="progressbar" style={{ width: "16.7%" }} aria-valuenow={16.7} aria-valuemin={0} aria-valuemax={100}></div>
                  </div>
                  <div className="d-flex justify-content-between">
                    <small>$2500.00 of $15000.00</small>
                    <small>Due: 31/12/2024</small>
                  </div>
                </div>

                {/* <!-- Holiday Goal --> */}
                <div className="goal-item">
                  <div className="goal-details">
                    <span>Holiday</span>
                    <span className="text-success">$1200.00</span>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{ width: "40%" }}
                      aria-valuenow={40}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                  <div className="d-flex justify-content-between">
                    <small>$1200.00 of $3000.00</small>
                    <small>Due: 15/09/2024</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* <!-- Right Side - Bank Accounts and Notifications --> */}
        <div className="col-md-6">
          {/* <!-- Bank Accounts Card --> */}
          <div className="card tile-card mb-3" data-tile-type="bank-accounts" style={{ height: "calc(50% - 10px)" }}>
            <div className="card-header">
              {/* Bank Accounts */}
              <i className="fas fa-university text-primary"></i>
            </div>
            <div className="card-body">
              <div className="scrollable-content">
                <div id="bank-connections-container">
                  {/* <!-- Bank connections will be loaded here --> */}
                  <div className="text-center py-4" id="no-connections-message">
                    <i className="fas fa-university fa-3x mb-3 text-muted"></i>
                    <p>No bank accounts connected yet. Click the "Connect Bank" button in the top-right corner to get started.</p>
                  </div>
                  <div id="dashboard-connections-list" style={{ display: "none" }}>
                    {/* <!-- Bank connections will be loaded here --> */}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* <!-- Notifications Card --> */}
          <div className="card tile-card" data-tile-type="notifications" style={{ height: "calc(50% - 10px)" }}>
            <div className="card-header">
              {/* Notifications */}
              <i className="fas fa-bell text-warning"></i>
            </div>
            <div className="card-body">
              <div className="scrollable-content">
                <h3>2 New Updates</h3>

                {/* <!-- Notifications List --> */}
                <div className="notification-item">
                  <h5>Tax Return Due</h5>
                  <p>Your tax return is due in 2 weeks</p>
                  <p className="notification-date">15/03/2024</p>
                </div>

                <div className="notification-item">
                  <h5>Goal Milestone</h5>
                  <p>Emergency Fund reached 75% of target</p>
                  <p className="notification-date">10/03/2024</p>
                </div>
              </div>

              {/* <!-- Clock Display --> */}
              <div className="clock-display">
                <span id="hours">14</span>:<span id="minutes">31</span>
                <div className="d-flex justify-content-between">
                  <small>min</small>
                  <small>hour</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>





      {/* ////////////////////////////////////////////////////////////////////////////////////////////////   */}
    </>
  );
};

export default GridBoxes;
