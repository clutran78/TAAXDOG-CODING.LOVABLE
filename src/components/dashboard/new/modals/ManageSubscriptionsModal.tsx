"use client";
import React from "react";

interface ManageSubscriptionsModalProps {
  show: boolean;
  handleClose: () => void;
}

const ManageSubscriptionsModal: React.FC<ManageSubscriptionsModalProps> = ({ show, handleClose }) => {
  if (!show) return null;

  const subscriptions = [
    { name: "Netflix", amount: 15.99, status: "Active", nextBilling: "2024-02-15" },
    { name: "Spotify", amount: 9.99, status: "Active", nextBilling: "2024-02-10" },
    { name: "Adobe Creative", amount: 54.99, status: "Active", nextBilling: "2024-02-20" },
    { name: "Gym Membership", amount: 49.99, status: "Active", nextBilling: "2024-02-01" },
  ];

  const totalAmount = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);

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
                  <svg className="w-5 h-5 text-purple-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Manage Subscriptions
                </h3>
                
                <div className="bg-gray-100 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-semibold">Total Monthly</h4>
                    <h3 className="text-2xl font-bold text-purple-600">${totalAmount.toFixed(2)}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{subscriptions.length} active subscriptions</p>
                </div>

                <div className="space-y-3">
                  {subscriptions.map((subscription, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-medium">{subscription.name}</h5>
                          <p className="text-sm text-gray-600">Next billing: {subscription.nextBilling}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-lg">${subscription.amount}</span>
                          <p className="text-sm text-green-600">{subscription.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Tip: Review your subscriptions regularly to avoid paying for services you don't use.
                  </p>
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

export default ManageSubscriptionsModal;