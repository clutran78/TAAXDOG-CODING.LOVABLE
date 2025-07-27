import React, { useState, useEffect } from 'react';
import { CategoryBreakdown } from './CategoryBreakdown';
import { VarianceChart } from './VarianceChart';
import { Budget, BudgetCategory } from '@/lib/types';
import { logger } from '@/lib/logger';

interface BudgetVariance {
  id: string;
  budgetId: string;
  month: number;
  year: number;
  totalBudgeted: number;
  totalSpent: number;
  variance: number;
  percentageUsed: number;
  categories: Array<{
    category: string;
    budgeted: number;
    spent: number;
    variance: number;
    percentageUsed: number;
  }>;
}

interface BudgetOverviewProps {
  budget: Budget & { tracking?: BudgetCategory[] };
  onUpdate: () => void;
}

export const BudgetOverview: React.FC<BudgetOverviewProps> = ({ budget, onUpdate }) => {
  const [variance, setVariance] = useState<BudgetVariance | null>(null);
  const [loadingVariance, setLoadingVariance] = useState(false);
  const [currentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchVariance();
  }, [budget.id]);

  const fetchVariance = async () => {
    setLoadingVariance(true);
    try {
      const response = await fetch(
        `/api/budgets/${budget.id}/variance?month=${currentMonth}&year=${currentYear}`,
      );

      if (response.ok) {
        const data = await response.json();
        setVariance(data.analysis);
      }
    } catch (error) {
      logger.error('Failed to fetch variance:', error);
    } finally {
      setLoadingVariance(false);
    }
  };

  const updateTracking = async () => {
    try {
      const response = await fetch('/api/budgets/tracking/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          year: currentYear,
        }),
      });

      if (response.ok) {
        fetchVariance();
        onUpdate();
      }
    } catch (error) {
      logger.error('Failed to update tracking:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const getVarianceColor = (percent: number) => {
    if (percent > 10) return 'text-red-600';
    if (percent < -10) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Budget Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">{budget.name}</h2>
            <p className="text-gray-500">
              {new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={updateTracking}
            className="text-blue-600 hover:text-blue-800"
          >
            Sync Transactions
          </button>
        </div>

        {/* Budget Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Monthly Budget</p>
            <p className="text-2xl font-semibold">{formatCurrency(budget.monthlyBudget)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Target Savings</p>
            <p className="text-2xl font-semibold">{formatCurrency(budget.targetSavings || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Income</p>
            <p className="text-2xl font-semibold">{formatCurrency(budget.monthlyIncome || 0)}</p>
          </div>
        </div>
      </div>

      {/* Current Month Variance */}
      {variance && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Current Month Performance</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500">Predicted</p>
              <p className="text-xl font-semibold">{formatCurrency(variance.totalPredicted)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Actual</p>
              <p className="text-xl font-semibold">{formatCurrency(variance.totalActual)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Variance</p>
              <p className={`text-xl font-semibold ${getVarianceColor(variance.variancePercent)}`}>
                {formatCurrency(variance.totalVariance)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Variance %</p>
              <p className={`text-xl font-semibold ${getVarianceColor(variance.variancePercent)}`}>
                {variance.variancePercent.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Insights */}
          {variance.insights && variance.insights.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Insights</h4>
              <ul className="space-y-1">
                {variance.insights.map((insight: string, index: number) => (
                  <li
                    key={index}
                    className="text-sm text-gray-700"
                  >
                    • {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Category Breakdown */}
      {variance && <CategoryBreakdown categories={variance.categories} />}

      {/* Historical Variance Chart */}
      {budget.budgetTracking && budget.budgetTracking.length > 0 && (
        <VarianceChart tracking={budget.budgetTracking} />
      )}

      {/* AI Predictions */}
      {budget.predictions && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">AI Predictions</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Confidence Score</p>
              <div className="flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(budget.confidenceScore || 0) * 100}%` }}
                  />
                </div>
                <span className="ml-2 text-sm">
                  {((budget.confidenceScore || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {budget.predictions.recommendations && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Recommendations</p>
                <ul className="space-y-2">
                  {budget.predictions.recommendations.map((rec: string, index: number) => (
                    <li
                      key={index}
                      className="text-sm bg-gray-50 p-2 rounded"
                    >
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
