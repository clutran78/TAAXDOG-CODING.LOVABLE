'use client';

import React, { useState, useEffect, useCallback, useMemo, memo, Suspense, lazy } from 'react';
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
  FaExclamationTriangle as WarningIcon,
  FaWifi as WifiOff,
} from 'react-icons/fa';
import { useInView } from 'react-intersection-observer';
import debounce from 'lodash/debounce';

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

// Loading skeleton components
const SkeletonCard = memo(() => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
      <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
    </div>
  </div>
));

SkeletonCard.displayName = 'SkeletonCard';

const InsightSkeleton = memo(() => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700 animate-pulse">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="flex gap-2">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          </div>
        </div>
      </div>
    </div>
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  </div>
));

InsightSkeleton.displayName = 'InsightSkeleton';

// Memoized summary card component with better mobile styles
const SummaryCard = memo<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass?: string;
  loading?: boolean;
}>(({ title, value, icon, colorClass = 'text-gray-900 dark:text-white', loading }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700 transition-transform hover:scale-[1.02] hover:shadow-lg">
    <div className="flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{title}</p>
        {loading ? (
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 mt-1 animate-pulse"></div>
        ) : (
          <p className={`text-xl sm:text-2xl font-bold ${colorClass} truncate`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        )}
      </div>
      <div className="ml-3 flex-shrink-0">{icon}</div>
    </div>
  </div>
));

SummaryCard.displayName = 'SummaryCard';

// Memoized insight card component with virtualization support
const InsightCard = memo<{
  insight: AIInsight;
  getPriorityColor: (priority: string) => string;
  getCategoryIcon: (category: string) => React.ReactNode;
  getConfidenceIcon: (confidence: number) => React.ReactNode;
}>(({ insight, getPriorityColor, getCategoryIcon, getConfidenceIcon }) => {
  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: true,
  });

  if (!inView) {
    return (
      <div ref={ref} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
    );
  }

  return (
    <div ref={ref} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700 transition-all hover:shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">{getCategoryIcon(insight.category)}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white break-words">{insight.title}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
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
          <div className="text-right flex-shrink-0">
            <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">
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

      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3">{insight.description}</p>

      {insight.impact && (
        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3">
          <strong>Impact:</strong> {insight.impact}
        </p>
      )}

      {insight.recommendations && insight.recommendations.length > 0 && (
        <details className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100">
            Recommendations ({insight.recommendations.length})
          </summary>
          <ul className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-1">
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
        </details>
      )}
    </div>
  );
});

