import React from "react";

interface Props {
  goToNextTab: (fromId: string, toId: string) => void;
}

const PersonalInfoTab: React.FC<Props> = ({ goToNextTab }) => (
  <div
    className="tab-pane fade show active"
    id="personal-content"
    role="tabpanel"
  >
    <h4 className="mb-3">Basic Identification</h4>
    <div className="row g-3">
      <div className="col-md-2">
        <label htmlFor="title" className="form-label">
          Title
        </label>
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
        <label htmlFor="family-name" className="form-label">
          Family Name/Surname
        </label>
        <input
          type="text"
          className="form-control"
          id="family-name"
          maxLength={40}
          required
        />
        <div className="invalid-feedback">Please enter your family name.</div>
      </div>
      <div className="col-md-3">
        <label htmlFor="first-given-name" className="form-label">
          First Given Name
        </label>
        <input
          type="text"
          className="form-control"
          id="first-given-name"
          maxLength={40}
          required
        />
        <div className="invalid-feedback">Please enter your first name.</div>
      </div>
      <div className="col-md-3">
        <label htmlFor="other-given-names" className="form-label">
          Other Given Names
        </label>
        <input
          type="text"
          className="form-control"
          id="other-given-names"
          maxLength={40}
        />
      </div>
      <div className="col-md-6">
        <label htmlFor="previous-names" className="form-label">
          Previous Names (if applicable)
        </label>
        <input type="text" className="form-control" id="previous-names" />
        <small className="text-muted">Maiden, former married names, etc.</small>
      </div>
      <div className="col-md-3">
        <label htmlFor="date-of-birth" className="form-label">
          Date of Birth
        </label>
        <input
          type="date"
          className="form-control"
          id="date-of-birth"
          required
        />
        <div className="invalid-feedback">Please enter your date of birth.</div>
      </div>
      <div className="col-md-3">
        <label htmlFor="tfn" className="form-label">
          Tax File Number (TFN)
        </label>
        <input
          type="text"
          className="form-control"
          id="tfn"
          pattern="[0-9]{9}"
          required
        />
        <div className="invalid-feedback">
          Please enter a valid 9-digit TFN.
        </div>
      </div>
      <div className="col-md-4">
        <label htmlFor="abn" className="form-label">
          ABN (if applicable)
        </label>
        <input
          type="text"
          className="form-control"
          id="abn"
          pattern="[0-9]{11}"
        />
      </div>
    </div>

    <h4 className="mb-3 mt-4">Contact Details</h4>

    <div className="row g-3">
      <div className="col-md-6">
        <label htmlFor="residential-address" className="form-label">
          Residential Address
        </label>
        <input
          type="text"
          className="form-control"
          id="residential-address"
          required
        />
        <div className="invalid-feedback">
          Please enter your residential address.
        </div>
      </div>
      <div className="col-md-6">
        <label htmlFor="postal-address" className="form-label">
          Postal Address
        </label>
        <input type="text" className="form-control" id="postal-address" />
        <small className="text-muted">
          If different from residential address
        </small>
      </div>
      <div className="col-md-4">
        <label htmlFor="email" className="form-label">
          Email Address
        </label>
        <input type="email" className="form-control" id="email" required />
        <div className="invalid-feedback">
          Please enter a valid email address.
        </div>
      </div>
      <div className="col-md-4">
        <label htmlFor="mobile" className="form-label">
          Mobile Phone Number
        </label>
        <input
          type="tel"
          className="form-control"
          id="mobile"
          pattern="[0-9]{10}"
          required
        />
        <div className="invalid-feedback">
          Please enter a valid 10-digit mobile number.
        </div>
      </div>
      <div className="col-md-4">
        <label htmlFor="alternative-phone" className="form-label">
          Alternative Phone Number
        </label>
        <input type="tel" className="form-control" id="alternative-phone" />
      </div>
    </div>

    <h4 className="mb-3 mt-4">Filing Status</h4>

    <div className="row g-3">
      <div className="col-md-4">
        <label className="form-label">
          Australian Resident for Tax Purposes?
        </label>
        <div>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="residency-status"
              id="resident-yes"
              value="yes"
              required
            />
            <label className="form-check-label" htmlFor="resident-yes">
              Yes
            </label>
          </div>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="residency-status"
              id="resident-no"
              value="no"
            />
            <label className="form-check-label" htmlFor="resident-no">
              No
            </label>
          </div>
          <div className="invalid-feedback">
            Please select your residency status.
          </div>
        </div>
      </div>

      <div className="col-md-4">
        <label className="form-label">Claiming Tax-Free Threshold?</label>
        <div>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="tax-free-threshold"
              id="threshold-yes"
              value="yes"
              required
            />
            <label className="form-check-label" htmlFor="threshold-yes">
              Yes
            </label>
          </div>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="tax-free-threshold"
              id="threshold-no"
              value="no"
            />
            <label className="form-check-label" htmlFor="threshold-no">
              No
            </label>
          </div>
          <div className="invalid-feedback">
            Please select your tax-free threshold status.
          </div>
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

    <div
      id="spouse-details"
      className="row g-3 mt-2"
      style={{ display: "none" }}
    >
      <div className="col-md-4">
        <label htmlFor="spouse-name" className="form-label">
          Spouse&apos;s Full Name
        </label>
        <input type="text" className="form-control" id="spouse-name" />
      </div>
      <div className="col-md-4">
        <label htmlFor="spouse-tfn" className="form-label">
          Spouse&apos;s TFN
        </label>
        <input
          type="text"
          className="form-control"
          id="spouse-tfn"
          pattern="[0-9]{9}"
        />
      </div>
      <div className="col-md-4">
        <label htmlFor="spouse-income" className="form-label">
          Spouse&apos;s Taxable Income
        </label>
        <input
          type="number"
          className="form-control"
          id="spouse-income"
          min="0"
          step="0.01"
        />
      </div>
      <div className="col-md-6">
        <label className="form-label">Spouse for Full or Partial Year?</label>
        <div>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="spouse-period"
              id="spouse-full"
              value="full"
            />
            <label className="form-check-label" htmlFor="spouse-full">
              Full Year
            </label>
          </div>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="spouse-period"
              id="spouse-partial"
              value="partial"
            />
            <label className="form-check-label" htmlFor="spouse-partial">
              Partial Year
            </label>
          </div>
        </div>
      </div>
    </div>

    <div className="row g-3 mt-2">
      <div className="col-md-6">
        <div className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            id="has-dependents"
          />
          <label className="form-check-label" htmlFor="has-dependents">
            I have dependent children
          </label>
        </div>
      </div>
    </div>

    <div
      id="dependent-details"
      className="row g-3 mt-2"
      style={{ display: "none" }}
    >
      <div className="col-md-12">
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          id="add-dependent"
        >
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
        <label htmlFor="bank-bsb" className="form-label">
          BSB
        </label>
        <input
          type="text"
          className="form-control"
          id="bank-bsb"
          pattern="[0-9]{6}"
          required
        />
        <div className="invalid-feedback">
          Please enter a valid BSB (6 digits).
        </div>
      </div>
      <div className="col-md-5">
        <label htmlFor="bank-account" className="form-label">
          Account Number
        </label>
        <input
          type="text"
          className="form-control"
          id="bank-account"
          pattern="[0-9]+"
          required
        />
        <div className="invalid-feedback">
          Please enter a valid account number.
        </div>
      </div>
      <div className="col-md-4">
        <label htmlFor="bank-name" className="form-label">
          Account Name
        </label>
        <input type="text" className="form-control" id="bank-name" required />
        <div className="invalid-feedback">Please enter the account name.</div>
      </div>
    </div>

    <div className="d-flex justify-content-between mt-4">
      <button
        className="btn btn-primary"
        type="button"
        onClick={(e) => goToNextTab("personal-tab", "income-tab")}
      >
        Next: Income <i className="fas fa-arrow-right ms-2"></i>
      </button>
    </div>
  </div>
);

export default PersonalInfoTab;
