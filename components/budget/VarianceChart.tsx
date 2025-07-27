import React, { useMemo } from 'react';

interface BudgetTracking {
  month: number;
  year: number;
  predictedAmount: number;
  actualAmount?: number | null;
}

interface VarianceChartProps {
  tracking: BudgetTracking[];
}

export const VarianceChart: React.FC<VarianceChartProps> = ({ tracking }) => {
  const chartData = useMemo(() => {
    // Group by month and calculate totals
    const monthlyData = tracking.reduce(
      (acc, t) => {
        const key = `${t.year}-${String(t.month).padStart(2, '0')}`;
        if (!acc[key]) {
          acc[key] = {
            month: t.month,
            year: t.year,
            predicted: 0,
            actual: 0,
          };
        }
        acc[key].predicted += parseFloat(t.predictedAmount.toString());
        acc[key].actual += parseFloat(t.actualAmount?.toString() || '0');
        return acc;
      },
      {} as Record<string, { month: number; year: number; predicted: number; actual: number }>,
    );

    // Convert to array and sort by date
    return Object.entries(monthlyData)
      .map(([key, data]) => ({
        month: data.month,
        year: data.year,
        predicted: data.predicted,
        actual: data.actual,
        key,
        label: new Date(data.year, data.month - 1).toLocaleDateString('en-AU', {
          month: 'short',
          year: '2-digit',
        }),
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6); // Last 6 months
  }, [tracking]);

  const maxValue = Math.max(...chartData.flatMap((d) => [d.predicted, d.actual]));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Spending Trend</h3>

      <div className="relative">
        {/* Chart */}
        <div
          className="flex items-end justify-between gap-2"
          style={{ height: '200px' }}
        >
          {chartData.map((data) => (
            <div
              key={data.key}
              className="flex-1 flex gap-1"
            >
              {/* Predicted bar */}
              <div className="flex-1 flex flex-col items-center justify-end">
                <div className="w-full relative group">
                  <div
                    className="bg-gray-300 rounded-t transition-all duration-300 hover:bg-gray-400"
                    style={{
                      height: `${(data.predicted / maxValue) * 180}px`,
                      minHeight: '4px',
                    }}
                  />
                  <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    Predicted: {formatCurrency(data.predicted)}
                  </div>
                </div>
              </div>

              {/* Actual bar */}
              <div className="flex-1 flex flex-col items-center justify-end">
                <div className="w-full relative group">
                  <div
                    className={`rounded-t transition-all duration-300 ${
                      data.actual > data.predicted
                        ? 'bg-red-400 hover:bg-red-500'
                        : 'bg-green-400 hover:bg-green-500'
                    }`}
                    style={{
                      height: `${(data.actual / maxValue) * 180}px`,
                      minHeight: '4px',
                    }}
                  />
                  <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    Actual: {formatCurrency(data.actual)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2">
          {chartData.map((data) => (
            <div
              key={data.key}
              className="flex-1 text-center"
            >
              <span className="text-xs text-gray-500">{data.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 rounded"></div>
          <span className="text-sm text-gray-600">Predicted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-400 rounded"></div>
          <span className="text-sm text-gray-600">Under Budget</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-400 rounded"></div>
          <span className="text-sm text-gray-600">Over Budget</span>
        </div>
      </div>
    </div>
  );
};
