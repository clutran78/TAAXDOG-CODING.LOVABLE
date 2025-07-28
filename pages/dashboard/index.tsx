import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback, useMemo, memo, Suspense } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/dashboard/Card';
import {
  SkeletonDashboardGrid,
  SkeletonStatsCard,
  SkeletonCard,
  Skeleton,
} from '@/components/ui/SkeletonLoaders';
import { ErrorDisplay, NetworkError, EmptyState } from '@/components/ui/ErrorComponents';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useApiError } from '@/hooks/useApiError';
import { logApiError } from '@/lib/errors/errorLogger';
import { lazyLoadComponent } from '@/lib/utils/lazyLoad';

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
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-6">
        {loading ? (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
              <p className={`text-2xl font-bold ${colorClass} animate-fadeIn`}>{value}</p>
              {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {subtitleCount !== undefined ? `${subtitleCount} ${subtitle}` : subtitle}
                </p>
              )}
            </div>
            <div
              className="text-3xl animate-fadeInScale"
              style={{ animationDelay: '100ms' }}
            >
              {icon}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  ),
);

StatCard.displayName = 'StatCard';

// Memoized goal item component
const GoalItem = memo<{
  goal: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    progressPercentage: number;
    daysRemaining: number;
    isOnTrack: boolean;
  };
  formatCurrency: (amount: number) => string;
}>(({ goal, formatCurrency }) => (
  <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.01] transform">
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">{goal.name}</h3>
        <span
          className={`text-sm font-medium ${goal.isOnTrack ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'} animate-fadeIn`}
        >
          {goal.isOnTrack ? 'On Track' : 'Behind Schedule'}
        </span>
      </div>
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>
            {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
          </span>
          <span className="font-medium">{goal.progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out relative"
            style={{ width: `${Math.min(100, goal.progressPercentage)}%` }}
          >
            <div className="absolute inset-0 bg-white bg-opacity-20 animate-pulse" />
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {goal.daysRemaining} days remaining
      </p>
    </CardContent>
  </Card>
));

GoalItem.displayName = 'GoalItem';

// Memoized category item component
const CategoryItem = memo<{
  category: {
    category: string;
    totalAmount: number;
    percentage: number;
  };
  formatCurrency: (amount: number) => string;
}>(({ category, formatCurrency }) => (
  <div className="flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-800 p-2 -m-2 rounded-lg transition-colors">
    <div className="flex-1">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {category.category}
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatCurrency(category.totalAmount)}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${category.percentage}%` }}
        />
      </div>
    </div>
  </div>
));

CategoryItem.displayName = 'CategoryItem';

// Memoized tab navigation component
const TabNavigation = memo<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: Array<{ id: string; label: string; icon: string }>;
}>(({ activeTab, setActiveTab, tabs }) => (
  <div className="border-b border-gray-200 mb-6">
    <nav
      className="-mb-px flex space-x-8"
      aria-label="Tabs"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`
            whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-all duration-200
            ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }
          `}
        >
          <span className="mr-2">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  </div>
));

TabNavigation.displayName = 'TabNavigation';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Error handling
  const { error, handleError, clearError } = useApiError();

  // Memoized tab setter to prevent unnecessary re-renders
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchDashboardData();
    }
  }, [session, fetchDashboardData]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      clearError();

      const response = await fetch('/api/optimized/user-dashboard');

      if (!response.ok) {
        const error = new Error(`Failed to fetch dashboard: ${response.status}`);
        (error as any).response = response;
        throw error;
      }

      const result = await response.json();

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
            {[1, 2, 3, 4].map((i) => (
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
    return null;
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

  // Memoized tabs array
  const tabs = useMemo(
    () => [
      { id: 'overview', label: 'Overview', icon: '📊' },
      { id: 'insights', label: 'AI Insights', icon: '🤖' },
      { id: 'goals', label: 'Goals', icon: '🎯' },
      { id: 'banking', label: 'Banking', icon: '🏦' },
      { id: 'tax', label: 'Tax Profile', icon: '📋' },
    ],
    [],
  );

  // Memoized calculations to prevent recalculation on every render
  const { totalBalance, netIncome, monthlySpend, goalProgress, taxSavings } = useMemo(() => {
    const totalBalance = dashboardData?.financialSummary?.totalBalance || 0;
    const netIncome = dashboardData?.financialSummary?.netIncome || 0;
    const monthlySpend = dashboardData?.insights?.averageMonthlySpending || 0;
    const goalProgress =
      dashboardData?.goals?.length > 0
        ? Math.round(
            dashboardData.goals.reduce((sum, goal) => sum + goal.progressPercentage, 0) /
              dashboardData.goals.length,
          )
        : 0;
    const taxSavings = Math.max(0, netIncome * 0.25); // Estimated tax savings (25% of net income)

    return { totalBalance, netIncome, monthlySpend, goalProgress, taxSavings };
  }, [dashboardData]);

  // Memoized format currency function
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

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
              Here's your financial overview and AI-powered insights
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
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Total Balance"
                  value={formatCurrency(totalBalance)}
                  subtitle="transactions"
                  subtitleCount={dashboardData?.financialSummary?.transactionCount}
                  icon="💰"
                />
                <StatCard
                  title="Tax Savings"
                  value={formatCurrency(taxSavings)}
                  subtitle="Estimated"
                  icon="📈"
                  colorClass="text-green-600"
                />
                <StatCard
                  title="Monthly Spend"
                  value={formatCurrency(monthlySpend)}
                  subtitle="Average"
                  icon="💳"
                />
                <StatCard
                  title="Goal Progress"
                  value={`${goalProgress}%`}
                  subtitle={
                    dashboardData?.insights
                      ? `${dashboardData.insights.goalsOnTrack}/${dashboardData.insights.totalActiveGoals} on track`
                      : undefined
                  }
                  icon="🎯"
                  colorClass="text-blue-600"
                />
              </div>
            )}

            {activeTab === 'insights' && (
              <ErrorBoundary
                fallback={
                  <ErrorDisplay
                    error="Failed to load insights"
                    onRetry={() => window.location.reload()}
                  />
                }
              >
                <InsightsDashboard />
              </ErrorBoundary>
            )}

            {activeTab === 'goals' && (
              <div className="space-y-4">
                {dashboardData?.goals && dashboardData.goals.length > 0 ? (
                  dashboardData.goals.map((goal) => (
                    <GoalItem
                      key={goal.id}
                      goal={goal}
                      formatCurrency={formatCurrency}
                    />
                  ))
                ) : (
                  <Card>
                    <CardContent className="p-6">
                      <EmptyState
                        title="No financial goals yet"
                        message="Create your first financial goal to track your progress and build better savings habits"
                        action={{
                          label: 'Create Goal',
                          onClick: () => router.push('/goals/new'),
                        }}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'banking' && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Connected Accounts</h2>
                  {dashboardData?.user?.counts?.accounts ? (
                    <p className="text-gray-600">
                      You have {dashboardData.user.counts.accounts} connected account
                      {dashboardData.user.counts.accounts !== 1 ? 's' : ''}
                    </p>
                  ) : (
                    <EmptyState
                      title="No bank accounts connected"
                      message="Connect your bank accounts to automatically track transactions and expenses"
                      action={{
                        label: 'Connect Bank',
                        onClick: () => router.push('/banking/connect'),
                      }}
                      className="py-8"
                    />
                  )}
                  {dashboardData?.topCategories && dashboardData.topCategories.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium mb-4">Top Spending Categories</h3>
                      <div className="space-y-3">
                        {dashboardData.topCategories.map((category) => (
                          <CategoryItem
                            key={category.category}
                            category={category}
                            formatCurrency={formatCurrency}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'tax' && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Tax Profile</h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Net Income (Current Tax Year)
                      </p>
                      <p className="text-lg font-semibold">{formatCurrency(netIncome)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Estimated Tax Savings</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(taxSavings)}
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
