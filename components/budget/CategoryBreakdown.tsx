import React from 'react';

interface CategoryData {
  category: string;
  predicted: number;
  actual: number;
  status: 'over' | 'under' | 'on-track';
  variance: number;
  variancePercentage: number;
}

interface CategoryBreakdownProps {
  categories: CategoryData[];
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ categories }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'over':
        return 'bg-red-100 text-red-800';
      case 'under':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'over':
        return 'bg-red-500';
      case 'under':
        return 'bg-green-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>

      <div className="space-y-4">
        {categories.map((category) => {
          const progressPercent = Math.min((category.actual / category.predicted) * 100, 150);

          return (
            <div
              key={category.category}
              className="border-b border-gray-200 pb-4 last:border-0"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-medium">{category.category}</h4>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(category.actual)} of {formatCurrency(category.predicted)}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(category.status)}`}
                  >
                    {category.status === 'over'
                      ? 'Over'
                      : category.status === 'under'
                        ? 'Under'
                        : 'On Track'}
                  </span>
                  <p className="text-sm mt-1">
                    {category.variance > 0 ? '+' : ''}
                    {formatCurrency(category.variance)}
                  </p>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(category.status)}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
