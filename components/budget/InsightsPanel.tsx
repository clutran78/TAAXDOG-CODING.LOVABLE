import React from 'react';

interface InsightsPanelProps {
  insights: any[];
  onDismiss: (id: string) => void;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights, onDismiss }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'spending_pattern':
        return '📊';
      case 'tax_optimization':
        return '🧾';
      case 'cash_flow':
        return '💰';
      case 'business_expense':
        return '💼';
      default:
        return '💡';
    }
  };

  const dismissInsight = async (id: string) => {
    try {
      const response = await fetch(`/api/insights/${id}/dismiss`, {
        method: 'POST',
      });
      
      if (response.ok) {
        onDismiss(id);
      }
    } catch (error) {
      console.error('Failed to dismiss insight:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Financial Insights</h3>
      
      {insights.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No active insights. Generate new insights to see AI-powered recommendations.
        </p>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`border rounded-lg p-4 ${getPriorityColor(insight.priority)}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-start">
                  <span className="text-2xl mr-2">{getInsightIcon(insight.insightType)}</span>
                  <div>
                    <h4 className="font-medium">{insight.title}</h4>
                    <p className="text-sm mt-1">{insight.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => dismissInsight(insight.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              {insight.recommendations && insight.recommendations.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium">Recommendations:</p>
                  {insight.recommendations.map((rec: any, index: number) => (
                    <div key={index} className="bg-white bg-opacity-50 rounded p-2">
                      <p className="text-sm font-medium">{rec.action}</p>
                      <p className="text-xs text-gray-600">
                        Impact: {rec.impact} • {rec.timeframe}
                        {rec.estimatedSavings && ` • Save $${rec.estimatedSavings}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex justify-between items-center mt-3 text-xs">
                <span className="opacity-75">
                  Confidence: {((insight.confidenceScore || 0) * 100).toFixed(0)}%
                </span>
                <span className="opacity-75">
                  {new Date(insight.createdAt).toLocaleDateString('en-AU')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};