import React, { useState, useCallback, useEffect, useMemo, memo, useReducer } from 'react';
import { TransactionList } from './TransactionList';
import { TransactionFilters } from './TransactionFilters';
import { TransactionSearch } from './TransactionSearch';
import { TransactionCategorizer } from './TransactionCategorizer';
import { TransactionDetails } from './TransactionDetails';
import { Card } from '@/components/dashboard/Card';
import { logger } from '@/lib/logger';
import {
  SkeletonStatsCard,
  SkeletonCard,
  LoadingButton,
  InlineLoader,
  LoadingOverlay,
} from '@/components/ui/SkeletonLoaders';
import { ErrorDisplay, NetworkError } from '@/components/ui/ErrorComponents';
import { AsyncErrorBoundary } from '@/components/ErrorBoundary';
import { useApiError } from '@/hooks/useApiError';
import { logApiError } from '@/lib/errors/errorLogger';

// Memoized components
const MemoizedTransactionList = memo(TransactionList);
const MemoizedTransactionFilters = memo(TransactionFilters);
const MemoizedTransactionSearch = memo(TransactionSearch);
const MemoizedCard = memo(Card);

interface Transaction {
  id: string;
  date: string;
  description: string;
  merchant?: string;
  amount: number;
  balance?: number;
  category?: string;
  taxCategory?: string;
  isBusinessExpense: boolean;
  gstAmount?: number;
  accountId: string;
  accountName?: string;
  type: 'debit' | 'credit';
  status: 'pending' | 'posted' | 'cancelled';
  receiptId?: string;
  notes?: string;
  tags?: string[];
}

interface TransactionFiltersType {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  category?: string;
  taxCategory?: string;
  type?: 'debit' | 'credit' | 'all';
  businessOnly?: boolean;
  uncategorizedOnly?: boolean;
  hasReceipt?: boolean;
  accountId?: string;
  tags?: string[];
}

interface Account {
  id: string;
  name: string;
  institution?: string;
  balance?: number;
}

interface TransactionsDashboardProps {
  userId?: string;
  className?: string;
}

// State reducer for better state management
interface DashboardState {
  filters: TransactionFiltersType;
  selectedTransactions: Set<string>;
  showCategorizer: boolean;
  selectedTransaction: Transaction | null;
  showDetails: boolean;
  accounts: Account[];
  refreshKey: number;
  showBulkActions: boolean;
  stats: {
    totalTransactions: number;
    uncategorized: number;
    businessExpenses: number;
    totalGST: number;
  };
  loading: {
    stats: boolean;
    accounts: boolean;
    exporting: boolean;
    deleting: boolean;
    categorizing: boolean;
    refreshing: boolean;
  };
}

type DashboardAction =
  | { type: 'SET_FILTERS'; payload: TransactionFiltersType }
  | { type: 'SET_SELECTED_TRANSACTIONS'; payload: Set<string> }
  | { type: 'TOGGLE_CATEGORIZER'; payload?: boolean }
  | { type: 'SET_SELECTED_TRANSACTION'; payload: Transaction | null }
  | { type: 'TOGGLE_DETAILS'; payload?: boolean }
  | { type: 'SET_ACCOUNTS'; payload: Account[] }
  | { type: 'REFRESH_TRANSACTIONS' }
  | { type: 'TOGGLE_BULK_ACTIONS'; payload?: boolean }
  | { type: 'SET_STATS'; payload: typeof DashboardState.prototype.stats }
  | {
      type: 'SET_LOADING';
      payload: { key: keyof typeof DashboardState.prototype.loading; value: boolean };
    }
  | { type: 'RESET_SELECTION' };

const dashboardReducer = (state: DashboardState, action: DashboardAction): DashboardState => {
  switch (action.type) {
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    case 'SET_SELECTED_TRANSACTIONS':
      return { ...state, selectedTransactions: action.payload };
    case 'TOGGLE_CATEGORIZER':
      return { ...state, showCategorizer: action.payload ?? !state.showCategorizer };
    case 'SET_SELECTED_TRANSACTION':
      return { ...state, selectedTransaction: action.payload };
    case 'TOGGLE_DETAILS':
      return { ...state, showDetails: action.payload ?? !state.showDetails };
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload };
    case 'REFRESH_TRANSACTIONS':
      return { ...state, refreshKey: state.refreshKey + 1 };
    case 'TOGGLE_BULK_ACTIONS':
      return { ...state, showBulkActions: action.payload ?? !state.showBulkActions };
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, [action.payload.key]: action.payload.value },
      };
    case 'RESET_SELECTION':
      return {
        ...state,
        selectedTransactions: new Set(),
        showCategorizer: false,
        showBulkActions: false,
      };
    default:
      return state;
  }
};

