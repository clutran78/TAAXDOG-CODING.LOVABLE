"use client";
import { useState } from "react";
import { Modal, Button } from "react-bootstrap";
import NetIncomeModal from "./NetIncomeModal";
import ExpenseCategoriesModal from "./ExpenseCategoriesModal";

interface NetBalanceDetailsProps {
  show: boolean;
  handleClose: () => void;
}

const NetBalanceDetails: React.FC<NetBalanceDetailsProps> = ({
  show,
  handleClose,
}) => {
  const [showNetIncomeModal, setShowNetIncomeModal] = useState(false);
  const [showNetCatModal, setShowNetCatModal] = useState(false);

  const handleShowNetIncomeModal = () => {
    handleClose(); // close NetBalanceDetails modal
    setShowNetIncomeModal(true); // open NetIncomeModal modal
  };

  const handleCloseNetIncomeModal = () => setShowNetIncomeModal(false);

  const handleShowCatModal = () => {
    handleClose(); // close NetBalanceDetails modal
    setShowNetCatModal(true); // open ExpenseCategoriesModal modal
  };

  const handleCloseCatModal = () => setShowNetCatModal(false);

  return (
    <>
      <Modal show={show} onHide={handleClose} size="lg">
        <div className="modal-header">
          <h5 className="modal-title" id="net-balance-modal-label">
            <i className="fas fa-balance-scale text-primary me-2"></i>Net
            Balance Details
          </h5>
          <button
            type="button"
            className="btn-close"
            onClick={handleClose}
            aria-label="Close"
          ></button>
        </div>

        <div className="modal-body">
          <div className="row mb-4">
            <div className="col-12">
              <div className="card bg-primary text-white">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <h4 className="mb-0">Net Balance</h4>
                    <h3 className="mb-0" id="modal-net-balance-value">
                      $0.00
                    </h3>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <div className="card h-100">
                <div className="card-header bg-success bg-opacity-10 text-success">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Total Income</h5>
                    <i className="fas fa-arrow-circle-up"></i>
                  </div>
                </div>
                <div className="card-body">
                  <h3 className="text-success" id="modal-balance-income-value">
                    $0.00
                  </h3>
                  <div className="mt-3">
                    <h6>Top Income Sources:</h6>
                    <div id="balance-income-sources">
                      {/* Income sources will be loaded here */}
                    </div>
                    <div className="mt-3">
                      <button
                        className="btn btn-outline-success btn-sm"
                        onClick={handleShowNetIncomeModal}
                      >
                        <i className="fas fa-list me-1"></i> View All Income
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-3">
              <div className="card h-100">
                <div className="card-header bg-danger bg-opacity-10 text-danger">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Total Expenses</h5>
                    <i className="fas fa-arrow-circle-down"></i>
                  </div>
                </div>
                <div className="card-body">
                  <h3 className="text-danger" id="modal-balance-expenses-value">
                    $0.00
                  </h3>
                  <div className="mt-3">
                    <h6>Top Expense Categories:</h6>
                    <div id="balance-expense-categories">
                      {/* Expense categories will be loaded here */}
                    </div>
                    <div className="mt-3">
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={handleShowCatModal}
                      >
                        <i className="fas fa-list me-1"></i> View All Expenses
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Trends Section */}
          <div className="row mt-2">
            <div className="col-12">
              <div className="card">
                <div className="card-header bg-light">
                  <h5 className="mb-0">
                    <i className="fas fa-chart-line me-2"></i>Monthly Balance
                    Trend
                  </h5>
                </div>
                <div className="card-body">
                  <div className="text-center py-3">
                    <i className="fas fa-chart-line fa-3x text-primary mb-3"></i>
                    {/* Balance trend visualization would appear here */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" id="analyze-balance-btn">
            <i className="fas fa-search me-1"></i>Analyze Balance
          </Button>
        </div>
      </Modal>

      {/* NetIncomeModal */}
      <NetIncomeModal
        show={showNetIncomeModal}
        handleClose={handleCloseNetIncomeModal}
      />

      {/* ExpenseCategoriesModal */}
      <ExpenseCategoriesModal
        show={showNetCatModal}
        handleClose={handleCloseCatModal}
      />
    </>
  );
};

export default NetBalanceDetails;
