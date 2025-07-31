import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleteLoading: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  deleteLoading,
}) => {
  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onCancel}
            ></button>
          </div>
          <div className="modal-body">
            <p>{message}</p>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={onConfirm}
            >
              {deleteLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Updating...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
