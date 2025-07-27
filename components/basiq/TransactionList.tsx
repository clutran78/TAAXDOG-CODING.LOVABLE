import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  transactionDate: string;
  direction: 'credit' | 'debit';
  category?: string;
  merchant?: {
    name: string;
  };
  taxCategory?: string;
  isBusinessExpense?: boolean;
  gstAmount?: number;
}

interface TransactionListProps {
  accountId?: string;
  onTransactionUpdate?: (transactionId: string, updates: TransactionUpdate) => void;
}

interface TransactionUpdate {
  taxCategory?: string;
  isBusinessExpense?: boolean;
  notes?: string;
}

export default function TransactionList({ accountId, onTransactionUpdate }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    fromDate: '',
    toDate: '',
    category: '',
    businessOnly: false,
  });

  useEffect(() => {
    if (accountId) {
      fetchTransactions();
    }
  }, [accountId, filters]);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (accountId) params.append('accountId', accountId);
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);

      const response = await fetch(`/api/basiq/transactions?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');

      const data = await response.json();
      let filteredTransactions = data.transactions || [];

      // Apply client-side filters
      if (filters.businessOnly) {
        filteredTransactions = filteredTransactions.filter((t: Transaction) => t.isBusinessExpense);
      }
      if (filters.category) {
        filteredTransactions = filteredTransactions.filter(
          (t: Transaction) => t.taxCategory === filters.category,
        );
      }

      setTransactions(filteredTransactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = async (
    transactionId: string,
    taxCategory: string,
    isBusinessExpense: boolean,
  ) => {
    try {
      const response = await fetch('/api/basiq/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId,
          taxCategory,
          isBusinessExpense,
        }),
      });

      if (!response.ok) throw new Error('Failed to update transaction');

      // Update local state
      setTransactions(
        transactions.map((t) =>
          t.id === transactionId ? { ...t, taxCategory, isBusinessExpense } : t,
        ),
      );

      if (onTransactionUpdate) {
        onTransactionUpdate(transactionId, { taxCategory, isBusinessExpense });
      }
    } catch (err: any) {
      logger.error('Error updating transaction:', err);
    }
  };

  const taxCategories = [
    { value: 'personal', label: 'Personal' },
    { value: 'meals_entertainment', label: 'Meals & Entertainment' },
    { value: 'vehicle_expenses', label: 'Vehicle Expenses' },
    { value: 'travel_expenses', label: 'Travel Expenses' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'medical_expenses', label: 'Medical Expenses' },
    { value: 'education_training', label: 'Education & Training' },
    { value: 'bank_fees', label: 'Bank Fees' },
    { value: 'interest_charges', label: 'Interest Charges' },
    { value: 'rent', label: 'Rent' },
    { value: 'phone_internet', label: 'Phone & Internet' },
    { value: 'subscriptions', label: 'Subscriptions' },
    { value: 'professional_fees', label: 'Professional Fees' },
    { value: 'office_expenses', label: 'Office Expenses' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'software', label: 'Software' },
    { value: 'advertising', label: 'Advertising' },
    { value: 'repairs_maintenance', label: 'Repairs & Maintenance' },
    { value: 'other', label: 'Other' },
  ];

  if (loading && transactions.length === 0) {
    return <div className="text-center py-8">Loading transactions...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Filters */}
      <div className="p-4 border-b">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">All Categories</option>
              {taxCategories.map((cat) => (
                <option
                  key={cat.value}
                  value={cat.value}
                >
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.businessOnly}
                onChange={(e) => setFilters({ ...filters, businessOnly: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Business Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="divide-y">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No transactions found</div>
        ) : (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(transaction.transactionDate), 'dd MMM yyyy')}
                        {transaction.merchant && ` • ${transaction.merchant.name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          transaction.direction === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {transaction.direction === 'credit' ? '+' : '-'}$
                        {Math.abs(transaction.amount).toFixed(2)}
                      </p>
                      {transaction.gstAmount && transaction.gstAmount > 0 && (
                        <p className="text-xs text-gray-500">
                          GST: ${transaction.gstAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expandable categorization section */}
                  <div className="mt-2">
                    <button
                      onClick={() =>
                        setExpandedTransaction(
                          expandedTransaction === transaction.id ? null : transaction.id,
                        )
                      }
                      className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                    >
                      {expandedTransaction === transaction.id ? (
                        <>
                          <ChevronUpIcon className="w-4 h-4 mr-1" />
                          Hide categorization
                        </>
                      ) : (
                        <>
                          <ChevronDownIcon className="w-4 h-4 mr-1" />
                          Categorize
                        </>
                      )}
                    </button>

                    {expandedTransaction === transaction.id && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Tax Category
                            </label>
                            <select
                              value={transaction.taxCategory || ''}
                              onChange={(e) =>
                                handleCategoryChange(
                                  transaction.id,
                                  e.target.value,
                                  transaction.isBusinessExpense || false,
                                )
                              }
                              className="w-full px-3 py-2 border rounded-md text-sm"
                            >
                              <option value="">Select category</option>
                              {taxCategories.map((cat) => (
                                <option
                                  key={cat.value}
                                  value={cat.value}
                                >
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={transaction.isBusinessExpense || false}
                                onChange={(e) =>
                                  handleCategoryChange(
                                    transaction.id,
                                    transaction.taxCategory || '',
                                    e.target.checked,
                                  )
                                }
                                className="mr-2"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                Business Expense
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {transactions.length > 0 && (
        <div className="p-4 text-center">
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
