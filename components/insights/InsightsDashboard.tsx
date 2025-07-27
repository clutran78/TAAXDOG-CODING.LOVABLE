'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { logger } from '@/lib/logger';
import {
  FaChartLine as TrendingUp,
  FaDollarSign as DollarSign,
  FaBullseye as Target,
  FaFileAlt as FileText,
  FaBrain as Brain,
  FaCalendarAlt as Calendar,
  FaFilter as Filter,
  FaDownload as Download,
  FaSyncAlt as RefreshCw,
  FaExclamationCircle as AlertCircle,
  FaCheckCircle as CheckCircle,
  FaClock as Clock,
  FaLightbulb as Lightbulb,
} from 'react-icons/fa';

// Define types for our insights data
interface AIInsight {
  id: string;
  type: string;
  category: string;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendations: string[];
  metadata?: {
    amount?: number;
    percentage?: number;
    trend?: 'up' | 'down' | 'stable';
    [key: string]: string | number | boolean | undefined;
  };
  createdAt: string;
  expiresAt: string;
}

interface InsightsResponse {
  insights: AIInsight[];
}

interface InsightsSummary {
  totalInsights: number;
  highPriorityCount: number;
  potentialSavings: number;
  categoryCounts: Record<string, number>;
}

// Memoized summary card component
const SummaryCard = memo<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass?: string;
}>(({ title, value, icon, colorClass = 'text-gray-900 dark:text-white' }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
        <p className={`text-2xl font-bold ${colorClass}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
      {icon}
    </div>
  </div>
));

SummaryCard.displayName = 'SummaryCard';

// Memoized insight card component
const InsightCard = memo<{
  insight: AIInsight;
  getPriorityColor: (priority: string) => string;
  getCategoryIcon: (category: string) => React.ReactNode;
  getConfidenceIcon: (confidence: number) => React.ReactNode;
}>(({ insight, getPriorityColor, getCategoryIcon, getConfidenceIcon }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        {getCategoryIcon(insight.category)}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{insight.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(insight.priority)}`}>
              {insight.priority}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {insight.category}
            </span>
            {getConfidenceIcon(insight.confidence)}
          </div>
        </div>
      </div>
      {insight.metadata?.amount && (
        <div className="text-right">
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            ${insight.metadata.amount.toLocaleString()}
          </p>
          {insight.metadata.trend && (
            <p
              className={`text-xs ${
                insight.metadata.trend === 'up'
                  ? 'text-red-600'
                  : insight.metadata.trend === 'down'
                    ? 'text-green-600'
                    : 'text-gray-600'
              }`}
            >
              {insight.metadata.trend === 'up'
                ? '↑'
                : insight.metadata.trend === 'down'
                  ? '↓'
                  : '→'}
              {insight.metadata.percentage?.toFixed(1)}%
            </p>
          )}
        </div>
      )}
    </div>

    <p className="text-gray-600 dark:text-gray-400 mb-3">{insight.description}</p>

    {insight.impact && (
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        <strong>Impact:</strong> {insight.impact}
      </p>
    )}

    {insight.recommendations && insight.recommendations.length > 0 && (
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Recommendations:
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          {insight.recommendations.map((rec, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
              {rec}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
));

InsightCard.displayName = 'InsightCard';

/**
 * Financial Insights Dashboard Component
 *
 * Provides comprehensive AI-powered financial insights including:
 * - Real-time AI-generated insights from the API
 * - Australian tax deduction identification
 * - Personalized financial recommendations
 * - Interactive data visualization
 */
const InsightsDashboard: React.FC = () => {
  // State management for insights data
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // State for filters and controls
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>(
    'all',
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'recommendations'>(
    'overview',
  );

  /**
   * Fetch insights from the API
   */
  const fetchInsights = useCallback(async (types?: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = types ? `?types=${types.join(',')}` : '';
      const response = await fetch(`/api/ai/insights${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch insights');
      }

      const data: InsightsResponse = await response.json();
      setInsights(data.insights || []);
      setLastFetched(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
      logger.error('Error fetching insights:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Generate specific type of insights
   */
  const generateInsights = useCallback(
    async (type: string, inputData: Record<string, unknown>) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/insights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            data: inputData,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to generate insights');
        }

        const data = await response.json();

        // Refresh the insights list after generation
        await fetchInsights();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate insights');
        logger.error('Error generating insights:', err);
      } finally {
        setLoading(false);
      }
    },
    [fetchInsights],
  );

  /**
   * Generate comprehensive analysis
   */
  const runComprehensiveAnalysis = useCallback(async () => {
    // This would typically fetch user's financial data first
    // For now, we'll trigger different insight types
    const analysisTypes = ['cashFlow', 'expenses', 'taxSavings'] as const;

    // Run all analysis types in parallel for better performance
    await Promise.all(
      analysisTypes.map((type) => {
        // In a real implementation, you'd fetch the actual data for each type
        const mockData = {
          cashFlow: { transactions: [], period: 'monthly' },
          expenses: { expenses: [] },
          taxSavings: { financialProfile: {} },
        };

        return generateInsights(type, mockData[type as keyof typeof mockData]);
      }),
    );
  }, [generateInsights]);

  /**
   * Calculate insights summary
   */
  const summary = useMemo((): InsightsSummary => {
    const summary: InsightsSummary = {
      totalInsights: insights.length,
      highPriorityCount: insights.filter((i) => i.priority === 'HIGH').length,
      potentialSavings: 0,
      categoryCounts: {},
    };

    insights.forEach((insight) => {
      // Count by category
      summary.categoryCounts[insight.category] =
        (summary.categoryCounts[insight.category] || 0) + 1;

      // Sum potential savings
      if (insight.metadata?.amount && insight.type.includes('saving')) {
        summary.potentialSavings += insight.metadata.amount;
      }
    });

    return summary;
  }, [insights]);

  /**
   * Get priority color for visual indicators
   */
  const getPriorityColor = useCallback((priority: string) => {
    switch (priority.toUpperCase()) {
      case 'HIGH':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'LOW':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  }, []);

  /**
   * Get confidence icon for visual indicators
   */
  const getConfidenceIcon = useCallback((confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (confidence >= 0.6) return <Clock className="w-4 h-4 text-yellow-600" />;
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  }, []);

  /**
   * Get category icon
   */
  const getCategoryIcon = useCallback((category: string) => {
    switch (category.toLowerCase()) {
      case 'tax':
        return <FileText className="w-5 h-5" />;
      case 'spending':
        return <DollarSign className="w-5 h-5" />;
      case 'savings':
        return <Target className="w-5 h-5" />;
      case 'investment':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Brain className="w-5 h-5" />;
    }
  }, []);

  /**
   * Filter insights based on selected criteria
   */
  const filteredInsights = useMemo(() => {
    return insights.filter((insight) => {
      const categoryMatch = selectedCategory === 'all' || insight.category === selectedCategory;
      const priorityMatch = selectedPriority === 'all' || insight.priority === selectedPriority;
      return categoryMatch && priorityMatch;
    });
  }, [insights, selectedCategory, selectedPriority]);

  /**
   * Get unique categories from insights
   */
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(insights.map((i) => i.category)));
  }, [insights]);

  // Load initial data on component mount
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Auto-refresh insights every 5 minutes
  useEffect(() => {
    const interval = setInterval(
      () => {
        fetchInsights();
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [fetchInsights]);

  // Memoized tab buttons
  const tabButtons = useMemo(
    () => [
      { id: 'overview', name: 'Overview', icon: TrendingUp },
      { id: 'detailed', name: 'Detailed Insights', icon: Brain },
      { id: 'recommendations', name: 'Recommendations', icon: Lightbulb },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            AI Financial Insights
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Refresh button */}
          <button
            onClick={() => fetchInsights()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          {/* Generate insights button */}
          <button
            onClick={runComprehensiveAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            Generate Analysis
          </button>
        </div>
      </div>

      {/* Last updated */}
      {lastFetched && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Last updated: {lastFetched.toLocaleString('en-AU')}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded dark:bg-red-900/20 dark:border-red-600 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav
          className="-mb-px flex space-x-8"
          aria-label="Tabs"
        >
          {tabButtons.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'detailed' | 'recommendations')}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SummaryCard
              title="Total Insights"
              value={summary.totalInsights}
              icon={<Brain className="w-8 h-8 text-blue-600" />}
            />
            <SummaryCard
              title="High Priority"
              value={summary.highPriorityCount}
              icon={<AlertCircle className="w-8 h-8 text-red-600" />}
              colorClass="text-red-600"
            />
            <SummaryCard
              title="Potential Savings"
              value={`$${summary.potentialSavings.toLocaleString()}`}
              icon={<DollarSign className="w-8 h-8 text-green-600" />}
              colorClass="text-green-600"
            />
            <SummaryCard
              title="Categories"
              value={Object.keys(summary.categoryCounts).length}
              icon={<Target className="w-8 h-8 text-purple-600" />}
            />
          </div>

          {/* Category breakdown */}
          {Object.keys(summary.categoryCounts).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Insights by Category
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(summary.categoryCounts).map(([category, count]) => (
                  <div
                    key={category}
                    className="flex items-center gap-3"
                  >
                    {getCategoryIcon(category)}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {category}
                      </p>
                      <p className="text-lg font-bold text-gray-600 dark:text-gray-400">{count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Insights Tab */}
      {activeTab === 'detailed' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map((cat) => (
                <option
                  key={cat}
                  value={cat}
                >
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as 'all' | 'HIGH' | 'MEDIUM' | 'LOW')}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          {/* Insights list */}
          <div className="space-y-4">
            {filteredInsights.length > 0 ? (
              filteredInsights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  getPriorityColor={getPriorityColor}
                  getCategoryIcon={getCategoryIcon}
                  getConfidenceIcon={getConfidenceIcon}
                />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {loading ? 'Loading insights...' : 'No insights found for the selected criteria.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Personalized Action Plan
            </h3>

            {/* High priority recommendations */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
                Immediate Actions (High Priority)
              </h4>
              {insights
                .filter((i) => i.priority === 'HIGH' && i.recommendations.length > 0)
                .map((insight) => (
                  <div
                    key={insight.id}
                    className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4"
                  >
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                      {insight.title}
                    </h5>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      {insight.recommendations.map((rec, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2"
                        >
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>

            {/* Medium priority recommendations */}
            <div className="space-y-4 mt-6">
              <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
                Short-term Goals (Medium Priority)
              </h4>
              {insights
                .filter((i) => i.priority === 'MEDIUM' && i.recommendations.length > 0)
                .slice(0, 3)
                .map((insight) => (
                  <div
                    key={insight.id}
                    className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4"
                  >
                    <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                      {insight.title}
                    </h5>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      {insight.recommendations.slice(0, 2).map((rec, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2"
                        >
                          <Clock className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>

            {insights.length === 0 && (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                Generate an analysis to see personalized recommendations.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MemoizedInsightsDashboard = memo(InsightsDashboard);
MemoizedInsightsDashboard.displayName = 'InsightsDashboard';

export default MemoizedInsightsDashboard;
