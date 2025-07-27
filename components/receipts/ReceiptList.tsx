import React, { useState, useMemo, useCallback, memo } from 'react';
import { Card, formatCurrency } from '@/components/dashboard/Card';
import { ReceiptPreview } from './ReceiptPreview';

// Memoized ReceiptPreview wrapper
const MemoizedReceiptPreview = memo(ReceiptPreview);

interface Receipt {
  id: string;
  merchant: string;
  totalAmount: number;
  gstAmount: number;
  date: string;
  processingStatus: ReceiptStatus;
  aiConfidence?: number;
  imageUrl: string;
  taxCategory?: string;
  matchedTransactionId?: string;
  abn?: string;
  taxInvoiceNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

type ReceiptStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'MATCHED'
  | 'MANUAL_REVIEW'
  | 'FAILED';

interface ReceiptListProps {
  receipts: Receipt[];
  loading?: boolean;
  onEdit?: (receipt: Receipt) => void;
  onDelete?: (receiptId: string) => void;
  onReprocess?: (receiptId: string) => void;
  onMatch?: (receiptId: string) => void;
  onBulkAction?: (action: string, receiptIds: string[]) => void;
  className?: string;
}

// Memoized receipt row component
const ReceiptRow = memo<{
  receipt: Receipt;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onPreview: (receipt: Receipt) => void;
  onEdit?: (receipt: Receipt) => void;
  onReprocess?: (id: string) => void;
  onDelete?: (id: string) => void;
  getStatusBadge: (status: ReceiptStatus) => { color: string; label: string };
  formatCurrency: (amount: number) => string;
}>(
  ({
    receipt,
    isSelected,
    onToggleSelection,
    onPreview,
    onEdit,
    onReprocess,
    onDelete,
    getStatusBadge,
    formatCurrency,
  }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(receipt.id)}
          className="rounded text-blue-600"
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        {new Date(receipt.date).toLocaleDateString('en-AU')}
      </td>
      <td className="px-6 py-4 text-sm">
        <div>
          <div className="font-medium">{receipt.merchant}</div>
          {receipt.taxInvoiceNumber && (
            <div className="text-xs text-gray-500">#{receipt.taxInvoiceNumber}</div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        {formatCurrency(receipt.totalAmount)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(receipt.gstAmount)}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">{receipt.taxCategory || '-'}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(receipt.processingStatus).color}`}
        >
          {getStatusBadge(receipt.processingStatus).label}
        </span>
        {receipt.matchedTransactionId && (
          <span className="ml-2 text-xs text-purple-600">Matched</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => onPreview(receipt)}
            className="text-gray-600 hover:text-gray-900"
            title="Preview"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </button>
          {onEdit && (
            <button
              onClick={() => onEdit(receipt)}
              className="text-blue-600 hover:text-blue-800"
              title="Edit"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          {receipt.processingStatus === 'FAILED' && onReprocess && (
            <button
              onClick={() => onReprocess(receipt.id)}
              className="text-yellow-600 hover:text-yellow-800"
              title="Reprocess"
            >
              <svg
                className="w-4 h-4"
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
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this receipt?')) {
                  onDelete(receipt.id);
                }
              }}
              className="text-red-600 hover:text-red-800"
              title="Delete"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  ),
);

ReceiptRow.displayName = 'ReceiptRow';

// Memoized receipt card component
const ReceiptCard = memo<{
  receipt: Receipt;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onPreview: (receipt: Receipt) => void;
  onEdit?: (receipt: Receipt) => void;
  onDelete?: (id: string) => void;
  getStatusBadge: (status: ReceiptStatus) => { color: string; label: string };
  formatCurrency: (amount: number) => string;
}>(
  ({
    receipt,
    isSelected,
    onToggleSelection,
    onPreview,
    onEdit,
    onDelete,
    getStatusBadge,
    formatCurrency,
  }) => (
    <Card className="relative hover:shadow-lg transition-shadow">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelection(receipt.id)}
        className="absolute top-3 right-3 rounded text-blue-600 z-10"
      />

      <div className="space-y-3">
        <div>
          <h3 className="font-medium text-gray-900 pr-8">{receipt.merchant}</h3>
          <p className="text-sm text-gray-500">
            {new Date(receipt.date).toLocaleDateString('en-AU')}
          </p>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-lg font-bold">{formatCurrency(receipt.totalAmount)}</p>
            <p className="text-sm text-gray-500">GST: {formatCurrency(receipt.gstAmount)}</p>
          </div>
          <span
            className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(receipt.processingStatus).color}`}
          >
            {getStatusBadge(receipt.processingStatus).label}
          </span>
        </div>

        {receipt.taxCategory && (
          <p className="text-sm text-gray-600">Category: {receipt.taxCategory}</p>
        )}

        <div className="flex justify-between items-center pt-3 border-t">
          <button
            onClick={() => onPreview(receipt)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View Receipt
          </button>
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                onClick={() => onEdit(receipt)}
                className="text-gray-600 hover:text-gray-800"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this receipt?')) {
                    onDelete(receipt.id);
                  }
                }}
                className="text-red-600 hover:text-red-800"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  ),
);

ReceiptCard.displayName = 'ReceiptCard';

export const ReceiptList: React.FC<ReceiptListProps> = memo(
  ({
    receipts,
    loading = false,
    onEdit,
    onDelete,
    onReprocess,
    onMatch,
    onBulkAction,
    className = '',
  }) => {
    const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState({
      search: '',
      status: '',
      taxCategory: '',
      dateFrom: '',
      dateTo: '',
      matched: '',
    });
    const [sortBy, setSortBy] = useState<'date' | 'amount' | 'merchant'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

    // Filter and sort receipts
    const processedReceipts = useMemo(() => {
      let filtered = receipts.filter((receipt) => {
        // Search filter
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          if (
            !receipt.merchant.toLowerCase().includes(searchLower) &&
            !receipt.taxInvoiceNumber?.toLowerCase().includes(searchLower) &&
            !receipt.notes?.toLowerCase().includes(searchLower)
          ) {
            return false;
          }
        }

        // Status filter
        if (filters.status && receipt.processingStatus !== filters.status) {
          return false;
        }

        // Tax category filter
        if (filters.taxCategory && receipt.taxCategory !== filters.taxCategory) {
          return false;
        }

        // Date range filter
        if (filters.dateFrom && new Date(receipt.date) < new Date(filters.dateFrom)) {
          return false;
        }
        if (filters.dateTo && new Date(receipt.date) > new Date(filters.dateTo)) {
          return false;
        }

        // Matched filter
        if (filters.matched === 'matched' && !receipt.matchedTransactionId) {
          return false;
        }
        if (filters.matched === 'unmatched' && receipt.matchedTransactionId) {
          return false;
        }

        return true;
      });

      // Sort
      filtered.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case 'date':
            comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
            break;
          case 'amount':
            comparison = a.totalAmount - b.totalAmount;
            break;
          case 'merchant':
            comparison = a.merchant.localeCompare(b.merchant);
            break;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });

      return filtered;
    }, [receipts, filters, sortBy, sortOrder]);

    // Toggle receipt selection
    const toggleSelection = useCallback((receiptId: string) => {
      setSelectedReceipts((prev) => {
        const newSelection = new Set(prev);
        if (newSelection.has(receiptId)) {
          newSelection.delete(receiptId);
        } else {
          newSelection.add(receiptId);
        }
        return newSelection;
      });
    }, []);

    // Select all visible receipts
    const selectAll = useCallback(() => {
      const allIds = processedReceipts.map((r) => r.id);
      setSelectedReceipts(new Set(allIds));
    }, [processedReceipts]);

    // Clear selection
    const clearSelection = useCallback(() => {
      setSelectedReceipts(new Set());
    }, []);

    // Handle bulk actions
    const handleBulkAction = useCallback(
      (action: string) => {
        if (onBulkAction && selectedReceipts.size > 0) {
          onBulkAction(action, Array.from(selectedReceipts));
          clearSelection();
        }
      },
      [onBulkAction, selectedReceipts, clearSelection],
    );

    // Get status badge config
    const getStatusBadge = useCallback((status: ReceiptStatus) => {
      const configs = {
        PENDING: { color: 'bg-gray-100 text-gray-800', label: 'Pending' },
        PROCESSING: { color: 'bg-blue-100 text-blue-800', label: 'Processing' },
        PROCESSED: { color: 'bg-green-100 text-green-800', label: 'Processed' },
        MATCHED: { color: 'bg-purple-100 text-purple-800', label: 'Matched' },
        MANUAL_REVIEW: { color: 'bg-yellow-100 text-yellow-800', label: 'Review Required' },
        FAILED: { color: 'bg-red-100 text-red-800', label: 'Failed' },
      };
      return configs[status] || configs.PENDING;
    }, []);

    // Memoized format currency
    const formatCurrencyMemo = useCallback(formatCurrency, []);

    // Calculate summary statistics
    const summary = useMemo(() => {
      const stats = processedReceipts.reduce(
        (acc, receipt) => ({
          total: acc.total + receipt.totalAmount,
          gst: acc.gst + receipt.gstAmount,
          count: acc.count + 1,
          matched: acc.matched + (receipt.matchedTransactionId ? 1 : 0),
        }),
        { total: 0, gst: 0, count: 0, matched: 0 },
      );

      return {
        ...stats,
        avgAmount: stats.count > 0 ? stats.total / stats.count : 0,
        matchRate: stats.count > 0 ? (stats.matched / stats.count) * 100 : 0,
      };
    }, [processedReceipts]);

    if (loading) {
      return (
        <Card className={className}>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-gray-200 rounded"
                />
              ))}
            </div>
          </div>
        </Card>
      );
    }

    return (
      <div className={`space-y-4 ${className}`}>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <p className="text-sm text-gray-600">Total Receipts</p>
            <p className="text-2xl font-bold">{summary.count}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.total)}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-600">Total GST</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.gst)}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-600">Average Receipt</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.avgAmount)}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-600">Match Rate</p>
            <p className="text-2xl font-bold">{summary.matchRate.toFixed(0)}%</p>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search receipts..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="flex-1 min-w-[200px] px-3 py-2 border rounded-md"
              />
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="PROCESSED">Processed</option>
                <option value="MATCHED">Matched</option>
                <option value="MANUAL_REVIEW">Review Required</option>
                <option value="FAILED">Failed</option>
              </select>
              <select
                value={filters.matched}
                onChange={(e) => setFilters((prev) => ({ ...prev, matched: e.target.value }))}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Receipts</option>
                <option value="matched">Matched Only</option>
                <option value="unmatched">Unmatched Only</option>
              </select>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className="px-3 py-2 border rounded-md"
                placeholder="From date"
              />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                className="px-3 py-2 border rounded-md"
                placeholder="To date"
              />
            </div>

            {/* Sort and View Options */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'merchant')}
                  className="px-3 py-1 border rounded text-sm"
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="merchant">Merchant</option>
                </select>
                <button
                  onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <svg
                    className={`w-4 h-4 transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 11l5-5m0 0l5 5m-5-5v12"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedReceipts.size > 0 && onBulkAction && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {selectedReceipts.size} receipt{selectedReceipts.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleBulkAction('delete')}
                      className="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleBulkAction('export')}
                      className="btn btn-sm btn-secondary"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => handleBulkAction('match')}
                      className="btn btn-sm btn-primary"
                    >
                      Match Transactions
                    </button>
                    <button
                      onClick={clearSelection}
                      className="ml-2 text-gray-600 hover:text-gray-800"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Receipt List/Grid */}
        {viewMode === 'list' ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedReceipts.size === processedReceipts.length &&
                          processedReceipts.length > 0
                        }
                        onChange={() => {
                          if (selectedReceipts.size === processedReceipts.length) {
                            clearSelection();
                          } else {
                            selectAll();
                          }
                        }}
                        className="rounded text-blue-600"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Merchant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      GST
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {processedReceipts.map((receipt) => (
                    <ReceiptRow
                      key={receipt.id}
                      receipt={receipt}
                      isSelected={selectedReceipts.has(receipt.id)}
                      onToggleSelection={toggleSelection}
                      onPreview={setPreviewReceipt}
                      onEdit={onEdit}
                      onReprocess={onReprocess}
                      onDelete={onDelete}
                      getStatusBadge={getStatusBadge}
                      formatCurrency={formatCurrencyMemo}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {processedReceipts.map((receipt) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                isSelected={selectedReceipts.has(receipt.id)}
                onToggleSelection={toggleSelection}
                onPreview={setPreviewReceipt}
                onEdit={onEdit}
                onDelete={onDelete}
                getStatusBadge={getStatusBadge}
                formatCurrency={formatCurrencyMemo}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {processedReceipts.length === 0 && (
          <Card>
            <div className="text-center py-12">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-gray-600 mb-2">No receipts found</p>
              <p className="text-sm text-gray-500">
                {filters.search || filters.status || filters.dateFrom || filters.dateTo
                  ? 'Try adjusting your filters'
                  : 'Upload your first receipt to get started'}
              </p>
            </div>
          </Card>
        )}

        {/* Preview Modal */}
        {previewReceipt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Receipt Preview</h3>
                  <button
                    onClick={() => setPreviewReceipt(null)}
                    className="text-gray-400 hover:text-gray-600"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div
                className="p-4 overflow-y-auto"
                style={{ maxHeight: 'calc(90vh - 120px)' }}
              >
                <MemoizedReceiptPreview
                  imageUrl={previewReceipt.imageUrl}
                  showMetadata={true}
                  metadata={{
                    fileName: `${previewReceipt.merchant} - ${previewReceipt.date}`,
                    uploadDate: previewReceipt.createdAt,
                    processingStatus: getStatusBadge(previewReceipt.processingStatus).label,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);

ReceiptList.displayName = 'ReceiptList';

export default ReceiptList;
