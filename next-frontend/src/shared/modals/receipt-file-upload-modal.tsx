import { useDarkMode } from "@/providers/dark-mode-provider";
import React from "react";

function ReceiptFileUploadModal({ loading = false }: { loading?: boolean }) {
  const { darkMode } = useDarkMode();
  return (
    <div
      className="modal fade"
      id="receipt-upload-section"
      aria-hidden="true"
      aria-labelledby="receipt-upload-section-label"
    >
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <button
              type="button"
              className={`btn-close ${darkMode ? "btn-close-white" : ""}`}
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <div className="card mt-3">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="fas fa-file-upload text-primary me-2"></i>
                  Upload Receipt
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
                  <div
                    className="tab-pane fade show active"
                    id="local"
                    role="tabpanel"
                  >
                    <div className="mb-3">
                      <label htmlFor="receipt-file" className="form-label">
                        Upload from your device
                      </label>
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
                      <label htmlFor="receipt-url" className="form-label">
                        Paste a receipt URL
                      </label>
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
                      <label className="form-label">
                        Take a photo of your receipt
                      </label>
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
                          📷 No camera detected. Please connect a webcam to use
                          this feature.
                        </div>

                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm mb-2"
                          id="capture-photo-btn"
                        >
                          Capture Photo
                        </button>

                        {/* <!-- Hidden Canvas (used for converting to dataURL) --> */}
                        <canvas
                          id="photo-canvas"
                          width="640"
                          height="480"
                          style={{ display: "none" }}
                        ></canvas>

                        {/* <!-- Image Preview Area --> */}
                        <div
                          id="photo-preview-wrapper"
                          className="position-relative d-none"
                        >
                          <img
                            id="photo-preview"
                            alt="photo-preview"
                            className="img-thumbnail mt-2"
                            style={{ maxWidth: "100%" }}
                          />
                          <button
                            id="remove-photo-btn"
                            type="button"
                            className="btn btn-sm btn-danger position-absolute top-0 end-0"
                            style={{ transform: "translate(50%, -50%)" }}
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
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Uploading...
                      </>
                    ) : (
                      "Submit Receipt"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              data-bs-dismiss="modal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReceiptFileUploadModal;
