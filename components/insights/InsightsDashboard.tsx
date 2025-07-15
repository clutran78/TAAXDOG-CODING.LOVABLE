'use client';

import React, { useState, useEffect } from 'react';
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
  FaLightbulb as Lightbulb
} from 'react-icons/fa';
import { insightsService, type InsightsAnalysis } from '../../services/insights-service';

// Define types for our insights data
interface FinancialInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: string;
  amount?: number;
  recommendations: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface TaxDeduction {
  category: string;
  category_name: string;
  amount: number;
  confidence: string;
  description: string;
  documentation_required: string;
}

interface FinancialGoal {
  goal_type: string;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  timeline_months: number;
  monthly_target: number;
  priority: string;
  achievability_score: number;
  action_steps: string[];
}

/**
 * Financial Insights Dashboard Component
 * 
 * Provides comprehensive AI-powered financial insights including:
 * - Spending pattern analysis using Claude AI
 * - Australian tax deduction identification
 * - Personalized financial goal suggestions
 * - Interactive data visualization
 */
const InsightsDashboard: React.FC = () => {
  // State management for insights data
  const [insights, setInsights] = useState<InsightsAnalysis | null>(null);
  const [taxDeductions, setTaxDeductions] = useState<TaxDeduction[]>([]);
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for filters and controls
  const [selectedPeriod, setSelectedPeriod] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [activeTab, setActiveTab] = useState<'overview' | 'deductions' | 'goals' | 'reports'>('overview');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');

  /**
   * Analyze user's financial data and generate comprehensive insights
   * Uses Claude AI to provide personalized recommendations
   */
  const analyzeFinances = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch comprehensive financial analysis
      const analysisResult = await insightsService.analyzeTransactions();
      setInsights(analysisResult);
      
      // Fetch tax deductions
      const deductionsResult = await insightsService.getTaxDeductions();
      setTaxDeductions(deductionsResult);
      
      // Generate financial goals
      const goalsResult = await insightsService.generateGoals();
      setFinancialGoals(goalsResult);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze financial data');
      console.error('Error analyzing finances:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generate and download comprehensive financial report
   */
  const generateReport = async () => {
    try {
      setLoading(true);
      const report = await insightsService.getFinancialReport(selectedPeriod);
      
      // Create downloadable report (simplified version)
      const reportData = JSON.stringify(report, null, 2);
      const blob = new Blob([reportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `financial-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      setError('Failed to generate report');
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load initial data on component mount
  useEffect(() => {
    analyzeFinances();
  }, [selectedPeriod]);

  /**
   * Get priority color for visual indicators
   */
  const getPriorityColor = (priority: string) => {
    switch (priority.toUpperCase()) {
      case 'HIGH': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'LOW': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  /**
   * Get confidence icon for visual indicators
   */
  const getConfidenceIcon = (confidence: string) => {
    switch (confidence.toUpperCase()) {
      case 'HIGH': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'MEDIUM': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'LOW': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  /**
   * Filter tax deductions based on confidence level
   */
  const filteredDeductions = taxDeductions.filter(deduction => 
    confidenceFilter === 'all' || deduction.confidence.toUpperCase() === confidenceFilter
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
          {/* Period selector */}
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          
          {/* Refresh button */}
          <button 
            onClick={analyzeFinances}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analyzing...' : 'Refresh Analysis'}
          </button>
          
          {/* Download report button */}
          <button 
            onClick={generateReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

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
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { id: 'overview', name: 'Overview', icon: TrendingUp },
            { id: 'deductions', name: 'Tax Deductions', icon: FileText },
            { id: 'goals', name: 'Financial Goals', icon: Target },
            { id: 'reports', name: 'Reports', icon: DollarSign }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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
          {/* Key metrics cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Spending Patterns Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Spending Patterns</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {insights?.spending_patterns?.length || 0}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                AI-identified patterns
              </p>
            </div>

            {/* Tax Deductions Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Potential Deductions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${taxDeductions.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {taxDeductions.length} deductions found
              </p>
            </div>

            {/* Financial Goals Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Goals</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {financialGoals.length}
                  </p>
                </div>
                <Target className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Personalized recommendations
              </p>
            </div>

            {/* Insights Score Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Insights Score</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {insights ? Math.round((insights.top_categories?.length || 0) * 20) : 0}%
                  </p>
                </div>
                <Brain className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Data completeness
              </p>
            </div>
          </div>

          {/* Top spending categories */}
          {insights?.top_categories && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Top Spending Categories
              </h3>
              <div className="space-y-3">
                {insights.top_categories.slice(0, 5).map((category: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-600" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {category.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${category.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {category.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommendations */}
          {insights?.recommendations && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                AI Recommendations
              </h3>
              <div className="space-y-3">
                {insights.recommendations.slice(0, 3).map((rec: any, index: number) => (
                  <div key={index} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(rec.type)}`}>
                        {rec.type.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-white">
                          {rec.description}
                        </p>
                        {rec.potential_saving > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Potential savings: ${rec.potential_saving.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tax Deductions Tab */}
      {activeTab === 'deductions' && (
        <div className="space-y-6">
          {/* Deductions filter */}
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <select 
              value={confidenceFilter} 
              onChange={(e) => setConfidenceFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="all">All Confidence Levels</option>
              <option value="HIGH">High Confidence</option>
              <option value="MEDIUM">Medium Confidence</option>
              <option value="LOW">Low Confidence</option>
            </select>
          </div>

          {/* Deductions list */}
          <div className="space-y-4">
            {filteredDeductions.map((deduction, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {deduction.category_name} ({deduction.category})
                      </span>
                      {getConfidenceIcon(deduction.confidence)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {deduction.description}
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <strong>Required documentation:</strong> {deduction.documentation_required}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      ${deduction.amount.toLocaleString()}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded ${getPriorityColor(deduction.confidence)}`}>
                      {deduction.confidence} confidence
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredDeductions.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No tax deductions found for the selected criteria.
            </div>
          )}
        </div>
      )}

      {/* Financial Goals Tab */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="space-y-4">
            {financialGoals.map((goal, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {goal.title}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(goal.priority)}`}>
                        {goal.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {goal.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      ${goal.target_amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Target Amount
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Progress</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {((goal.current_amount / goal.target_amount) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((goal.current_amount / goal.target_amount) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Goal details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Current Amount</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      ${goal.current_amount.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Monthly Target</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      ${goal.monthly_target.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Timeline</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {goal.timeline_months} months
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Achievability</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {(goal.achievability_score * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Action steps */}
                {goal.action_steps && goal.action_steps.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Action Steps:
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {goal.action_steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {financialGoals.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No financial goals generated yet. Click "Refresh Analysis" to create personalized goals.
            </div>
          )}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Financial Reports
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Generate comprehensive financial reports for tax purposes and financial planning.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={generateReport}
                disabled={loading}
                className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
              >
                <FileText className="w-5 h-5" />
                <span>Download Financial Report</span>
              </button>
              
              <button 
                onClick={() => alert('Tax summary coming soon!')}
                className="flex items-center justify-center gap-2 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
              >
                <DollarSign className="w-5 h-5" />
                <span>Tax Summary Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsDashboard;