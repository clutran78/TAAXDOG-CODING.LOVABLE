'use client';
import { showToast, updateFirebaseAndUI } from '@/services/helperFunction';
import React, { useEffect, useState } from 'react';
import { capturePhoto, removeCapturedPhoto, startCamera } from '../utils/camera-utils';
import { fetchReceiptStats, subscribeToAuthState } from '@/services/firebase-service';
import { resetUploadFields, validateForm } from '@/services/ui-helper-functions';
import { handleUploadFromActiveTab } from '@/services/upload-receipt-service';
import StatisticCard from './statistic-card';
import ReceiptFileUploadModal from '@/shared/modals/receipt-file-upload-modal';
import { useDarkMode } from '@/providers/dark-mode-provider';

declare global {
  interface Window {
    currentReceiptData: any;
    bootstrap: any;
  }
}

const ReceiptsComponent = () => {
  const { darkMode } = useDarkMode();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReceipts: 0,
    totalSpent: 0,
    matchedReceipts: 0,
    averageAmount: '$0.00',
  });

  useEffect(() => {
    const init = async () => {
      const { default: Modal } = await import('bootstrap/js/dist/modal');

      const uploadBtn = document.getElementById('receipt-upload-section-btn');

      if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
          const modalEl = document.getElementById('receipt-upload-section');
          if (modalEl) {
            const modalInstance = Modal.getInstance(modalEl) || new Modal(modalEl);
            resetUploadFields();
            modalInstance.show();
          }
        });
      }
    };
    const handleAuthSuccess = async (userId: string) => {
      try {
        setStatsLoading(true);
        const stats = await fetchReceiptStats(userId);
        if (stats) {
          setStats({
            totalReceipts: stats.totalReceipts || 0,
            totalSpent: stats.totalSpent || 0,
            matchedReceipts: stats.matchedReceipts || 0,
            averageAmount: stats.averageAmount || '$0.00',
          });
        }
      } catch (error) {
        console.error('Failed to load receipt stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    const handleAuthFail = () => {
      console.error('User not authenticated');
    };

    subscribeToAuthState(handleAuthSuccess, handleAuthFail);
    init();
  }, []);

  useEffect(() => {
    const receiptFileInput = document.getElementById('receipt-file') as HTMLInputElement | null;
    const receiptUrlInput = document.getElementById('receipt-url') as HTMLInputElement | any;
    const photoCanvas = document.getElementById('photo-canvas') as HTMLCanvasElement | null;
    const photoPreview = document.getElementById('photo-preview') as HTMLImageElement | null;
    const captureBtn = document.getElementById('capture-photo-btn') as HTMLButtonElement | null;
    const submitBtn = document.querySelector(
      '#receipt-upload-section button[type="submit"]',
    ) as HTMLButtonElement | null;
    const video = document.getElementById('camera-stream') as HTMLVideoElement | null;
    const cameraWarning = document.getElementById('camera-warning') as HTMLDivElement | null;
    const removeBtn = document.getElementById('remove-photo-btn') as HTMLButtonElement | null;

    const showCameraUnavailable = () => {
      captureBtn?.classList.add('d-none');
      cameraWarning?.classList.remove('d-none');
      video?.classList.add('d-none');
    };

    const showCameraAvailable = () => {
      captureBtn?.classList.remove('d-none');
      cameraWarning?.classList.add('d-none');
      video?.classList.remove('d-none');
    };

    const tabChangeHandler = () => validateForm();

    document
      .querySelectorAll('#uploadTab .nav-link')
      .forEach((tab) => tab.addEventListener('click', tabChangeHandler));

    receiptFileInput?.addEventListener('change', validateForm);
    receiptUrlInput?.addEventListener('input', validateForm);
    captureBtn?.addEventListener('click', () =>
      capturePhoto(video, photoCanvas, photoPreview, validateForm),
    );
    removeBtn?.addEventListener('click', () => removeCapturedPhoto(photoPreview, validateForm));
    submitBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      handleUploadFromActiveTab(
        document.querySelector('#uploadTab .nav-link.active')?.id,
        receiptFileInput,
        receiptUrlInput,
        photoCanvas,
        setLoading,
      );
    });

    startCamera(video, showCameraUnavailable, showCameraAvailable);
    validateForm();

    return () => {
      receiptFileInput?.removeEventListener('change', validateForm);
      receiptUrlInput?.removeEventListener('input', validateForm);
      captureBtn?.removeEventListener('click', () =>
        capturePhoto(video, photoCanvas, photoPreview, validateForm),
      );
      removeBtn?.removeEventListener('click', () =>
        removeCapturedPhoto(photoPreview, validateForm),
      );
      submitBtn?.removeEventListener('click', () =>
        handleUploadFromActiveTab(
          document.querySelector('#uploadTab .nav-link.active')?.id,
          receiptFileInput,
          receiptUrlInput,
          photoCanvas,
          setLoading,
        ),
      );
      document
        .querySelectorAll('#uploadTab .nav-link')
        .forEach((tab) => tab.removeEventListener('click', tabChangeHandler));
    };
  }, []);

  useEffect(() => {
    const formEl = document.getElementById('receiptForm') as HTMLFormElement | null;
    const cancelBtn = document.getElementById('cancel-review-btn') as HTMLButtonElement | null;
    const reviewForm = document.getElementById('receipt-review-form') as HTMLElement | null;

    const handleSubmit = async (e: Event) => {
      e.preventDefault();

      const vendorInput = document.getElementById('vendor_name') as HTMLInputElement | null;
      const amountInput = document.getElementById('total_amount') as HTMLInputElement | null;
      const dateInput = document.getElementById('date') as HTMLInputElement | null;

      const saveBtn = document.getElementById('confirm-save-btn') as HTMLButtonElement | null;
      const spinner = document.getElementById('save-spinner');
      const textSpan = document.getElementById('save-text');

      if (!vendorInput || !amountInput || !dateInput || !saveBtn || !spinner || !textSpan) return;

      // 🔁 Show loading state
      saveBtn.disabled = true;
      spinner.classList.remove('d-none');
      textSpan.textContent = 'Saving...';

      const updatedData = {
        vendor_name: vendorInput.value,
        total_amount: amountInput.value,
        date: dateInput.value,
      };

      try {
        if (window.currentReceiptData?.documents?.[0]?.data) {
          window.currentReceiptData.documents[0].data = {
            ...window.currentReceiptData.documents[0].data,
            ...updatedData,
          };
        }

        await updateFirebaseAndUI(window.currentReceiptData); // Make sure this is an async function

        // Hide the form
        const reviewForm = document.getElementById('receipt-review-form');
        if (reviewForm) reviewForm.style.display = 'none';

        showToast('Receipt data saved successfully!', 'success');
      } catch (error) {
        console.error(error);
        showToast('Failed to save receipt.', 'danger');
      } finally {
        // ✅ Reset button state
        saveBtn.disabled = false;
        spinner.classList.add('d-none');
        textSpan.textContent = 'Confirm and Save';
      }
    };

    const handleCancel = () => {
      if (reviewForm) reviewForm.style.display = 'none';
      showToast('Review cancelled. Receipt not saved.', 'secondary');
    };

    if (formEl) formEl.addEventListener('submit', handleSubmit);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);

    return () => {
      if (formEl) formEl.removeEventListener('submit', handleSubmit);
      if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
    };
  }, []);

  return (
    <div className="">
      <div
        className="row mt-3"
        id="receipts-section"
        style={{ display: 'block' }}
      >
        <div className="col-12">
          <div className="card shadow-sm mb-4">
            <div className="card-header d-flex justify-content-between align-items-center py-3">
              <h5 className="mb-0">
                <i className="fas fa-receipt text-primary me-2"></i>Receipts
              </h5>
              <button
                className="btn btn-primary"
                id="receipt-upload-section-btn"
              >
                <i className="fas fa-plus me-1"></i> Upload New Receipt
              </button>
            </div>
            <div className="card-body">
              {/* <!-- Search and Filter Bar --> */}
              <div className="row mb-4">
                <div className="col-md-6 col-lg-4 mb-2 mb-lg-0">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control border-end-0"
                      id="receipt-search"
                      placeholder="Search merchant, items..."
                    />
                    <button
                      className="btn btn-outline-secondary border-start-0"
                      type="button"
                      id="receipt-search-btn"
                    >
                      <i
                        className={`fas fa-search ${darkMode ? 'text-secondary' : 'text-muted'}`}
                      ></i>
                    </button>
                  </div>
                </div>
                <div className="col-md-6 col-lg-3 mb-2 mb-lg-0">
                  <select
                    className="form-select"
                    id="receipt-category-filter"
                  >
                    <option value="">All Categories</option>
                    <option value="groceries">Groceries</option>
                    <option value="dining">Dining & Restaurants</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="transportation">Transportation</option>
                    <option value="utilities">Utilities</option>
                    <option value="housing">Housing & Rent</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="education">Education</option>
                    <option value="shopping">Shopping</option>
                    <option value="travel">Travel</option>
                    <option value="business">Business Expenses</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="col-md-6 col-lg-3 mb-2 mb-md-0">
                  <select
                    className="form-select"
                    id="receipt-date-filter"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="year">This Year</option>
                  </select>
                </div>
                <div className="col-md-6 col-lg-2">
                  <button
                    className="btn btn-outline-secondary w-100"
                    id="reset-filters-btn"
                  >
                    <i className="fas fa-undo me-1"></i> Reset
                  </button>
                </div>
              </div>

              <div
                id="no-receipts-message"
                style={{ display: 'none' }}
                className="text-center p-5"
              >
                <div className="mb-4">
                  <i className="fas fa-receipt fa-4x text-secondary opacity-50"></i>
                </div>
                <h5 className="text-muted mb-3">No receipts found</h5>
                <p className="text-muted mb-4">
                  Upload your first receipt to start tracking your expenses
                </p>
                <button
                  className="btn btn-primary btn-lg"
                  id="upload-first-receipt-btn"
                >
                  <i className="fas fa-plus me-2"></i> Upload Your First Receipt
                </button>
              </div>

              <div
                id="receipts-list"
                style={{ display: 'none' }}
              >
                <div className="table-responsive rounded">
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th className="ps-3">Date</th>
                        <th>Merchant</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th className="text-end pe-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="receipts-table-body">
                      {/* <!-- Receipts will be loaded here --> */}
                    </tbody>
                  </table>
                </div>
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div>
                    <span className="text-muted">
                      Showing <span id="receipts-count">0</span>
                      receipts
                    </span>
                  </div>
                  <nav aria-label="Receipt pagination">
                    <ul
                      className="pagination pagination-sm"
                      id="receipts-pagination"
                    >
                      {/* <!-- Pagination will be added here --> */}
                    </ul>
                  </nav>
                </div>
              </div>
            </div>
          </div>

          {/* <!-- Receipt Statistics Card --> */}
          <div className="card shadow-sm mb-4">
            <div className="card-header py-3">
              <h5 className="mb-0">
                <i className="fas fa-chart-pie text-primary me-2"></i>Receipt Summary
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                <StatisticCard
                  title="Total Receipts"
                  value={stats.totalReceipts.toString()}
                  id="total-receipts-count"
                  parentStyleClass={'mb-3 mb-lg-0'}
                  loading={statsLoading}
                />
                <StatisticCard
                  title="Total Spent"
                  value={'$' + stats.totalSpent.toFixed(2)}
                  id="total-receipts-amount"
                  parentStyleClass={'mb-3 mb-lg-0'}
                  loading={statsLoading}
                />
                <StatisticCard
                  title="Matched Receipts"
                  value={stats.matchedReceipts.toString()}
                  id="matched-receipts-count"
                  parentStyleClass={'mb-3 mb-md-0'}
                  loading={statsLoading}
                />
                <StatisticCard
                  title="Average Amount"
                  value={
                    '$' +
                    (stats.totalReceipts > 0
                      ? (stats.totalSpent / stats.totalReceipts).toFixed(2)
                      : 0)
                  }
                  id="average-receipt-amount"
                  loading={statsLoading}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <input
        type="file"
        id="receipt-file-input"
        accept="image/*,.pdf"
        style={{ display: 'none' }}
      />
      <div
        id="receipt-review-form"
        style={{ display: 'none', marginTop: '20px' }}
      >
        <h5>Review Receipt Details</h5>
        <form id="receiptForm">
          <div className="mb-3">
            <label
              htmlFor="vendor_name"
              className="form-label"
            >
              Vendor Name
            </label>
            <input
              type="text"
              className="form-control"
              id="vendor_name"
              name="vendor_name"
            />
          </div>
          <div className="mb-3">
            <label
              htmlFor="total_amount"
              className="form-label"
            >
              Total Amount
            </label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              id="total_amount"
              name="total_amount"
            />
          </div>
          <div className="mb-3">
            <label
              htmlFor="date"
              className="form-label"
            >
              Date
            </label>
            <input
              type="date"
              className="form-control"
              id="date"
              name="date"
            />
          </div>
          <div className="d-flex justify-content-between">
            <button
              type="submit"
              className="btn btn-primary"
              id="confirm-save-btn"
            >
              <span
                className="spinner-border spinner-border-sm me-2 d-none"
                id="save-spinner"
                role="status"
                aria-hidden="true"
              ></span>
              <span id="save-text">Confirm and Save</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              id="cancel-review-btn"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      <div
        id="toast-container"
        className="position-fixed bottom-0 end-0 p-3"
        style={{ zIndex: '1100' }}
      >
        <div
          id="main-toast"
          className="toast align-items-center text-white bg-primary border-0"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="d-flex">
            <div
              className="toast-body"
              id="toast-body"
            >
              Message here...
            </div>
            <button
              type="button"
              className="btn-close btn-close-white me-2 m-auto"
              data-bs-dismiss="toast"
              aria-label="Close"
            ></button>
          </div>
        </div>
      </div>

      {/* <!--- file upload start --> */}
      <ReceiptFileUploadModal loading={loading} />
    </div>
  );
};

export default ReceiptsComponent;
