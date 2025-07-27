import React, { useState, useEffect } from 'react';
import { BankAccountSummary, TransactionSummary } from '@/lib/basiq/types';
import { format } from 'date-fns';
import {
  ChartBarIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

export default function AccountSummary() {
  const [accounts, setAccounts] = useState<BankAccountSummary[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch accounts
      const accountsResponse = await fetch('/api/basiq/accounts?sync=true');
      if (!accountsResponse.ok) throw new Error('Failed to fetch accounts');
      const accountsData = await accountsResponse.json();
      setAccounts(accountsData.accounts || []);

      // Fetch transaction summary
      const params = new URLSearchParams({
        summary: 'true',
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
      });
      const summaryResponse = await fetch(`/api/basiq/transactions?${params.toString()}`);
      if (!summaryResponse.ok) throw new Error('Failed to fetch summary');
      const summaryData = await summaryResponse.json();
      setSummary(summaryData.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  if (loading) {
    return <div className="text-center py-8">Loading financial summary...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;
  }

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalAvailable = accounts.reduce((sum, acc) => sum + acc.availableBalance, 0);

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateRange.fromDate}
              onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateRange.toDate}
              onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
              className="px-3 py-2 border rounded-md"
            />
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Update
          </button>
        </div>
      </div>

      {/* Account Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
            </div>
            <BanknotesIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Available Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(totalAvailable)}</p>
            </div>
            <ChartBarIcon className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Connected Accounts</p>
              <p className="text-2xl font-bold">{accounts.length}</p>
            </div>
            <BanknotesIcon className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Income/Expense Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Income & Expenses</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <ArrowTrendingUpIcon className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-gray-700">Total Income</span>
                </div>
                <span className="font-semibold text-green-600">
                  {formatCurrency(summary.totalIncome)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <ArrowTrendingDownIcon className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-gray-700">Total Expenses</span>
                </div>
                <span className="font-semibold text-red-600">
                  {formatCurrency(summary.totalExpenses)}
                </span>
              </div>
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Net Income</span>
                  <span
                    className={`font-bold text-lg ${
                      summary.totalIncome - summary.totalExpenses >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(summary.totalIncome - summary.totalExpenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Expense Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Business Expenses</span>
                <span className="font-semibold">{formatCurrency(summary.businessExpenses)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Personal Expenses</span>
                <span className="font-semibold">{formatCurrency(summary.personalExpenses)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">GST Paid</span>
                <span className="font-semibold">{formatCurrency(summary.gstTotal)}</span>
              </div>
              <div className="pt-3 border-t">
                <div className="text-sm text-gray-600">
                  Business expense ratio:{' '}
                  {summary.totalExpenses > 0
                    ? `${((summary.businessExpenses / summary.totalExpenses) * 100).toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Accounts */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Bank Accounts</h3>
        </div>
        <div className="divide-y">
          {accounts.map((account) => (
            <div
              key={account.accountId}
              className="p-6 hover:bg-gray-50 cursor-pointer"
              onClick={() =>
                setSelectedAccount(selectedAccount === account.accountId ? null : account.accountId)
              }
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{account.accountName}</p>
                  <p className="text-sm text-gray-600">
                    {account.institutionName} • {account.accountType}
                  </p>
                  {account.bsb && (
                    <p className="text-sm text-gray-500">
                      BSB: {account.bsb} • Account: {account.accountNumber}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">{formatCurrency(account.balance)}</p>
                  {account.availableBalance !== account.balance && (
                    <p className="text-sm text-gray-600">
                      Available: {formatCurrency(account.availableBalance)}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Last synced: {format(new Date(account.lastSynced), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {selectedAccount === account.accountId && (
                <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Transactions</p>
                    <p className="font-semibold">{account.transactionCount}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Business Expenses</p>
                    <p className="font-semibold">{formatCurrency(account.businessExpenseTotal)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Personal Expenses</p>
                    <p className="font-semibold">{formatCurrency(account.personalExpenseTotal)}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      {summary && Object.keys(summary.categorizedExpenses).length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Expense Categories</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(summary.categorizedExpenses)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([category, data]) => (
                  <div
                    key={category}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="font-medium capitalize">{category.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-gray-600">
                        {data.count} transactions
                        {data.gst > 0 && ` • GST: ${formatCurrency(data.gst)}`}
                      </p>
                    </div>
                    <p className="font-semibold">{formatCurrency(data.total)}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
