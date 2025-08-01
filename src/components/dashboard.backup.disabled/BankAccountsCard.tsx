import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PlusIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils'

interface BankAccount {
  id: string
  institutionName: string
  accountName: string
  accountNumber: string
  balance: number
  accountType: string
  isActive: boolean
}

export function BankAccountsCard() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/banking/accounts')
        if (!response.ok) {
          throw new Error('Failed to fetch bank accounts')
        }
        const bankAccounts = await response.json()
        setAccounts(bankAccounts)
      } catch (err) {
        setError('Failed to load bank accounts')
      } finally {
        setLoading(false)
      }
    }

    loadAccounts()
  }, [])

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
  const activeAccounts = accounts.filter(account => account.isActive)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">🏦 Bank Accounts</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">🏦 Bank Accounts</h3>
        <Link
          href="/bank-accounts"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Manage
        </Link>
      </div>

      {error ? (
        <div className="text-center py-8">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Something went wrong</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-8">
          <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PlusIcon className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-gray-500 mb-4">No bank connections</p>
          <p className="text-gray-400 text-sm mb-4">Connect your bank to start tracking transactions</p>
          <Link
            href="/connect-bank"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Connect Bank
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Total Balance */}
          <div className="bg-primary-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-900">Total Balance</p>
                <p className="text-2xl font-bold text-primary-900 tabular-nums">
                  {formatCurrency(totalBalance)}
                </p>
              </div>
              <div className="text-primary-600">
                <span className="text-sm">
                  {activeAccounts.length} active account{activeAccounts.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Account List */}
          <div className="space-y-3">
            {accounts.slice(0, 3).map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    account.isActive ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {account.isActive ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {account.institutionName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {account.accountName} • ****{account.accountNumber.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    {formatCurrency(account.balance)}
                  </p>
                  <p className="text-xs text-gray-500">{account.accountType}</p>
                </div>
              </div>
            ))}
          </div>

          {accounts.length > 3 && (
            <p className="text-center text-sm text-gray-500">
              +{accounts.length - 3} more account{accounts.length - 3 !== 1 ? 's' : ''}
            </p>
          )}

          <Link
            href="/connect-bank"
            className="block w-full text-center py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-300 hover:text-primary-600 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mx-auto mb-1" />
            Connect Another Bank
          </Link>
        </div>
      )}
    </div>
  )
}