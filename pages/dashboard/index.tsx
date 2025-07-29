import React, { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-hot-toast';

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
import { logger } from '@/lib/logger';

// Type definitions
export const TAB_CONFIG = {
  OVERVIEW: 'overview',
  INSIGHTS: 'insights',
  GOALS: 'goals',
  BANKING: 'banking',
  TAX: 'tax',
} as const;

export type TabType = typeof TAB_CONFIG[keyof typeof TAB_CONFIG];

// Constants
const RESPONSE_STATUS_OK = 200;
const ESTIMATED_TAX_RATE = 0.25;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

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
    errorFallback: ({ error, retry }) => (
      <ErrorDisplay
        error={error}
        title="Failed to load insights"
        onRetry={retry}
      />
    ),
  },
);

// Enhanced type definitions
interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  counts?: {
    goals: number;
    transactions: number;
    accounts: number;
  };
}

interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  transactionCount: number;
  lastTransactionDate: string | null;
  accountsCount?: number;
  currency: string;
}

interface SpendingData {
  month: string;
  totalAmount: number;
  transactionCount: number;
  categoryBreakdown?: Record<string, number>;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPercentage: number;
  daysRemaining: number;
  isOnTrack: boolean;
  category?: string;
  targetDate: string;
  createdAt: string;
}

interface Category {
  category: string;
  totalAmount: number;
  percentage: number;
  transactionCount: number;
  trend?: 'up' | 'down' | 'stable';
  lastMonthAmount?: number;
}

interface Insights {
  averageMonthlySpending: number;
  goalsOnTrack: number;
  totalActiveGoals: number;
  savingsRate?: number;
  topExpenseCategory?: string;
  monthOverMonthChange?: number;
}

