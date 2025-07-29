import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

import Head from 'next/head';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/dashboard/Card';
import {
  SkeletonDashboardGrid,
  SkeletonCard,
  Skeleton,
} from '@/components/ui/SkeletonLoaders';
import { ErrorDisplay, NetworkError, EmptyState } from '@/components/ui/ErrorComponents';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useApiError } from '@/hooks/useApiError';
import { lazyLoadComponent } from '@/lib/utils/lazyLoad';

// Constants
const TAB_CONFIG = {
  OVERVIEW: 'overview',
  INSIGHTS: 'insights',
  GOALS: 'goals',
  BANKING: 'banking',
  TAX: 'tax',
} as const;

const RESPONSE_STATUS_OK = 200;
const ESTIMATED_TAX_RATE = 0.25;
const DASHBOARD_GRID_COLS = [1, 2, 3, 4];

// Lazy load InsightsDashboard as it's a heavy component
const InsightsDashboard = lazyLoadComponent(
  () => import('../../components/insights/InsightsDashboard'),
  {
    loading: () => (
      <div className="space-y-4">
        <SkeletonCard className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
        </div>
      </div>
    ),
  },
);

interface DashboardData {
  user: {
    id: string;
    email: string;
    name: string;
    counts?: {
      goals?: number;
      transactions?: number;
      accounts?: number;
    };
  };
  financialSummary: {
    totalBalance: number;
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    transactionCount: number;
    lastTransactionDate: string;
  };
  recentSpending: Array<{
    month: string;
    totalAmount: number;
    transactionCount: number;
  }>;
  goals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    progressPercentage: number;
    daysRemaining: number;
    isOnTrack: boolean;
  }>;
  topCategories: Array<{
    category: string;
    totalAmount: number;
    percentage: number;
    transactionCount: number;
  }>;
  insights: {
    averageMonthlySpending: number;
    goalsOnTrack: number;
    totalActiveGoals: number;
  };
  lastUpdated: string;
}

