"use client";
import React, { useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { initializeEmptyTaxProfile, loadTaxProfileData, setupTaxProfileForm } from '@/services/helperFunction';

const TaxProfile: React.FC = () => {

    useEffect(() => {
        if (!localStorage.getItem('taxProfileData')) {
            initializeEmptyTaxProfile();
        } else {
            loadTaxProfileData();
        }
        setupTaxProfileForm(); // You can progressively migrate this to React logic
    }, []);

    const goToNextTab = (fromId: string, toId: string) => {
        const fromTab = document.getElementById(fromId);
        const toTab = document.getElementById(toId);
        if (fromTab && toTab) {
            fromTab.classList.remove('active');
            document.getElementById(fromTab.getAttribute('data-bs-target')!.substring(1))?.classList.remove('show', 'active');

            toTab.classList.add('active');
            document.getElementById(toTab.getAttribute('data-bs-target')!.substring(1))?.classList.add('show', 'active');
        }
    };

    return (
        <div className="container my-4">
            <div className="bg-primary text-white p-3 rounded">
                <h2><i className="fas fa-file-invoice-dollar me-2"></i> Your Tax Profile</h2>
            </div>

            <div className="alert alert-info mt-3">
                <i className="fas fa-info-circle me-2"></i>
                Complete your tax profile to help our AI identify potential tax deductions and optimize your financial planning.
            </div>

            <form id="tax-profile-form" className="needs-validation" noValidate>

                {/* Nav Tabs */}
                <ul className="nav nav-tabs mb-4" id="taxProfileTabs" role="tablist">
                    <li className="nav-item" role="presentation">
                        <button className="nav-link active" id="personal-tab" data-bs-toggle="tab" data-bs-target="#personal-content" type="button" role="tab">
                            Personal Information
                        </button>
                    </li>
                    <li className="nav-item" role="presentation">
                        <button className="nav-link" id="income-tab" data-bs-toggle="tab" data-bs-target="#income-content" type="button" role="tab">
                            Income
                        </button>
                    </li>
                    <li className="nav-item" role="presentation">
                        <button className="nav-link" id="deductions-tab" data-bs-toggle="tab" data-bs-target="#deductions-content" type="button" role="tab">
                            Deductions
                        </button>
                    </li>
                    <li className="nav-item" role="presentation">
                        <button className="nav-link" id="offsets-tab" data-bs-toggle="tab" data-bs-target="#offsets-content" type="button" role="tab">
                            Tax Offsets
                        </button>
                    </li>
                    <li className="nav-item" role="presentation">
                        <button className="nav-link" id="medicare-tab" data-bs-toggle="tab" data-bs-target="#medicare-content" type="button" role="tab">
                            Medicare
                        </button>
                    </li>
                    <li className="nav-item" role="presentation">
                        <button className="nav-link" id="hecs-tab" data-bs-toggle="tab" data-bs-target="#hecs-content" type="button" role="tab">
                            HELP/HECS
                        </button>
                    </li>
                    <li className="nav-item" role="presentation">
                        <button className="nav-link" id="additional-tab" data-bs-toggle="tab" data-bs-target="#additional-content" type="button" role="tab">
                            Additional Info
                        </button>
                    </li>
                </ul>

                <div className="tab-content" id="taxProfileTabsContent">

                    {/* Personal Info Tab */}

                    <div className="tab-pane fade show active" id="personal-content" role="tabpanel">
                        <h4 className="mb-3">Basic Identification</h4>
                        <div className="row g-3">
                            <div className="col-md-2">
                                <label htmlFor="title" className="form-label">Title</label>
                                <select className="form-select" id="title" required>
                                    <option value="">Choose...</option>
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Miss">Miss</option>
                                    <option value="Ms">Ms</option>
                                    <option value="Dr">Dr</option>
                                </select>
                                <div className="invalid-feedback">Please select a title.</div>
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="family-name" className="form-label">Family Name/Surname</label>
                                <input type="text" className="form-control" id="family-name" maxLength={40} required />
                                <div className="invalid-feedback">Please enter your family name.</div>
                            </div>
                            <div className="col-md-3">
                                <label htmlFor="first-given-name" className="form-label">First Given Name</label>
                                <input type="text" className="form-control" id="first-given-name" maxLength={40} required />
                                <div className="invalid-feedback">Please enter your first name.</div>
                            </div>
                            <div className="col-md-3">
                                <label htmlFor="other-given-names" className="form-label">Other Given Names</label>
                                <input type="text" className="form-control" id="other-given-names" maxLength={40} />
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="previous-names" className="form-label">Previous Names (if applicable)</label>
                                <input type="text" className="form-control" id="previous-names" />
                                <small className="text-muted">Maiden, former married names, etc.</small>
                            </div>
                            <div className="col-md-3">
                                <label htmlFor="date-of-birth" className="form-label">Date of Birth</label>
                                <input type="date" className="form-control" id="date-of-birth" required />
                                <div className="invalid-feedback">Please enter your date of birth.</div>
                            </div>
                            <div className="col-md-3">
                                <label htmlFor="tfn" className="form-label">Tax File Number (TFN)</label>
                                <input type="text" className="form-control" id="tfn" pattern="[0-9]{9}" required />
                                <div className="invalid-feedback">Please enter a valid 9-digit TFN.</div>
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="abn" className="form-label">ABN (if applicable)</label>
                                <input type="text" className="form-control" id="abn" pattern="[0-9]{11}" />
                            </div>
                        </div>


                        <h4 className="mb-3 mt-4">Contact Details</h4>

                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="residential-address" className="form-label">Residential Address</label>
                                <input type="text" className="form-control" id="residential-address" required />
                                <div className="invalid-feedback">Please enter your residential address.</div>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="postal-address" className="form-label">Postal Address</label>
                                <input type="text" className="form-control" id="postal-address" />
                                <small className="text-muted">If different from residential address</small>
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="email" className="form-label">Email Address</label>
                                <input type="email" className="form-control" id="email" required />
                                <div className="invalid-feedback">Please enter a valid email address.</div>
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="mobile" className="form-label">Mobile Phone Number</label>
                                <input type="tel" className="form-control" id="mobile" pattern="[0-9]{10}" required />
                                <div className="invalid-feedback">Please enter a valid 10-digit mobile number.</div>
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="alternative-phone" className="form-label">Alternative Phone Number</label>
                                <input type="tel" className="form-control" id="alternative-phone" />
                            </div>
                        </div>

                        <h4 className="mb-3 mt-4">Filing Status</h4>

                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label">Australian Resident for Tax Purposes?</label>
                                <div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="radio" name="residency-status" id="resident-yes" value="yes" required />
                                        <label className="form-check-label" htmlFor="resident-yes">Yes</label>
                                    </div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="radio" name="residency-status" id="resident-no" value="no" />
                                        <label className="form-check-label" htmlFor="resident-no">No</label>
                                    </div>
                                    <div className="invalid-feedback">Please select your residency status.</div>
                                </div>
                            </div>

                            <div className="col-md-4">
                                <label className="form-label">Claiming Tax-Free Threshold?</label>
                                <div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="radio" name="tax-free-threshold" id="threshold-yes" value="yes" required />
                                        <label className="form-check-label" htmlFor="threshold-yes">Yes</label>
                                    </div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="radio" name="tax-free-threshold" id="threshold-no" value="no" />
                                        <label className="form-check-label" htmlFor="threshold-no">No</label>
                                    </div>
                                    <div className="invalid-feedback">Please select your tax-free threshold status.</div>
                                </div>
                            </div>
                        </div>


                        <div className="row g-3 mt-2">
                            <div className="col-md-6">
                                <div className="form-check">
                                    <input className="form-check-input" type="checkbox" id="has-spouse" />
                                    <label className="form-check-label" htmlFor="has-spouse">
                                        I have a spouse during this tax year
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div id="spouse-details" className="row g-3 mt-2" style={{ display: 'none' }}>
                            <div className="col-md-4">
                                <label htmlFor="spouse-name" className="form-label">Spouse&apos;s Full Name</label>
                                <input type="text" className="form-control" id="spouse-name" />
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="spouse-tfn" className="form-label">Spouse&apos;s TFN</label>
                                <input type="text" className="form-control" id="spouse-tfn" pattern="[0-9]{9}" />
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="spouse-income" className="form-label">Spouse&apos;s Taxable Income</label>
                                <input type="number" className="form-control" id="spouse-income" min="0" step="0.01" />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">Spouse for Full or Partial Year?</label>
                                <div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="radio" name="spouse-period" id="spouse-full" value="full" />
                                        <label className="form-check-label" htmlFor="spouse-full">Full Year</label>
                                    </div>
                                    <div className="form-check form-check-inline">
                                        <input className="form-check-input" type="radio" name="spouse-period" id="spouse-partial" value="partial" />
                                        <label className="form-check-label" htmlFor="spouse-partial">Partial Year</label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="row g-3 mt-2">
                            <div className="col-md-6">
                                <div className="form-check">
                                    <input className="form-check-input" type="checkbox" id="has-dependents" />
                                    <label className="form-check-label" htmlFor="has-dependents">
                                        I have dependent children
                                    </label>
                                </div>
                            </div>
                        </div>


                        <div id="dependent-details" className="row g-3 mt-2" style={{ display: 'none' }}>
                            <div className="col-md-12">
                                <button type="button" className="btn btn-sm btn-outline-primary" id="add-dependent">
                                    <i className="fas fa-plus"></i> Add Dependent
                                </button>
                            </div>
                            <div className="col-md-12" id="dependents-container">
                                {/* Dependent children will be added here */}
                            </div>
                        </div>

                        <h4 className="mb-3 mt-4">Bank Account for Refunds</h4>

                        <div className="row g-3">
                            <div className="col-md-3">
                                <label htmlFor="bank-bsb" className="form-label">BSB</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="bank-bsb"
                                    pattern="[0-9]{6}"
                                    required
                                />
                                <div className="invalid-feedback">Please enter a valid BSB (6 digits).</div>
                            </div>
                            <div className="col-md-5">
                                <label htmlFor="bank-account" className="form-label">Account Number</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="bank-account"
                                    pattern="[0-9]+"
                                    required
                                />
                                <div className="invalid-feedback">Please enter a valid account number.</div>
                            </div>
                            <div className="col-md-4">
                                <label htmlFor="bank-name" className="form-label">Account Name</label>
                                <input type="text" className="form-control" id="bank-name" required />
                                <div className="invalid-feedback">Please enter the account name.</div>
                            </div>
                        </div>

                        <div className="d-flex justify-content-between mt-4">
                            <button className="btn btn-primary" type='button' onClick={(e) => goToNextTab('personal-tab', 'income-tab')}>
                                Next: Income <i className="fas fa-arrow-right ms-2"></i>
                            </button>
                        </div>



                    </div>

                    {/* ======================================================================================================== */}

                    <div className="tab-pane fade" id="income-content" role="tabpanel">
                        <h4 className="mb-3">Employment Income</h4>
                        <div className="row g-3 mb-3">
                            <div className="col-md-12">
                                <button type="button" className="btn btn-sm btn-outline-primary" id="add-employer">
                                    <i className="fas fa-plus"></i> Add Employer
                                </button>
                            </div>
                            <div className="col-md-12" id="employers-container">
                                {/* Employer details will be added here */}
                            </div>
                        </div>

                        <h4 className="mb-3 mt-4">Investment Income</h4>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="interest-income" className="form-label">Interest from Bank Accounts</label>
                                <input type="number" className="form-control" id="interest-income" min="0" step="0.01" />
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="dividend-income" className="form-label">Dividends from Investments</label>
                                <input type="number" className="form-control" id="dividend-income" min="0" step="0.01" />
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="trust-income" className="form-label">Trust Distributions</label>
                                <input type="number" className="form-control" id="trust-income" min="0" step="0.01" />
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="rental-income" className="form-label">Rental Property Income</label>
                                <input type="number" className="form-control" id="rental-income" min="0" step="0.01" />
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="capital-gains" className="form-label">Capital Gains</label>
                                <input type="number" className="form-control" id="capital-gains" min="0" step="0.01" />
                                <small className="text-muted">Including cryptocurrency</small>
                            </div>
                        </div>

                        <h4 className="mb-3 mt-4">Government Payments</h4>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="govt-payment-type" className="form-label">Types of Pensions or Benefits</label>
                                <input type="text" className="form-control" id="govt-payment-type" />
                            </div>
                            <div className="col-md-3">
                                <label htmlFor="govt-payment-amount" className="form-label">Amount Received</label>
                                <input type="number" className="form-control" id="govt-payment-amount" min="0" step="0.01" />
                            </div>
                            <div className="col-md-3">
                                <label htmlFor="govt-payment-tax" className="form-label">Tax Withheld</label>
                                <input type="number" className="form-control" id="govt-payment-tax" min="0" step="0.01" />
                            </div>
                        </div>

                        <h4 className="mb-3 mt-4">Other Income</h4>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="foreign-income" className="form-label">Foreign Income</label>
                                <input type="number" className="form-control" id="foreign-income" min="0" step="0.01" />
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="business-income" className="form-label">Business Income</label>
                                <input type="number" className="form-control" id="business-income" min="0" step="0.01" />
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="super-income" className="form-label">Superannuation Income</label>
                                <input type="number" className="form-control" id="super-income" min="0" step="0.01" />
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="partnership-income" className="form-label">Income from Partnerships and Trusts</label>
                                <input type="number" className="form-control" id="partnership-income" min="0" step="0.01" />
                            </div>
                        </div>

                        <div className="d-flex justify-content-between mt-4">
                            <button type="button" className="btn btn-outline-secondary" onClick={() => goToNextTab('income-tab', 'personal-tab')}>
                                <i className="fas fa-arrow-left me-2"></i> Previous: Personal
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => goToNextTab('income-tab', 'deductions-tab')}>
                                Next: Deductions <i className="fas fa-arrow-right ms-2"></i>
                            </button>
                        </div>
                    </div>


                    {/* //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}

                    {/* Deductions Tab */}
                    {/* <div className="tab-pane fade" id="deductions-content" role="tabpanel">
                    <div className="form-check">
                        <input className="form-check-input" type="checkbox" id="use-car-for-work" checked={useCarForWork} onChange={() => setUseCarForWork(!useCarForWork)} />
                        <label className="form-check-label" htmlFor="use-car-for-work">I use my car for work purposes</label>
                    </div>

                    {useCarForWork && (
                        <div className="row mt-3">
                            <div className="col-md-4">
                                <label className="form-label">Car Make</label>
                                <input type="text" className="form-control" />
                            </div>
                        </div>
                    )}

                    <div className="d-flex justify-content-between mt-4">
                        <button className="btn btn-outline-secondary" onClick={() => goToNextTab('deductions-tab', 'income-tab')}>
                            <i className="fas fa-arrow-left me-2"></i> Previous: Income
                        </button>
                        <button className="btn btn-primary" onClick={() => goToNextTab('deductions-tab', 'offsets-tab')}>
                            Next: Tax Offsets <i className="fas fa-arrow-right ms-2"></i>
                        </button>
                    </div>
                </div> */}
                    <div className="tab-pane fade" id="deductions-content" role="tabpanel">
                        <h4 className="mb-3">Work-Related Expenses</h4>

                        {/* Car Expenses */}
                        <div className="card mb-3">
                            <div className="card-header bg-light">
                                <h5 className="mb-0">Car Expenses (D1)</h5>
                            </div>
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-md-12">
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" id="use-car-for-work" />
                                            <label className="form-check-label" htmlFor="use-car-for-work">
                                                I use my car for work purposes
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div id="car-expense-details" className="row g-3 mt-2" style={{ display: 'none' }}>
                                    <div className="col-md-4">
                                        <label htmlFor="car-make" className="form-label">Car Make and Model</label>
                                        <input type="text" className="form-control" id="car-make" />
                                    </div>
                                    <div className="col-md-4">
                                        <label htmlFor="car-registration" className="form-label">Registration Number</label>
                                        <input type="text" className="form-control" id="car-registration" />
                                    </div>
                                    <div className="col-md-4">
                                        <label htmlFor="car-method" className="form-label">Calculation Method</label>
                                        <select className="form-select" id="car-method">
                                            <option value="cents">Cents per Kilometer</option>
                                            <option value="logbook">Logbook Method</option>
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label htmlFor="business-km" className="form-label">Business Kilometers</label>
                                        <input type="number" className="form-control" id="business-km" min="0" />
                                    </div>
                                    <div className="col-md-8">
                                        <label htmlFor="car-expenses" className="form-label">Total Car Expenses Claimed</label>
                                        <input type="number" className="form-control" id="car-expenses" min="0" step="0.01" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Additional deduction sections */}
                        <div className="alert alert-info">
                            <i className="fas fa-info-circle me-2"></i> Additional deduction sections will include travel expenses, clothing
                            expenses, self-education, and other work-related expenses.
                        </div>

                        <div className="d-flex justify-content-between mt-4">
                            <button type="button" className="btn btn-outline-secondary" onClick={() => goToNextTab('deductions-tab', 'income-tab')}>
                                <i className="fas fa-arrow-left me-2"></i> Previous: Income
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => goToNextTab('deductions-tab', 'offsets-tab')}>
                                Next: Tax Offsets <i className="fas fa-arrow-right ms-2"></i>
                            </button>
                        </div>
                    </div>

                    {/* //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}

                    {/* offsets-content */}

                    <div className="tab-pane fade" id="offsets-content" role="tabpanel">
                        <div className="alert alert-info">
                            <i className="fas fa-info-circle me-2"></i>
                            This section will contain tax offset fields including private health insurance details, spouse details for offsets, and other tax offset information.
                        </div>

                        <div className="d-flex justify-content-between mt-4">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => goToNextTab('offsets-tab', 'deductions-tab')}
                            >
                                <i className="fas fa-arrow-left me-2"></i> Previous: Deductions
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => goToNextTab('offsets-tab', 'medicare-tab')}
                            >
                                Next: Medicare <i className="fas fa-arrow-right ms-2"></i>
                            </button>
                        </div>
                    </div>

                    {/* //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}

                    {/* medicare-content */}

                    <div className="tab-pane fade" id="medicare-content" role="tabpanel">
                        <div className="alert alert-info">
                            <i className="fas fa-info-circle me-2"></i>
                            This section will contain Medicare levy information and private health insurance details.
                        </div>

                        <div className="d-flex justify-content-between mt-4">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => goToNextTab('medicare-tab', 'offsets-tab')}
                            >
                                <i className="fas fa-arrow-left me-2"></i> Previous: Tax Offsets
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => goToNextTab('medicare-tab', 'hecs-tab')}
                            >
                                Next: HELP/HECS <i className="fas fa-arrow-right ms-2"></i>
                            </button>
                        </div>
                    </div>


                    {/* //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}

                    {/* //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}

                    {/* hecs-content */}

                    <div className="tab-pane fade" id="hecs-content" role="tabpanel">
                        <div className="alert alert-info">
                            <i className="fas fa-info-circle me-2"></i>
                            This section will contain HELP/HECS debt information and student loan details.
                        </div>

                        <div className="d-flex justify-content-between mt-4">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => goToNextTab('hecs-tab', 'medicare-tab')}
                            >
                                <i className="fas fa-arrow-left me-2"></i> Previous: Medicare
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => goToNextTab('hecs-tab', 'additional-tab')}
                            >
                                Next: Additional Info <i className="fas fa-arrow-right ms-2"></i>
                            </button>
                        </div>
                    </div>



                    {/* //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}

                    {/* //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}

                    {/* additional-content */}

                    <div className="tab-pane fade" id="additional-content" role="tabpanel">
                        <div className="alert alert-info">
                            <i className="fas fa-info-circle me-2"></i>
                            This section will contain additional tax information such as foreign entities, family trust details, and other special circumstances.
                        </div>

                        <div className="d-flex justify-content-between mt-4">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={() => goToNextTab('additional-tab', 'hecs-tab')}
                            >
                                <i className="fas fa-arrow-left me-2"></i> Previous: HELP/HECS
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                id="save-tax-profile"
                                onClick={() => goToNextTab('additional-tab','personal-tab')}
                            >
                                <i className="fas fa-save me-2"></i> Save Tax Profile
                            </button>
                        </div>
                    </div>




                    {/* //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// */}





                </div>
            </form>
        </div>
    );
};

export default TaxProfile;
