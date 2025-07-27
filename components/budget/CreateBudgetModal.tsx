import React, { useState } from 'react';
import { TransactionCategory } from '@/lib/types';

interface BudgetFormData {
  name: string;
  monthlyBudget: number;
  targetSavings?: number;
  monthlyIncome?: number;
  categoryLimits?: Record<string, number>;
}

interface CreateBudgetModalProps {
  onClose: () => void;
  onCreate: (data: BudgetFormData) => void;
}

export const CreateBudgetModal: React.FC<CreateBudgetModalProps> = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    monthlyBudget: '',
    targetSavings: '',
    monthlyIncome: '',
    categoryLimits: {} as Record<string, string>,
  });

  const [categories] = useState([
    'Food & Dining',
    'Transport',
    'Shopping',
    'Entertainment',
    'Bills & Utilities',
    'Healthcare',
    'Education',
    'Other',
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const categoryLimits = Object.entries(formData.categoryLimits).reduce(
      (acc, [key, value]) => {
        if (value) {
          acc[key] = parseFloat(value);
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    onCreate({
      name: formData.name,
      monthlyBudget: parseFloat(formData.monthlyBudget),
      targetSavings: formData.targetSavings ? parseFloat(formData.targetSavings) : undefined,
      monthlyIncome: formData.monthlyIncome ? parseFloat(formData.monthlyIncome) : undefined,
      categoryLimits: Object.keys(categoryLimits).length > 0 ? categoryLimits : undefined,
    });
  };

  const updateCategoryLimit = (category: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      categoryLimits: {
        ...prev.categoryLimits,
        [category]: value,
      },
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Create New Budget</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Budget Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Monthly Budget (AUD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.monthlyBudget}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, monthlyBudget: e.target.value }))
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Target Monthly Savings (AUD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.targetSavings}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, targetSavings: e.target.value }))
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Monthly Income (AUD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.monthlyIncome}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, monthlyIncome: e.target.value }))
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            {/* Category Limits */}
            <div>
              <h3 className="text-lg font-medium mb-4">Category Limits (Optional)</h3>
              <p className="text-sm text-gray-500 mb-4">
                Set spending limits for specific categories. AI will use these to generate better
                predictions.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((category) => (
                  <div key={category}>
                    <label className="block text-sm font-medium text-gray-700">{category}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.categoryLimits[category] || ''}
                      onChange={(e) => updateCategoryLimit(category, e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="No limit"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* AI Features Notice */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">AI-Powered Features</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Automatic spending predictions based on your transaction history</li>
                <li>• Category-wise budget recommendations</li>
                <li>• Seasonal spending pattern analysis</li>
                <li>• Tax optimization suggestions for Australian tax year</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Budget
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
