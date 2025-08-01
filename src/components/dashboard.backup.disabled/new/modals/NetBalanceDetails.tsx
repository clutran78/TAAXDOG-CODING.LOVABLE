"use client";
import React from "react";

interface NetBalanceDetailsProps {
  show: boolean;
  handleClose: () => void;
}

const NetBalanceDetails: React.FC<NetBalanceDetailsProps> = ({ show, handleClose }) => {
  if (!show) return null;

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
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                  Net Balance Details
                </h3>
                
                <div className="bg-gray-100 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold">Current Balance</h4>
                    <h3 className="text-2xl font-bold text-blue-600">$2,350.00</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h5 className="font-medium mb-3">Balance Breakdown</h5>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Income</span>
                        <span className="font-semibold text-green-600">+$5,850.00</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Expenses</span>
                        <span className="font-semibold text-red-600">-$3,500.00</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Net Balance</span>
                          <span className="font-bold text-blue-600">$2,350.00</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h5 className="font-medium mb-3">Monthly Trend</h5>
                    <div className="flex items-center text-green-600">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                      <span>+15.2% from last month</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Your balance has increased by $305.43 compared to last month.
                    </p>
                  </div>
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

export default NetBalanceDetails;