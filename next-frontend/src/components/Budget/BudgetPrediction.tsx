"use client";

import React, { useState, useEffect } from 'react';

interface BudgetPrediction {
  predicted_total: number;
  confidence: number;
  method: string;
}

interface PredictionData {
  predictions: Record<string, BudgetPrediction>;
  confidence_scores: {
    overall: number;
    data_quantity: number;
    time_coverage: number;
    data_consistency: number;
  };
  recommendations: Array<{
    type: string;
    title: string;
    description: string;
    amount: number;
    priority: string;
  }>;
  analysis_summary: {
    transaction_count: number;
    analysis_period_days: number;
    average_monthly_spending: number;
  };
}

interface SpendingAnalysis {
  monthly_spending: Record<string, { total: number; count: number }>;
  category_spending: Record<string, { total: number; count: number; average: number; percentage: number }>;
  trend_analysis: {
    trend: string;
    description: string;
    recent_average: number;
    overall_average: number;
  };
}

const BudgetPrediction: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionData | null>(null);
  const [analysis, setAnalysis] = useState<SpendingAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictionMonths, setPredictionMonths] = useState(3);

  // Fetch budget predictions from API
  const fetchPredictions = async (months: number = 3) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Fetch predictions
      const predictionsResponse = await fetch(`/api/budget/predict?months=${months}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!predictionsResponse.ok) {
        throw new Error('Failed to fetch budget predictions');
      }

      const predictionsData = await predictionsResponse.json();
      
      if (!predictionsData.success) {
        throw new Error(predictionsData.error || 'Failed to get predictions');
      }

      setPredictions(predictionsData.data);

      // Fetch spending analysis
      const analysisResponse = await fetch('/api/budget/analyze', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        if (analysisData.success) {
          setAnalysis(analysisData.data);
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching budget predictions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load predictions on component mount
  useEffect(() => {
    fetchPredictions(predictionMonths);
  }, [predictionMonths]);

  // Format currency for display
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  // Get trend icon based on spending trend
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <span className="text-red-500 text-lg">📈</span>;
      case 'decreasing':
        return <span className="text-green-500 text-lg">📉</span>;
      default:
        return <span className="text-blue-500 text-lg">💰</span>;
    }
  };

  // Get confidence color based on score
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Handle prediction period change
  const handleMonthsChange = (months: number) => {
    setPredictionMonths(months);
    fetchPredictions(months);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-2">Loading budget predictions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 p-6 rounded-lg">
        <div className="flex items-center space-x-2 text-red-600">
          <span className="text-lg">⚠️</span>
          <span>Error loading budget predictions: {error}</span>
        </div>
        <button 
          onClick={() => fetchPredictions(predictionMonths)} 
          className="mt-4 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!predictions) {
    return (
      <div className="border p-6 rounded-lg">
        <p>No prediction data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Budget Predictions</h2>
          <p className="text-gray-600">AI-powered spending forecasts and recommendations</p>
        </div>
        
        {/* Prediction Period Selector */}
        <div className="flex space-x-2">
          {[3, 6, 12].map((months) => (
            <button
              key={months}
              className={`px-3 py-1 rounded text-sm ${
                predictionMonths === months 
                  ? 'bg-blue-600 text-white' 
                  : 'border border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => handleMonthsChange(months)}
            >
              {months} months
            </button>
          ))}
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-blue-500 text-lg">💰</span>
            <div>
              <p className="text-sm text-gray-600">Average Monthly Spending</p>
              <p className="text-xl font-semibold">
                {formatCurrency(predictions.analysis_summary.average_monthly_spending)}
              </p>
            </div>
          </div>
        </div>

        <div className="border p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            {analysis && getTrendIcon(analysis.trend_analysis.trend)}
            <div>
              <p className="text-sm text-gray-600">Spending Trend</p>
              <p className="text-xl font-semibold capitalize">
                {analysis?.trend_analysis.trend || 'Stable'}
              </p>
            </div>
          </div>
        </div>

        <div className="border p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="h-5 w-5 bg-green-500 rounded-full" />
            <div>
              <p className="text-sm text-gray-600">Prediction Confidence</p>
              <p className={`text-xl font-semibold ${getConfidenceColor(predictions.confidence_scores.overall)}`}>
                {Math.round(predictions.confidence_scores.overall * 100)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Predictions */}
      <div className="border rounded-lg">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Monthly Budget Predictions</h3>
          <p className="text-sm text-gray-600">
            Predicted spending for the next {predictionMonths} months
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(predictions.predictions).map(([month, prediction]) => (
              <div key={month} className="border border-l-4 border-l-blue-500 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{new Date(month + '-01').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(prediction.predicted_total)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Confidence</p>
                    <p className={`text-sm font-medium ${getConfidenceColor(prediction.confidence)}`}>
                      {Math.round(prediction.confidence * 100)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {predictions.recommendations.length > 0 && (
        <div className="border rounded-lg">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Budget Recommendations</h3>
            <p className="text-sm text-gray-600">
              AI-generated suggestions to optimize your budget
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {predictions.recommendations.map((rec, index) => (
                <div key={index} className={`p-4 rounded-lg border-l-4 ${
                  rec.priority === 'high' ? 'border-l-red-500 bg-red-50' :
                  rec.priority === 'medium' ? 'border-l-yellow-500 bg-yellow-50' :
                  'border-l-green-500 bg-green-50'
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold">{formatCurrency(rec.amount)}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                        rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Spending Analysis */}
      {analysis && (
        <div className="border rounded-lg">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Spending Analysis</h3>
            <p className="text-sm text-gray-600">
              {analysis.trend_analysis.description}
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Categories */}
              <div>
                <h4 className="font-medium mb-3">Top Spending Categories</h4>
                <div className="space-y-2">
                  {Object.entries(analysis.category_spending)
                    .slice(0, 5) // Top 5 categories
                    .map(([category, data]) => (
                      <div key={category} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm">{category}</span>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatCurrency(data.total)}</p>
                          <p className="text-xs text-gray-500">{data.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Monthly Trend */}
              <div>
                <h4 className="font-medium mb-3">Recent Monthly Spending</h4>
                <div className="space-y-2">
                  {Object.entries(analysis.monthly_spending)
                    .slice(-5) // Last 5 months
                    .map(([month, data]) => (
                      <div key={month} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm">
                          {new Date(month + '-01').toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-sm font-medium">{formatCurrency(data.total)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button 
          onClick={() => fetchPredictions(predictionMonths)} 
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Refresh Predictions
        </button>
      </div>
    </div>
  );
};

export default BudgetPrediction;