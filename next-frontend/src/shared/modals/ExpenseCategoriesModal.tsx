'use client';

import { useEffect, useRef, useState } from 'react';
import {
  loadDetailedExpenses,
  openExpenseCategoriesModal,
  performExpenseSearch,
  setupFinancialFeatureHandlers,
} from '@/services/helperFunction';

const TotalExpensesModal = () => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load data on mount
  useEffect(() => {
    loadDetailedExpenses();
    setupFinancialFeatureHandlers();
  }, []);

  // Debounced search
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.trim() === '') {
        loadDetailedExpenses();
      } else {
        performExpenseSearch(searchTerm.trim());
      }
    }, 400);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  // Open modal method
  const openModal = () => {
    import('bootstrap/js/dist/modal').then(({ default: Modal }) => {
      if (modalRef.current) {
        const modal = Modal.getOrCreateInstance(modalRef.current);
        modal.show();
      }
    });
  };

  // Close modal method
  const closeModal = () => {
    import('bootstrap/js/dist/modal').then(({ default: Modal }) => {
      if (modalRef.current) {
        const modal = Modal.getInstance(modalRef.current);
        modal?.hide();
      }
    });
  };

  // Expose global open method
  useEffect(() => {
    (window as any).openExpensesModal = openModal;
  }, []);

  return (
    <div
      className="modal fade"
      id="total-expenses-modal"
      tabIndex={-1}
      aria-labelledby="total-expenses-modal-label"
      style={{zIndex:"9999"}}
      aria-hidden="true"
      ref={modalRef}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-danger text-white">
            <h5 className="modal-title" id="total-expenses-modal-label">
              <i className="fas fa-receipt me-2"></i> Detailed Expenses
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={closeModal}
              aria-label="Close"
            ></button>
          </div>

          <div className="modal-body">
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
                </div>
              </div>
            </div>

            <div id="no-expenses-message" className="alert alert-info d-none">
              <i className="fas fa-info-circle me-2"></i>No expenses found. Connect your bank account to see your expenses.
            </div>

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
                  {/* Injected by JS */}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-end mt-3  cursor-pointer">
              <button type="button" className="btn btn-primary" onClick={ ()=>setTimeout(() => openExpenseCategoriesModal(), 400)}>
                <i className="fas fa-chart-pie me-2"></i>View Expense Categories
              </button>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalExpensesModal;
