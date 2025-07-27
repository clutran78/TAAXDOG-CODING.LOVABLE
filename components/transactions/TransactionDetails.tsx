import React, { useState, useEffect } from 'react';
import { Card, formatCurrency } from '@/components/dashboard/Card';
import { TransactionCategorizer } from './TransactionCategorizer';
import { logger } from '@/lib/logger';

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
  reference?: string;
  location?: TransactionLocation;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

interface TransactionLocation {
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface Receipt {
  id: string;
  imageUrl: string;
  merchant: string;
  totalAmount: number;
  date: string;
}

interface SimilarTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
}

interface TransactionDetailsProps {
  transactionId: string;
  onClose?: () => void;
  onUpdate?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
  className?: string;
}

export const TransactionDetails: React.FC<TransactionDetailsProps> = ({
  transactionId,
  onClose,
  onUpdate,
  onDelete,
  className = '',
}) => {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showCategorizer, setShowCategorizer] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [similarTransactions, setSimilarTransactions] = useState<SimilarTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'insights'>('details');
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [saving, setSaving] = useState(false);

  // Fetch transaction details
  useEffect(() => {
    fetchTransactionDetails();
  }, [transactionId]);

  const fetchTransactionDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch transaction
      const response = await fetch(`/api/transactions/${transactionId}`);
      if (!response.ok) throw new Error('Failed to fetch transaction');

      const data = await response.json();
      setTransaction(data);
      setEditForm({
        description: data.description,
        merchant: data.merchant,
        notes: data.notes,
        tags: data.tags || [],
      });

      // Fetch receipt if exists
      if (data.receiptId) {
        const receiptResponse = await fetch(`/api/receipts/${data.receiptId}`);
        if (receiptResponse.ok) {
          const receiptData = await receiptResponse.json();
          setReceipt(receiptData);
        }
      }

      // Fetch similar transactions
      fetchSimilarTransactions(data);
    } catch (error) {
      logger.error('Error fetching transaction:', error);
      setError('Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilarTransactions = async (tx: Transaction) => {
    try {
      const params = new URLSearchParams({
        merchant: tx.merchant || tx.description,
        excludeId: tx.id,
        limit: '5',
      });

      const response = await fetch(`/api/transactions/similar?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSimilarTransactions(data);
      }
    } catch (error) {
      logger.error('Error fetching similar transactions:', error);
    }
  };

  // Handle categorization
  interface CategoryUpdate {
    category: string;
    taxCategory?: string;
    isBusinessExpense: boolean;
  }

  const handleCategorize = async (updates: CategoryUpdate[]) => {
    if (!transaction) return;

    try {
      const update = updates[0];
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: update.category,
          taxCategory: update.taxCategory,
          isBusinessExpense: update.isBusinessExpense,
        }),
      });

      if (!response.ok) throw new Error('Failed to update transaction');

      const updated = await response.json();
      setTransaction(updated);
      setShowCategorizer(false);

      if (onUpdate) {
        onUpdate(updated);
      }
    } catch (error) {
      logger.error('Error categorizing transaction:', error);
    }
  };

  // Handle edit save
  const handleSave = async () => {
    if (!transaction) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) throw new Error('Failed to update transaction');

      const updated = await response.json();
      setTransaction(updated);
      setEditing(false);

      if (onUpdate) {
        onUpdate(updated);
      }
    } catch (error) {
      logger.error('Error updating transaction:', error);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!transaction || !onDelete) return;

    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete transaction');

      onDelete(transaction.id);
      if (onClose) onClose();
    } catch (error) {
      logger.error('Error deleting transaction:', error);
      setError('Failed to delete transaction');
    }
  };

  // Attach receipt
  const attachReceipt = async (receiptId: string) => {
    if (!transaction) return;

    try {
      const response = await fetch(`/api/transactions/${transaction.id}/attach-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId }),
      });

      if (!response.ok) throw new Error('Failed to attach receipt');

      await fetchTransactionDetails();
    } catch (error) {
      logger.error('Error attaching receipt:', error);
    }
  };

  // Export transaction
  const exportTransaction = () => {
    if (!transaction) return;

    const data = {
      ...transaction,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction-${transaction.id}-${transaction.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card className={className}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </Card>
    );
  }

  if (error || !transaction) {
    return (
      <Card className={className}>
        <div className="text-center py-8">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-gray-600">{error || 'Transaction not found'}</p>
        </div>
      </Card>
    );
  }

  if (showCategorizer) {
    return (
      <TransactionCategorizer
        transaction={transaction}
        onCategorize={handleCategorize}
        onClose={() => setShowCategorizer(false)}
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-medium">
              {transaction.merchant || transaction.description}
            </h3>
            <p className="text-sm text-gray-500 mt-1">Transaction ID: {transaction.id}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportTransaction}
              className="p-2 hover:bg-gray-100 rounded"
              title="Export"
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
            </button>
            {onDelete && (
              <button
                onClick={handleDelete}
                className="p-2 hover:bg-gray-100 rounded"
                title="Delete"
              >
                <svg
                  className="w-5 h-5 text-red-600"
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
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          {(['details', 'history', 'insights'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <>
          {/* Main Details */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Transaction Details</h4>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Merchant</label>
                  <input
                    type="text"
                    value={editForm.merchant || ''}
                    onChange={(e) => setEditForm({ ...editForm, merchant: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditForm({
                        description: transaction.description,
                        merchant: transaction.merchant,
                        notes: transaction.notes,
                        tags: transaction.tags || [],
                      });
                    }}
                    className="btn btn-secondary"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">
                      {new Date(transaction.date).toLocaleDateString('en-AU', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Amount</p>
                    <p
                      className={`text-xl font-bold ${
                        transaction.type === 'credit' ? 'text-green-600' : 'text-gray-900'
                      }`}
                    >
                      {transaction.type === 'credit' ? '+' : '-'}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Account</p>
                    <p className="font-medium">{transaction.accountName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span
                      className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        transaction.status === 'posted'
                          ? 'bg-green-100 text-green-800'
                          : transaction.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {transaction.status}
                    </span>
                  </div>
                </div>

                {transaction.balance !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500">Balance After</p>
                    <p className="font-medium">{formatCurrency(transaction.balance)}</p>
                  </div>
                )}

                {transaction.reference && (
                  <div>
                    <p className="text-sm text-gray-500">Reference</p>
                    <p className="font-medium font-mono text-sm">{transaction.reference}</p>
                  </div>
                )}

                {transaction.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="text-gray-700">{transaction.notes}</p>
                  </div>
                )}

                {transaction.tags && transaction.tags.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {transaction.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Categorization */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Categorization</h4>
              <button
                onClick={() => setShowCategorizer(true)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {transaction.category ? 'Change' : 'Categorize'}
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium">{transaction.category || 'Uncategorized'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tax Category</p>
                  <p className="font-medium">{transaction.taxCategory || 'None'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={transaction.isBusinessExpense}
                    disabled
                    className="rounded text-blue-600 mr-2"
                  />
                  <span className="text-sm">Business expense</span>
                </label>
                {transaction.gstAmount && (
                  <span className="text-sm text-gray-600">
                    GST: {formatCurrency(transaction.gstAmount)}
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Receipt */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Receipt</h4>
              {!receipt && (
                <button className="text-sm text-blue-600 hover:text-blue-700">
                  Attach Receipt
                </button>
              )}
            </div>

            {receipt ? (
              <div className="flex items-center space-x-4">
                <img
                  src={receipt.imageUrl}
                  alt="Receipt"
                  className="w-20 h-20 object-cover rounded"
                />
                <div className="flex-1">
                  <p className="font-medium">{receipt.merchant}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(receipt.date).toLocaleDateString('en-AU')} •
                    {formatCurrency(receipt.totalAmount)}
                  </p>
                </div>
                <button className="text-blue-600 hover:text-blue-700">View</button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No receipt attached</p>
            )}
          </Card>

          {/* Location */}
          {transaction.location && (
            <Card>
              <h4 className="font-medium mb-3">Location</h4>
              <div className="space-y-2">
                {transaction.location.address && (
                  <p className="text-sm">{transaction.location.address}</p>
                )}
                {(transaction.location.city || transaction.location.state) && (
                  <p className="text-sm text-gray-600">
                    {[
                      transaction.location.city,
                      transaction.location.state,
                      transaction.location.postcode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {transaction.location.latitude && transaction.location.longitude && (
                  <a
                    href={`https://maps.google.com/?q=${transaction.location.latitude},${transaction.location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View on map
                  </a>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <Card>
          <h4 className="font-medium mb-4">Similar Transactions</h4>
          {similarTransactions.length > 0 ? (
            <div className="space-y-3">
              {similarTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(tx.date).toLocaleDateString('en-AU')} •
                      {tx.category || 'Uncategorized'}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(Math.abs(tx.amount))}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No similar transactions found</p>
          )}
        </Card>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-4">
          <Card>
            <h4 className="font-medium mb-4">Transaction Insights</h4>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Frequency</p>
                <p className="font-medium">
                  This merchant appears {similarTransactions.length + 1} time
                  {similarTransactions.length !== 0 ? 's' : ''} in your history
                </p>
              </div>
              {similarTransactions.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500">Average Spend</p>
                  <p className="font-medium">
                    {formatCurrency(
                      [...similarTransactions, transaction].reduce(
                        (sum, tx) => sum + Math.abs(tx.amount),
                        0,
                      ) /
                        (similarTransactions.length + 1),
                    )}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Time Since Last</p>
                <p className="font-medium">
                  {similarTransactions.length > 0
                    ? `${Math.floor(
                        (new Date(transaction.date).getTime() -
                          new Date(similarTransactions[0].date).getTime()) /
                          (1000 * 60 * 60 * 24),
                      )} days`
                    : 'First transaction'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <h4 className="font-medium mb-4">Tax Implications</h4>
            <div className="space-y-3">
              {transaction.isBusinessExpense ? (
                <>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800">Business Expense</p>
                    <p className="text-sm text-green-700 mt-1">
                      This transaction may be tax deductible
                    </p>
                  </div>
                  {transaction.gstAmount && (
                    <div>
                      <p className="text-sm text-gray-500">GST Claimable</p>
                      <p className="font-medium">{formatCurrency(transaction.gstAmount)}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-800">Personal Expense</p>
                  <p className="text-sm text-gray-700 mt-1">Not tax deductible</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TransactionDetails;
