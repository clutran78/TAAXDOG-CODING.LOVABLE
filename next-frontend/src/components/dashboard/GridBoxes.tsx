"use client";
import React, { useEffect, useState } from "react";
import { displayTransactionSummary, initializeMockData, loadIncomeDetails, setupFinancialFeatureHandlers, updateBankConnectionsDisplay, updateSubscriptionDisplays } from '@/services/helperFunction';
import AlertMessage from "@/shared/alerts";
import NetIncomeModal from "@/shared/modals/NetIncomeModal";
import NetBalanceDetails from "@/shared/modals/NetBalanceDetailsModal";
import SubscriptionsModal from "@/shared/modals/ManageSubscriptionsModal";
import { auth, db } from '../../lib/firebase';
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import GoalsDashboardCard from "../Goal/GoalDashboardCard";
import GoalsModal from "../Goal/DashboardGoalModal";


const GridBoxes = () => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);
  const [showFullGoalsModal, setShowFullGoalsModal] = useState(false);

  const [alert, setAlert] = useState<{ message: string; type: string } | null>(null);

  const [showNetBalanceDetailsModal, setShowNetBalanceDetailsModal] = useState(false)

  // Example: useEffect for auth state
  useEffect(() => {
    if (showNetIncomeModal) {
      // Give React time to render the modal content
      setTimeout(() => {
        loadIncomeDetails();
      }, 0);
    }
  }, [showNetIncomeModal]);

  useEffect(() => {
    const loadSubscriptions = async () => {
      try {



        onAuthStateChanged(auth, async (user) => {

          if (!user) {
            console.error('No authenticated user found. Cannot fetch user-specific data.');
            return;
          }

          const q = query(
            collection(db, 'subscriptions'),
            where('userId', '==', user?.uid)
          );


          const snapshot = await getDocs(q)

          const subscriptions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          setTimeout(() => {
            setupFinancialFeatureHandlers();
            updateBankConnectionsDisplay();
            updateSubscriptionDisplays(subscriptions);
          }, 0);
        })
      } catch (error) {
        console.error("Failed to load subscriptions:", error);
      }
    };
    loadSubscriptions()
  }, []);


  const handleShowNetIncomeModal = () => setShowNetIncomeModal(true)

  const handleCloseNetIncomeModal = () => setShowNetIncomeModal(false);

  const handleShowNetBalanceDetails = () => setShowNetBalanceDetailsModal(true);

  const handleCloseNetBalanceDetails = () => setShowNetBalanceDetailsModal(false);


  useEffect(() => {
    const initializeApp = () => {
      const dataCreated = initializeMockData();
      if (dataCreated) {
        // setAlert({
        //   message: 'All set! Your data is ready—start exploring your dashboard.',
        //   type: 'success',
        // });
        // Auto-dismiss after 5 seconds
        setTimeout(() => setAlert(null), 3000);
      }
    };
    initializeApp();
    getBankTransactions();
  }, [])

  const getBankTransactions = async () => {
    // const transactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]');


    onAuthStateChanged(auth, async (user) => {

      if (!user) {
        console.error('No authenticated user found. Cannot fetch user-specific data.');
        return;
      }

      const q = query(
        collection(db, 'bankTransactions'),
        where('userId', '==', user?.uid)
      );

      const transactions = await getDocs(q);

      if (transactions) {
        displayTransactionSummary()
      }
    })
  }

  return (
    <>
      {alert && <AlertMessage message={alert.message} type={alert.type as any} />}

      {showFullGoalsModal && (
        <GoalsModal onClose={() => setShowFullGoalsModal(false)} />
      )}

      <div className="col-md-3 mb-4 cursor-pointer" onClick={handleShowNetIncomeModal}>
        <div
          className="card stats-card h-100 cursor-pointer"
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
            >
              <i className="fas fa-arrow-up"></i> +12.3% from last month
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-3 mb-4 cursor-pointer" id="view-expense-categories-btn">
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
            >
              <i className="fas fa-arrow-down"></i> -8.1% from last month
            </div>
          </div>
        </div>
      </div>

      <div className="col-md-3 mb-4">
        <div
          className="card stats-card h-100 cursor-pointer"
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


      {/* Subscription */}
      <div className="col-md-3 mb-4">
        <div className="card stats-card h-100 cursor-pointer" id="subscriptions-card" data-card="subscriptions" >
          <div className="card-header">
            Subscriptions
            <i className="fas fa-repeat subscription-icon"></i>
          </div>
          <div className="card-body">
            <div className="stat-value">$<span id="total-subscriptions-value">0.00</span></div>
            <div className="stat-change neutral-change">
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

      <NetBalanceDetails
        show={showNetBalanceDetailsModal}
        handleClose={handleCloseNetBalanceDetails}
      />

      <SubscriptionsModal />


      {/* ////////////////////////////////////////////////////////////////////////////////////////////////  Goal Progress  */}


      {/* <!-- Second Row - Goals, Notifications, and Bank Accounts --> */}
      <div className="row mt-3">
        {/* <!-- Left Side - Goals --> */}

        <div className="col-md-6">
          {/* <!-- Goals Card --> */}
          <GoalsDashboardCard onOpenModal={() => setShowFullGoalsModal(true)} />
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
                    <p>No bank accounts connected yet. Click the &quot;Connect Bank&quot; button in the top-right corner to get started.</p>
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