interface DashboardData {
  user: User;
  financialSummary: FinancialSummary;
  recentSpending: SpendingData[];
  goals: Goal[];
  topCategories: Category[];
  insights: Insights;
  lastUpdated: string;
  dataQuality?: {
    hasConnectedAccounts: boolean;
    transactionsCoverage: number;
    lastSyncDate?: string;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

// Props interfaces
interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  colorClass?: string;
  subtitleCount?: number;
  loading?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

interface GoalCardProps {
  goal: Goal;
  formatCurrency: (amount: number) => string;
  onEdit?: (goalId: string) => void;
}

interface CategoryCardProps {
  category: Category;
  formatCurrency: (amount: number) => string;
  onClick?: (category: string) => void;
}

interface TabNavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  tabs: Array<{ id: TabType; label: string; icon: string; badge?: number }>;
  loading?: boolean;
}

// Memoized stat card component with enhanced features
const StatCard = memo<StatCardProps>(
  ({
    title,
    value,
    subtitle,
    icon,
    colorClass = 'text-gray-900',
    subtitleCount,
    loading = false,
    trend,
  }) => (
    <Card className="transition-all duration-200 hover:shadow-lg">
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
              <span className="text-2xl" role="img" aria-label={title}>
                {icon}
              </span>
            </div>
            <p className={`text-2xl font-bold ${colorClass} tabular-nums`}>{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">
                {subtitle}
                {typeof subtitleCount === 'number' && ` (${subtitleCount})`}
              </p>
            )}
            {trend && (
              <div className={`flex items-center mt-2 text-sm ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                <span className="mr-1">
                  {trend.isPositive ? '↑' : '↓'}
                </span>
                <span>{Math.abs(trend.value).toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  ),
);
StatCard.displayName = 'StatCard';

// Enhanced Goal Card component
const GoalCard = memo<GoalCardProps>(({ goal, formatCurrency, onEdit }) => {
  const progressPercentage = Math.min(goal.progressPercentage, 100);
  const isOverdue = goal.daysRemaining < 0;
  
  return (
    <div className="bg-white p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 truncate flex-1" title={goal.name}>
          {goal.name}
        </h3>
        <span className={`text-sm px-2 py-1 rounded ml-2 ${
          isOverdue ? 'bg-red-100 text-red-800' :
          goal.isOnTrack ? 'bg-green-100 text-green-800' : 
          'bg-yellow-100 text-yellow-800'
        }`}>
          {isOverdue ? 'Overdue' : goal.isOnTrack ? 'On Track' : 'Behind'}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium tabular-nums">{progressPercentage.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" 
             aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              isOverdue ? 'bg-red-500' :
              goal.isOnTrack ? 'bg-blue-600' : 'bg-yellow-500'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 tabular-nums">
            {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
          </span>
          <span className="text-gray-600">
            {isOverdue 
              ? `${Math.abs(goal.daysRemaining)} days overdue`
              : `${goal.daysRemaining} days left`
            }
          </span>
        </div>
        {goal.category && (
          <div className="pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">Category: {goal.category}</span>
          </div>
        )}
      </div>
      {onEdit && (
        <button
          onClick={() => onEdit(goal.id)}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Edit Goal
        </button>
      )}
    </div>
  );
});
GoalCard.displayName = 'GoalCard';

// Enhanced Category Card component
const CategoryCard = memo<CategoryCardProps>(({ category, formatCurrency, onClick }) => (
  <div 
    className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg transition-all hover:bg-gray-100 ${
      onClick ? 'cursor-pointer' : ''
    }`}
    onClick={() => onClick?.(category.category)}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    <div>
      <p className="font-medium text-gray-900">{category.category}</p>
      <p className="text-sm text-gray-600">{category.transactionCount} transactions</p>
    </div>
    <div className="text-right">
      <p className="font-semibold text-gray-900 tabular-nums">{formatCurrency(category.totalAmount)}</p>
      <div className="flex items-center justify-end text-sm text-gray-600">
        <span className="tabular-nums">{category.percentage.toFixed(1)}%</span>
        {category.trend && (
          <span className={`ml-2 ${
            category.trend === 'up' ? 'text-red-600' : 
            category.trend === 'down' ? 'text-green-600' : 
            'text-gray-400'
          }`}>
            {category.trend === 'up' ? '↑' : category.trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
    </div>
  </div>
));
CategoryCard.displayName = 'CategoryCard';

// Enhanced Tab Navigation component
const TabNavigation = memo<TabNavigationProps>(({ activeTab, setActiveTab, tabs, loading }) => (
  <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg" role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        disabled={loading}
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls={`tabpanel-${tab.id}`}
        className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
          activeTab === tab.id
            ? 'bg-white text-blue-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''} relative`}
      >
        <span className="mr-2" role="img" aria-label={tab.label}>
          {tab.icon}
        </span>
        <span>{tab.label}</span>
        {tab.badge && tab.badge > 0 && (
          <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
            {tab.badge}
          </span>
        )}
      </button>
    ))}
  </div>
));
TabNavigation.displayName = 'TabNavigation';

// Main dashboard component with enhanced functionality
export default function DashboardPage(): React.JSX.Element {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // State management
  const [activeTab, setActiveTab] = useState<TabType>(TAB_CONFIG.OVERVIEW);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs for cleanup
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Error handling
  const { error, handleError, clearError, isRetrying } = useApiError();

  // Cleanup function
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced fetch function with retry logic
  const fetchDashboardData = useCallback(async (isRetry = false, attempt = 1): Promise<void> => {
    try {
      // Cancel previous request if any
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }

      // Create new abort controller
      fetchControllerRef.current = new AbortController();

      if (!isRetry) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      clearError();

      const response = await fetch('/api/optimized/user-dashboard', {
        signal: fetchControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired
          await router.push('/auth/login');
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json() as ApiResponse<DashboardData>;

      if (!result.success || !result.data) {
        throw new Error(result.error || result.message || 'Invalid response format');
      }

      // Validate data structure
      if (!result.data.user || !result.data.financialSummary) {
        throw new Error('Incomplete dashboard data received');
      }

      setDashboardData(result.data);
      
      // Log successful fetch
      logger.info('Dashboard data fetched successfully', {
        userId: result.data.user.id,
        dataPoints: {
          transactions: result.data.financialSummary.transactionCount,
          goals: result.data.goals.length,
          categories: result.data.topCategories.length,
        },
      });

      // Show success toast on manual refresh
      if (isRetry) {
        toast.success('Dashboard refreshed successfully');
      }
      
    } catch (err) {
      // Don't retry on abort
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      // Retry logic
      if (attempt < RETRY_ATTEMPTS && !isRetry) {
        logger.warn(`Dashboard fetch failed, retrying (attempt ${attempt}/${RETRY_ATTEMPTS})`, { error: err });
        
        retryTimeoutRef.current = setTimeout(() => {
          void fetchDashboardData(false, attempt + 1);
        }, RETRY_DELAY * attempt);
        return;
      }

      handleError(err, {
        endpoint: '/api/optimized/user-dashboard',
        method: 'GET',
        retryable: true,
        context: { attempt, isRetry },
      });
      
      // Show error toast
      if (isRetry) {
        toast.error('Failed to refresh dashboard');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [clearError, handleError, router]);

  // Manual refresh function
  const handleRefresh = useCallback(() => {
    void fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Tab change handler
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    
    // Track tab change
    logger.debug('Dashboard tab changed', { tab });
  }, []);

  // Handle goal edit
  const handleGoalEdit = useCallback((goalId: string) => {
    void router.push(`/goals/${goalId}/edit`);
  }, [router]);

  // Handle category click
  const handleCategoryClick = useCallback((category: string) => {
    void router.push(`/transactions?category=${encodeURIComponent(category)}`);
  }, [router]);

  // Authentication check
  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      void router.push('/auth/login');
    }
  }, [status, router]);

  // Initial data fetch
  useEffect(() => {
    if (session && status === 'authenticated') {
      void fetchDashboardData();
      
      // Set up auto-refresh
      refreshIntervalRef.current = setInterval(() => {
        void fetchDashboardData(true);
      }, REFRESH_INTERVAL);
    }
  }, [session, status, fetchDashboardData]);

  // Memoized tabs configuration with dynamic badges
  const tabs = useMemo(
    () => [
      { id: TAB_CONFIG.OVERVIEW, label: 'Overview', icon: '📊', badge: 0 },
      { id: TAB_CONFIG.INSIGHTS, label: 'AI Insights', icon: '🤖', badge: 0 },
      { id: TAB_CONFIG.GOALS, label: 'Goals', icon: '🎯', badge: dashboardData?.goals?.length || 0 },
      { id: TAB_CONFIG.BANKING, label: 'Banking', icon: '🏦', badge: 0 },
      { id: TAB_CONFIG.TAX, label: 'Tax Profile', icon: '📋', badge: 0 },
    ],
    [dashboardData?.goals?.length],
  );

  // Enhanced financial metrics calculation
  const financialMetrics = useMemo(() => {
    if (!dashboardData) {
      return {
        totalBalance: 0,
        netIncome: 0,
        monthlySpend: 0,
        goalProgress: 0,
        taxSavings: 0,
        savingsRate: 0,
        hasData: false,
      };
    }

    const totalBalance = dashboardData.financialSummary?.totalBalance || 0;
    const totalIncome = dashboardData.financialSummary?.totalIncome || 0;
    const totalExpenses = dashboardData.financialSummary?.totalExpenses || 0;
    const netIncome = dashboardData.financialSummary?.netIncome || 0;
    const monthlySpend = dashboardData.insights?.averageMonthlySpending || 0;
    
    const goalProgress =
      dashboardData.goals?.length > 0
        ? Math.round(
            dashboardData.goals.reduce((sum, goal) => sum + goal.progressPercentage, 0) /
              dashboardData.goals.length,
          )
        : 0;
        
    const taxSavings = Math.max(0, totalIncome * ESTIMATED_TAX_RATE);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    return {
      totalBalance,
      netIncome,
      monthlySpend,
      goalProgress,
      taxSavings,
      savingsRate,
      hasData: true,
    };
  }, [dashboardData]);

  // Enhanced currency formatter
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: dashboardData?.financialSummary?.currency || 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  }, [dashboardData?.financialSummary?.currency]);

  // Loading state
  if (status === 'loading' || (loading && !dashboardData)) {
    return (
      <Layout>
        <Head>
          <title>Dashboard - TaxReturnPro</title>
          <meta name="description" content="View your financial dashboard and insights" />
        </Head>
        <div className="p-6">
          <div className="mb-6">
            <Skeleton height={32} width={200} rounded className="mb-2" />
            <Skeleton height={20} width={300} rounded />
          </div>
          <div className="flex space-x-4 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={40} width={120} rounded />
            ))}
          </div>
          <SkeletonDashboardGrid />
        </div>
      </Layout>
    );
  }

  // No session state
  if (!session) {
    return null;
  }

  // Error state
  if (error && !dashboardData) {
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

          <ErrorBoundary>
            {error.code === 'NETWORK_ERROR' ? (
              <NetworkError
                onRetry={handleRefresh}
                className="max-w-2xl mx-auto"
              />
            ) : (
              <ErrorDisplay
                error={error}
                onRetry={handleRefresh}
                className="max-w-2xl mx-auto"
              />
            )}
          </ErrorBoundary>
        </div>
      </Layout>
    );
  }

  // Main dashboard render
  return (
    <>
      <Head>
        <title>Dashboard - TaxReturnPro</title>
        <meta name="description" content="View your financial dashboard, AI insights, and tax information" />
      </Head>

      <Layout>
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Welcome back, {dashboardData?.user?.name || session.user?.name || 'User'}!
                </h1>
                <p className="mt-2 text-gray-600">
                  Here's your financial overview and AI-powered insights
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                  isRefreshing || loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isRefreshing ? (
                  <span className="flex items-center">
                    <span className="animate-spin mr-2">↻</span>
                    Refreshing...
                  </span>
                ) : (
                  'Refresh'
                )}
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            tabs={tabs}
            loading={loading || isRefreshing}
          />

          {/* Tab Content */}
          <div className="mt-6" role="tabpanel" id={`tabpanel-${activeTab}`}>
            <ErrorBoundary>
              {activeTab === TAB_CONFIG.OVERVIEW && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                      title="Total Balance"
                      value={formatCurrency(financialMetrics.totalBalance)}
                      subtitle="Across all accounts"
                      icon="💰"
                      colorClass="text-green-600"
                      subtitleCount={dashboardData?.user?.counts?.accounts}
                      loading={isRefreshing}
                    />
                    <StatCard
                      title="Net Income"
                      value={formatCurrency(financialMetrics.netIncome)}
                      subtitle="This month"
                      icon="📈"
                      colorClass={financialMetrics.netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}
                      loading={isRefreshing}
                      trend={dashboardData?.insights?.monthOverMonthChange ? {
                        value: dashboardData.insights.monthOverMonthChange,
                        isPositive: dashboardData.insights.monthOverMonthChange > 0,
                      } : undefined}
                    />
                    <StatCard
                      title="Monthly Spending"
                      value={formatCurrency(financialMetrics.monthlySpend)}
                      subtitle="Average"
                      icon="💳"
                      colorClass="text-orange-600"
                      loading={isRefreshing}
                    />
                    <StatCard
                      title="Savings Rate"
                      value={`${financialMetrics.savingsRate.toFixed(1)}%`}
                      subtitle="Of total income"
                      icon="🏦"
                      colorClass={financialMetrics.savingsRate >= 20 ? 'text-green-600' : 'text-orange-600'}
                      loading={isRefreshing}
                    />
                  </div>

                  {/* Data Quality Warning */}
                  {dashboardData?.dataQuality && !dashboardData.dataQuality.hasConnectedAccounts && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <span className="text-2xl">⚠️</span>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Connect your bank accounts
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>
                              Connect your bank accounts to get accurate financial insights and automated transaction categorization.
                            </p>
                          </div>
                          <div className="mt-4">
                            <div className="-mx-2 -my-1.5 flex">
                              <button
                                onClick={() => void router.push('/banking')}
                                className="bg-yellow-100 px-3 py-2 rounded-md text-sm font-medium text-yellow-800 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                              >
                                Connect Banks
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === TAB_CONFIG.INSIGHTS && (
                <InsightsDashboard 
                  data={dashboardData}
                  loading={isRefreshing}
                />
              )}

              {activeTab === TAB_CONFIG.GOALS && (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">Financial Goals</h2>
                      <button
                        onClick={() => void router.push('/goals/new')}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        + New Goal
                      </button>
                    </div>
                    {dashboardData?.goals && dashboardData.goals.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dashboardData.goals.map((goal) => (
                          <GoalCard
                            key={goal.id}
                            goal={goal}
                            formatCurrency={formatCurrency}
                            onEdit={handleGoalEdit}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No Goals Set"
                        message="Create your first financial goal to start tracking your progress."
                        action={{
                          label: "Create Goal",
                          onClick: () => void router.push('/goals/new'),
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
                            onClick={handleCategoryClick}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No Transaction Data"
                        message="Connect your bank account to see spending insights."
                        action={{
                          label: "Connect Bank",
                          onClick: () => void router.push('/banking'),
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {activeTab === TAB_CONFIG.TAX && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Tax Profile</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">
                            Net Income (Current Tax Year)
                          </p>
                          <p className="text-2xl font-semibold tabular-nums">
                            {formatCurrency(financialMetrics.netIncome)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Estimated Tax Savings</p>
                          <p className="text-2xl font-semibold text-green-600 tabular-nums">
                            {formatCurrency(financialMetrics.taxSavings)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                          <p className="text-2xl font-semibold tabular-nums">
                            {dashboardData?.financialSummary?.transactionCount || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Tax Documents</p>
                          <p className="text-2xl font-semibold">0</p>
                          <p className="text-sm text-gray-500 mt-1">Ready for upload</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-900 mb-2">
                        <strong>Next Steps:</strong>
                      </p>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Complete your tax profile for accurate calculations</li>
                        <li>• Upload tax-related documents and receipts</li>
                        <li>• Review and categorize transactions for deductions</li>
                      </ul>
                    </div>
                    <button
                      onClick={() => void router.push('/tax-profile')}
                      className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Complete Tax Profile
                    </button>
                  </CardContent>
                </Card>
              )}
            </ErrorBoundary>
          </div>

          {/* Footer with last updated and data quality */}
          <div className="mt-8 flex items-center justify-between text-sm text-gray-500">
            <div>
              {dashboardData?.lastUpdated && (
                <span>
                  Last updated: {new Date(dashboardData.lastUpdated).toLocaleString('en-AU', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              )}
            </div>
            {dashboardData?.dataQuality && (
              <div className="flex items-center space-x-4">
                {dashboardData.dataQuality.transactionsCoverage < 100 && (
                  <span className="text-yellow-600">
                    ⚠️ {dashboardData.dataQuality.transactionsCoverage}% transaction coverage
                  </span>
                )}
                {dashboardData.dataQuality.lastSyncDate && (
                  <span>
                    Last sync: {new Date(dashboardData.dataQuality.lastSyncDate).toLocaleString('en-AU', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}