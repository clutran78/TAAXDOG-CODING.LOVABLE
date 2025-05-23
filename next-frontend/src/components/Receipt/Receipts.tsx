'use client';
import { auth, db } from '@/lib/firebase';
import { populateFormWithReceiptData, showToast, updateFirebaseAndUI, updateReceiptDashboard } from '@/services/helperFunction';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
// import 'bootstrap/dist/js/bootstrap.bundle.min';

declare global {
    interface Window {
        currentReceiptData: any;
        bootstrap: any;
    }
}

const ReceiptsComponent = () => {
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // @ts-expect-error
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
        onAuthStateChanged(auth, async (user) => {
            if (!user) return;

            try {
                const q = query(
                    collection(db, "receiptStats"),
                    where("userId", "==", user.uid)
                );

                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const userStats = snapshot.docs[0].data();
                    updateReceiptDashboard(userStats);
                }
            } catch (error) {
                console.error("Failed to load receipt stats:", error);
            }
        });

        init();
    }, []);

    useEffect(() => {
        const receiptFileInput = document.getElementById('receipt-file') as HTMLInputElement | null;
        const receiptUrlInput = document.getElementById('receipt-url') as HTMLInputElement | any;
        const photoCanvas = document.getElementById('photo-canvas') as HTMLCanvasElement | null;
        const photoPreview = document.getElementById('photo-preview') as HTMLImageElement | null;
        const captureBtn = document.getElementById('capture-photo-btn') as HTMLButtonElement | null;
        const submitBtn = document.querySelector('#receipt-upload-section button[type="submit"]') as HTMLButtonElement | null;
        const video = document.getElementById('camera-stream') as HTMLVideoElement | null;
        const cameraWarning = document.getElementById('camera-warning') as HTMLDivElement | null;
        const removeBtn = document.getElementById('remove-photo-btn') as HTMLButtonElement | null;

        let capturedPhoto = false;

        const validateForm = () => {
            const activeTab = document.querySelector('#uploadTab .nav-link.active')?.id;
            if (!submitBtn) return;

            if (activeTab === 'local-tab') {
                submitBtn.disabled = !receiptFileInput?.files?.length;
            } else if (activeTab === 'url-tab') {
                submitBtn.disabled = !(receiptUrlInput?.value?.trim().length > 0);
            } else if (activeTab === 'camera-tab') {
                submitBtn.disabled = !capturedPhoto;
            }
        };

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

        const startCamera = async () => {
            if (!video) return;
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const hasCamera = devices.some(device => device.kind === 'videoinput');

                if (!hasCamera) {
                    showCameraUnavailable();
                    return;
                }

                showCameraAvailable();
                //   const stream = await navigator.mediaDevices.getUserMedia({
                //     video: { width: { ideal: 1280 }, height: { ideal: 720 } }
                //   });

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },  // More flexible: tries rear, falls back to front
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30, max: 60 },
                    }
                });


                video.srcObject = stream;
                await video.play();
            } catch (err) {
                console.error('Camera access error:', err);
                showCameraUnavailable();
            }
        };

        const capturePhoto = () => {
            if (!photoCanvas || !video || !photoPreview) return;
            const context = photoCanvas.getContext('2d');
            if (!context) return;

            context.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);
            const dataURL = photoCanvas.toDataURL('image/jpeg');

            photoPreview.src = dataURL;
            const previewWrapper = document.getElementById('photo-preview-wrapper');
            if (previewWrapper) previewWrapper.classList.remove('d-none');

            photoPreview.style.display = 'block';
            capturedPhoto = true;
            validateForm();
        };

        const removeCapturedPhoto = () => {
            const previewWrapper = document.getElementById('photo-preview-wrapper');
            if (photoPreview && previewWrapper) {
                photoPreview.src = '';
                previewWrapper.classList.add('d-none');
                capturedPhoto = false;
                validateForm();
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

            if (file.size > 10 * 1024 * 1024) {
                showToast("File too large. Max 10MB allowed.", "danger");
                return;
            }


            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/receipts/upload/gemini`, {
                    method: 'POST',
                    body: formData,
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || `HTTP error! status: ${response.status}`);
                }

                showToast('Extraction Successful!', 'success');
                populateFormWithReceiptData(result.data);

                const formElement = document.getElementById('receipt-review-form');
                if (formElement) {
                    formElement.style.display = 'block';
                }

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

        const handleUploadFromActiveTab = async () => {
            const activeTab = document.querySelector('#uploadTab .nav-link.active')?.id;
            setLoading(true); // Start spinner
            try {
                if (activeTab === 'local-tab') {
                    if (!receiptFileInput?.files?.length) {
                        showToast('Please select a file to upload.', 'primary');
                        return;
                    }
                    await handleReceiptUpload(receiptFileInput.files[0]);
                } else if (activeTab === 'url-tab') {
                    const url = receiptUrlInput?.value.trim();
                    if (!url) {
                        showToast('Please paste a receipt URL.', 'primary');
                        return;
                    }

                    showToast('Fetching image from URL...', 'primary');
                    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/${url}`);
                    const blob = await response.blob();
                    const type = blob.type || 'image/jpeg';
                    const ext = type.split('/')[1] || 'jpg';
                    const file = new File([blob], `url-upload.${ext}`, { type });
                    await handleReceiptUpload(file);

                } else if (activeTab === 'camera-tab') {
                    if (!photoCanvas) return;
                    photoCanvas.toBlob(async (blob) => {
                        if (!blob) {
                            showToast('No photo captured.', 'primary');
                            return;
                        }
                        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
                        await handleReceiptUpload(file);
                    }, 'image/jpeg');
                }

                setLoading(false);
            } catch (error: any) {
                showToast(`Upload failed: ${error.message}`, 'danger');
                setLoading(false);
                console.error('Error during upload:', error);
            }
        };

        const tabChangeHandler = () => validateForm();

        document.querySelectorAll('#uploadTab .nav-link').forEach(tab =>
            tab.addEventListener('click', tabChangeHandler)
        );

        receiptFileInput?.addEventListener('change', validateForm);
        receiptUrlInput?.addEventListener('input', validateForm);
        captureBtn?.addEventListener('click', capturePhoto);
        removeBtn?.addEventListener('click', removeCapturedPhoto);
        submitBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            handleUploadFromActiveTab();
        });

        startCamera();
        validateForm();

        return () => {
            receiptFileInput?.removeEventListener('change', validateForm);
            receiptUrlInput?.removeEventListener('input', validateForm);
            captureBtn?.removeEventListener('click', capturePhoto);
            removeBtn?.removeEventListener('click', removeCapturedPhoto);
            submitBtn?.removeEventListener('click', handleUploadFromActiveTab);
            document.querySelectorAll('#uploadTab .nav-link').forEach(tab =>
                tab.removeEventListener('click', tabChangeHandler)
            );
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
                        <button type="submit" className="btn btn-primary" id="confirm-save-btn">
                            <span className="spinner-border spinner-border-sm me-2 d-none" id="save-spinner" role="status" aria-hidden="true"></span>
                            <span id="save-text">Confirm and Save</span>
                        </button>
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
                                    <h5 className="mb-0">
                                        <i className="fas fa-file-upload text-primary me-2"></i>Upload Receipt
                                    </h5>
                                </div>

                                <div className="card-body">
                                    {/* Tab Navigation */}
                                    <ul className="nav nav-tabs" id="uploadTab" role="tablist">
                                        <li className="nav-item" role="presentation">
                                            <button
                                                className="nav-link active"
                                                id="local-tab"
                                                data-bs-toggle="tab"
                                                data-bs-target="#local"
                                                type="button"
                                                role="tab"
                                            >
                                                From Device
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button
                                                className="nav-link"
                                                id="url-tab"
                                                data-bs-toggle="tab"
                                                data-bs-target="#url"
                                                type="button"
                                                role="tab"
                                            >
                                                From URL
                                            </button>
                                        </li>
                                        <li className="nav-item" role="presentation">
                                            <button
                                                className="nav-link"
                                                id="camera-tab"
                                                data-bs-toggle="tab"
                                                data-bs-target="#camera"
                                                type="button"
                                                role="tab"
                                            >
                                                Take Photo
                                            </button>
                                        </li>
                                    </ul>

                                    {/* Tab Content */}
                                    <div className="tab-content mt-3" id="uploadTabContent">
                                        {/* Local Upload */}
                                        <div className="tab-pane fade show active" id="local" role="tabpanel">
                                            <div className="mb-3">
                                                <label htmlFor="receipt-file" className="form-label">Upload from your device</label>
                                                <input
                                                    className="form-control"
                                                    type="file"
                                                    id="receipt-file"
                                                    accept="image/*,application/pdf"
                                                />
                                            </div>
                                        </div>

                                        {/* URL Upload */}
                                        <div className="tab-pane fade" id="url" role="tabpanel">
                                            <div className="mb-3">
                                                <label htmlFor="receipt-url" className="form-label">Paste a receipt URL</label>
                                                <input
                                                    className="form-control"
                                                    type="url"
                                                    id="receipt-url"
                                                    placeholder="https://example.com/receipt.jpg"
                                                />
                                            </div>
                                        </div>

                                        {/* Camera Upload */}
                                        <div className="tab-pane fade" id="camera" role="tabpanel">
                                            <div className="mb-3">
                                                <label className="form-label">Take a photo of your receipt</label>
                                                <div className="d-flex flex-column align-items-center position-relative">
                                                    <video
                                                        id="camera-stream"
                                                        width="100%"
                                                        height="240"
                                                        autoPlay
                                                        playsInline
                                                        className="mb-2"
                                                        style={{ border: "1px solid #ccc" }}
                                                    ></video>

                                                    <div
                                                        id="camera-warning"
                                                        className="alert alert-warning text-center d-none"
                                                    >
                                                        📷 No camera detected. Please connect a webcam to use this feature.
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-primary btn-sm mb-2"
                                                        id="capture-photo-btn"
                                                    >
                                                        Capture Photo
                                                    </button>

                                                    {/* <!-- Hidden Canvas (used for converting to dataURL) --> */}
                                                    <canvas id="photo-canvas" width="640" height="480" style={{ display: 'none' }}></canvas>

                                                    {/* <!-- Image Preview Area --> */}
                                                    <div id="photo-preview-wrapper" className="position-relative d-none">
                                                        <img
                                                            id="photo-preview"
                                                            alt="photo-preview"
                                                            className="img-thumbnail mt-2"
                                                            style={{ maxWidth: '100%' }}
                                                        />
                                                        <button
                                                            id="remove-photo-btn"
                                                            type="button"
                                                            className="btn btn-sm btn-danger position-absolute top-0 end-0"
                                                            style={{ transform: 'translate(50%, -50%)' }}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Submit */}
                                    <div className="text-end">
                                        <button
                                            type="submit"
                                            className="btn btn-success"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Uploading...
                                                </>
                                            ) : (
                                                'Submit Receipt'
                                            )}
                                        </button>
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
