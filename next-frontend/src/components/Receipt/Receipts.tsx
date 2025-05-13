'use client';
import {  populateFormWithReceiptData, showToast, updateLocalStorageAndUI, updateReceiptDashboard } from '@/services/helperFunction';
import React, { useEffect } from 'react';
// import 'bootstrap/dist/js/bootstrap.bundle.min';

declare global {
    interface Window {
        currentReceiptData: any;
        bootstrap: any;
    }
}

const ReceiptsComponent = () => {

    useEffect(() => {
  // @ts-ignore
  import('bootstrap/dist/js/bootstrap.bundle.min')
    .then(() => {
      console.log('Bootstrap loaded');
    })
    .catch((err) => console.error('Bootstrap failed to load', err));
}, []);


    useEffect(() => {
        debugger
        const init = async () => {
              const { default: Modal } = await import('bootstrap/js/dist/modal');

            const uploadBtn = document.getElementById('receipt-upload-section-btn');

            if (uploadBtn) {
                uploadBtn.addEventListener('click', () => {
                    const modalEl = document.getElementById('receipt-upload-section');
                    if (modalEl) {
                        const modalInstance = Modal.getInstance(modalEl) || new Modal(modalEl);
                        modalInstance.show();
                    }
                });
            }
        };
        const receiptStats = localStorage.getItem('receiptStats')
        if (receiptStats) {
            const storedStats = JSON.parse(receiptStats);
            if (storedStats) {
                updateReceiptDashboard(storedStats);
            }
        }

        init();
    }, []);

    useEffect(() => {
        const receiptFileInput = document.getElementById('receipt-file') as HTMLInputElement | null;
        const receiptUrlInput = document.getElementById('receipt-url') as HTMLInputElement | null;
        const photoCanvas = document.getElementById('photo-canvas') as HTMLCanvasElement | null;
        const submitReceiptBtn = document.querySelector('#receipt-upload-section button[type="submit"]') as HTMLButtonElement | null;
        const video = document.getElementById('camera-stream') as HTMLVideoElement | null;
        const captureBtn = document.getElementById('capture-photo-btn') as HTMLButtonElement | null;

        //   const startCamera = async () => {
        //     if (!video) return;
        //     try {
        //       const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        //       video.srcObject = stream;
        //     } catch (err) {
        //       console.error('Camera access error:', err);
        //       showToast('Could not access camera.', 'danger');
        //     }
        //   };

        const handleUploadFromActiveTab = async () => {
            const activeTab = document.querySelector('#uploadTab .nav-link.active')?.id;

            try {
                if (activeTab === 'local-tab') {
                    if (!receiptFileInput || !receiptFileInput.files?.length) {
                        showToast('Please select a file to upload.', 'primary');
                        return;
                    }
                    const file = receiptFileInput.files[0];
                    await handleReceiptUpload(file);

                } else if (activeTab === 'url-tab') {
                    const url = receiptUrlInput?.value.trim();
                    if (!url) {
                        showToast('Please paste a receipt URL.', 'primary');
                        return;
                    }

                    showToast('Fetching image from URL...', 'primary');

                    const response = await fetch(url);
                    const blob = await response.blob();

                    const contentType = blob.type || 'image/jpeg';
                    const extension = contentType.split('/')[1] || 'jpg';
                    const file = new File([blob], `url-upload.${extension}`, { type: contentType });

                    await handleReceiptUpload(file);

                }
                // else if (activeTab === 'camera-tab') {
                //     if (!photoCanvas) return;

                //     photoCanvas.toBlob(async (blob) => {
                //         if (!blob) {
                //             showToast('No photo captured.', 'primary');
                //             return;
                //         }

                //         const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
                //         await handleReceiptUpload(file);
                //     }, 'image/jpeg');
                // }
            } catch (error: any) {
                showToast(`Upload failed: ${error.message}`, 'danger');
                console.error('Error during upload:', error);
            }
        };


   const handleReceiptUpload = async (file: File | null) => {
    if (!file) {
        showToast("No file selected!", 'primary');
        return;
    }

    showToast('Uploading receipt...', 'primary');

    const formData = new FormData();
    formData.append('receipt', file);

    try {
        const response = await fetch('http://127.0.0.1:8080/api/receipts/upload/formx', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }

        showToast('Extraction Successful!', 'success');

        const data = result.data;
        populateFormWithReceiptData(data); // Ensure this function is typed properly

        const formElement = document.getElementById('receipt-review-form');
        if (formElement) {
            formElement.style.display = 'block';
        }

        // Dynamically import Bootstrap Modal and close the modal
        const { default: Modal } = await import('bootstrap/js/dist/modal');
        const modalEl = document.getElementById('receipt-upload-section');

        if (modalEl) {
            const modalInstance = Modal.getInstance(modalEl) || Modal.getOrCreateInstance(modalEl);
            modalInstance.hide();
        }

    } catch (error: any) {
        showToast(`Extraction Failed: ${error.message}`, 'danger');
        console.error('Receipt upload/extraction failed:', error);
    }
};

        


        const capturePhoto = () => {
            if (!photoCanvas || !video) return;

            const context = photoCanvas.getContext('2d');
            if (!context) return;

            photoCanvas.style.display = 'block';
            context.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);
        };

        // Attach listeners
        if (submitReceiptBtn) {
            submitReceiptBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleUploadFromActiveTab();
            });
        }

        if (captureBtn) {
            captureBtn.addEventListener('click', capturePhoto);
        }

        //   startCamera();

        return () => {
            // Cleanup
            submitReceiptBtn?.removeEventListener('click', handleUploadFromActiveTab);
            captureBtn?.removeEventListener('click', capturePhoto);
        };
    }, []);

    useEffect(() => {
        const formEl = document.getElementById('receiptForm') as HTMLFormElement | null;
        const cancelBtn = document.getElementById('cancel-review-btn') as HTMLButtonElement | null;
        const reviewForm = document.getElementById('receipt-review-form') as HTMLElement | null;

        const handleSubmit = (e: Event) => {
            e.preventDefault();

            const vendorInput = document.getElementById('vendor_name') as HTMLInputElement | null;
            const amountInput = document.getElementById('total_amount') as HTMLInputElement | null;
            const dateInput = document.getElementById('date') as HTMLInputElement | null;

            if (!vendorInput || !amountInput || !dateInput) return;

            const updatedData = {
                vendor_name: vendorInput.value,
                total_amount: amountInput.value,
                date: dateInput.value,
            };

            // Update the global data (assumes window.currentReceiptData exists)
            if (window.currentReceiptData?.documents?.[0]?.data) {
                window.currentReceiptData.documents[0].data = {
                    ...window.currentReceiptData.documents[0].data,
                    ...updatedData,
                };
            }

            // Call function to update localStorage and UI
            updateLocalStorageAndUI(window.currentReceiptData);

            // Hide the form
            if (reviewForm) reviewForm.style.display = 'none';

            showToast('Receipt data saved successfully!', 'success');
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
        <div className=''>
            <div className="row mt-3" id="receipts-section" style={{ display: "block" }}>
                <div className="col-12">
                    <div className="card shadow-sm mb-4">
                        <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
                            <h5 className="mb-0"><i className="fas fa-receipt text-primary me-2"></i>Receipts</h5>
                            <button className="btn btn-primary" id="receipt-upload-section-btn">
                                <i className="fas fa-plus me-1"></i> Upload New Receipt
                            </button>
                        </div>
                        <div className="card-body">
                            {/* <!-- Search and Filter Bar --> */}
                            <div className="row mb-4">
                                <div className="col-md-4 mb-2 mb-md-0">
                                    <div className="input-group">
                                        <input type="text" className="form-control border-end-0" id="receipt-search"
                                            placeholder="Search merchant, items..." />
                                        <button className="btn btn-outline-secondary border-start-0 bg-white"
                                            type="button" id="receipt-search-btn">
                                            <i className="fas fa-search text-muted"></i>
                                        </button>
                                    </div>
                                </div>
                                <div className="col-md-3 mb-2 mb-md-0">
                                    <select className="form-select" id="receipt-category-filter">
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
                                <div className="col-md-3 mb-2 mb-md-0">
                                    <select className="form-select" id="receipt-date-filter">
                                        <option value="all">All Time</option>
                                        <option value="today">Today</option>
                                        <option value="week">This Week</option>
                                        <option value="month">This Month</option>
                                        <option value="quarter">This Quarter</option>
                                        <option value="year">This Year</option>
                                    </select>
                                </div>
                                <div className="col-md-2">
                                    <button className="btn btn-outline-secondary w-100" id="reset-filters-btn">
                                        <i className="fas fa-undo me-1"></i> Reset
                                    </button>
                                </div>
                            </div>

                            <div id="no-receipts-message" style={{ display: "none" }} className="text-center p-5">
                                <div className="mb-4">
                                    <i className="fas fa-receipt fa-4x text-secondary opacity-50"></i>
                                </div>
                                <h5 className="text-muted mb-3">No receipts found</h5>
                                <p className="text-muted mb-4">Upload your first receipt to start tracking your expenses
                                </p>
                                <button className="btn btn-primary btn-lg" id="upload-first-receipt-btn">
                                    <i className="fas fa-plus me-2"></i> Upload Your First Receipt
                                </button>
                            </div>

                            <div id="receipts-list" style={{ display: "none" }}>
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
                                        <span className="text-muted">Showing <span id="receipts-count">0</span>
                                            receipts</span>
                                    </div>
                                    <nav aria-label="Receipt pagination">
                                        <ul className="pagination pagination-sm" id="receipts-pagination">
                                            {/* <!-- Pagination will be added here --> */}
                                        </ul>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* <!-- Receipt Statistics Card --> */}
                    <div className="card shadow-sm mb-4">
                        <div className="card-header bg-white py-3">
                            <h5 className="mb-0"><i className="fas fa-chart-pie text-primary me-2"></i>Receipt Summary</h5>
                        </div>
                        <div className="card-body">
                            <div className="row">
                                <div className="col-md-3 mb-3 mb-md-0">
                                    <div className="card border-0 bg-light h-100">
                                        <div className="card-body text-center">
                                            <h6 className="text-muted mb-2">Total Receipts</h6>
                                            <h3 id="total-receipts-count">0</h3>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3 mb-3 mb-md-0">
                                    <div className="card border-0 bg-light h-100">
                                        <div className="card-body text-center">
                                            <h6 className="text-muted mb-2">Total Spent</h6>
                                            <h3 id="total-receipts-amount">$0.00</h3>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3 mb-3 mb-md-0">
                                    <div className="card border-0 bg-light h-100">
                                        <div className="card-body text-center">
                                            <h6 className="text-muted mb-2">Matched Receipts</h6>
                                            <h3 id="matched-receipts-count">0</h3>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="card border-0 bg-light h-100">
                                        <div className="card-body text-center">
                                            <h6 className="text-muted mb-2">Average Amount</h6>
                                            <h3 id="average-receipt-amount">$0.00</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <input type="file" id="receipt-file-input" accept="image/*,.pdf" style={{ display: "none" }} />
            <div id="receipt-review-form" style={{ display: "none", marginTop: '20px' }}>
                <h5>Review Receipt Details</h5>
                <form id="receiptForm">
                    <div className="mb-3">
                        <label htmlFor="vendor_name" className="form-label">Vendor Name</label>
                        <input type="text" className="form-control" id="vendor_name" name="vendor_name" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="total_amount" className="form-label">Total Amount</label>
                        <input type="number" step="0.01" className="form-control" id="total_amount" name="total_amount" />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="date" className="form-label">Date</label>
                        <input type="date" className="form-control" id="date" name="date" />
                    </div>
                    <div className="d-flex justify-content-between">
                        <button type="submit" className="btn btn-primary">Confirm and Save</button>
                        <button type="button" className="btn btn-secondary" id="cancel-review-btn">Cancel</button>
                    </div>
                </form>
            </div>
            <div id="toast-container" className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: '1100' }}>
                <div id="main-toast" className="toast align-items-center text-white bg-primary border-0" role="alert"
                    aria-live="assertive" aria-atomic="true">
                    <div className="d-flex">
                        <div className="toast-body" id="toast-body">
                            Message here...
                        </div>
                        <button type="button" className="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"
                            aria-label="Close"></button>
                    </div>
                </div>
            </div>





            {/* <!--- file upload start --> */}
            <div className="modal fade" id="receipt-upload-section" aria-hidden="true" aria-labelledby="receipt-upload-section-label">
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header">
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="card mt-3">
                                <div className="card-header bg-light">
                                    <h5 className="mb-0"><i className="fas fa-file-upload text-primary me-2"></i>Upload Receipt</h5>
                                </div>
                                <div className="card-body">
                                    {/* <!-- Tab Navigation --> */}
                                    <ul className="nav nav-tabs" id="uploadTab" role="tablist">
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link active" id="local-tab" data-bs-toggle="tab"
                                                data-bs-target="#local" type="button" role="tab">From Device</button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="url-tab" data-bs-toggle="tab" data-bs-target="#url"
                                                type="button" role="tab">From URL</button>
                                        </li>
                                        {/* <li className="nav-item" role="presentation">
                                            <button className="nav-link" id="camera-tab" data-bs-toggle="tab"
                                                data-bs-target="#camera" type="button" role="tab">Take Photo</button>
                                        </li> */}
                                    </ul>

                                    {/* <!-- Tab Content --> */}
                                    <div className="tab-content mt-3" id="uploadTabContent">
                                        {/* <!-- Local Upload --> */}
                                        <div className="tab-pane fade show active" id="local" role="tabpanel">
                                            <div className="mb-3">
                                                <label htmlFor="receipt-file" className="form-label">Upload from your device</label>
                                                <input className="form-control" type="file" id="receipt-file"
                                                    accept="image/*,application/pdf" />
                                            </div>
                                        </div>

                                        {/* <!-- URL Upload --> */}
                                        <div className="tab-pane fade" id="url" role="tabpanel">
                                            <div className="mb-3">
                                                <label htmlFor="receipt-url" className="form-label">Paste a receipt URL</label>
                                                <input className="form-control" type="url" id="receipt-url"
                                                    placeholder="https://example.com/receipt.jpg" />
                                            </div>
                                        </div>

                                        {/* <!-- Camera Upload --> */}
                                        {/* <div className="tab-pane fade" id="camera" role="tabpanel">
                                            <div className="mb-3">
                                                <label className="form-label">Take a photo of your receipt</label>
                                                <div className="d-flex flex-column">
                                                    <video
                                                        id="camera-stream"
                                                        width="100%"
                                                        height="240"
                                                        autoPlay
                                                        playsInline
                                                        className="mb-2"
                                                        style={{ border: '1px solid #ccc' }}
                                                    ></video>
                                                    <button type="button" className="btn btn-outline-primary btn-sm mb-2"
                                                        id="capture-photo-btn">Capture Photo</button>
                                                    <canvas id="photo-canvas" width="640" height="480"
                                                        style={{ display: "none" }}></canvas>
                                                    <img id="photo-preview" className="img-thumbnail mt-2" style={{ display: "none" }} />
                                                </div>
                                            </div>
                                        </div> */}
                                    </div>

                                    <div className="text-end">
                                        <button type="submit" className="btn btn-success">Submit Receipt</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>



        </div>
    )
}

export default ReceiptsComponent
