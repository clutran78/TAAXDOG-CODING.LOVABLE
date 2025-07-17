import React from 'react';

interface ExpenseCategoriesModalProps {
  show: boolean;
  onClose: () => void;
  categories?: any[];
}

const ExpenseCategoriesModal: React.FC<ExpenseCategoriesModalProps> = ({ show, onClose, categories = [] }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Expense Categories</h2>
        <div className="space-y-4">
          {categories.length === 0 ? (
            <p className="text-gray-500">No expense categories found</p>
          ) : (
            categories.map((category, index) => (
              <div key={index} className="border p-4 rounded">
                <h3 className="font-semibold">{category.name}</h3>
                <p className="text-sm text-gray-600">Total: ${category.total}</p>
                <p className="text-sm text-gray-600">Transactions: {category.count}</p>
              </div>
            ))
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ExpenseCategoriesModal;