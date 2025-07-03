import React, { useState, useEffect } from 'react';
import { BudgetOverview } from './BudgetOverview';
import { InsightsPanel } from './InsightsPanel';
import { CreateBudgetModal } from './CreateBudgetModal';

export const BudgetDashboard: React.FC = () => {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetsRes, insightsRes] = await Promise.all([
        fetch('/api/budgets?includeTracking=true'),
        fetch('/api/insights'),
      ]);

      const budgetsData = await budgetsRes.json();
      const insightsData = await insightsRes.json();

      setBudgets(budgetsData.budgets);
      setInsights(insightsData.insights);
      
      // Select active budget by default
      const activeBudget = budgetsData.budgets.find((b: any) => b.status === 'ACTIVE');
      if (activeBudget) {
        setSelectedBudget(activeBudget);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async (budgetData: any) => {
    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetData),
      });

      if (response.ok) {
        setShowCreateModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to create budget:', error);
    }
  };

  const handleGenerateInsights = async () => {
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightTypes: ['spending_pattern', 'tax_optimization', 'cash_flow'],
        }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to generate insights:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget & Insights</h1>
          <p className="mt-2 text-gray-600">AI-powered financial planning and analysis</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Create Budget
          </button>
          <button
            onClick={handleGenerateInsights}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            Generate Insights
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Budget Overview - 2 columns */}
        <div className="lg:col-span-2">
          {selectedBudget ? (
            <BudgetOverview
              budget={selectedBudget}
              onUpdate={fetchData}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500 mb-4">No active budget found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Create Your First Budget
              </button>
            </div>
          )}
        </div>

        {/* Insights Panel - 1 column */}
        <div className="lg:col-span-1">
          <InsightsPanel
            insights={insights}
            onDismiss={(id) => {
              setInsights(insights.filter(i => i.id !== id));
            }}
          />
        </div>
      </div>

      {/* Budget List */}
      {budgets.length > 1 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">All Budgets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgets.map((budget) => (
              <div
                key={budget.id}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer border-2 ${
                  selectedBudget?.id === budget.id ? 'border-blue-500' : 'border-transparent'
                }`}
                onClick={() => setSelectedBudget(budget)}
              >
                <h3 className="font-medium">{budget.name}</h3>
                <p className="text-sm text-gray-500">
                  ${budget.monthlyBudget}/month
                </p>
                <p className="text-sm text-gray-500">
                  Status: {budget.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Budget Modal */}
      {showCreateModal && (
        <CreateBudgetModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateBudget}
        />
      )}
    </div>
  );
};