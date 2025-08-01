import Link from 'next/link'
import { PlusIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '@/lib/utils'

interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  category: string
}

interface GoalsCardProps {
  goals: Goal[]
}

export function GoalsCard({ goals }: GoalsCardProps) {
  const calculateProgress = (goal: Goal): number => {
    if (goal.targetAmount <= 0) return 0
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
  }

  return (
    <div className="bg-white rounded-lg shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">🎯 Active Goals</h3>
        <Link
          href="/goals"
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          View All
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8">
          <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No goals yet. Click here to add your first financial goal!</p>
          <Link
            href="/goals"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Goal
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const progress = calculateProgress(goal)
            const isOverdue = new Date(goal.targetDate) < new Date()
            
            return (
              <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900">{goal.name}</h4>
                  <span className="text-xs text-gray-500">{goal.category}</span>
                </div>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {progress.toFixed(1)}%
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      progress >= 100
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
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
                  {isOverdue && (
                    <span className="text-red-600 font-medium">Overdue</span>
                  )}
                </div>
              </div>
            )
          })}
          
          <Link
            href="/goals"
            className="block w-full text-center py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-300 hover:text-primary-600 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mx-auto mb-1" />
            Add New Goal
          </Link>
        </div>
      )}
    </div>
  )
}