const initialState: DashboardState = {
  filters: { type: 'all' },
  selectedTransactions: new Set(),
  showCategorizer: false,
  selectedTransaction: null,
  showDetails: false,
  accounts: [],
  refreshKey: 0,
  showBulkActions: false,
  stats: {
    totalTransactions: 0,
    uncategorized: 0,
    businessExpenses: 0,
    totalGST: 0,
  },
  loading: {
    stats: true,
    accounts: true,
    exporting: false,
    deleting: false,
    categorizing: false,
    refreshing: false,
  },
};

export const TransactionsDashboard: React.FC<TransactionsDashboardProps> = memo(
  ({ userId, className = '' }) => {
    const [state, dispatch] = useReducer(dashboardReducer, initialState);

    // Error handling
    const {
      error: statsError,
      handleError: handleStatsError,
      clearError: clearStatsError,
    } = useApiError();
    const {
      error: accountsError,
      handleError: handleAccountsError,
      clearError: clearAccountsError,
    } = useApiError();
    const {
      error: actionError,
      handleError: handleActionError,
      clearError: clearActionError,
    } = useApiError();

    // Memoized API calls
    const fetchAccounts = useCallback(async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: { key: 'accounts', value: true } });
        clearAccountsError();
        const response = await fetch('/api/banking/accounts');

        if (!response.ok) {
          const error = new Error(`Failed to fetch accounts: ${response.status}`);
          (error as any).response = response;
          throw error;
        }

        const data = await response.json();
        dispatch({ type: 'SET_ACCOUNTS', payload: data });
      } catch (error) {
        handleAccountsError(error, {
          endpoint: '/api/banking/accounts',
          method: 'GET',
          retryable: true,
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { key: 'accounts', value: false } });
      }
    }, [clearAccountsError, handleAccountsError]);

    const fetchStats = useCallback(async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: { key: 'stats', value: true } });
        clearStatsError();
        const response = await fetch('/api/transactions/stats');

        if (!response.ok) {
          const error = new Error(`Failed to fetch stats: ${response.status}`);
          (error as any).response = response;
          throw error;
        }

        const data = await response.json();
        dispatch({ type: 'SET_STATS', payload: data });
      } catch (error) {
        handleStatsError(error, {
          endpoint: '/api/transactions/stats',
          method: 'GET',
          retryable: true,
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { key: 'stats', value: false } });
      }
    }, [clearStatsError, handleStatsError]);

    // Initial data load
    useEffect(() => {
      let mounted = true;

      const loadInitialData = async () => {
        if (!mounted) return;

        // Parallel fetch
        await Promise.all([fetchAccounts(), fetchStats()]);
      };

      loadInitialData();

      return () => {
        mounted = false;
      };
    }, [fetchAccounts, fetchStats, userId]);

    // Memoized handlers
    const handleSearchSelect = useCallback((transaction: any) => {
      dispatch({ type: 'SET_SELECTED_TRANSACTION', payload: transaction });
      dispatch({ type: 'TOGGLE_DETAILS', payload: true });
    }, []);

    const handleTransactionSelect = useCallback((transaction: Transaction) => {
      dispatch({ type: 'SET_SELECTED_TRANSACTION', payload: transaction });
      dispatch({ type: 'TOGGLE_DETAILS', payload: true });
    }, []);

    const handleCategorize = useCallback(
      async (updates: any[]) => {
        try {
          dispatch({ type: 'SET_LOADING', payload: { key: 'categorizing', value: true } });
          clearActionError();

          const response = await fetch('/api/transactions/categorize-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates }),
          });

          if (!response.ok) {
            const error = new Error(`Failed to categorize: ${response.status}`);
            (error as any).response = response;
            throw error;
          }

          // Refresh transaction list
          dispatch({ type: 'REFRESH_TRANSACTIONS' });
          dispatch({ type: 'RESET_SELECTION' });

          // Refresh stats
          await fetchStats();
        } catch (error) {
          handleActionError(error, {
            endpoint: '/api/transactions/categorize-bulk',
            method: 'POST',
            retryable: true,
          });
        } finally {
          dispatch({ type: 'SET_LOADING', payload: { key: 'categorizing', value: false } });
        }
      },
      [clearActionError, handleActionError, fetchStats],
    );

    const exportTransactions = useCallback(async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: { key: 'exporting', value: true } });
        clearActionError();

        const params = new URLSearchParams({
          ...(state.filters as any),
          format: 'csv',
        });

        if (state.selectedTransactions.size > 0) {
          params.append('ids', Array.from(state.selectedTransactions).join(','));
        }

        const response = await fetch(`/api/transactions/export?${params}`);

        if (!response.ok) {
          const error = new Error(`Export failed: ${response.status}`);
          (error as any).response = response;
          throw error;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        handleActionError(error, {
          endpoint: '/api/transactions/export',
          method: 'GET',
          retryable: false,
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { key: 'exporting', value: false } });
      }
    }, [state.filters, state.selectedTransactions, clearActionError, handleActionError]);

    const deleteTransactions = useCallback(async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: { key: 'deleting', value: true } });
        clearActionError();

        const response = await fetch('/api/transactions/delete-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds: Array.from(state.selectedTransactions),
          }),
        });

        if (!response.ok) {
          const error = new Error(`Delete failed: ${response.status}`);
          (error as any).response = response;
          throw error;
        }

        dispatch({ type: 'REFRESH_TRANSACTIONS' });
        dispatch({ type: 'RESET_SELECTION' });
        await fetchStats();
      } catch (error) {
        handleActionError(error, {
          endpoint: '/api/transactions/delete-bulk',
          method: 'POST',
          retryable: true,
        });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { key: 'deleting', value: false } });
      }
    }, [state.selectedTransactions, clearActionError, handleActionError, fetchStats]);

    const handleBulkAction = useCallback(
      (action: string) => {
        switch (action) {
          case 'categorize':
            if (state.selectedTransactions.size > 0) {
              dispatch({ type: 'TOGGLE_CATEGORIZER', payload: true });
            }
            break;
          case 'export':
            exportTransactions();
            break;
          case 'delete':
            if (confirm(`Delete ${state.selectedTransactions.size} transactions?`)) {
              deleteTransactions();
            }
            break;
        }
      },
      [state.selectedTransactions.size, exportTransactions, deleteTransactions],
    );

    const handleRefresh = useCallback(async () => {
      dispatch({ type: 'SET_LOADING', payload: { key: 'refreshing', value: true } });
      dispatch({ type: 'REFRESH_TRANSACTIONS' });
      await fetchStats();
      dispatch({ type: 'SET_LOADING', payload: { key: 'refreshing', value: false } });
    }, [fetchStats]);

    // Memoized values
    const hasSelectedTransactions = state.selectedTransactions.size > 0;
    const statsCardData = useMemo(
      () => [
        {
          value: state.stats.totalTransactions,
          label: 'Total Transactions',
          loading: state.loading.stats,
        },
        { value: state.stats.uncategorized, label: 'Uncategorized', loading: state.loading.stats },
        {
          value: `$${state.stats.businessExpenses}`,
          label: 'Business Expenses',
          loading: state.loading.stats,
        },
        { value: `$${state.stats.totalGST}`, label: 'GST Claimable', loading: state.loading.stats },
      ],
      [state.stats, state.loading.stats],
    );

    // Get selected transactions for categorizer
    const getSelectedTransactionsData = useCallback(async () => {
      if (state.selectedTransactions.size === 0) return [];

      try {
        const response = await fetch('/api/transactions/by-ids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: Array.from(state.selectedTransactions),
          }),
        });

        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        logger.error('Error fetching selected transactions:', error);
      }
      return [];
    }, [state.selectedTransactions]);

    if (state.showDetails && state.selectedTransaction) {
      return (
        <TransactionDetails
          transactionId={state.selectedTransaction.id}
          onClose={() => {
            dispatch({ type: 'TOGGLE_DETAILS', payload: false });
            dispatch({ type: 'SET_SELECTED_TRANSACTION', payload: null });
          }}
          onUpdate={(updated) => {
            dispatch({ type: 'REFRESH_TRANSACTIONS' });
            fetchStats();
          }}
          onDelete={() => {
            dispatch({ type: 'TOGGLE_DETAILS', payload: false });
            dispatch({ type: 'SET_SELECTED_TRANSACTION', payload: null });
            dispatch({ type: 'REFRESH_TRANSACTIONS' });
            fetchStats();
          }}
          className={className}
        />
      );
    }

    if (state.showCategorizer) {
      return (
        <div className={className}>
          {hasSelectedTransactions ? (
            <div className="space-y-4">
              <Card>
                <p className="text-sm text-gray-600">
                  Loading {state.selectedTransactions.size} selected transactions...
                </p>
              </Card>
              {/* The categorizer will load the transactions */}
              <TransactionCategorizer
                transaction={[]}
                onCategorize={handleCategorize}
                onClose={() => {
                  dispatch({ type: 'TOGGLE_CATEGORIZER', payload: false });
                  dispatch({ type: 'RESET_SELECTION' });
                }}
              />
            </div>
          ) : (
            <Card>
              <p>No transactions selected</p>
            </Card>
          )}
        </div>
      );
    }

    return (
      <div className={`space-y-6 ${className}`}>
        {/* Loading overlays */}
        {state.loading.exporting && <LoadingOverlay message="Exporting transactions..." />}
        {state.loading.deleting && <LoadingOverlay message="Deleting transactions..." />}
        {state.loading.categorizing && <LoadingOverlay message="Categorizing transactions..." />}

        {/* Error displays */}
        {statsError && (
          <ErrorDisplay
            error={statsError}
            onRetry={fetchStats}
            className="mb-4"
          />
        )}

        {accountsError && (
          <ErrorDisplay
            error={accountsError}
            onRetry={fetchAccounts}
            className="mb-4"
          />
        )}

        {actionError && (
          <ErrorDisplay
            error={actionError}
            onRetry={() => clearActionError()}
            className="mb-4"
          />
        )}

        {/* Header with Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {state.loading.stats ? (
            <>
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
              <SkeletonStatsCard />
            </>
          ) : statsError ? (
            <Card className="col-span-full">
              <NetworkError onRetry={fetchStats} />
            </Card>
          ) : (
            <>
              <Card>
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">
                    {state.stats.totalTransactions}
                  </p>
                  <p className="text-sm text-gray-600">Total Transactions</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600">{state.stats.uncategorized}</p>
                  <p className="text-sm text-gray-600">Uncategorized</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    ${state.stats.businessExpenses}
                  </p>
                  <p className="text-sm text-gray-600">Business Expenses</p>
                </div>
              </Card>
              <Card>
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">${state.stats.totalGST}</p>
                  <p className="text-sm text-gray-600">GST Claimable</p>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Search Bar */}
        <MemoizedCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Quick Search</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                className="p-2 hover:bg-gray-100 rounded relative"
                title="Refresh"
                disabled={state.loading.refreshing}
              >
                {state.loading.refreshing ? (
                  <InlineLoader size="sm" />
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                )}
              </button>
              <LoadingButton
                onClick={() => exportTransactions()}
                loading={state.loading.exporting}
                className="p-2 hover:bg-gray-100 rounded"
                title="Export All"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </LoadingButton>
            </div>
          </div>
          <MemoizedTransactionSearch
            onResultSelect={handleSearchSelect}
            onSearchChange={(query) =>
              dispatch({ type: 'SET_FILTERS', payload: { ...state.filters, search: query } })
            }
            showRecent={true}
            autoFocus={false}
          />
        </MemoizedCard>

        {/* Filters */}
        <MemoizedTransactionFilters
          filters={state.filters}
          onFiltersChange={(filters) => dispatch({ type: 'SET_FILTERS', payload: filters })}
          accounts={state.accounts}
          showAdvanced={false}
        />

        {/* Bulk Actions */}
        {hasSelectedTransactions && (
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {state.selectedTransactions.size} transaction
                {state.selectedTransactions.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <LoadingButton
                  onClick={() => handleBulkAction('categorize')}
                  loading={state.loading.categorizing}
                  className="btn btn-sm btn-secondary"
                >
                  Categorize
                </LoadingButton>
                <LoadingButton
                  onClick={() => handleBulkAction('export')}
                  loading={state.loading.exporting}
                  className="btn btn-sm btn-secondary"
                >
                  Export
                </LoadingButton>
                <LoadingButton
                  onClick={() => handleBulkAction('delete')}
                  loading={state.loading.deleting}
                  className="btn btn-sm btn-danger"
                >
                  Delete
                </LoadingButton>
              </div>
            </div>
          </Card>
        )}

        {/* Transaction List */}
        <AsyncErrorBoundary>
          <MemoizedTransactionList
            key={state.refreshKey}
            filters={state.filters}
            onTransactionSelect={handleTransactionSelect}
            selectedTransactions={state.selectedTransactions}
            onSelectionChange={(selected) =>
              dispatch({ type: 'SET_SELECTED_TRANSACTIONS', payload: selected })
            }
            showCheckboxes={true}
          />
        </AsyncErrorBoundary>

        {/* Quick Actions FAB */}
        <div className="fixed bottom-6 right-6">
          <div className="relative">
            <button
              onClick={() => dispatch({ type: 'TOGGLE_BULK_ACTIONS' })}
              className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </button>

            {state.showBulkActions && (
              <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl p-2 min-w-[200px]">
                <button
                  onClick={() => {
                    handleBulkAction('categorize');
                    dispatch({ type: 'TOGGLE_BULK_ACTIONS', payload: false });
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                >
                  Bulk Categorize
                </button>
                <button
                  onClick={() => {
                    dispatch({
                      type: 'SET_FILTERS',
                      payload: { ...state.filters, uncategorizedOnly: true },
                    });
                    dispatch({ type: 'TOGGLE_BULK_ACTIONS', payload: false });
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                >
                  Show Uncategorized
                </button>
                <button
                  onClick={() => {
                    dispatch({
                      type: 'SET_FILTERS',
                      payload: { ...state.filters, businessOnly: true },
                    });
                    dispatch({ type: 'TOGGLE_BULK_ACTIONS', payload: false });
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                >
                  Show Business Only
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

TransactionsDashboard.displayName = 'TransactionsDashboard';

export default TransactionsDashboard;
