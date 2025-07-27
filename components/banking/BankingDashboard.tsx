import React, { useState, useCallback, useMemo, memo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Alert } from '@/components/ui/Alert';
import { BankConnectionManager } from './BankConnectionManager';
import { AccountBalances } from './AccountBalances';
import { TransactionList } from './TransactionList';
import { ConnectionHealthMonitor } from './ConnectionHealthMonitor';

interface BankingDashboardProps {
  defaultTab?: 'overview' | 'connections' | 'transactions' | 'health';
}

// Memoized components
const MemoizedBankConnectionManager = memo(BankConnectionManager);
const MemoizedAccountBalances = memo(AccountBalances);
const MemoizedTransactionList = memo(TransactionList);
const MemoizedConnectionHealthMonitor = memo(ConnectionHealthMonitor);

export const BankingDashboard: React.FC<BankingDashboardProps> = memo(({ 
  defaultTab = 'overview' 
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end: new Date()
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Handle connection updates
  const handleConnectionUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    setNotification({
      type: 'success',
      message: 'Bank connections updated successfully'
    });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Handle connection issues
  const handleConnectionIssue = useCallback((connectionId: string, issue: string) => {
    setNotification({
      type: 'warning',
      message: `Connection issue detected: ${issue}`
    });
  }, []);

  // Handle account selection
  const handleAccountSelect = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
  }, []);

  // Handle transaction updates
  const handleTransactionUpdate = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    setNotification({
      type: 'success',
      message: 'Transactions updated successfully'
    });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Date range presets
  const setDatePreset = useCallback((preset: 'week' | 'month' | 'quarter' | 'year' | 'tax-year') => {
    const end = new Date();
    let start = new Date();

    switch (preset) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
      case 'tax-year':
        // Australian tax year (July 1 - June 30)
        const currentYear = end.getFullYear();
        const currentMonth = end.getMonth();
        if (currentMonth >= 6) { // July or later
          start = new Date(currentYear, 6, 1); // July 1 of current year
        } else {
          start = new Date(currentYear - 1, 6, 1); // July 1 of previous year
        }
        break;
    }

    setDateRange({ start, end });
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banking & Transactions</h1>
          <p className="text-gray-600 mt-1">
            Manage your bank connections and track financial transactions
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Bank-grade security with BASIQ</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <Alert 
          className={`
            ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}
            ${notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : ''}
            ${notification.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : ''}
            ${notification.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}
          `}
        >
          <div className="flex items-center justify-between">
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </Alert>
      )}

      {/* Date Range Selector (for transactions) */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Date Range:</span>
          <DatePresetButtons onPresetClick={setDatePreset} />
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={dateRange.start.toISOString().split('T')[0]}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
              className="px-3 py-1 text-sm border rounded-md"
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange.end.toISOString().split('T')[0]}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
              className="px-3 py-1 text-sm border rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="health">Health Monitor</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Account Balances - takes 2 columns */}
            <div className="lg:col-span-2">
              <MemoizedAccountBalances 
                key={refreshKey}
                onAccountSelect={handleAccountSelect}
              />
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <QuickStats dateRange={dateRange} />
              <TaxDeductionSummary dateRange={dateRange} />
            </div>
          </div>

          {/* Recent Transactions */}
          <div>
            <h3 className="text-lg font-medium mb-3">Recent Transactions</h3>
            <MemoizedTransactionList
              key={refreshKey}
              accountId={selectedAccountId || undefined}
              dateRange={dateRange}
              onTransactionUpdate={handleTransactionUpdate}
            />
          </div>
        </TabsContent>

        {/* Connections Tab */}
        <TabsContent value="connections">
          <MemoizedBankConnectionManager
            onConnectionUpdate={handleConnectionUpdate}
          />
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <MemoizedTransactionList
            key={refreshKey}
            accountId={selectedAccountId || undefined}
            dateRange={dateRange}
            onTransactionUpdate={handleTransactionUpdate}
          />
        </TabsContent>

        {/* Health Monitor Tab */}
        <TabsContent value="health">
          <MemoizedConnectionHealthMonitor
            onConnectionIssue={handleConnectionIssue}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
});

// Memoized preset buttons
const DatePresetButtons = memo<{
  onPresetClick: (preset: 'week' | 'month' | 'quarter' | 'year' | 'tax-year') => void;
}>(({ onPresetClick }) => {
  const presets = useMemo(() => 
    (['week', 'month', 'quarter', 'year', 'tax-year'] as const), []
  );
  
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map(preset => (
        <button
          key={preset}
          onClick={() => onPresetClick(preset)}
          className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 transition-colors"
        >
          {preset === 'tax-year' ? 'Tax Year' : preset.charAt(0).toUpperCase() + preset.slice(1)}
        </button>
      ))}
    </div>
  );
});

DatePresetButtons.displayName = 'DatePresetButtons';

// Quick Stats Component
const QuickStats = memo<{ dateRange: { start: Date; end: Date } }>(({ dateRange }) => {
  // This would fetch actual data from API
  const stats = useMemo(() => ({
    totalIncome: 12450.00,
    totalExpenses: 8320.50,
    netProfit: 4129.50,
    taxEstimate: 1238.85
  }), [dateRange]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="font-medium mb-3">Quick Stats</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Income</span>
          <span className="font-medium text-green-600">
            ${stats.totalIncome.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Expenses</span>
          <span className="font-medium text-red-600">
            ${stats.totalExpenses.toLocaleString()}
          </span>
        </div>
        <div className="border-t pt-3 flex justify-between items-center">
          <span className="text-sm font-medium">Net Profit</span>
          <span className="font-bold text-lg">
            ${stats.netProfit.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Est. Tax</span>
          <span className="font-medium text-purple-600">
            ${stats.taxEstimate.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
});

QuickStats.displayName = 'QuickStats';

// Tax Deduction Summary Component
const TaxDeductionSummary = memo<{ dateRange: { start: Date; end: Date } }>(({ dateRange }) => {
  // This would fetch actual data from API
  const { deductions, total } = useMemo(() => {
    const deductions = [
      { category: 'D1 - Car expenses', amount: 2340.50 },
      { category: 'D2 - Travel expenses', amount: 1250.00 },
      { category: 'D5 - Other work', amount: 890.75 },
      { category: 'D10 - Tax management', amount: 450.00 }
    ];

    const total = deductions.reduce((sum, d) => sum + d.amount, 0);
    return { deductions, total };
  }, [dateRange]);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border">
      <h3 className="font-medium mb-3">Tax Deductions</h3>
      <div className="space-y-2">
        {deductions.map((deduction, index) => (
          <div key={index} className="flex justify-between items-center text-sm">
            <span className="text-gray-600 truncate pr-2">{deduction.category}</span>
            <span className="font-medium">${deduction.amount.toLocaleString()}</span>
          </div>
        ))}
        <div className="border-t pt-2 flex justify-between items-center">
          <span className="text-sm font-medium">Total Deductions</span>
          <span className="font-bold text-blue-600">
            ${total.toLocaleString()}
          </span>
        </div>
      </div>
      <button className="mt-3 w-full btn btn-sm btn-secondary">
        View All Deductions
      </button>
    </div>
  );
});

TaxDeductionSummary.displayName = 'TaxDeductionSummary';

BankingDashboard.displayName = 'BankingDashboard';

export default BankingDashboard;