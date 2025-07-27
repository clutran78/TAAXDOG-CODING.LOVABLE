import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { BudgetOverview } from './BudgetOverview';
import { InsightsPanel } from './InsightsPanel';
import { CreateBudgetModal } from './CreateBudgetModal';
import { Button } from '@/components/ui/Button';
import { SkeletonBudgetItem, SkeletonCard, Skeleton } from '@/components/ui/SkeletonLoaders';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Budget {
  id: string;
  name: string;
  monthlyBudget: number;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  tracking?: BudgetTracking[];
}

interface BudgetTracking {
  category: string;
  spent: number;
  limit: number;
}

interface Insight {
  id: string;
  type: 'spending_pattern' | 'tax_optimization' | 'cash_flow';
  title: string;
  description: string;
  recommendations?: string[];
}

interface BudgetFormData {
  name: string;
  monthlyBudget: number;
  categories: {
    name: string;
    limit: number;
  }[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INSIGHT_TYPES = ['spending_pattern', 'tax_optimization', 'cash_flow'] as const;

// ============================================================================
// MEMOIZED SUB-COMPONENTS
// ============================================================================

const LoadingSkeleton = memo(() => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {/* Header skeleton */}
    <div className="mb-8 flex justify-between items-center">
      <div>
        <Skeleton
          height={36}
          width={250}
          rounded
          className="mb-2"
        />
        <Skeleton
          height={20}
          width={350}
          rounded
        />
      </div>
      <div className="flex gap-4">
        <Skeleton
          height={40}
          width={120}
          rounded
        />
        <Skeleton
          height={40}
          width={140}
          rounded
        />
      </div>
    </div>

    {/* Main content skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Budget Overview skeleton */}
      <div className="lg:col-span-2 space-y-4">
        <SkeletonCard className="h-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonBudgetItem />
          <SkeletonBudgetItem />
          <SkeletonBudgetItem />
          <SkeletonBudgetItem />
        </div>
      </div>

      {/* Insights Panel skeleton */}
      <div className="lg:col-span-1">
        <SkeletonCard className="h-96" />
      </div>
    </div>
  </div>
));

LoadingSkeleton.displayName = 'LoadingSkeleton';

const BudgetItem = memo<{
  budget: Budget;
  isSelected: boolean;
  onClick: (budget: Budget) => void;
}>(({ budget, isSelected, onClick }) => (
  <div
    className={`bg-white rounded-lg shadow p-4 cursor-pointer border-2 ${
      isSelected ? 'border-blue-500' : 'border-transparent'
    }`}
    onClick={() => onClick(budget)}
  >
    <h3 className="font-medium">{budget.name}</h3>
    <p className="text-sm text-gray-500">${budget.monthlyBudget}/month</p>
    <p className="text-sm text-gray-500">Status: {budget.status}</p>
  </div>
));

BudgetItem.displayName = 'BudgetItem';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BudgetDashboard: React.FC = () => {
  // ========================================
  // STATE
  // ========================================

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [creatingBudget, setCreatingBudget] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // ========================================
  // CALLBACKS
  // ========================================

  const fetchData = useCallback(async () => {
    try {
      const [budgetsRes, insightsRes] = await Promise.all([
        fetch('/api/budgets?includeTracking=true'),
        fetch('/api/insights'),
      ]);

      const budgetsData = await budgetsRes.json();
      const insightsData = await insightsRes.json();

      setBudgets(budgetsData.budgets);
      setInsights(insightsData.insights);
      setLastFetched(new Date());

      // Select active budget by default
      const activeBudget = budgetsData.budgets.find((b: Budget) => b.status === 'ACTIVE');
      if (activeBudget) {
        setSelectedBudget(activeBudget);
      }
    } catch (error) {
      logger.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateBudget = useCallback(
    async (budgetData: BudgetFormData) => {
      try {
        setCreatingBudget(true);
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
        logger.error('Failed to create budget:', error);
      } finally {
        setCreatingBudget(false);
      }
    },
    [fetchData],
  );

  const handleGenerateInsights = useCallback(async () => {
    try {
      setGeneratingInsights(true);
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightTypes: INSIGHT_TYPES,
        }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      logger.error('Failed to generate insights:', error);
    } finally {
      setGeneratingInsights(false);
    }
  }, [fetchData]);

  const handleDismissInsight = useCallback((id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleSelectBudget = useCallback((budget: Budget) => {
    setSelectedBudget(budget);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  // ========================================
  // MEMOIZED VALUES
  // ========================================

  const hasMultipleBudgets = useMemo(() => budgets.length > 1, [budgets.length]);

  // ========================================
  // EFFECTS
  // ========================================

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!loading && lastFetched) {
      const interval = setInterval(
        () => {
          fetchData();
        },
        5 * 60 * 1000,
      );

      return () => clearInterval(interval);
    }
  }, [loading, lastFetched, fetchData]);

  // ========================================
  // RENDER
  // ========================================

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget & Insights</h1>
          <p className="mt-2 text-gray-600">AI-powered financial planning and analysis</p>
        </div>
        <div className="flex gap-4">
          <Button
            onClick={handleOpenCreateModal}
            variant="primary"
          >
            Create Budget
          </Button>
          <Button
            onClick={handleGenerateInsights}
            loading={generatingInsights}
            disabled={generatingInsights}
            variant="success"
          >
            Generate Insights
          </Button>
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
              <Button
                onClick={handleOpenCreateModal}
                variant="primary"
              >
                Create Your First Budget
              </Button>
            </div>
          )}
        </div>

        {/* Insights Panel - 1 column */}
        <div className="lg:col-span-1">
          <InsightsPanel
            insights={insights}
            onDismiss={handleDismissInsight}
          />
        </div>
      </div>

      {/* Budget List */}
      {hasMultipleBudgets && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">All Budgets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgets.map((budget) => (
              <BudgetItem
                key={budget.id}
                budget={budget}
                isSelected={selectedBudget?.id === budget.id}
                onClick={handleSelectBudget}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Budget Modal */}
      {showCreateModal && (
        <CreateBudgetModal
          onClose={handleCloseCreateModal}
          onCreate={handleCreateBudget}
        />
      )}
    </div>
  );
};

BudgetDashboard.displayName = 'BudgetDashboard';

const MemoizedBudgetDashboard = memo(BudgetDashboard);

export { MemoizedBudgetDashboard as BudgetDashboard };
export default MemoizedBudgetDashboard;
