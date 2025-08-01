'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { PlusIcon, CheckCircleIcon, ExclamationTriangleIcon, EyeIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils'
import { apiService } from '@/services/api-service'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorDisplay } from '@/components/ui/ErrorDisplay'
import toast from 'react-hot-toast'

interface BankAccount {
  id: string
  institutionName: string
  accountName: string
  accountNumber: string
  bsb: string
  balance: number
  accountType: string
  isActive: boolean
  lastSynced: string
  connectionStatus: 'connected' | 'disconnected' | 'error'
}

export default function BankAccountsPage() {
  const { data: session } = useSession()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.id) {
      loadBankAccounts()
    }
  }, [session?.user?.id])

  const loadBankAccounts = async () => {
    if (!session?.user?.id) return

    try {
      setLoading(true)
      const response = await apiService.getBankAccounts(session.user.id)
      
      if (response.success && response.data) {
        setAccounts(Array.isArray(response.data) ? response.data : [])
        setError(null)
      } else {
        setError(response.error || 'Failed to load bank accounts')
      }
    } catch (err) {
      setError('Failed to load bank accounts')
    } finally {
      setLoading(false)
    }
  }

  const handleConnectBank = async () => {
    // This would typically open a bank connection flow
    // For now, we'll just show a toast
    toast.success('Bank connection flow would open here')
  }

  const handleSyncAccount = async (accountId: string) => {
    try {
      setSyncing(accountId)
      // API call to sync account
      const response = await fetch(`/api/banking/sync/${accountId}`, {
        method: 'POST',
      })
      
      if (response.ok) {
        toast.success('Account synced successfully')
        loadBankAccounts()
      } else {
        toast.error('Failed to sync account')
      }
    } catch (err) {
      toast.error('Failed to sync account')
    } finally {
      setSyncing(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'error':
        return 'Connection Error'
      default:
        return 'Disconnected'
    }
  }

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
  const activeAccounts = accounts.filter(account => account.isActive)
  const connectedAccounts = accounts.filter(account => account.connectionStatus === 'connected')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadBankAccounts} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
          <p className="text-gray-600">Manage your connected bank accounts</p>
        </div>
        <button
          onClick={handleConnectBank}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Connect Bank
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold">{accounts.length}</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Accounts</p>
              <p className="text-lg font-semibold text-gray-900">
                {activeAccounts.length} active
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Connected</p>
              <p className="text-lg font-semibold text-gray-900">
                {connectedAccounts.length} account{connectedAccounts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">$</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Balance</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(totalBalance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PlusIcon className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bank accounts connected</h3>
          <p className="text-gray-500 mb-6">Connect your bank accounts to start tracking transactions</p>
          <button
            onClick={handleConnectBank}
            className="btn-primary"
          >
            Connect Your First Bank
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Connected Accounts</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {accounts.map((account) => (
              <div key={account.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium text-sm">
                          {account.institutionName.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">
                        {account.institutionName}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {account.accountName} • BSB: {account.bsb} • ****{account.accountNumber.slice(-4)}
                      </p>
                      <div className="flex items-center mt-1">
                        {getStatusIcon(account.connectionStatus)}
                        <span className="ml-1 text-sm text-gray-600">
                          {getStatusText(account.connectionStatus)}
                        </span>
                        <span className="ml-3 text-xs text-gray-500">
                          Last synced: {new Date(account.lastSynced).toLocaleDateString('en-AU')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(account.balance)}
                      </p>
                      <p className="text-sm text-gray-500">{account.accountType}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleSyncAccount(account.id)}
                        disabled={syncing === account.id}
                        className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        {syncing === account.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}