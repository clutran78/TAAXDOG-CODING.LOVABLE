"use client";
import React from "react";

interface ExpenseCategoriesModalProps {
  show: boolean;
  handleClose: () => void;
}

const ExpenseCategoriesModal: React.FC<ExpenseCategoriesModalProps> = ({ show, handleClose }) => {
  if (!show) return null;

  const categories = [
    { name: "Housing", amount: 1200, percentage: 35 },
    { name: "Food & Dining", amount: 450, percentage: 13 },
    { name: "Transportation", amount: 320, percentage: 9 },
    { name: "Utilities", amount: 280, percentage: 8 },
    { name: "Shopping", amount: 600, percentage: 17 },
    { name: "Entertainment", amount: 250, percentage: 7 },
    { name: "Healthcare", amount: 180, percentage: 5 },
    { name: "Other", amount: 220, percentage: 6 },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Expense Categories
                </h3>
                
                <div className="bg-gray-100 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold">Total Expenses</h4>
                    <h3 className="text-2xl font-bold text-red-600">$3,500.00</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {categories.map((category, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <h5 className="font-medium">{category.name}</h5>
                        <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">{category.percentage}%</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="text-gray-600 text-sm">Monthly expense</div>
                        <h4 className="text-lg font-bold text-red-600">${category.amount.toFixed(2)}</h4>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                        <div 
                          className="bg-red-600 h-2 rounded-full" 
                          style={{ width: `${category.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseCategoriesModal;