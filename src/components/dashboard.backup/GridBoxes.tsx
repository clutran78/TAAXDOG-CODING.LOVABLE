'use client'

import { useState } from 'react'
import { StatCard } from './StatCard'
import { GoalsDashboardCard } from './GoalsDashboardCard'
import { BankAccountsCard } from './BankAccountsCard'
import { formatCurrency } from '@/lib/utils'

interface GridBoxesProps {
  financialSummary: {
    totalBalance: number
    totalIncome: number
    totalExpenses: number
    netIncome: number
    transactionCount: number
    currency: string
  }
  goals: Array<{
    id: string
    name: string
    targetAmount: number
    currentAmount: number
    progressPercentage: number
    daysRemaining: number
    isOnTrack: boolean
  }>
  insights: {
    averageMonthlySpending: number
    goalsOnTrack: number
    totalActiveGoals: number
    savingsRate: number
  }
  onRefresh: () => void
}

export function GridBoxes({ financialSummary, goals, insights, onRefresh }: GridBoxesProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Net Income"
          value={formatCurrency(financialSummary.totalIncome)}
          subtitle="+12.3% from last month"
          icon="💰"
          colorClass="text-green-600"
          trend={{ value: 12.3, isPositive: true }}
          loading={refreshing}
        />
        
        <StatCard
          title="Total Expenses"
          value={formatCurrency(financialSummary.totalExpenses)}
          subtitle="-8.1% from last month"
          icon="💸"
          colorClass="text-red-600"
          trend={{ value: -8.1, isPositive: false }}
          loading={refreshing}
        />
        
        <StatCard
          title="Net Balance"
          value={formatCurrency(financialSummary.totalBalance)}
          subtitle="+15.2% from last month"
          icon="⚖️"
          colorClass="text-blue-600"
          trend={{ value: 15.2, isPositive: true }}
          loading={refreshing}
        />
        
        <StatCard
          title="Subscriptions"
          value={formatCurrency(insights.averageMonthlySpending)}
          subtitle="0 active subscriptions"
          icon="🔄"
          colorClass="text-purple-600"
          loading={refreshing}
        />
      </div>

      {/* Goals and Bank Accounts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GoalsDashboardCard
          goals={goals}
          insights={insights}
          loading={refreshing}
        />
        
        <BankAccountsCard
          loading={refreshing}
        />
      </div>
    </div>
  )
}