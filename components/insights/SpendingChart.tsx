import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// Color palette for chart visualizations
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

// TypeScript interfaces for component props
interface CategoryData {
  name: string;
  amount: number;
}

interface MonthlyTrendData {
  month: string;
  income: number;
  expenses: number;
}

interface SpendingData {
  categories: CategoryData[];
  monthly_trends: MonthlyTrendData[];
}

interface SpendingChartProps {
  data: SpendingData | null;
}

/**
 * SpendingChart Component
 *
 * Displays financial data through two main visualizations:
 * 1. Pie chart showing spending breakdown by category
 * 2. Bar chart showing monthly income vs expenses trends
 *
 * Features:
 * - Responsive design that adapts to screen size
 * - Interactive tooltips and legends
 * - Color-coded categories for easy identification
 * - Loading state when data is not available
 */
export const SpendingChart: React.FC<SpendingChartProps> = ({ data }) => {
  // Show loading state when data is not available
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p>Loading spending analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Spending by Category - Pie Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Spending by Category
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Breakdown of your expenses by category
          </p>
        </div>

        <div className="h-80">
          <ResponsiveContainer
            width="100%"
            height={300}
          >
            <PieChart>
              <Pie
                data={data.categories}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {data.categories?.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Trends - Bar Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Monthly Trends</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Income vs expenses over time</p>
        </div>

        <div className="h-80">
          <ResponsiveContainer
            width="100%"
            height={300}
          >
            <BarChart data={data.monthly_trends}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="opacity-30"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
                tickFormatter={(value: number) => `$${value.toLocaleString()}`}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString()}`,
                  name.charAt(0).toUpperCase() + name.slice(1),
                ]}
                labelStyle={{ color: 'var(--foreground)' }}
                contentStyle={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                }}
              />
              <Legend />
              <Bar
                dataKey="income"
                fill="#00C49F"
                name="Income"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                fill="#FF8042"
                name="Expenses"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SpendingChart;
