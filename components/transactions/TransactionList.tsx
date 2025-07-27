import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { formatCurrency } from '@/components/dashboard/Card';
import { SkeletonTransactionRow, InlineLoader, Skeleton } from '@/components/ui/SkeletonLoaders';
import { ErrorDisplay, NetworkError, EmptyState } from '@/components/ui/ErrorComponents';
import { useApiError } from '@/hooks/useApiError';
import { logApiError } from '@/lib/errors/errorLogger';
import { useAriaLive, KEYS, focusRing, announce } from '@/lib/utils/accessibility';

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

interface TransactionListProps {
  accountId?: string;
  filters?: TransactionFilters;
  onTransactionSelect?: (transaction: Transaction) => void;
  onCategorize?: (transactionId: string, category: string, taxCategory?: string) => void;
  selectedTransactions?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  showCheckboxes?: boolean;
  className?: string;
}

interface TransactionFilters {
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
}

const ITEM_HEIGHT = 72;
const LOAD_MORE_THRESHOLD = 5;

export const TransactionList: React.FC<TransactionListProps> = ({
  accountId,
  filters = {},
  onTransactionSelect,
  onCategorize,
  selectedTransactions = new Set(),
  onSelectionChange,
  showCheckboxes = false,
  className = '',
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const listRef = useRef<List>(null);
  const { announcePolite, announceAssertive } = useAriaLive();

  // Error handling
  const { error, handleError, clearError } = useApiError();
  const [retryCount, setRetryCount] = useState(0);

  const ITEMS_PER_PAGE = 50;

  // Fetch transactions
  const fetchTransactions = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        if (!append) {
          setLoading(true);
          clearError();
        } else {
          setLoadingMore(true);
        }

        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: ITEMS_PER_PAGE.toString(),
        });

        // Add filters
        if (accountId) params.append('accountId', accountId);
        if (filters.search) params.append('search', filters.search);
        if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.append('dateTo', filters.dateTo);
        if (filters.amountMin !== undefined)
          params.append('amountMin', filters.amountMin.toString());
        if (filters.amountMax !== undefined)
          params.append('amountMax', filters.amountMax.toString());
        if (filters.category) params.append('category', filters.category);
        if (filters.taxCategory) params.append('taxCategory', filters.taxCategory);
        if (filters.type && filters.type !== 'all') params.append('type', filters.type);
        if (filters.businessOnly) params.append('businessOnly', 'true');
        if (filters.uncategorizedOnly) params.append('uncategorizedOnly', 'true');
        if (filters.hasReceipt !== undefined)
          params.append('hasReceipt', filters.hasReceipt.toString());

        const response = await fetch(`/api/transactions?${params}`);

        if (!response.ok) {
          const error = new Error(`Failed to fetch transactions: ${response.status}`);
          (error as any).response = response;
          throw error;
        }

        const data = await response.json();

        if (append) {
          setTransactions((prev) => [...prev, ...data.transactions]);
        } else {
          setTransactions(data.transactions || []);
        }

        setTotalCount(data.total || 0);
        setHasMore(data.hasMore || false);
        setPage(pageNum);

        // Reset retry count on success
        setRetryCount(0);
      } catch (err) {
        handleError(err, {
          endpoint: '/api/transactions',
          method: 'GET',
          retryable: true,
        });

        // Don't clear existing data on error if appending
        if (!append) {
          setTransactions([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accountId, filters, handleError, clearError],
  );

  // Load more transactions
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchTransactions(page + 1, true);
    }
  }, [page, loadingMore, hasMore, fetchTransactions]);

  // Toggle row expansion
  const toggleRowExpansion = (transactionId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  // Handle checkbox change
  const handleCheckboxChange = (transactionId: string) => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedTransactions);
    if (newSelection.has(transactionId)) {
      newSelection.delete(transactionId);
    } else {
      newSelection.add(transactionId);
    }
    onSelectionChange(newSelection);
  };

  // Select all visible
  const selectAll = () => {
    if (!onSelectionChange) return;
    const allIds = transactions.map((t) => t.id);
    onSelectionChange(new Set(allIds));
  };

  // Clear selection
  const clearSelection = () => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set());
  };

  // Calculate summary
  const summary = useMemo(() => {
    const credits = transactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const debits = transactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const businessExpenses = transactions
      .filter((t) => t.type === 'debit' && t.isBusinessExpense)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const gst = transactions
      .filter((t) => t.gstAmount)
      .reduce((sum, t) => sum + (t.gstAmount || 0), 0);

    return { credits, debits, businessExpenses, gst, net: credits - debits };
  }, [transactions]);

  useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  // Row renderer for virtual list
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const transaction = transactions[index];
    const isExpanded = expandedRows.has(transaction.id);
    const isSelected = selectedTransactions.has(transaction.id);

    // Check if we need to load more
    if (index === transactions.length - LOAD_MORE_THRESHOLD && hasMore && !loadingMore) {
      loadMore();
    }

    return (
      <div
        style={style}
        className={`border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-all duration-200 ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        }`}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              {showCheckboxes && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleCheckboxChange(transaction.id)}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  aria-label={`Select transaction ${transaction.merchant || transaction.description}`}
                />
              )}

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {transaction.merchant || transaction.description}
                      </span>
                      {transaction.receiptId && (
                        <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                          Receipt
                        </span>
                      )}
                      {transaction.isBusinessExpense && (
                        <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">
                          Business
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(transaction.date).toLocaleDateString('en-AU')}
                      {transaction.accountName && ` • ${transaction.accountName}`}
                      {transaction.category && ` • ${transaction.category}`}
                    </div>
                  </div>

                  <div className="text-right ml-4">
                    <div
                      className={`font-medium ${
                        transaction.type === 'credit' ? 'text-green-600' : 'text-gray-900'
                      }`}
                    >
                      {transaction.type === 'credit' ? '+' : '-'}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </div>
                    {transaction.gstAmount && (
                      <div className="text-xs text-gray-500">
                        GST: {formatCurrency(transaction.gstAmount)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => toggleRowExpansion(transaction.id)}
                className="p-2 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors touch-manipulation"
                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
              >
                <svg
                  className={`w-4 h-4 transform transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700 animate-slideDown">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Full Description:</span>
                  <p className="text-gray-900">{transaction.description}</p>
                </div>
                {transaction.taxCategory && (
                  <div>
                    <span className="text-gray-500">Tax Category:</span>
                    <p className="text-gray-900">{transaction.taxCategory}</p>
                  </div>
                )}
                {transaction.balance !== undefined && (
                  <div>
                    <span className="text-gray-500">Balance After:</span>
                    <p className="text-gray-900">{formatCurrency(transaction.balance)}</p>
                  </div>
                )}
                {transaction.notes && (
                  <div>
                    <span className="text-gray-500">Notes:</span>
                    <p className="text-gray-900">{transaction.notes}</p>
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {onTransactionSelect && (
                  <button
                    onClick={() => onTransactionSelect(transaction)}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                  >
                    View Details
                  </button>
                )}
                {onCategorize && !transaction.category && (
                  <button
                    onClick={() => onCategorize(transaction.id, '', '')}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                  >
                    Categorize
                  </button>
                )}
                {!transaction.receiptId && (
                  <button className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800 rounded-md transition-colors">
                    Attach Receipt
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        {/* Header skeleton */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <Skeleton
              height={24}
              width={200}
              rounded
            />
            <Skeleton
              height={20}
              width={100}
              rounded
            />
          </div>
        </div>

        {/* Summary skeleton */}
        <div className="px-4 py-3 bg-gray-50 border-b grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i}>
              <Skeleton
                height={14}
                width={60}
                rounded
                className="mb-1"
              />
              <Skeleton
                height={20}
                width={80}
                rounded
              />
            </div>
          ))}
        </div>

        {/* Transaction rows skeleton */}
        <div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <SkeletonTransactionRow key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    // Check if it's a network error
    if (error.code === 'NETWORK_ERROR') {
      return (
        <div className={`bg-white rounded-lg shadow ${className}`}>
          <NetworkError
            onRetry={() => fetchTransactions(1)}
            className="m-6"
          />
        </div>
      );
    }

    return (
      <div className={`bg-white rounded-lg shadow ${className}`}>
        <ErrorDisplay
          error={error.message || 'Failed to load transactions'}
          onRetry={() => fetchTransactions(1)}
          className="m-6"
        />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">
              Transactions
              <span className="text-sm text-gray-500 ml-2">
                ({totalCount} total, showing {transactions.length})
              </span>
            </h3>
          </div>
          {showCheckboxes && selectedTransactions.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{selectedTransactions.size} selected</span>
              <button
                onClick={clearSelection}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 bg-gray-50 border-b grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Credits:</span>
          <p className="font-medium text-green-600">{formatCurrency(summary.credits)}</p>
        </div>
        <div>
          <span className="text-gray-500">Debits:</span>
          <p className="font-medium text-gray-900">{formatCurrency(summary.debits)}</p>
        </div>
        <div>
          <span className="text-gray-500">Business:</span>
          <p className="font-medium text-blue-600">{formatCurrency(summary.businessExpenses)}</p>
        </div>
        <div>
          <span className="text-gray-500">GST:</span>
          <p className="font-medium text-purple-600">{formatCurrency(summary.gst)}</p>
        </div>
        <div>
          <span className="text-gray-500">Net:</span>
          <p className={`font-medium ${summary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(summary.net)}
          </p>
        </div>
      </div>

      {/* Virtual List */}
      {transactions.length > 0 ? (
        <div style={{ height: '600px' }}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                height={height}
                itemCount={transactions.length}
                itemSize={ITEM_HEIGHT}
                width={width}
              >
                {Row}
              </List>
            )}
          </AutoSizer>

          {/* Loading more indicator */}
          {loadingMore && (
            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-center space-x-3">
                <InlineLoader size="md" />
                <p className="text-sm text-gray-600">Loading more transactions...</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No transactions found"
          message="Try adjusting your filters or date range"
          action={
            filters.search || filters.category || filters.dateFrom || filters.dateTo
              ? {
                  label: 'Clear Filters',
                  onClick: () => {
                    // Reset filters to show all transactions
                    window.location.reload();
                  },
                }
              : undefined
          }
          className="py-12"
        />
      )}
    </div>
  );
};

export default TransactionList;
