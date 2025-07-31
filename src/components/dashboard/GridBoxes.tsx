'use client';
import React, { useEffect, useState } from 'react';
import {
  formatCurrency,
  loadIncomeDetails,
  setupFinancialFeatureHandlers,
  updateBankConnectionsDisplay,
} from '@/services/helperFunction.js';
import AlertMessage from '@/shared/alerts';
import NetIncomeModal from '@/shared/modals/NetIncomeModal';
import NetBalanceDetails from '@/shared/modals/NetBalanceDetailsModal';
import SubscriptionsModal from '@/shared/modals/ManageSubscriptionsModal';
import GoalsDashboardCard from '../Goal/GoalDashboardCard';
import GoalsModal from '../Goal/DashboardGoalModal';
import Cookies from 'js-cookie';
import { getData } from '@/services/api/apiController';
import StatCard from './stats-card';
import BankAccountsCard from './bank-accounts-card';
import { fetchBankTransactions, fetchSubscriptions } from '@/services/firebase-service';

const GridBoxes = () => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);
  const [showFullGoalsModal, setShowFullGoalsModal] = useState(false);

  const [connections, setConnections] = useState([]);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<any>(null);
  const [transactions, setTransactions] = useState({
    income: '$0.00',
    expenses: '$0.00',
    netBalance: '$0.00',
    subscriptions: '$0.00',
    activeSubscriptions: 0,
  });

  const [alert, setAlert] = useState<{ message: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [showNetBalanceDetailsModal, setShowNetBalanceDetailsModal] = useState(false);

  useEffect(() => {
    if (showNetIncomeModal) {
      loadIncomeDetails();
    }
  }, [showNetIncomeModal]);

  useEffect(() => {
    fetchConnections();
    loadSubscriptions();
    getBankTransactions();
  }, []);

  const fetchConnections = async () => {
    const token = Cookies.get('auth-token');
    if (!token) {
      setConnectionError('Not authenticated');
      return;
    }

    setConnectionLoading(true);
    setConnectionError(null);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const res = await getData('/api/banking/accounts', config);

      if (res.success) {
        setConnections(res.accounts?.data || []);
      } else {
        setConnectionError(res.error || 'Failed to load connections');
      }
    } catch (err: any) {
      setConnectionError(err?.error || 'Something went wrong');
    } finally {
      setConnectionLoading(false);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const subscriptions = await fetchSubscriptions();
      let totalMonthlyCost = 0;

      subscriptions.forEach((subscription) => {
        let amount = parseFloat(subscription.amount || 0);
        if (isNaN(amount)) amount = 0;

        switch (subscription.frequency) {
          case 'yearly':
            amount = amount / 12;
            break;
          case 'quarterly':
            amount = amount / 3;
            break;
          case 'weekly':
            amount = amount * 4.33;
            break;
        }

        totalMonthlyCost += amount;
      });

      setTransactions((prev) => ({
        ...prev,
        subscriptions: formatCurrency(totalMonthlyCost),
        activeSubscriptions: subscriptions.length,
      }));

      setupFinancialFeatureHandlers();
      updateBankConnectionsDisplay();
      // updateSubscriptionDisplays(subscriptions);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    }
  };

  const handleShowNetIncomeModal = () => setShowNetIncomeModal(true);

  const handleCloseNetIncomeModal = () => setShowNetIncomeModal(false);

  const handleShowNetBalanceDetails = () => setShowNetBalanceDetailsModal(true);

  const handleCloseNetBalanceDetails = () => setShowNetBalanceDetailsModal(false);

  const getBankTransactions = async () => {
    try {
      setLoading(true);
      const transactions = await fetchBankTransactions();
      if (transactions.length === 0) {
        return;
      }

      const income = transactions.reduce((sum, tx) => {
        const amount = parseFloat(tx.amount || '0');
        return sum + (amount > 0 ? amount : 0);
      }, 0);

      const expenses = transactions.reduce((sum, tx) => {
        const amount = parseFloat(tx.amount || '0');
        return sum + (amount < 0 ? Math.abs(amount) : 0);
      }, 0);

      const netBalance = income - expenses;

      setTransactions((prev) => ({
        ...prev,
        income: formatCurrency(income),
        expenses: formatCurrency(expenses),
        netBalance: formatCurrency(netBalance),
      }));
    } catch (error) {
      console.error('Failed to load bank transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {alert && (
        <AlertMessage
          message={alert.message}
          type={alert.type as any}
        />
      )}

      {showFullGoalsModal && <GoalsModal onClose={() => setShowFullGoalsModal(false)} />}

      <StatCard
        id="net-income-card"
        dataCard="net-income"
        title="Net Income"
        iconClass="fas fa-arrow-circle-up income-icon"
        value={transactions.income ? `${transactions.income}` : '$0.00'}
        valueId="net-income-value"
        change="+12.3% from last month"
        changeType="positive"
        arrowIcon={<i className="fas fa-arrow-up"></i>}
        onClick={handleShowNetIncomeModal}
        loading={loading}
      />

      <StatCard
        id="total-expenses-card"
        dataCard="total-expenses"
        title="Total Expenses"
        iconClass="fas fa-arrow-circle-down expense-icon"
        value={transactions.expenses ? `${transactions.expenses}` : '$0.00'}
        valueId="total-expenses-value"
        change="-8.1% from last month"
        changeType="negative"
        arrowIcon={<i className="fas fa-arrow-down"></i>}
        loading={loading}
      />

      <StatCard
        id="net-balance-card"
        dataCard="net-balance"
        title="Net Balance"
        iconClass="fas fa-balance-scale balance-icon"
        value={transactions.netBalance ? `${transactions.netBalance}` : '$0.00'}
        valueId="net-balance-value"
        change="+15.2% from last month"
        changeType="positive"
        arrowIcon={<i className="fas fa-arrow-up"></i>}
        onClick={handleShowNetBalanceDetails}
        loading={loading}
      />

      <StatCard
        id="subscriptions-card"
        dataCard="subscriptions"
        title="Subscriptions"
        iconClass="fas fa-repeat subscription-icon"
        value={transactions.subscriptions ? transactions.subscriptions : '$0.00'}
        valueId=""
        change={
          <>
            <span id="subscription-count">{transactions.activeSubscriptions || 0}</span> active
            subscriptions
          </>
        }
        changeType="neutral"
        loading={loading}
      />

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

      {/* <!-- Second Row - Goals, Notifications, and Bank Accounts --> */}
      <div className="row mt-3 p-0 m-0">
        {/* <!-- Left Side - Goals --> */}

        <div className="col-md-12 col-lg-6">
          {/* <!-- Goals Card --> */}
          <GoalsDashboardCard onOpenModal={() => setShowFullGoalsModal(true)} />
        </div>

        {/* <!-- Right Side - Bank Accounts and Notifications --> */}
        <div className="col-md-12 col-lg-6 mt-4 mt-lg-0">
          <BankAccountsCard
            connections={connections}
            connectionLoading={connectionLoading}
            connectionError={connectionError}
          />
        </div>
      </div>
    </>
  );
};

export default GridBoxes;
