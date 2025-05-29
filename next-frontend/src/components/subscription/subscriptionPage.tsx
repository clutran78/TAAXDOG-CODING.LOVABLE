"use client";
import { fetchSubscriptions } from "@/services/firebase-service";
import {
  loadSubscriptionsData,
  setupFinancialFeatureHandlers,
  setupSubscriptionFormHandlers,
  updateSubscriptionDisplays,
} from "@/services/helperFunction";
import React, { useEffect } from "react";

const SubscriptionsPage: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  useEffect(() => {
    const getSubscriptions = async () => {
      try {
        const subscriptions = await fetchSubscriptions();

        setupFinancialFeatureHandlers();
        loadSubscriptionsData();
        updateSubscriptionDisplays(subscriptions);
        setupSubscriptionFormHandlers();
      } catch (error) {
        console.error("Failed to fetch subscriptions:", error);
      } finally {
        setLoading(false);
      }
    };
    getSubscriptions();
  }, []);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">
          <i className="fas fa-repeat text-primary me-2"></i>Manage
          Subscriptions
        </h3>
      </div>

      {/* Total Monthly Cost */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-light">
            <div className="card-body d-flex justify-content-between align-items-center">
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

      {/* Active Subscriptions Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Active Subscriptions</h5>
        <button className="btn btn-primary btn-sm" id="add-subscription-btn">
          <i className="fas fa-plus me-1"></i> Add Subscription
        </button>
      </div>

      {/* No Subscriptions Message */}
      {loading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div id="no-subscriptions-message" className="alert alert-info">
          <i className="fas fa-info-circle me-2"></i>No subscriptions found. Add
          your first subscription or connect your bank to automatically detect
          them.
        </div>
      )}

      {/* Subscriptions List */}
      <div id="subscriptions-container">{/* Dynamic subscription cards */}</div>

      {/* Add Subscription Form */}
      <div
        id="add-subscription-form"
        className="card mt-4"
        style={{ display: "none" }}
      >
        <div className="card-header bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Add New Subscription</h5>
          </div>
          <button
            type="button"
            className="btn-close"
            id="close-subscription-form"
          ></button>
        </div>
        <div className="card-body">
          <form id="subscription-form">
            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="subscription-name" className="form-label">
                  Service Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="subscription-name"
                  required
                />
              </div>
              <div className="col-md-6">
                <label htmlFor="subscription-amount" className="form-label">
                  Monthly Amount
                </label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    className="form-control"
                    id="subscription-amount"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="subscription-category" className="form-label">
                  Category
                </label>
                <select
                  className="form-select"
                  id="subscription-category"
                  required
                >
                  <option value="">Select a category</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Software">Software</option>
                  <option value="Streaming">Streaming</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="col-md-6">
                <label htmlFor="subscription-frequency" className="form-label">
                  Billing Frequency
                </label>
                <select
                  className="form-select"
                  id="subscription-frequency"
                  required
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label htmlFor="subscription-start-date" className="form-label">
                  Start Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  id="subscription-start-date"
                  required
                />
              </div>
              <div className="col-md-6">
                <label
                  htmlFor="subscription-next-payment"
                  className="form-label"
                >
                  Next Payment Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  id="subscription-next-payment"
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="subscription-notes" className="form-label">
                Notes (Optional)
              </label>
              <textarea
                className="form-control"
                id="subscription-notes"
                rows={2}
              ></textarea>
            </div>

            <div className="text-end">
              <button type="submit" className="btn btn-primary">
                Save Subscription
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Auto-Detection Settings */}
      <div className="card mt-4">
        <div className="card-header bg-light">
          <h5 className="mb-0">Auto-Detection Settings</h5>
        </div>
        <div className="card-body">
          <div className="form-check form-switch mb-3">
            <input
              className="form-check-input"
              type="checkbox"
              id="auto-detect-subscriptions"
              defaultChecked
            />
            <label
              className="form-check-label"
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
                  The app looks for recurring transactions with similar amounts
                  from the same merchant. When a pattern is detected, it
                  suggests adding them as subscriptions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page Footer Buttons */}
      <div className="d-flex justify-content-end mt-4">
        <button
          type="button"
          className="btn btn-primary"
          id="scan-for-subscriptions-btn"
        >
          <i className="fas fa-search me-1"></i>Scan for Subscriptions
        </button>
      </div>
    </div>
  );
};

export default SubscriptionsPage;
