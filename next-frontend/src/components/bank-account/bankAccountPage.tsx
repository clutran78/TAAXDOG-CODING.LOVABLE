'use client';

import { handleCustomAccountAddition, handleMockConnection, loadBankAccountsContent } from '@/services/helperFunction';
import { useEffect, useState } from 'react';

const BankAccountsPage = () => {
  const [activeTab, setActiveTab] = useState<'mock' | 'custom'>('mock');

  useEffect(() => {
    const container = document.getElementById('bank-accounts-container');
    if (container) {
      container.innerHTML = `
        <div class="text-center p-5" id="bank-accounts-loading">
          <div class="spinner-border text-primary" role="status"></div>
          <p class="mt-3">Loading bank accounts...</p>
        </div>`;
    }

    setTimeout(() => {
      loadBankAccountsContent({ querySelector: (sel:any) => document.querySelector(sel) });
    }, 200);
  }, []);

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3><i className="fas fa-university text-success me-2"></i>Your Bank Accounts</h3>
      </div>

      <div id="bank-accounts-container" className="mb-5" />

      <h5 className="mb-3">Connect New Bank Account</h5>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'mock' ? 'active' : ''}`}
            onClick={() => setActiveTab('mock')}
          >
            Mock Connection
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Add Custom Account
          </button>
        </li>
      </ul>

      <div className="tab-content">
        {activeTab === 'mock' && (
          <div className="tab-pane fade show active">
            <p>Connect your bank account and import mock transactions:</p>
            <button className="btn btn-primary w-100" onClick={handleMockConnection}>
              <i className="fas fa-check me-2"></i>Complete Mock Connection
            </button>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="tab-pane fade show active">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCustomAccountAddition();
              }}
            >
              <div className="mb-3">
                <label htmlFor="bank-name" className="form-label">Bank Name</label>
                <input type="text" className="form-control" id="bank-name" required />
              </div>

              <div className="mb-3">
                <label htmlFor="account-type" className="form-label">Account Type</label>
                <select className="form-select" id="account-type" required>
                  <option value="">Select account type</option>
                  <option value="checking">Checking Account</option>
                  <option value="savings">Savings Account</option>
                  <option value="credit">Credit Card</option>
                  <option value="investment">Investment Account</option>
                </select>
              </div>

              <div className="mb-3">
                <label htmlFor="account-number" className="form-label">Account Number (last 4 digits)</label>
                <input
                  type="text"
                  className="form-control"
                  id="account-number"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  required
                />
                <div className="form-text">For demo purposes only, enter any 4 digits.</div>
              </div>

              <div className="mb-3">
                <label htmlFor="initial-balance" className="form-label">Initial Balance</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input type="number" className="form-control" id="initial-balance" min="0" step="0.01" required />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-100">
                <i className="fas fa-plus me-2"></i>Add Custom Account
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankAccountsPage;
