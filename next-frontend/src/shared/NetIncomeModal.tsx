// components/NetIncomeModal.tsx
import { Modal, ProgressBar } from "react-bootstrap";

interface NetIncomeModalProps {
  show: boolean;
  handleClose: () => void;
}

const NetIncomeModal: React.FC<NetIncomeModalProps> = ({
  show,
  handleClose,
}) => {
  return (
    <Modal show={show} onHide={handleClose} className="modal-lg">
      <div className="modal-header">
        <h5 className="modal-title" id="net-income-modal-label">
          <i className="fas fa-money-bill-wave text-success me-2"></i>Net Income
          Details
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
            <div className="card bg-light">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Total Income</h4>
                  <h3 className="text-success mb-0" id="modal-net-income-value">
                    $0.00
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
        <h5 className="mb-3">Income Sources</h5>
        <div
          id="no-income-sources-message"
          className="alert alert-info"
          style={{ display: "none" }}
        >
          <i className="fas fa-info-circle me-2"></i>No income sources found.
          Connect your bank account to see your income details.
        </div>
        <div id="income-sources-container">
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Income</h5>
                <span className="badge bg-success">$61.1% %</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-2">
                <div className="text-muted">Monthly income</div>
                <h4 className="text-success mb-0">$5850.00</h4>
              </div>
              <div className="w-100 h-1">
                <ProgressBar
                  now={75}
                  variant="success"
                  animated={false}
                  className="h-100"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleClose}
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default NetIncomeModal;
