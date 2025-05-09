"use client";
import { useState, useEffect } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import NetIncomeModal from "./NetIncomeModal";

interface ExpenseCategoriesProps {
  show: boolean;
  handleClose: () => void;
}

const ExpenseCategoriesModal: React.FC<ExpenseCategoriesProps> = ({
  show,
  handleClose,
}) => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllExpenses, setShowAllExpenses] = useState(false); // ✅ added state

  const handleCloseNetIncomeModal = () => setShowNetIncomeModal(false);

  useEffect(() => {
    if (show) {
      setIsLoading(true);
      setShowAllExpenses(false); // ✅ reset view-all state when modal opens
      const timer = setTimeout(() => setIsLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <>
    <div className="modal fade" id="expense-categories-modal" aria-labelledby="expense-categories-modal-label"
        aria-hidden="true">
        <div className="modal-dialog modal-lg">
            <div className="modal-content">
                <div className="modal-header">
                    <h5 className="modal-title" id="expense-categories-modal-label">
                        <i className="fas fa-chart-pie text-danger me-2"></i>Expense Categories
                    </h5>
                    <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div className="modal-body">
                    <div className="text-center p-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-3">Loading expense data...</p>
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" className="btn btn-primary" id="view-all-expenses-btn">
                        <i className="fas fa-list-ul me-2"></i>View All Expenses
                    </button>
                </div>
            </div>
        </div>
    </div>

      <Modal show={show} onHide={handleClose} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title id="expense-categories-modal-label">
            <i className="fas fa-chart-pie text-danger me-2"></i>
            Expense Categories
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="position-relative">
          {isLoading && (
            <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex flex-column justify-content-center align-items-center spinner-overlay">
              <Spinner animation="border" variant="primary" role="status" />
              <p className="mt-3">Loading expense data...</p>
            </div>
          )}

          <div className="row mb-4">
            <div className="col-12">
              <div className="card bg-light">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <h4 className="mb-0">Total Expenses</h4>
                    <h3 className="text-danger mb-0" id="modal-detailed-expenses-value">$0.00</h3>
                  </div>
                </div>
              </div>
              {showAllExpenses && (
                <div className="col-12">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      id="expense-search"
                      placeholder="Search expenses..."
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      id="expense-search-btn"
                    >
                      <i className="fas fa-search"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div id="no-expenses-message" className="alert alert-info d-none">
            <i className="fas fa-info-circle me-2"></i>No expenses found. Connect your bank account to see your
            expenses.
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

              </tbody>
            </table>
          </div>

        </Modal.Body>

        <Modal.Footer>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" className="btn btn-primary" id="view-expense-categories-btn">
              <i className="fas fa-chart-pie me-2"></i>View Expense Categories
            </button>
          </div>
        </Modal.Footer>
      </Modal>

      <NetIncomeModal
        show={showNetIncomeModal}
        handleClose={handleCloseNetIncomeModal}
      />
    </>
  );
};

export default ExpenseCategoriesModal;