InsightCard.displayName = 'InsightCard';

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('InsightsDashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="text-center py-8">
          <WarningIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Something went wrong loading insights.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  const [retryCount, setRetryCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  // State for filters and controls
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>(
    'all',
  );
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'recommendations'>(
    'overview',
  );

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Fetch insights from the API with retry logic
   */
  const fetchInsights = useCallback(async (types?: string[], isRetry = false) => {
    if (!isRetry) {
      setLoading(true);
      setError(null);
    }

    try {
      const queryParams = types ? `?types=${types.join(',')}` : '';
      const response = await fetch(`/api/ai/insights${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch insights`);
      }

      const data: InsightsResponse = await response.json();
      setInsights(data.insights || []);
      setLastFetched(new Date());
      setRetryCount(0);
      
      // Cache insights in localStorage for offline access
      try {
        localStorage.setItem('cached_insights', JSON.stringify({
          insights: data.insights,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        logger.warn('Failed to cache insights:', e);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load insights';
      
      // Auto-retry logic with exponential backoff
      if (retryCount < 3 && !isRetry) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchInsights(types, true);
        }, delay);
      } else {
        setError(errorMessage);
        
        // Try to load cached insights if available
        try {
          const cached = localStorage.getItem('cached_insights');
          if (cached) {
            const { insights: cachedInsights, timestamp } = JSON.parse(cached);
            setInsights(cachedInsights);
            setError(`${errorMessage}. Showing cached data from ${new Date(timestamp).toLocaleString()}`);
          }
        } catch (e) {
          logger.error('Failed to load cached insights:', e);
        }
      }
      
      logger.error('Error fetching insights:', err);
    } finally {
      if (!isRetry) {
        setLoading(false);
      }
    }
  }, [retryCount]);

  /**
   * Generate specific type of insights with debouncing
   */
  const generateInsights = useMemo(
    () => debounce(async (type: string, inputData: Record<string, unknown>) => {
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
          signal: AbortSignal.timeout(60000), // 60 second timeout for generation
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to generate insights');
        }

        await response.json();
        // Refresh the insights list after generation
        await fetchInsights();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate insights');
        logger.error('Error generating insights:', err);
      } finally {
        setLoading(false);
      }
    }, 1000),
    [fetchInsights]
  );

  /**
   * Generate comprehensive analysis
   */
  const runComprehensiveAnalysis = useCallback(async () => {
    const analysisTypes = ['cashFlow', 'expenses', 'taxSavings'] as const;

    // Run all analysis types in parallel for better performance
    await Promise.allSettled(
      analysisTypes.map((type) => {
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
    if (confidence >= 0.8) return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />;
    if (confidence >= 0.6) return <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600" />;
    return <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" />;
  }, []);

  /**
   * Get category icon
   */
  const getCategoryIcon = useCallback((category: string) => {
    const iconClass = "w-4 h-4 sm:w-5 sm:h-5";
    switch (category.toLowerCase()) {
      case 'tax':
        return <FileText className={iconClass} />;
      case 'spending':
        return <DollarSign className={iconClass} />;
      case 'savings':
        return <Target className={iconClass} />;
      case 'investment':
        return <TrendingUp className={iconClass} />;
      default:
        return <Brain className={iconClass} />;
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
        if (!isOffline) {
          fetchInsights();
        }
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [fetchInsights, isOffline]);

  // Memoized tab buttons
  const tabButtons = useMemo(
    () => [
      { id: 'overview', name: 'Overview', icon: TrendingUp },
      { id: 'detailed', name: 'Insights', icon: Brain },
      { id: 'recommendations', name: 'Actions', icon: Lightbulb },
    ],
    [],
  );

  return (
    <ErrorBoundary>
      <div className="space-y-4 sm:space-y-6">
        {/* Offline indicator */}
        {isOffline && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-400">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm">You're offline. Showing cached data.</span>
            </div>
          </div>
        )}

        {/* Header with controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              AI Financial Insights
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Refresh button */}
            <button
              onClick={() => fetchInsights()}
              disabled={loading || isOffline}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Refresh insights"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Loading...' : 'Refresh'}</span>
            </button>

            {/* Generate insights button */}
            <button
              onClick={runComprehensiveAnalysis}
              disabled={loading || isOffline}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Generate analysis"
            >
              <Lightbulb className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Generate Analysis</span>
              <span className="sm:hidden">Analyze</span>
            </button>
          </div>
        </div>

        {/* Last updated */}
        {lastFetched && (
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Last updated: {lastFetched.toLocaleString('en-AU')}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded dark:bg-red-900/20 dark:border-red-600 dark:text-red-400">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Tab navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav
            className="-mb-px flex overflow-x-auto scrollbar-hide"
            aria-label="Tabs"
          >
            {tabButtons.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'overview' | 'detailed' | 'recommendations')}
                className={`flex items-center gap-1.5 sm:gap-2 py-2 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <SummaryCard
                title="Total Insights"
                value={summary.totalInsights}
                icon={<Brain className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />}
                loading={loading && insights.length === 0}
              />
              <SummaryCard
                title="High Priority"
                value={summary.highPriorityCount}
                icon={<AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />}
                colorClass="text-red-600"
                loading={loading && insights.length === 0}
              />
              <SummaryCard
                title="Potential Savings"
                value={`$${summary.potentialSavings.toLocaleString()}`}
                icon={<DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />}
                colorClass="text-green-600"
                loading={loading && insights.length === 0}
              />
              <SummaryCard
                title="Categories"
                value={Object.keys(summary.categoryCounts).length}
                icon={<Target className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />}
                loading={loading && insights.length === 0}
              />
            </div>

            {/* Category breakdown */}
            {Object.keys(summary.categoryCounts).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Insights by Category
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {Object.entries(summary.categoryCounts).map(([category, count]) => (
                    <div
                      key={category}
                      className="flex items-center gap-2 sm:gap-3"
                    >
                      {getCategoryIcon(category)}
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {category}
                        </p>
                        <p className="text-base sm:text-lg font-bold text-gray-600 dark:text-gray-400">{count}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading state for initial load */}
            {loading && insights.length === 0 && (
              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detailed Insights Tab */}
        {activeTab === 'detailed' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                className="px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="all">All Priorities</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>

            {/* Insights list */}
            <div className="space-y-3 sm:space-y-4">
              {loading && insights.length === 0 ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <InsightSkeleton key={i} />
                  ))}
                </>
              ) : filteredInsights.length > 0 ? (
                <Suspense fallback={<InsightSkeleton />}>
                  {filteredInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      getPriorityColor={getPriorityColor}
                      getCategoryIcon={getCategoryIcon}
                      getConfidenceIcon={getConfidenceIcon}
                    />
                  ))}
                </Suspense>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No insights found for the selected criteria.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Personalized Action Plan
              </h3>

              {/* High priority recommendations */}
              <div className="space-y-3 sm:space-y-4">
                <h4 className="text-sm sm:text-md font-medium text-gray-700 dark:text-gray-300">
                  Immediate Actions (High Priority)
                </h4>
                {insights
                  .filter((i) => i.priority === 'HIGH' && i.recommendations.length > 0)
                  .map((insight) => (
                    <div
                      key={insight.id}
                      className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 sm:p-4"
                    >
                      <h5 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white mb-2">
                        {insight.title}
                      </h5>
                      <ul className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        {insight.recommendations.map((rec, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2"
                          >
                            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>

              {/* Medium priority recommendations */}
              <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
                <h4 className="text-sm sm:text-md font-medium text-gray-700 dark:text-gray-300">
                  Short-term Goals (Medium Priority)
                </h4>
                {insights
                  .filter((i) => i.priority === 'MEDIUM' && i.recommendations.length > 0)
                  .slice(0, 3)
                  .map((insight) => (
                    <div
                      key={insight.id}
                      className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 sm:p-4"
                    >
                      <h5 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white mb-2">
                        {insight.title}
                      </h5>
                      <ul className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        {insight.recommendations.slice(0, 2).map((rec, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2"
                          >
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>

              {insights.length === 0 && (
                <p className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  Generate an analysis to see personalized recommendations.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

const MemoizedInsightsDashboard = memo(InsightsDashboard);
MemoizedInsightsDashboard.displayName = 'InsightsDashboard';

export default MemoizedInsightsDashboard;