'use client';

import { useEffect, useState } from 'react';
import {
  loadDetailedExpenses,
  performExpenseSearch,
  setupFinancialFeatureHandlers,
} from '@/services/helperFunction';

const TotalExpensesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Load initial data
  useEffect(() => {
    loadDetailedExpenses();
    setupFinancialFeatureHandlers();
  }, []);

  // Auto-search with debounce
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.trim() === '') {
        loadDetailedExpenses();
      } else {
        performExpenseSearch(searchTerm.trim());
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(debounce);
  }, [searchTerm]);

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>
          <i className="fas fa-receipt text-danger me-2"></i>Detailed Expenses
        </h3>
      </div>

      {/* Totals and Search */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card bg-light">
            <div className="card-body d-flex justify-content-between align-items-center">
              <h4 className="mb-0">Total Expenses</h4>
              <h3 className="text-danger mb-0" id="modal-detailed-expenses-value">$0.00</h3>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* <button className="btn btn-primary" type="button" disabled>
              <i className="fas fa-search"></i>
            </button> */}
          </div>
        </div>
      </div>

      {/* No Expense Message */}
      <div id="no-expenses-message" className="alert alert-info d-none">
        <i className="fas fa-info-circle me-2"></i>No expenses found. Connect your bank account to see your expenses.
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Merchant</th>
              <th>Category</th>
              <th>Account</th>
              <th className="text-end">Amount</th>
            </tr>
          </thead>
          <tbody id="expenses-table-body">
            {/* Content inserted by performExpenseSearch or loadDetailedExpenses */}
          </tbody>
        </table>
      </div>

      {/* View Categories Button */}
      <div className="d-flex justify-content-end mt-3">
        <button type="button" className="btn btn-primary" id="view-expense-categories-btn">
          <i className="fas fa-chart-pie me-2"></i>View Expense Categories
        </button>
      </div>
    </div>
  );
};

export default TotalExpensesPage;
