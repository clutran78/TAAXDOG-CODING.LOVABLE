'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import {
  FaChartLine,
  FaTrophy,
  FaLightbulb,
  FaBullseye,
  FaDollarSign,
  FaCalendarAlt,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaSync,
  FaDownload,
} from 'react-icons/fa';

interface SavingsMetrics {
  total_saved: number;
  monthly_avg_saved: number;
  goal_completion_rate: number;
  transfer_success_rate: number;
  current_streak: number;
  longest_streak: number;
  total_goals: number;
  total_transfers: number;
}

interface AnalyticsData {
  user_id: string;
  timeframe: string;
  metrics: SavingsMetrics;
  summary: {
    headline: string;
    status: string;
    next_actions: string[];
  };
}

const SavingsInsights: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('monthly');

  useEffect(() => {
    loadAnalytics();
  }, [timeframe]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // Simulate API call with mock data
      setTimeout(() => {
        setAnalyticsData({
          user_id: 'user123',
          timeframe,
          metrics: {
            total_saved: 15420,
            monthly_avg_saved: 1285,
            goal_completion_rate: 75,
            transfer_success_rate: 92,
            current_streak: 14,
            longest_streak: 28,
            total_goals: 4,
            total_transfers: 36,
          },
          summary: {
            headline: "Excellent savings performance! You're on track to meet your goals.",
            status: 'good',
            next_actions: [
              'Consider increasing your emergency fund goal',
              'Set up automated transfers for your vacation fund',
              'Review and optimize transfer amounts',
            ],
          },
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      logger.error('Failed to load analytics:', error);
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Generating your savings insights...</p>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <FaChartLine className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No Analytics Data Available</h2>
          <p className="text-gray-500 mb-6">Start saving and creating goals to see your insights</p>
          <button
            onClick={loadAnalytics}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Savings Insights</h1>
            <p className="text-gray-600">{analyticsData.summary.headline}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>

            <button
              onClick={loadAnalytics}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FaSync className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Saved</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analyticsData.metrics.total_saved)}
              </p>
            </div>
            <FaDollarSign className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Across {analyticsData.metrics.total_goals} goals
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Monthly Average</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analyticsData.metrics.monthly_avg_saved)}
              </p>
            </div>
            <FaCalendarAlt className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-sm text-gray-600 mt-2">Last 12 months</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.metrics.transfer_success_rate}%
              </p>
            </div>
            <FaBullseye className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {analyticsData.metrics.total_transfers} total transfers
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Current Streak</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.metrics.current_streak}
              </p>
            </div>
            <FaTrophy className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Best: {analyticsData.metrics.longest_streak} days
          </p>
        </div>
      </div>

      {/* Recommended Actions */}
      {analyticsData.summary.next_actions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recommended Actions</h2>
          <div className="space-y-3">
            {analyticsData.summary.next_actions.map((action, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg"
              >
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">
                  {index + 1}
                </div>
                <p className="text-blue-800">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingsInsights;
