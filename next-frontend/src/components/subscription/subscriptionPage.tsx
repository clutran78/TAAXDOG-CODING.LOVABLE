'use client';

import { useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { Button, InputGroup } from 'react-bootstrap';

const SubscriptionPage = () => {
    const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
    const [isAutoDetectEnabled, setIsAutoDetectEnabled] = useState(true);

    const handleAddSubscription = () => setShowSubscriptionForm(true);
    const handleCloseForm = () => setShowSubscriptionForm(false);
    const handleToggleChange = () => setIsAutoDetectEnabled(!isAutoDetectEnabled);

    return (
        <>
            <div className="container py-4">
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h3>
                        <i className="fas fa-repeat text-primary me-2"></i>Manage Subscriptions
                    </h3>
                </div>

                {/* Total Monthly Cost */}
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="card bg-light">
                            <div className="card-body d-flex justify-content-between align-items-center">
                                <h4 className="mb-0">Total Monthly Cost</h4>
                                <h3 className="text-primary mb-0" id="modal-total-subscriptions-value">
                                    $0.00
                                </h3>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Active Subscriptions */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">Active Subscriptions</h5>
                    <Button variant="primary" size="sm" onClick={handleAddSubscription}>
                        <i className="fas fa-plus me-1"></i> Add Subscription
                    </Button>
                </div>

                <div className="card my-3">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start">
                            <div>
                                <h5 className="mb-1">Dropbox</h5>
                                <span className="badge bg-light text-dark">Software</span>
                                <span className="badge bg-light text-dark ms-2">Monthly</span>
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
                                Auto-detected from 2 transactions. Avg. interval: 27 days.
                            </div>
                            <div>
                                <button className="btn btn-sm btn-outline-danger">
                                    <i className="fas fa-trash-alt"></i>
                                </button>
                                <button className="btn btn-sm btn-outline-primary ms-2">
                                    <i className="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="no-subscriptions-message" className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>No subscriptions found. Add or detect subscriptions.
                </div>

                {/* Add Subscription Form */}
                {showSubscriptionForm && (
                    <Formik
                        initialValues={{
                            subscriptionName: '',
                            subscriptionAmount: '',
                            subscriptionCategory: '',
                            subscriptionFrequency: 'monthly',
                            subscriptionStartDate: '',
                            subscriptionNextPayment: '',
                            subscriptionNotes: '',
                        }}
                        onSubmit={(values) => {
                            console.log('Submitted:', values);
                            setShowSubscriptionForm(false);
                        }}
                    >
                        {() => (
                            <Form>
                                <div className="card mt-4">
                                    <div className="card-header bg-light d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0">Add New Subscription</h5>
                                        <button type="button" className="btn-close" onClick={handleCloseForm}></button>
                                    </div>
                                    <div className="card-body">
                                        <div className="row mb-3">
                                            <div className="col-md-6">
                                                <label htmlFor="subscriptionName" className="form-label">Service Name</label>
                                                <Field type="text" name="subscriptionName" className="form-control" required />
                                            </div>
                                            <div className="col-md-6">
                                                <label htmlFor="subscriptionAmount" className="form-label">Monthly Amount</label>
                                                <InputGroup>
                                                    <InputGroup.Text>$</InputGroup.Text>
                                                    <Field type="number" name="subscriptionAmount" className="form-control" required />
                                                </InputGroup>
                                            </div>
                                        </div>

                                        <div className="row mb-3">
                                            <div className="col-md-6">
                                                <label htmlFor="subscriptionCategory" className="form-label">Category</label>
                                                <Field as="select" name="subscriptionCategory" className="form-select" required>
                                                    <option value="">Select category</option>
                                                    <option value="Entertainment">Entertainment</option>
                                                    <option value="Software">Software</option>
                                                    <option value="Streaming">Streaming</option>
                                                    <option value="Utilities">Utilities</option>
                                                    <option value="Shopping">Shopping</option>
                                                    <option value="Other">Other</option>
                                                </Field>
                                            </div>
                                            <div className="col-md-6">
                                                <label htmlFor="subscriptionFrequency" className="form-label">Billing Frequency</label>
                                                <Field as="select" name="subscriptionFrequency" className="form-select" required>
                                                    <option value="monthly">Monthly</option>
                                                    <option value="yearly">Yearly</option>
                                                    <option value="quarterly">Quarterly</option>
                                                    <option value="weekly">Weekly</option>
                                                </Field>
                                            </div>
                                        </div>

                                        <div className="row mb-3">
                                            <div className="col-md-6">
                                                <label htmlFor="subscriptionStartDate" className="form-label">Start Date</label>
                                                <Field type="date" name="subscriptionStartDate" className="form-control" required />
                                            </div>
                                            <div className="col-md-6">
                                                <label htmlFor="subscriptionNextPayment" className="form-label">Next Payment</label>
                                                <Field type="date" name="subscriptionNextPayment" className="form-control" required />
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <label htmlFor="subscriptionNotes" className="form-label">Notes (optional)</label>
                                            <Field as="textarea" name="subscriptionNotes" className="form-control" rows={2} />
                                        </div>

                                        <div className="text-end">
                                            <Button variant="secondary" onClick={handleCloseForm} className="me-2">Cancel</Button>
                                            <Button type="submit" variant="primary">Save Subscription</Button>
                                        </div>
                                    </div>
                                </div>
                            </Form>
                        )}
                    </Formik>
                )}

                {/* Auto-detect Settings */}
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
                                checked={isAutoDetectEnabled}
                                onChange={handleToggleChange}
                            />
                            <label className="form-check-label" htmlFor="auto-detect-subscriptions">
                                Automatically detect subscriptions from transactions
                            </label>
                        </div>
                        <p className="text-muted small">
                            We'll analyze your transactions and detect recurring payments.
                        </p>
                        <div className="alert alert-light border d-flex">
                            <div className="me-3">
                                <i className="fas fa-lightbulb text-warning fa-2x"></i>
                            </div>
                            <div>
                                <h6>How it works</h6>
                                <p className="small mb-0">
                                    We look for recurring transactions with similar amounts from the same merchant and suggest them as subscriptions.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* <!-- Right Side - Bank Accounts and Notifications --> */}
            <div className="col-md-6">
                {/* <!-- Bank Accounts Card --> */}
                <div className="card tile-card mb-3" data-tile-type="bank-accounts"
                    style={{ height: "calc(50% - 10px)" }}>
                    <div className="card-header">
                        Bank Accounts
                        <i className="fas fa-university text-primary"></i>
                    </div>
                    <div className="card-body">
                        <div className="scrollable-content">
                            <div id="bank-connections-container">
                                {/* <!-- Bank connections will be loaded here --> */}
                                <div className="text-center py-4" id="no-connections-message">
                                    <i className="fas fa-university fa-3x mb-3 text-muted"></i>
                                    <p>No bank accounts connected yet. Click the "Connect Bank" button in the
                                        top-right corner to get started.</p>
                                </div>
                                <div id="dashboard-connections-list" style={{display: "none"}}>
                                    {/* <!-- Bank connections will be loaded here --> */}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </>
    );
};

export default SubscriptionPage;
