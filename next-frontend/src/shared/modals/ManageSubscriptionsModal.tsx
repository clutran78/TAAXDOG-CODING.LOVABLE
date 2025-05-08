import React, { useState } from "react";
import { Modal, Button, Form, InputGroup } from "react-bootstrap";
import { Formik, Field } from "formik";

interface ManageSubscriptionsModalProps {
  show: boolean;
  handleClose: () => void;
}

const ManageSubscriptionsModal: React.FC<ManageSubscriptionsModalProps> = ({
  show,
  handleClose,
}) => {
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);

  // Function to show the subscription form
  const handleAddSubscription = () => {
    setShowSubscriptionForm(true);
  };

  // Function to close the subscription form
  const handleCloseForm = () => {
    setShowSubscriptionForm(false);
  };

  const [isAutoDetectEnabled, setIsAutoDetectEnabled] = useState(true);

  // Handle toggle change
  const handleToggleChange = () => {
    setIsAutoDetectEnabled(!isAutoDetectEnabled);
  };

  return (
    <Modal show={show} onHide={handleClose} className="modal-lg">
      <div className="modal-header">
        <h5 className="modal-title" id="subscriptions-modal-label">
          <i className="fas fa-repeat text-primary me-2"></i>Manage
          Subscriptions
        </h5>
        <button
          type="button"
          className="btn-close"
          onClick={handleClose}
        ></button>
      </div>

      <div className="modal-body">
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-light">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Total Monthly Cost</h4>
                  <h3
                    className="text-primary mb-0"
                    id="modal-total-subscriptions-value"
                  >
                    $0.00
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">Active Subscriptions</h5>
          <Button variant="primary" size="sm" onClick={handleAddSubscription}>
            <i className="fas fa-plus me-1"></i> Add Subscription
          </Button>
        </div>
        <div
          className="card my-3 subscription-card"
          data-subscription-id="sub-ou0wshz"
        >
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h5 className="mb-1">Dropbox</h5>
                <span className="badge bg-light text-dark">Software</span>
                <span className="badge bg-light text-dark text-capitalize">
                  monthly
                </span>
              </div>
              <h4 className="text-primary mb-0">$9.99</h4>
            </div>
            <div className="row mt-3">
              <div className="col-md-4">
                <div className="text-muted small">Started on</div>
                <div>4/8/2025</div>
              </div>
              <div className="col-md-4">
                <div className="text-muted small">Next payment</div>
                <div>6/1/2025</div>
              </div>
              <div className="col-md-4">
                <div className="text-muted small">Status</div>
                <div>
                  <span className="badge bg-success">In 24 days</span>
                </div>
              </div>
            </div>
            <div className="mt-3 d-flex justify-content-between align-items-center">
              <div className="text-muted small">
                Note: Auto-detected from 2 transactions. Average interval: 27
                days.
              </div>
              <div>
                <button
                  className="btn btn-sm btn-outline-danger delete-subscription-btn"
                  data-subscription-index="1"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
                <button
                  className="btn btn-sm btn-outline-primary edit-subscription-btn ms-1"
                  data-subscription-index="1"
                >
                  <i className="fas fa-edit"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div id="no-subscriptions-message" className="alert alert-info">
          <i className="fas fa-info-circle me-2"></i>No subscriptions found. Add
          your first subscription or connect your bank to automatically detect
          them.
        </div>

        {showSubscriptionForm && (
          <Formik
            initialValues={{
              subscriptionName: "",
              subscriptionAmount: "",
              subscriptionCategory: "",
              subscriptionFrequency: "monthly",
              subscriptionStartDate: "",
              subscriptionNextPayment: "",
              subscriptionNotes: "",
            }}
            onSubmit={(values) => {
              console.log(values);
            }}
          >
            {() => (
              <Form>
                <div className="card mt-4">
                  <div className="card-header bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">Add New Subscription</h5>
                      <button
                        type="button"
                        className="form-close"
                        onClick={handleCloseForm}
                      ></button>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label
                          htmlFor="subscriptionName"
                          className="form-label"
                        >
                          Service Name
                        </label>
                        <Field
                          type="text"
                          className="form-control"
                          id="subscriptionName"
                          name="subscriptionName"
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label
                          htmlFor="subscriptionAmount"
                          className="form-label"
                        >
                          Monthly Amount
                        </label>
                        <InputGroup>
                          <InputGroup.Text>$</InputGroup.Text>
                          <Field
                            type="number"
                            className="form-control"
                            id="subscriptionAmount"
                            name="subscriptionAmount"
                            min="0.01"
                            step="0.01"
                            required
                          />
                        </InputGroup>
                      </div>
                    </div>

                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label
                          htmlFor="subscriptionCategory"
                          className="form-label"
                        >
                          Category
                        </label>
                        <Field
                          as="select"
                          className="form-select"
                          id="subscriptionCategory"
                          name="subscriptionCategory"
                          required
                        >
                          <option value="">Select a category</option>
                          <option value="Entertainment">Entertainment</option>
                          <option value="Software">Software</option>
                          <option value="Streaming">Streaming</option>
                          <option value="Utilities">Utilities</option>
                          <option value="Shopping">Shopping</option>
                          <option value="Other">Other</option>
                        </Field>
                      </div>

                      <div className="col-md-6">
                        <label
                          htmlFor="subscriptionFrequency"
                          className="form-label"
                        >
                          Billing Frequency
                        </label>
                        <Field
                          as="select"
                          className="form-select"
                          id="subscriptionFrequency"
                          name="subscriptionFrequency"
                          required
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="weekly">Weekly</option>
                        </Field>
                      </div>
                    </div>

                    <div className="row mb-3">
                      <div className="col-md-6">
                        <label
                          htmlFor="subscriptionStartDate"
                          className="form-label"
                        >
                          Start Date
                        </label>
                        <Field
                          type="date"
                          className="form-control"
                          id="subscriptionStartDate"
                          name="subscriptionStartDate"
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label
                          htmlFor="subscriptionNextPayment"
                          className="form-label"
                        >
                          Next Payment Date
                        </label>
                        <Field
                          type="date"
                          className="form-control"
                          id="subscriptionNextPayment"
                          name="subscriptionNextPayment"
                          required
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label htmlFor="subscriptionNotes" className="form-label">
                        Notes (Optional)
                      </label>
                      <Field
                        as="textarea"
                        className="form-control"
                        id="subscriptionNotes"
                        name="subscriptionNotes"
                        rows={2}
                      />
                    </div>

                    <div className="text-end">
                      <Button
                        variant="secondary"
                        onClick={handleCloseForm}
                        className="me-2"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" variant="primary">
                        Save Subscription
                      </Button>
                    </div>
                  </div>
                </div>
              </Form>
            )}
          </Formik>
        )}

        <div className="card mt-4">
          <div className="card-header bg-light">
            <h5 className="mb-0">Auto-Detection Settings</h5>
          </div>

          <div className="card-body">
            {/* Auto Detection Toggle */}
            <div className="form-check form-switch mb-3">
              <input
                className="form-check-input cursor-pointer"
                type="checkbox"
                id="auto-detect-subscriptions"
                checked={isAutoDetectEnabled} // Bind to state
                onChange={handleToggleChange} // Handle toggle change
              />
              <label
                className="form-check-label cursor-pointer"
                htmlFor="auto-detect-subscriptions"
              >
                Automatically detect subscriptions from transactions
              </label>
            </div>
            <p className="text-muted small">
              The app will analyze your transactions and automatically detect
              recurring payments that might be subscriptions. You can review and
              confirm these detections.
            </p>
            <div className="alert alert-light border">
              <div className="d-flex">
                <div className="me-3">
                  <i className="fas fa-lightbulb text-warning fa-2x"></i>
                </div>
                <div>
                  <h6>How it works</h6>
                  <p className="small mb-0">
                    The app looks for recurring transactions with similar
                    amounts from the same merchant. When a pattern is detected,
                    it suggests adding them as subscriptions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div></div>
      </div>

      <div className="modal-footer">
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        <Button variant="primary">
          <i className="fas fa-search me-1"></i>Scan for Subscriptions
        </Button>
      </div>
    </Modal>
  );
};

export default ManageSubscriptionsModal;
