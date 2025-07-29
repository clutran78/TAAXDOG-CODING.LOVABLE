import React, { useState, useEffect, useCallback } from 'react';
import { Card, formatCurrency } from '@/components/dashboard/Card';
import { logger } from '@/lib/logger';

interface AccountBalancesProps {
  connectionId?: string;
  onAccountSelect?: (accountId: string) => void;
  className?: string;
}

interface AccountWithBalance {
  id: string;
  institution?: {
    name: string;
  };
  name: string;
  type: string;
  accountNumber: string;
  bsb?: string;
  creditLimit?: number;
  minimumPayment?: number;
  balance?: {
    current: number;
    available: number;
  };
}

interface AccountGroup {
  institution: string;
  accounts: AccountWithBalance[];
  totalBalance: number;
  totalAvailable: number;
}

export const AccountBalances: React.FC<AccountBalancesProps> = ({
  connectionId,
  onAccountSelect,
  className = '',
}) => {
  const [accounts, setAccounts] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState<string | null>(null);

  // Fetch account balances
  const fetchAccountBalances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = connectionId
        ? `/api/basiq/accounts?connectionId=${connectionId}`
        : '/api/basiq/accounts';

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch accounts');

      const data = await response.json();

      // Group accounts by institution
      const grouped = groupAccountsByInstitution(data);
      setAccounts(grouped);

      // Auto-expand first group
      if (grouped.length > 0 && grouped[0]) {
        setExpandedGroups(new Set([grouped[0].institution]));
      }
    } catch (error) {
      logger.error('Error fetching accounts:', error);
      setError('Failed to load account balances');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  // Refresh specific account balance
  const refreshAccountBalance = async (accountId: string) => {
    try {
      setRefreshing(accountId);

      const response = await fetch(`/api/basiq/accounts/${accountId}/refresh`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to refresh');

      // Refetch all balances
      await fetchAccountBalances();
    } catch (error) {
      logger.error('Refresh error:', error);
      setError('Failed to refresh account balance');
    } finally {
      setRefreshing(null);
    }
  };

  // Group accounts by institution
  const groupAccountsByInstitution = (
    accountList: AccountWithBalance[],
  ): AccountGroup[] => {
    const groups: Record<string, AccountGroup> = {};

    accountList.forEach((account) => {
      const institutionName = account.institution?.name || 'Unknown Bank';

      if (!groups[institutionName]) {
        groups[institutionName] = {
          institution: institutionName,
          accounts: [],
          totalBalance: 0,
          totalAvailable: 0,
        };
      }

      groups[institutionName].accounts.push(account);
      groups[institutionName].totalBalance += account.balance?.current || 0;
      groups[institutionName].totalAvailable += account.balance?.available || 0;
    });

    return Object.values(groups).sort((a, b) => b.totalBalance - a.totalBalance);
  };

  // Toggle group expansion
  const toggleGroup = (institution: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(institution)) {
      newExpanded.delete(institution);
    } else {
      newExpanded.add(institution);
    }
    setExpandedGroups(newExpanded);
  };

  useEffect(() => {
    fetchAccountBalances();
  }, [fetchAccountBalances]);

  // Calculate totals
  const totals = accounts.reduce(
    (acc, group) => ({
      balance: acc.balance + group.totalBalance,
      available: acc.available + group.totalAvailable,
      accounts: acc.accounts + group.accounts.length,
    }),
    { balance: 0, available: 0, accounts: 0 },
  );

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

  if (error) {
    return (
      <Card className={className}>
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
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
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchAccountBalances}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Card */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Balance</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.balance)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Available Balance</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.available)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Connected Accounts</p>
            <p className="text-2xl font-bold text-gray-900">{totals.accounts}</p>
          </div>
        </div>
      </Card>

      {/* Account Groups */}
      {accounts.map((group) => (
        <Card
          key={group.institution}
          className="overflow-hidden"
        >
          {/* Group Header */}
          <button
            onClick={() => toggleGroup(group.institution)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors -m-6 mb-0"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold">{group.institution.charAt(0)}</span>
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">{group.institution}</h3>
                <p className="text-sm text-gray-500">
                  {group.accounts.length} account{group.accounts.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Balance</p>
                <p className="font-semibold">{formatCurrency(group.totalBalance)}</p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedGroups.has(group.institution) ? 'rotate-180' : ''
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
            </div>
          </button>

          {/* Account List */}
          {expandedGroups.has(group.institution) && (
            <div className="mt-4 space-y-3 px-6 pb-4">
              {group.accounts.map((account) => (
                <div
                  key={account.id}
                  className={`p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                    onAccountSelect ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => onAccountSelect?.(account.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{account.name}</h4>
                        <AccountTypeBadge type={account.type} />
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {account.accountNumber && (
                          <span>•••• {account.accountNumber.slice(-4)}</span>
                        )}
                        {account.bsb && <span className="ml-2">BSB: {account.bsb}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(account.balance?.current || 0)}
                          </p>
                          {account.balance?.available !== account.balance?.current && (
                            <p className="text-sm text-gray-500">
                              Available: {formatCurrency(account.balance?.available || 0)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            refreshAccountBalance(account.id);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          disabled={refreshing === account.id}
                        >
                          <svg
                            className={`w-4 h-4 ${refreshing === account.id ? 'animate-spin' : ''}`}
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
                      </div>
                    </div>
                  </div>

                  {/* Additional Account Details */}
                  {(account.creditLimit || account.minimumPayment) && (
                    <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                      {account.creditLimit && (
                        <div>
                          <span className="text-gray-500">Credit Limit:</span>
                          <span className="ml-2 font-medium">
                            {formatCurrency(account.creditLimit)}
                          </span>
                        </div>
                      )}
                      {account.minimumPayment && (
                        <div>
                          <span className="text-gray-500">Min Payment:</span>
                          <span className="ml-2 font-medium">
                            {formatCurrency(account.minimumPayment)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      {/* Empty State */}
      {accounts.length === 0 && !loading && (
        <Card>
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
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            <p className="text-gray-600">No bank accounts found</p>
            <p className="text-sm text-gray-500 mt-2">
              Connect your bank accounts to view balances
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

// Account Type Badge Component
const AccountTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const typeConfig: Record<string, { color: string; label: string }> = {
    transaction: { color: 'bg-blue-100 text-blue-800', label: 'Transaction' },
    savings: { color: 'bg-green-100 text-green-800', label: 'Savings' },
    credit: { color: 'bg-purple-100 text-purple-800', label: 'Credit' },
    loan: { color: 'bg-orange-100 text-orange-800', label: 'Loan' },
    mortgage: { color: 'bg-red-100 text-red-800', label: 'Mortgage' },
  };

  const config = typeConfig[type.toLowerCase()] || {
    color: 'bg-gray-100 text-gray-800',
    label: type,
  };

  return <span className={`px-2 py-1 text-xs rounded-full ${config.color}`}>{config.label}</span>;
};

export default AccountBalances;
