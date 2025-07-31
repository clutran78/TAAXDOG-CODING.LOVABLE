'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { fetchBankTransactions, fetchGoals, fetchSubscriptions, calculateFinancialSummary } from '@/services/firebase-service'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorDisplay } from '@/components/ui/ErrorDisplay'
import { StatCard } from '@/components/dashboard/StatCard'
import { GoalsCard } from '@/components/dashboard/GoalsCard'
import { BankAccountsCard } from '@/components/dashboard/BankAccountsCard'

interface DashboardData {
  totalBalance: number
  netIncome: number
  totalExpenses: number
  monthlySpend: number
  goalProgress: number
  recentTransactions: any[]
  goals: any[]
  subscriptions: any[]
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all data in parallel
      const [transactions, goals, subscriptions] = await Promise.all([
        fetchBankTransactions(),
        fetchGoals(),
        fetchSubscriptions(),
      ])

      // Calculate financial summary
      const financialSummary = calculateFinancialSummary(transactions)

      // Calculate current month data
      const now = new Date()
      const currentMonth = now.getMonth()
      const currentYear = now.getFullYear()

      const currentMonthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date)
        return transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear
      })

      const monthlyExpenses = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0)

      // Calculate goal progress
      const activeGoals = goals.filter(g => g.isActive)
      const totalGoalProgress = activeGoals.length > 0
        ? activeGoals.reduce((sum, goal) => {
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
            return sum + Math.min(progress, 100)
          }, 0) / activeGoals.length
        : 0

      // Get recent transactions (last 5)
      const recentTransactions = transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)

      setDashboardData({
        totalBalance: financialSummary.netBalance,
        netIncome: financialSummary.totalIncome,
        totalExpenses: financialSummary.totalExpenses,
        monthlySpend: monthlyExpenses,
        goalProgress: totalGoalProgress,
        recentTransactions,
        goals: activeGoals.slice(0, 3), // Show top 3 goals
        subscriptions: subscriptions.filter(s => s.isActive),
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}!
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}!
            </p>
          </div>
        </div>
        <ErrorDisplay
          title="Failed to load dashboard"
          message={error}
          onRetry={fetchDashboardData}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}! Here's your financial overview and AI-powered insights.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          Refresh
        </button>
      </div>

      {/* Overview Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button className="border-primary-500 text-primary-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
            📊 Overview
          </button>
          <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
            🤖 AI Insights
          </button>
          <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
            🎯 Goals
          </button>
          <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
            🏦 Banking
          </button>
          <button className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
            📋 Tax Profile
          </button>
        </nav>
      </div>

      {/* Stats Grid */}
      {dashboardData && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Balance"
            value={formatCurrency(dashboardData.totalBalance)}
            subtitle="Across all accounts"
            icon="💰"
            colorClass={dashboardData.totalBalance >= 0 ? "text-green-600" : "text-red-600"}
          />
          
          <StatCard
            title="Tax Savings"
            value={formatCurrency(dashboardData.netIncome * 0.15)} // Estimated 15% tax savings
            subtitle="Estimated this year"
            icon="💸"
            colorClass="text-blue-600"
          />
          
          <StatCard
            title="Monthly Spend"
            value={formatCurrency(dashboardData.monthlySpend)}
            subtitle="This month"
            icon="📊"
            colorClass="text-purple-600"
          />
          
          <StatCard
            title="Goal Progress"
            value={`${Math.round(dashboardData.goalProgress)}%`}
            subtitle="Average completion"
            icon="🎯"
            colorClass="text-yellow-600"
          />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals Card */}
        <GoalsCard goals={dashboardData?.goals || []} />
        
        {/* Bank Accounts Card */}
        <BankAccountsCard />
      </div>

      {/* Recent Transactions */}
      {dashboardData && dashboardData.recentTransactions.length > 0 && (
        <div className="bg-white rounded-lg shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {dashboardData.recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <span className="text-sm">
                      {transaction.type === 'income' ? '💰' : '💸'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {transaction.category} • {formatDate(transaction.date)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold tabular-nums ${
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(Math.abs(parseFloat(transaction.amount)))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}