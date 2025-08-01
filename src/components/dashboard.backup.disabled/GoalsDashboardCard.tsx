'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PlusIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  progressPercentage: number
  daysRemaining: number
  isOnTrack: boolean
}

interface GoalsDashboardCardProps {
  goals: Goal[]
  insights: {
    goalsOnTrack: number
    totalActiveGoals: number
  }
  loading?: boolean
}

export function GoalsDashboardCard({ goals, insights, loading }: GoalsDashboardCardProps) {
  const [showAllGoals, setShowAllGoals] = useState(false)
  
  const displayGoals = showAllGoals ? goals : goals.slice(0, 3)
  const hasMoreGoals = goals.length > 3

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-gray-200 rounded animate-pulse w-20"></div>
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
              <div className="h-2 bg-gray-200 rounded animate-pulse w-full"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <ChartBarIcon className="h-6 w-6 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Goals</h3>
        </div>
        <Link
          href="/goals"
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 transition-colors"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Goal
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No goals yet</p>
          <Link
            href="/goals"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Create your first goal
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Goals on track</span>
              <span className="font-medium text-green-600">
                {insights.goalsOnTrack} of {insights.totalActiveGoals}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {displayGoals.map((goal) => (
              <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 truncate flex-1">
                    {goal.name}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded-full ml-2 ${
                    goal.isOnTrack 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {goal.isOnTrack ? 'On Track' : 'Behind'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Progress</span>
                    <span className="font-medium">
                      {Math.min(goal.progressPercentage, 100).toFixed(0)}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        goal.isOnTrack ? 'bg-blue-600' : 'bg-yellow-500'
                      }`}
                      style={{ 
                        width: `${Math.min(goal.progressPercentage, 100)}%` 
                      }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-sm text-gray-600">
                    <span className="tabular-nums">
                      {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                    </span>
                    <span>
                      {goal.daysRemaining > 0 
                        ? `${goal.daysRemaining} days left`
                        : `${Math.abs(goal.daysRemaining)} days overdue`
                      }
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMoreGoals && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAllGoals(!showAllGoals)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {showAllGoals ? 'Show Less' : `Show ${goals.length - 3} More Goals`}
              </button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              href="/goals"
              className="block text-center text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View All Goals →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}