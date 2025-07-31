import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

interface DashboardData {
  financialSummary: {
    netBalance: number;
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    incomeChange: number;
    expenseChange: number;
    cashFlowChange: number;
  };
  accountBalances: Array<{
    id: string;
    name: string;
    balance: number;
    type: string;
    institution: string;
  }>;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    date: Date;
    category: string;
    type: string;
  }>;
  activeGoals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    progress: number;
    daysRemaining: number | null;
  }>;
  insights: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    priority: string;
  }>;
}

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (period: string) => [...dashboardKeys.all, 'summary', period] as const,
  accounts: () => [...dashboardKeys.all, 'accounts'] as const,
  transactions: (limit: number) => [...dashboardKeys.all, 'transactions', limit] as const,
  goals: () => [...dashboardKeys.all, 'goals'] as const,
  insights: () => [...dashboardKeys.all, 'insights'] as const,
  combined: (period: string) => [...dashboardKeys.all, 'combined', period] as const,
};

/**
 * Fetch dashboard data from optimized endpoint
 */
async function fetchDashboardData(period = 'month'): Promise<DashboardData> {
  const response = await fetch(`/api/optimized/user-dashboard?period=${period}`);

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Hook to fetch complete dashboard data
 * Uses a single optimized endpoint for better performance
 */
export function useDashboard(period = 'month') {
  return useQuery({
    queryKey: dashboardKeys.combined(period),
    queryFn: () => fetchDashboardData(period),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

/**
 * Hook to fetch individual dashboard components
 * Useful when you need to update specific parts independently
 */
export function useDashboardQueries(period = 'month') {
  const queries = useQueries({
    queries: [
      {
        queryKey: dashboardKeys.summary(period),
        queryFn: async () => {
          const response = await fetch(`/api/financial/summary?period=${period}`);
          if (!response.ok) throw new Error('Failed to fetch summary');
          const data = await response.json();
          return data.data;
        },
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: dashboardKeys.accounts(),
        queryFn: async () => {
          const response = await fetch('/api/accounts/balances');
          if (!response.ok) throw new Error('Failed to fetch accounts');
          const data = await response.json();
          return data.data;
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: dashboardKeys.transactions(10),
        queryFn: async () => {
          const response = await fetch('/api/transactions?limit=10&sortBy=date&sortOrder=desc');
          if (!response.ok) throw new Error('Failed to fetch transactions');
          const data = await response.json();
          return data.data.transactions;
        },
        staleTime: 1 * 60 * 1000,
      },
      {
        queryKey: dashboardKeys.goals(),
        queryFn: async () => {
          const response = await fetch('/api/goals?status=ACTIVE');
          if (!response.ok) throw new Error('Failed to fetch goals');
          const data = await response.json();
          return data.data.goals;
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: dashboardKeys.insights(),
        queryFn: async () => {
          const response = await fetch('/api/ai/insights?limit=5');
          if (!response.ok) throw new Error('Failed to fetch insights');
          const data = await response.json();
          return data.data.insights;
        },
        staleTime: 10 * 60 * 1000,
      },
    ],
  });

  // Combine results
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const error = queries.find((q) => q.error)?.error;

  return {
    data: {
      financialSummary: queries[0].data,
      accountBalances: queries[1].data,
      recentTransactions: queries[2].data,
      activeGoals: queries[3].data,
      insights: queries[4].data,
    },
    isLoading,
    isError,
    error,
    refetch: () => queries.forEach((q) => q.refetch()),
  };
}

/**
 * Hook to prefetch dashboard data
 * Useful for route transitions
 */
export function usePrefetchDashboard() {
  const queryClient = useQueryClient();

  return (period = 'month') => {
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.combined(period),
      queryFn: () => fetchDashboardData(period),
      staleTime: 2 * 60 * 1000,
    });
  };
}

/**
 * Hook to refresh all dashboard data
 */
export function useRefreshDashboard() {
  const queryClient = useQueryClient();

  return async () => {
    logger.info('Refreshing dashboard data');
    await queryClient.invalidateQueries({
      queryKey: dashboardKeys.all,
      refetchType: 'active',
    });
  };
}
