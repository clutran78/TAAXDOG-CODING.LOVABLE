'use client';
import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import { logger } from '@/lib/logger';
import {
  formatCurrency,
  loadIncomeDetails,
  setupFinancialFeatureHandlers,
  updateBankConnectionsDisplay,
} from '@/lib/utils/helpers';
import AlertMessage from '@/shared/alerts';
import GoalsDashboardCard from '../Goal/GoalDashboardCard';
import Cookies from 'js-cookie';
import { getData } from '@/lib/services/api/apiController';
import StatCard from './StatsCard';
import BankAccountsCard from './BankAccountsCard';
import { fetchBankTransactions } from '@/lib/services/transaction-service';
import { fetchBillingHistory } from '@/lib/services/subscription-service';
import { lazyLoadModal } from '@/lib/utils/lazyLoad';

// Lazy load modals - they're not needed on initial page load
const NetIncomeModal = lazyLoadModal(() => import('@/shared/modals/NetIncomeModal'));

const NetBalanceDetails = lazyLoadModal(() => import('@/shared/modals/NetBalanceDetailsModal'));

const SubscriptionsModal = lazyLoadModal(() => import('@/shared/modals/ManageSubscriptionsModal'));

const GoalsModal = lazyLoadModal(() => import('../Goal/DashboardGoalModal'));

// Memoized components
const MemoizedStatCard = memo(StatCard);
const MemoizedBankAccountsCard = memo(BankAccountsCard);
const MemoizedGoalsDashboardCard = memo(GoalsDashboardCard);
const MemoizedAlertMessage = memo(AlertMessage);

// Types for better type safety and performance
interface TransactionData {
  income: string;
  expenses: string;
  netBalance: string;
  subscriptions: string;
  activeSubscriptions: number;
}

interface Alert {
  message: string;
  type: string;
}

// Constants outside component to prevent recreation
const INITIAL_TRANSACTIONS: TransactionData = {
  income: '$0.00',
  expenses: '$0.00',
  netBalance: '$0.00',
  subscriptions: '$0.00',
  activeSubscriptions: 0,
};

// Utility function for subscription calculation (pure function)
const calculateMonthlyCost = (amount: number, frequency: string): number => {
  switch (frequency) {
    case 'yearly':
      return amount / 12;
    case 'quarterly':
      return amount / 3;
    case 'weekly':
      return amount * 4.33;
    default:
      return amount; // monthly
  }
};

