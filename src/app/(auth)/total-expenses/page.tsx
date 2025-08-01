'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  CreditCardIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency, formatPercentageChange, calculatePercentageChange } from '@/lib/utils';
import { apiService } from '@/services/api-service';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

interface ExpenseData {
  currentMonth: number;
  previousMonth: number;
  yearToDate: number;
  categories: Array<{
    name: string;
    amount: number;
    percentage: number;
  }>;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string;
    merchant: string;
  }>;
}

export default function TotalExpensesPage() {
  const { data: session } = useSession();
  const [expenseData, setExpenseData] = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current-month');

  useEffect(() => {
    if (session?.user?.id) {
      loadExpenseData();
    }
  }, [session?.user?.id, selectedPeriod]);

  const loadExpenseData = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      const response = await apiService.getTotalExpenses(session.user.id, selectedPeriod);

      if (response.success && response.data) {
        setExpenseData(response.data as ExpenseData);
        setError(null);
      } else {
        setError(response.error || 'Failed to load expense data');
      }
    } catch (err) {
      setError('Failed to load expense data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        message={error}
        onRetry={loadExpenseData}
      />
    );
  }

  if (!expenseData) {
    return (
      <ErrorDisplay
        message="No expense data available"
        onRetry={loadExpenseData}
      />
    );
  }

  const monthlyChange = calculatePercentageChange(
    expenseData.currentMonth,
    expenseData.previousMonth,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Total Expenses</h1>
          <p className="text-gray-600">Monitor your spending patterns and categories</p>
        </div>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="input-field w-48"
        >
          <option value="current-month">Current Month</option>
          <option value="last-month">Last Month</option>
          <option value="last-3-months">Last 3 Months</option>
          <option value="year-to-date">Year to Date</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CreditCardIcon className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Current Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(expenseData.currentMonth)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {monthlyChange >= 0 ? (
                <ArrowTrendingUpIcon className="h-8 w-8 text-red-600" />
              ) : (
                <ArrowTrendingDownIcon className="h-8 w-8 text-green-600" />
              )}
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Monthly Change</p>
              <p
                className={`text-2xl font-bold ${
                  monthlyChange >= 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {monthlyChange >= 0 ? '+' : ''}
                {formatPercentageChange(monthlyChange)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CreditCardIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Year to Date</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(expenseData.yearToDate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg shadow-card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Expense Categories</h3>
        <div className="space-y-4">
          {expenseData.categories.map((category, index) => (
            <div
              key={index}
              className="flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{category.name}</span>
                  <span className="text-sm text-gray-500">{category.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${category.percentage}%` }}
                  />
                </div>
              </div>
              <div className="ml-4 text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(category.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Expense Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Merchant
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenseData.transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString('en-AU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.merchant}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                    -{formatCurrency(transaction.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