// Memoized stat card component
const StatCard = memo<{
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  colorClass?: string;
  subtitleCount?: number;
  loading?: boolean;
}>(
  ({
    title,
    value,
    subtitle,
    icon,
    colorClass = 'text-gray-900',
    subtitleCount,
    loading = false,
  }) => (
    <Card>
      <CardContent className="p-6">
        {loading ? (
          <div className="space-y-2">
            <Skeleton height={20} width="60%" rounded />
            <Skeleton height={32} width="80%" rounded />
            <Skeleton height={16} width="40%" rounded />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <span className="text-lg">{icon}</span>
            </div>
            <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500">
                {subtitle}
                {typeof subtitleCount === 'number' && ` (${subtitleCount})`}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  ),
);
StatCard.displayName = 'StatCard';

// Memoized Goal Card component
const GoalCard = memo<{
  goal: DashboardData['goals'][0];
  formatCurrency: (amount: number) => string;
}>(({ goal, formatCurrency }) => (
  <div className="bg-white p-4 border border-gray-200 rounded-lg">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-medium text-gray-900 truncate">{goal.name}</h3>
      <span className={`text-sm px-2 py-1 rounded ${goal.isOnTrack ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
        {goal.isOnTrack ? 'On Track' : 'Behind'}
      </span>
    </div>
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Progress</span>
        <span className="font-medium">{goal.progressPercentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(goal.progressPercentage, ESTIMATED_TAX_RATE * 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">
          {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
        </span>
        <span className="text-gray-600">{goal.daysRemaining} days left</span>
      </div>
    </div>
  </div>
));
GoalCard.displayName = 'GoalCard';

// Memoized Category Card component
const CategoryCard = memo<{
  category: DashboardData['topCategories'][0];
  formatCurrency: (amount: number) => string;
}>(({ category, formatCurrency }) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    <div>
      <p className="font-medium text-gray-900">{category.category}</p>
      <p className="text-sm text-gray-600">{category.transactionCount} transactions</p>
    </div>
    <div className="text-right">
      <p className="font-semibold text-gray-900">{formatCurrency(category.totalAmount)}</p>
      <p className="text-sm text-gray-600">{category.percentage}%</p>
    </div>
  </div>
));
CategoryCard.displayName = 'CategoryCard';

// Tab Navigation component
const TabNavigation = memo<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: Array<{ id: string; label: string; icon: string }>;
}>(({ activeTab, setActiveTab, tabs }) => (
  <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          activeTab === tab.id
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <span className="mr-2">{tab.icon}</span>
        {tab.label}
      </button>
    ))}
  </div>
));
TabNavigation.displayName = 'TabNavigation';

export default function DashboardPage(): React.JSX.Element {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(TAB_CONFIG.OVERVIEW);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Error handling
  const { error, handleError, clearError } = useApiError();

  // Memoized tab setter to prevent unnecessary re-renders
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const fetchDashboardData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      clearError();

      const response = await fetch('/api/optimized/user-dashboard');

      if (!response.ok) {
        const fetchError = new Error(`Failed to fetch dashboard: ${response.status}`);
        (fetchError as { response?: Response }).response = response;
        throw fetchError;
      }

      const result = await response.json() as { success: boolean; data?: DashboardData; message?: string };

      if (result.success && result.data) {
        setDashboardData(result.data);
      } else {
        throw new Error(result.message || 'Invalid response format');
      }
    } catch (err) {
      handleError(err, {
        endpoint: '/api/optimized/user-dashboard',
        method: 'GET',
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      void router.push('/auth/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      void fetchDashboardData();
    }
  }, [session, fetchDashboardData]);

  // Memoized tabs array
  const tabs = useMemo(
    () => [
      { id: TAB_CONFIG.OVERVIEW, label: 'Overview', icon: '📊' },
      { id: TAB_CONFIG.INSIGHTS, label: 'AI Insights', icon: '🤖' },
      { id: TAB_CONFIG.GOALS, label: 'Goals', icon: '🎯' },
      { id: TAB_CONFIG.BANKING, label: 'Banking', icon: '🏦' },
      { id: TAB_CONFIG.TAX, label: 'Tax Profile', icon: '📋' },
    ],
    [],
  );

  // Memoized calculations to prevent recalculation on every render
  const financialMetrics = useMemo(() => {
    if (!dashboardData) {
      return {
        totalBalance: 0,
        netIncome: 0,
        monthlySpend: 0,
        goalProgress: 0,
        taxSavings: 0,
      };
    }

    const totalBalance = dashboardData.financialSummary?.totalBalance || 0;
    const netIncome = dashboardData.financialSummary?.netIncome || 0;
    const monthlySpend = dashboardData.insights?.averageMonthlySpending || 0;
    const goalProgress =
      dashboardData.goals?.length > 0
        ? Math.round(
            dashboardData.goals.reduce((sum, goal) => sum + goal.progressPercentage, 0) /
              dashboardData.goals.length,
          )
        : 0;
    const taxSavings = Math.max(0, netIncome * ESTIMATED_TAX_RATE);

    return { totalBalance, netIncome, monthlySpend, goalProgress, taxSavings };
  }, [dashboardData]);

  // Memoized format currency function
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  if (status === 'loading' || loading) {
    return (
      <Layout>
        <Head>
          <title>Dashboard - TaxReturnPro</title>
        </Head>
        <div className="p-6">
          {/* Header skeleton */}
          <div className="mb-6">
            <Skeleton
              height={32}
              width={200}
              rounded
              className="mb-2"
            />
            <Skeleton
              height={20}
              width={300}
              rounded
            />
          </div>

          {/* Tabs skeleton */}
          <div className="flex space-x-4 mb-6">
            {DASHBOARD_GRID_COLS.map((i) => (
              <Skeleton
                key={i}
                height={40}
                width={120}
                rounded
              />
            ))}
          </div>

          {/* Main dashboard skeleton */}
          <SkeletonDashboardGrid />
        </div>
      </Layout>
    );
  }

  if (!session) {
    return <div>No session</div>;
  }

  if (error) {
    return (
      <Layout>
        <Head>
          <title>Dashboard - TaxReturnPro</title>
        </Head>
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">There was a problem loading your dashboard</p>
          </div>

          {error.code === 'NETWORK_ERROR' ? (
            <NetworkError
              onRetry={fetchDashboardData}
              className="max-w-2xl mx-auto"
            />
          ) : (
            <ErrorDisplay
              error={error.message}
              onRetry={fetchDashboardData}
              className="max-w-2xl mx-auto"
            />
          )}
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard - TaxReturnPro</title>
      </Head>

      <Layout>
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {dashboardData?.user?.name || session.user?.name || session.user?.email}
              !
            </h1>
            <p className="mt-2 text-gray-600">
              Here&apos;s your financial overview and AI-powered insights
            </p>
          </div>

          {/* Tab Navigation */}
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            tabs={tabs}
          />

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === TAB_CONFIG.OVERVIEW && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Balance"
                  value={formatCurrency(financialMetrics.totalBalance)}
                  subtitle="Across all accounts"
                  icon="💰"
                  colorClass="text-green-600"
                />
                <StatCard
                  title="Net Income"
                  value={formatCurrency(financialMetrics.netIncome)}
                  subtitle="This month"
                  icon="📈"
                  colorClass="text-blue-600"
                />
                <StatCard
                  title="Monthly Spending"
                  value={formatCurrency(financialMetrics.monthlySpend)}
                  subtitle="Average"
                  icon="💳"
                  colorClass="text-orange-600"
                />
                <StatCard
                  title="Goal Progress"
                  value={`${financialMetrics.goalProgress}%`}
                  subtitle={`${dashboardData?.goals?.length || 0} active goals`}
                  icon="🎯"
                  colorClass="text-purple-600"
                />
              </div>
            )}

            {activeTab === TAB_CONFIG.INSIGHTS && <InsightsDashboard />}

            {activeTab === TAB_CONFIG.GOALS && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Financial Goals</h2>
                  {dashboardData?.goals && dashboardData.goals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dashboardData.goals.map((goal) => (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </div>
                  ) : (
                                         <EmptyState
                       title="No Goals Set"
                       message="Create your first financial goal to start tracking your progress."
                       action={{
                         label: "Create Goal",
                         onClick: () => void router.push('/goals'),
                       }}
                     />
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === TAB_CONFIG.BANKING && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Top Spending Categories</h2>
                  {dashboardData?.topCategories && dashboardData.topCategories.length > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.topCategories.map((category) => (
                        <CategoryCard
                          key={category.category}
                          category={category}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No Transaction Data"
                      description="Connect your bank account to see spending insights."
                      actionText="Connect Bank"
                      onAction={() => void router.push('/banking')}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === TAB_CONFIG.TAX && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Tax Profile</h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Net Income (Current Tax Year)
                      </p>
                      <p className="text-lg font-semibold">{formatCurrency(financialMetrics.netIncome)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Estimated Tax Savings</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(financialMetrics.taxSavings)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                      <p className="text-lg font-semibold">
                        {dashboardData?.financialSummary?.transactionCount || 0}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-6">
                    Complete your tax profile for more personalized insights and recommendations.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Last Updated */}
          {dashboardData?.lastUpdated && (
            <div className="mt-8 text-center text-sm text-gray-500">
              Last updated: {new Date(dashboardData.lastUpdated).toLocaleString('en-AU')}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