const GridBoxes = () => {
  // State consolidation
  const [modals, setModals] = useState({
    netIncome: false,
    fullGoals: false,
    netBalanceDetails: false,
  });

  const [connections, setConnections] = useState([]);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<any>(null);
  const [transactions, setTransactions] = useState<TransactionData>(INITIAL_TRANSACTIONS);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(false);

  // Memoized modal handlers
  const toggleModal = useCallback((modalName: keyof typeof modals, value: boolean) => {
    setModals((prev) => ({ ...prev, [modalName]: value }));
  }, []);

  const handleShowNetIncomeModal = useCallback(() => {
    toggleModal('netIncome', true);
  }, [toggleModal]);

  const handleCloseNetIncomeModal = useCallback(() => {
    toggleModal('netIncome', false);
  }, [toggleModal]);

  const handleShowNetBalanceDetails = useCallback(() => {
    toggleModal('netBalanceDetails', true);
  }, [toggleModal]);

  const handleCloseNetBalanceDetails = useCallback(() => {
    toggleModal('netBalanceDetails', false);
  }, [toggleModal]);

  const handleCloseGoalsModal = useCallback(() => {
    toggleModal('fullGoals', false);
  }, [toggleModal]);

  const handleOpenGoalsModal = useCallback(() => {
    toggleModal('fullGoals', true);
  }, [toggleModal]);

  // Optimized fetch connections
  const fetchConnections = useCallback(async () => {
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
  }, []);

  // Optimized load subscriptions with memoized calculation
  const loadSubscriptions = useCallback(async () => {
    try {
      const billingHistory = await fetchBillingHistory();

      // Use reduce for single pass calculation
      const totalMonthlyCost = billingHistory.reduce((total, invoice) => {
        const amount = invoice.amount / 100; // Convert from cents to dollars
        return total + amount;
      }, 0);

      // Count unique active subscriptions
      const activeSubscriptions = billingHistory.filter(
        invoice => invoice.status === 'paid'
      ).length;

      setTransactions((prev) => ({
        ...prev,
        subscriptions: formatCurrency(totalMonthlyCost),
        activeSubscriptions: activeSubscriptions,
      }));

      // These should ideally be moved to a separate effect or called once
      setupFinancialFeatureHandlers();
      updateBankConnectionsDisplay();
    } catch (error) {
      logger.error('Failed to load subscriptions:', error);
    }
  }, []);

  // Optimized bank transactions with single reduce pass
  const getBankTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const transactions = await fetchBankTransactions();

      if (transactions.length === 0) {
        return;
      }

      // Single pass through transactions
      const { income, expenses } = transactions.reduce(
        (acc, tx) => {
          const amount = parseFloat(tx.amount || '0');
          if (amount > 0) {
            acc.income += amount;
          } else {
            acc.expenses += Math.abs(amount);
          }
          return acc;
        },
        { income: 0, expenses: 0 },
      );

      const netBalance = income - expenses;

      setTransactions((prev) => ({
        ...prev,
        income: formatCurrency(income),
        expenses: formatCurrency(expenses),
        netBalance: formatCurrency(netBalance),
      }));
    } catch (error) {
      logger.error('Failed to load bank transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load net income details only when modal is shown
  useEffect(() => {
    if (modals.netIncome) {
      loadIncomeDetails();
    }
  }, [modals.netIncome]);

  // Initial data load - combine related calls
  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      if (!mounted) return;

      // Parallel data fetching
      await Promise.all([fetchConnections(), loadSubscriptions(), getBankTransactions()]);
    };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, [fetchConnections, loadSubscriptions, getBankTransactions]);

  // Memoized stat card props to prevent unnecessary re-renders
  const statCardProps = useMemo(
    () => ({
      netIncome: {
        id: 'net-income-card',
        dataCard: 'net-income',
        title: 'Net Income',
        iconClass: 'fas fa-arrow-circle-up income-icon',
        value: transactions.income,
        valueId: 'net-income-value',
        change: '+12.3% from last month',
        changeType: 'positive' as const,
        arrowIcon: <i className="fas fa-arrow-up"></i>,
        onClick: handleShowNetIncomeModal,
        loading,
      },
      totalExpenses: {
        id: 'total-expenses-card',
        dataCard: 'total-expenses',
        title: 'Total Expenses',
        iconClass: 'fas fa-arrow-circle-down expense-icon',
        value: transactions.expenses,
        valueId: 'total-expenses-value',
        change: '-8.1% from last month',
        changeType: 'negative' as const,
        arrowIcon: <i className="fas fa-arrow-down"></i>,
        loading,
      },
      netBalance: {
        id: 'net-balance-card',
        dataCard: 'net-balance',
        title: 'Net Balance',
        iconClass: 'fas fa-balance-scale balance-icon',
        value: transactions.netBalance,
        valueId: 'net-balance-value',
        change: '+15.2% from last month',
        changeType: 'positive' as const,
        arrowIcon: <i className="fas fa-arrow-up"></i>,
        onClick: handleShowNetBalanceDetails,
        loading,
      },
      subscriptions: {
        id: 'subscriptions-card',
        dataCard: 'subscriptions',
        title: 'Subscriptions',
        iconClass: 'fas fa-repeat subscription-icon',
        value: transactions.subscriptions,
        valueId: '',
        change: (
          <>
            <span id="subscription-count">{transactions.activeSubscriptions}</span> active
            subscriptions
          </>
        ),
        changeType: 'neutral' as const,
        loading,
      },
    }),
    [transactions, loading, handleShowNetIncomeModal, handleShowNetBalanceDetails],
  );

  return (
    <>
      {alert && (
        <MemoizedAlertMessage
          message={alert.message}
          type={alert.type as any}
        />
      )}

      {modals.fullGoals && <GoalsModal onClose={handleCloseGoalsModal} />}

      <MemoizedStatCard {...statCardProps.netIncome} />
      <MemoizedStatCard {...statCardProps.totalExpenses} />
      <MemoizedStatCard {...statCardProps.netBalance} />
      <MemoizedStatCard {...statCardProps.subscriptions} />

      {/* NetIncomeModal component */}
      <NetIncomeModal
        show={modals.netIncome}
        handleClose={handleCloseNetIncomeModal}
      />

      <NetBalanceDetails
        show={modals.netBalanceDetails}
        handleClose={handleCloseNetBalanceDetails}
      />

      <SubscriptionsModal />

      {/* <!-- Second Row - Goals, Notifications, and Bank Accounts --> */}
      <div className="row mt-3 p-0 m-0">
        {/* <!-- Left Side - Goals --> */}
        <div className="col-md-12 col-lg-6">
          {/* <!-- Goals Card --> */}
          <MemoizedGoalsDashboardCard onOpenModal={handleOpenGoalsModal} />
        </div>

        {/* <!-- Right Side - Bank Accounts and Notifications --> */}
        <div className="col-md-12 col-lg-6 mt-4 mt-lg-0">
          <MemoizedBankAccountsCard
            connections={connections}
            connectionLoading={connectionLoading}
            connectionError={connectionError}
          />
        </div>
      </div>
    </>
  );
};

export default memo(GridBoxes);
