'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import GridBoxes from './GridBoxes';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface DashboardStats {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  goalProgress: number;
  recentTransactions: number;
  activeGoals: number;
}

interface DashboardComponentProps {
  initialStats?: Partial<DashboardStats>;
  onRefresh?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const DashboardComponent: React.FC<DashboardComponentProps> = ({ initialStats, onRefresh }) => {
  // ========================================
  // HOOKS
  // ========================================

  const { data: session, status } = useSession();
  const router = useRouter();

  // ========================================
  // STATE
  // ========================================

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalBalance: initialStats?.totalBalance || 0,
    totalIncome: initialStats?.totalIncome || 0,
    totalExpenses: initialStats?.totalExpenses || 0,
    goalProgress: initialStats?.goalProgress || 0,
    recentTransactions: initialStats?.recentTransactions || 0,
    activeGoals: initialStats?.activeGoals || 0,
  });

  // ========================================
  // EFFECTS
  // ========================================

  // Check authentication status
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Load dashboard data
  useEffect(() => {
    let mounted = true;

    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Simulate API call - replace with actual API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!mounted) return;

        // Update stats with fetched data
        setStats({
          totalBalance: 15420.5,
          totalIncome: 8500.0,
          totalExpenses: 3200.0,
          goalProgress: 65,
          recentTransactions: 42,
          activeGoals: 3,
        });
      } catch (err) {
        if (!mounted) return;

        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    if (status === 'authenticated') {
      loadDashboardData();
    }

    return () => {
      mounted = false;
    };
  }, [status]);

  // ========================================
  // EVENT HANDLERS
  // ========================================

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);

    try {
      // Call parent refresh handler if provided
      await onRefresh?.();

      // Reload dashboard data
      // Add actual refresh logic here
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setIsLoading(false);
    }
  }, [onRefresh]);

  // ========================================
  // COMPUTED VALUES
  // ========================================

  const isAuthenticated = useMemo(() => {
    return status === 'authenticated' && session?.user;
  }, [status, session]);

  const userName = useMemo(() => {
    return session?.user?.name || 'User';
  }, [session]);

  // ========================================
  // RENDER HELPERS
  // ========================================

  const renderLoadingState = () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 m-5">
      <div className="flex items-center">
        <svg
          className="w-6 h-6 text-red-400 mr-3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 className="text-lg font-medium text-red-800">Error Loading Dashboard</h3>
          <p className="text-red-700 mt-1">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );

  const renderWelcomeHeader = () => (
    <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 mb-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Welcome back, {userName}!</h1>
          <p className="text-sm text-gray-600 mt-1">Here's your financial overview</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isLoading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );

  // ========================================
  // MAIN RENDER
  // ========================================

  // Show loading while checking auth
  if (status === 'loading') {
    return renderLoadingState();
  }

  // Redirect will happen in useEffect, show loading meanwhile
  if (!isAuthenticated) {
    return renderLoadingState();
  }

  // Show error state if there's an error
  if (error && !isLoading) {
    return renderErrorState();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderWelcomeHeader()}

      <div className="px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          renderLoadingState()
        ) : (
          <div className="row mt-5">
            <GridBoxes stats={stats} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardComponent;
