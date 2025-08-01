'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils'
import { apiService } from '@/services/api-service'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorDisplay } from '@/components/ui/ErrorDisplay'
import toast from 'react-hot-toast'

interface Goal {
  id: string
  name: string
  description: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  category: string
  isCompleted: boolean
  createdAt: string
}

export default function GoalsPage() {
  const { data: session } = useSession()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  useEffect(() => {
    if (session?.user?.id) {
      loadGoals()
    }
  }, [session?.user?.id])

  const loadGoals = async () => {
    if (!session?.user?.id) return

    try {
      setLoading(true)
      const response = await apiService.getGoals(session.user.id)
      
      if (response.success && response.data) {
        setGoals(Array.isArray(response.data) ? response.data : [])
        setError(null)
      } else {
        setError(response.error || 'Failed to load goals')
      }
    } catch (err) {
      setError('Failed to load goals')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateGoal = async (goalData: Partial<Goal>) => {
    if (!session?.user?.id) return

    try {
      const response = await apiService.createGoal(session.user.id, goalData)
      
      if (response.success) {
        toast.success('Goal created successfully!')
        setShowCreateModal(false)
        loadGoals()
      } else {
        toast.error(response.error || 'Failed to create goal')
      }
    } catch (err) {
      toast.error('Failed to create goal')
    }
  }

  const handleUpdateGoal = async (goalId: string, goalData: Partial<Goal>) => {
    try {
      const response = await apiService.updateGoal(goalId, goalData)
      
      if (response.success) {
        toast.success('Goal updated successfully!')
        setEditingGoal(null)
        loadGoals()
      } else {
        toast.error(response.error || 'Failed to update goal')
      }
    } catch (err) {
      toast.error('Failed to update goal')
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return

    try {
      const response = await apiService.deleteGoal(goalId)
      
      if (response.success) {
        toast.success('Goal deleted successfully!')
        loadGoals()
      } else {
        toast.error(response.error || 'Failed to delete goal')
      }
    } catch (err) {
      toast.error('Failed to delete goal')
    }
  }

  const calculateProgress = (goal: Goal): number => {
    if (goal.targetAmount <= 0) return 0
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadGoals} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Goals</h1>
          <p className="text-gray-600">Set and track your financial objectives</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Goal
        </button>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="text-center py-12">
          <div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No goals yet</h3>
          <p className="text-gray-500 mb-6">Start by creating your first financial goal</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const progress = calculateProgress(goal)
            const isOverdue = new Date(goal.targetDate) < new Date() && !goal.isCompleted
            
            return (
              <div key={goal.id} className="bg-white rounded-lg shadow-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {goal.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">{goal.description}</p>
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                      {goal.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingGoal(goal)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Progress</span>
                    <span className="text-sm font-medium text-gray-900">
                      {progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        goal.isCompleted
                          ? 'bg-green-500'
                          : progress >= 75
                          ? 'bg-blue-500'
                          : progress >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                    </span>
                    {goal.isCompleted && (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Target: {new Date(goal.targetDate).toLocaleDateString('en-AU')}
                  </span>
                  {isOverdue && (
                    <span className="text-red-600 font-medium">Overdue</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Goal Modal would go here */}
      {/* Implementation depends on your modal component preference */}
    </div>
  )
}