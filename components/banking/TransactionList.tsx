import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction, TaxCategory } from '@/lib/basiq/types';
import { Card, formatCurrency } from '@/components/dashboard/Card';
import { logger } from '@/lib/logger';

interface TransactionListProps {
  accountId?: string;
  dateRange?: { start: Date; end: Date };
  onTransactionUpdate?: () => void;
  className?: string;
}

const TAX_CATEGORIES: TaxCategory[] = [
  { code: 'D1', name: 'Car expenses' },
  { code: 'D2', name: 'Travel expenses' },
  { code: 'D3', name: 'Clothing expenses' },
  { code: 'D4', name: 'Self-education expenses' },
  { code: 'D5', name: 'Other work-related expenses' },
  { code: 'D6', name: 'Low-value pool deduction' },
  { code: 'D7', name: 'Interest deductions' },
  { code: 'D8', name: 'Dividend deductions' },
  { code: 'D9', name: 'Gifts and donations' },
  { code: 'D10', name: 'Cost of managing tax affairs' },
  { code: 'P8', name: 'Personal expenses (non-deductible)' },
];

export const TransactionList: React.FC<TransactionListProps> = ({
  accountId,
  dateRange,
  onTransactionUpdate,
  className = '',
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    businessOnly: false,
    uncategorizedOnly: false,
  });
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [categorizing, setCategorizing] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const ITEMS_PER_PAGE = 50;

  // Fetch transactions
  const fetchTransactions = useCallback(
    async (pageNum: number = 1) => {
      try {
        setLoading(pageNum === 1);
        setError(null);

        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: ITEMS_PER_PAGE.toString(),
        });

        if (accountId) params.append('accountId', accountId);
        if (dateRange?.start) params.append('startDate', dateRange.start.toISOString());
        if (dateRange?.end) params.append('endDate', dateRange.end.toISOString());

        const response = await fetch(`/api/basiq/transactions?${params}`);
        if (!response.ok) throw new Error('Failed to fetch transactions');

        const data = await response.json();

        if (pageNum === 1) {
          setTransactions(data.transactions);
        } else {
          setTransactions((prev) => [...prev, ...data.transactions]);
        }

        setHasMore(data.hasMore);
        setPage(pageNum);
      } catch (error) {
        logger.error('Error fetching transactions:', error);
        setError('Failed to load transactions');
      } finally {
        setLoading(false);
      }
    },
    [accountId, dateRange],
  );

  // Categorize transaction(s)
  const categorizeTransactions = async (
    transactionIds: string[],
    category: string,
    isBusinessExpense: boolean,
  ) => {
    try {
      setCategorizing(transactionIds[0]);

      const response = await fetch('/api/basiq/transactions/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds,
          taxCategory: category,
          isBusinessExpense,
        }),
      });

      if (!response.ok) throw new Error('Failed to categorize');

      // Update local state
      setTransactions((prev) =>
        prev.map((tx) =>
          transactionIds.includes(tx.id) ? { ...tx, taxCategory: category, isBusinessExpense } : tx,
        ),
      );

      // Clear selection
      setSelectedTransactions(new Set());
      setBulkActionMode(false);

      if (onTransactionUpdate) onTransactionUpdate();
    } catch (error) {
      logger.error('Categorization error:', error);
      setError('Failed to categorize transactions');
    } finally {
      setCategorizing(null);
    }
  };

  // Export transactions
  const exportTransactions = async (format: 'csv' | 'pdf') => {
    try {
      setExportLoading(true);

      const params = new URLSearchParams({ format });
      if (accountId) params.append('accountId', accountId);
      if (dateRange?.start) params.append('startDate', dateRange.start.toISOString());
      if (dateRange?.end) params.append('endDate', dateRange.end.toISOString());

      const response = await fetch(`/api/basiq/transactions/export?${params}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Export error:', error);
      setError('Failed to export transactions');
    } finally {
      setExportLoading(false);
    }
  };

  // Smart categorization suggestion
  const suggestCategory = async (transactionId: string) => {
    try {
      const response = await fetch(`/api/ai/categorize-transaction/${transactionId}`);
      if (!response.ok) throw new Error('Failed to get suggestion');

      const { category, confidence } = await response.json();

      if (confidence > 0.8) {
        // Auto-apply if high confidence
        await categorizeTransactions([transactionId], category, true);
      } else {
        // Show suggestion to user
        return { category, confidence };
      }
    } catch (error) {
      logger.error('Suggestion error:', error);
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filters.search && !tx.description.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.category && tx.taxCategory !== filters.category) {
        return false;
      }
      if (filters.businessOnly && !tx.isBusinessExpense) {
        return false;
      }
      if (filters.uncategorizedOnly && tx.taxCategory) {
        return false;
      }
      return true;
    });
  }, [transactions, filters]);

  // Toggle transaction selection
  const toggleSelection = (transactionId: string) => {
    const newSelection = new Set(selectedTransactions);
    if (newSelection.has(transactionId)) {
      newSelection.delete(transactionId);
    } else {
      newSelection.add(transactionId);
    }
    setSelectedTransactions(newSelection);
  };

  // Select all visible transactions
  const selectAll = () => {
    const allIds = filteredTransactions.map((tx) => tx.id);
    setSelectedTransactions(new Set(allIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTransactions(new Set());
  };

  useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  // Calculate summary
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expenses = filteredTransactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const businessExpenses = filteredTransactions
      .filter((tx) => tx.amount < 0 && tx.isBusinessExpense)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const gst = businessExpenses * 0.1; // 10% GST

    return { income, expenses, businessExpenses, gst };
  }, [filteredTransactions]);

  if (loading && transactions.length === 0) {
    return (
      <Card className={className}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 rounded"
            />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Card */}
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Income</p>
            <p className="text-xl font-semibold text-green-600">{formatCurrency(summary.income)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Expenses</p>
            <p className="text-xl font-semibold text-red-600">{formatCurrency(summary.expenses)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Business Expenses</p>
            <p className="text-xl font-semibold text-blue-600">
              {formatCurrency(summary.businessExpenses)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">GST Claimable</p>
            <p className="text-xl font-semibold text-purple-600">{formatCurrency(summary.gst)}</p>
          </div>
        </div>
      </Card>

      {/* Filters and Actions */}
      <Card>
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search transactions..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {TAX_CATEGORIES.map((cat) => (
                <option
                  key={cat.code}
                  value={cat.code}
                >
                  {cat.code} - {cat.name}
                </option>
              ))}
            </select>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.businessOnly}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, businessOnly: e.target.checked }))
                }
                className="rounded text-blue-600"
              />
              <span>Business Only</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.uncategorizedOnly}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, uncategorizedOnly: e.target.checked }))
                }
                className="rounded text-blue-600"
              />
              <span>Uncategorized</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setBulkActionMode(!bulkActionMode)}
                className={`btn btn-sm ${bulkActionMode ? 'btn-primary' : 'btn-secondary'}`}
              >
                {bulkActionMode ? 'Cancel Bulk Mode' : 'Bulk Actions'}
              </button>
              {bulkActionMode && (
                <>
                  <button
                    onClick={selectAll}
                    className="btn btn-sm btn-secondary"
                  >
                    Select All ({filteredTransactions.length})
                  </button>
                  <button
                    onClick={clearSelection}
                    className="btn btn-sm btn-secondary"
                    disabled={selectedTransactions.size === 0}
                  >
                    Clear Selection
                  </button>
                  {selectedTransactions.size > 0 && (
                    <span className="text-sm text-gray-600">
                      {selectedTransactions.size} selected
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => exportTransactions('csv')}
                className="btn btn-sm btn-secondary"
                disabled={exportLoading}
              >
                {exportLoading ? <span className="spinner mr-2" /> : '📊'} Export CSV
              </button>
              <button
                onClick={() => exportTransactions('pdf')}
                className="btn btn-sm btn-secondary"
                disabled={exportLoading}
              >
                {exportLoading ? <span className="spinner mr-2" /> : '📄'} Export PDF
              </button>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {bulkActionMode && selectedTransactions.size > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Bulk categorize {selectedTransactions.size} transaction
                  {selectedTransactions.size !== 1 ? 's' : ''}:
                </span>
                <div className="flex items-center space-x-2">
                  <select
                    className="px-3 py-1 border rounded text-sm"
                    onChange={(e) => {
                      if (e.target.value) {
                        categorizeTransactions(
                          Array.from(selectedTransactions),
                          e.target.value,
                          true,
                        );
                      }
                    }}
                  >
                    <option value="">Select category...</option>
                    {TAX_CATEGORIES.map((cat) => (
                      <option
                        key={cat.code}
                        value={cat.code}
                      >
                        {cat.code} - {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Transaction List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {bulkActionMode && (
                  <th className="px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.size === filteredTransactions.length}
                      onChange={() => {
                        if (selectedTransactions.size === filteredTransactions.length) {
                          clearSelection();
                        } else {
                          selectAll();
                        }
                      }}
                      className="rounded text-blue-600"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  isSelected={selectedTransactions.has(transaction.id)}
                  onSelect={() => toggleSelection(transaction.id)}
                  onCategorize={categorizeTransactions}
                  onSuggestCategory={suggestCategory}
                  bulkMode={bulkActionMode}
                  categorizing={categorizing === transaction.id}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={() => fetchTransactions(page + 1)}
              className="btn btn-secondary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner mr-2" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}

        {/* Empty State */}
        {filteredTransactions.length === 0 && !loading && (
          <div className="text-center py-8">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-600">No transactions found</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or date range</p>
          </div>
        )}
      </Card>
    </div>
  );
};

// Transaction Row Component
interface TransactionRowProps {
  transaction: Transaction;
  isSelected: boolean;
  onSelect: () => void;
  onCategorize: (ids: string[], category: string, isBusiness: boolean) => Promise<void>;
  onSuggestCategory: (id: string) => Promise<{ category: string; confidence: number } | undefined>;
  bulkMode: boolean;
  categorizing: boolean;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  isSelected,
  onSelect,
  onCategorize,
  onSuggestCategory,
  bulkMode,
  categorizing,
}) => {
  const [showCategorize, setShowCategorize] = useState(false);
  const [suggestion, setSuggestion] = useState<{ category: string; confidence: number } | null>(
    null,
  );

  const handleSuggest = async () => {
    const result = await onSuggestCategory(transaction.id);
    if (result) {
      setSuggestion(result);
    }
  };

  return (
    <tr className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
      {bulkMode && (
        <td className="px-3 py-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="rounded text-blue-600"
          />
        </td>
      )}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {new Date(transaction.date).toLocaleDateString('en-AU')}
      </td>
      <td className="px-6 py-4 text-sm text-gray-900">
        <div>
          <div className="font-medium">{transaction.description}</div>
          {transaction.merchant && <div className="text-gray-500">{transaction.merchant}</div>}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        {transaction.taxCategory ? (
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {transaction.taxCategory}
            </span>
            {transaction.isBusinessExpense && (
              <span className="ml-1 text-xs text-gray-500">Business</span>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowCategorize(!showCategorize)}
            className="text-gray-400 hover:text-gray-600"
          >
            + Add category
          </button>
        )}
      </td>
      <td
        className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {transaction.amount >= 0 ? '+' : ''}
        {formatCurrency(Math.abs(transaction.amount))}
        {transaction.gstAmount && (
          <div className="text-xs text-gray-500">GST: {formatCurrency(transaction.gstAmount)}</div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
        <button
          onClick={() => setShowCategorize(!showCategorize)}
          className="text-blue-600 hover:text-blue-800"
          disabled={categorizing}
        >
          {categorizing ? <span className="spinner" /> : '✏️'}
        </button>
      </td>

      {/* Inline Categorization */}
      {showCategorize && (
        <tr>
          <td
            colSpan={bulkMode ? 6 : 5}
            className="px-6 py-4 bg-gray-50 border-t"
          >
            <div className="space-y-3">
              {suggestion && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm">
                    Suggested category: <strong>{suggestion.category}</strong>
                    <span className="text-gray-500 ml-2">
                      ({Math.round(suggestion.confidence * 100)}% confidence)
                    </span>
                  </p>
                  <button
                    onClick={() => {
                      onCategorize([transaction.id], suggestion.category, true);
                      setShowCategorize(false);
                    }}
                    className="mt-2 btn btn-sm btn-primary"
                  >
                    Apply Suggestion
                  </button>
                </div>
              )}
              <div className="flex items-center space-x-3">
                <select
                  className="flex-1 px-3 py-2 border rounded"
                  onChange={(e) => {
                    if (e.target.value) {
                      onCategorize([transaction.id], e.target.value, true);
                      setShowCategorize(false);
                    }
                  }}
                >
                  <option value="">Select tax category...</option>
                  {TAX_CATEGORIES.map((cat) => (
                    <option
                      key={cat.code}
                      value={cat.code}
                    >
                      {cat.code} - {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleSuggest}
                  className="btn btn-sm btn-secondary"
                >
                  🤖 Suggest
                </button>
                <button
                  onClick={() => setShowCategorize(false)}
                  className="btn btn-sm btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </tr>
  );
};

export default TransactionList;
