"use client";
import React, { useState } from "react";
import ExpenseCategoriesModal from "./modals/ExpenseCategoriesModal";
import ManageSubscriptionsModal from "./modals/ManageSubscriptionsModal";
import NetBalanceDetails from "./modals/NetBalanceDetails";
import NetIncomeModal from "./modals/NetIncomeModal";

const GridBoxes = () => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);
  const handleShowNetIncomeModal = () => setShowNetIncomeModal(true);
  const handleCloseNetIncomeModal = () => setShowNetIncomeModal(false);

  const [showNetBalanceDetailsModal, setShowNetBalanceDetailsModal] =
    useState(false);
  const handleShowNetBalanceDetails = () => setShowNetBalanceDetailsModal(true);
  const handleCloseNetBalanceDetails = () =>
    setShowNetBalanceDetailsModal(false);

  const [showExpenseCategoriesModal, setShowExpenseCategoriesModal] =
    useState(false);
  const handleShowExpenseCategoriesModal = () =>
    setShowExpenseCategoriesModal(true);
  const handleCloseExpenseCategoriesModal = () =>
    setShowExpenseCategoriesModal(false);

  const [showManageSubscriptionsModal, setShowManageSubscriptionsModal] =
    useState(false);

  const handleOpenManageSubscriptionsModal = () =>
    setShowManageSubscriptionsModal(true);

  const handleCloseManageSubscriptionsModal = () =>
    setShowManageSubscriptionsModal(false);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Net Income Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
          <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Net Income</h3>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8l-8 8-8-8" />
              </svg>
            </div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-bold text-gray-900">$0.00</div>
            <button
              onClick={handleShowNetIncomeModal}
              className="mt-2 text-sm text-green-600 hover:text-green-800 flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              <span>+12.3% from last month</span>
            </button>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
          <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Total Expenses</h3>
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 0l-8 8m8-8l8 8" />
              </svg>
            </div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-bold text-gray-900">$0.00</div>
            <button
              onClick={handleShowExpenseCategoriesModal}
              className="mt-2 text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 13l5 5m0 0l5-5m-5 5V6" />
              </svg>
              <span>-8.1% from last month</span>
            </button>
          </div>
        </div>

        {/* Net Balance Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Net Balance</h3>
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 3m0 0l3-3M6 9v12m8-12h8m-4-4v8m4 8H10" />
              </svg>
            </div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-bold text-gray-900">$0.00</div>
            <button
              onClick={handleShowNetBalanceDetails}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              <span>+15.2% from last month</span>
            </button>
          </div>
        </div>

        {/* Subscriptions Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
          <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Subscriptions</h3>
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <div className="p-4">
            <div className="text-2xl font-bold text-gray-900">$0.00</div>
            <button
              onClick={handleOpenManageSubscriptionsModal}
              className="mt-2 text-sm text-purple-600 hover:text-purple-800"
            >
              0 active subscriptions
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <NetIncomeModal
        show={showNetIncomeModal}
        handleClose={handleCloseNetIncomeModal}
      />

      <ExpenseCategoriesModal
        show={showExpenseCategoriesModal}
        handleClose={handleCloseExpenseCategoriesModal}
      />

      <NetBalanceDetails
        show={showNetBalanceDetailsModal}
        handleClose={handleCloseNetBalanceDetails}
      />

      <ManageSubscriptionsModal
        show={showManageSubscriptionsModal}
        handleClose={handleCloseManageSubscriptionsModal}
      />
    </>
  );
};

export default GridBoxes;