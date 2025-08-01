'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { GridBoxes } from './GridBoxes'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorDisplay } from '@/components/ui/ErrorDisplay'

interface DashboardData {
  user: {
    id: string
    name: string
    email: string
  }
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
}

export function DashboardComponent() {
  const { data: session } = useSession()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/optimized/user-dashboard', {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid response format')
      }

      setDashboardData(result.data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchDashboardData()
    }
  }, [session])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorDisplay
        title="Failed to load dashboard"
        message={error}
        onRetry={fetchDashboardData}
      />
    )
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No dashboard data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <GridBoxes
          financialSummary={dashboardData.financialSummary}
          goals={dashboardData.goals}
          insights={dashboardData.insights}
          onRefresh={fetchDashboardData}
        />
      </div>
    </div>
  )
}