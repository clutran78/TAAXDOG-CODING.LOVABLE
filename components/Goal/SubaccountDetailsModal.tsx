import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import {
  Subaccount,
  SubaccountTransaction,
  SubaccountAnalytics,
  GrowthProjection,
  SubaccountTransferRequest,
} from '@/lib/types/subaccount';
import subaccountService from '@/lib/services/goals/subaccount-service';
import { useDarkMode } from '@/providers/dark-mode-provider';

interface SubaccountDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subaccountId: string;
  goalName: string;
}

interface TabType {
  id: 'overview' | 'transactions' | 'analytics' | 'transfer';
  name: string;
  icon: string;
}

const SubaccountDetailsModal: React.FC<SubaccountDetailsModalProps> = ({
  isOpen,
  onClose,
  subaccountId,
  goalName,
}) => {
  const { darkMode } = useDarkMode();

  // State management
  const [activeTab, setActiveTab] = useState<TabType['id']>('overview');
  const [subaccount, setSubaccount] = useState<Subaccount | null>(null);
  const [transactions, setTransactions] = useState<SubaccountTransaction[]>([]);
  const [analytics, setAnalytics] = useState<SubaccountAnalytics | null>(null);
  const [projections, setProjections] = useState<GrowthProjection[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Transfer form state
  const [transferType, setTransferType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferDescription, setTransferDescription] = useState<string>('');
  const [processingTransfer, setProcessingTransfer] = useState<boolean>(false);

  // Pagination state
  const [transactionPage, setTransactionPage] = useState<number>(1);
  const [transactionsPerPage] = useState<number>(10);

  const tabs: TabType[] = [
    { id: 'overview', name: 'Overview', icon: 'fas fa-chart-pie' },
    { id: 'transactions', name: 'Transactions', icon: 'fas fa-list' },
    { id: 'analytics', name: 'Analytics', icon: 'fas fa-chart-line' },
    { id: 'transfer', name: 'Transfer', icon: 'fas fa-exchange-alt' },
  ];

  // Load subaccount data when modal opens
  useEffect(() => {
    if (isOpen && subaccountId) {
      loadSubaccountData();
    }
  }, [isOpen, subaccountId]);

  // Load different data based on active tab
  useEffect(() => {
    if (isOpen && subaccountId && subaccount) {
      switch (activeTab) {
        case 'transactions':
          loadTransactions();
          break;
        case 'analytics':
          loadAnalytics();
          break;
      }
    }
  }, [activeTab, isOpen, subaccountId, subaccount]);

  const loadSubaccountData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await subaccountService.getSubaccount(subaccountId);
      if (response.success && response.data) {
        setSubaccount(response.data);

        // Load projections
        const projectionResponse = await subaccountService.calculateGrowthProjections(subaccountId);
        if (projectionResponse.success && projectionResponse.data) {
          setProjections(projectionResponse.data);
        }
      } else {
        setError(response.error || 'Failed to load subaccount data');
      }
    } catch (error) {
      setError('Error loading subaccount information');
      logger.error('Failed to load subaccount:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await subaccountService.getSubaccountTransactions(subaccountId, {
        page: transactionPage,
        limit: transactionsPerPage,
      });

      if (response.success && response.data) {
        setTransactions(response.data);
      }
    } catch (error) {
      logger.error('Failed to load transactions:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await subaccountService.getSubaccountAnalytics(subaccountId, {
        startDate,
        endDate,
      });

      if (response.success && response.data) {
        setAnalytics(response.data);
      }
    } catch (error) {
      logger.error('Failed to load analytics:', error);
    }
  };

  const handleTransfer = async () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setProcessingTransfer(true);

    try {
      const transferRequest: SubaccountTransferRequest = {
        subaccountId,
        amount: parseFloat(transferAmount),
        type: transferType,
        description: transferDescription || `Manual ${transferType}`,
      };

      const response = await subaccountService.processTransfer(transferRequest);

      if (response.success) {
        alert(`${transferType === 'deposit' ? 'Deposit' : 'Withdrawal'} successful!`);
        setTransferAmount('');
        setTransferDescription('');

        // Reload subaccount data
        await loadSubaccountData();
        if (activeTab === 'transactions') {
          await loadTransactions();
        }
      } else {
        alert(`Transfer failed: ${response.error}`);
      }
    } catch (error) {
      alert('Transfer failed. Please try again.');
      logger.error('Transfer error:', error);
    } finally {
      setProcessingTransfer(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return subaccountService.formatCurrency(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getTransactionTypeIcon = (type: string): string => {
    switch (type) {
      case 'deposit':
        return 'fas fa-arrow-down text-success';
      case 'withdrawal':
        return 'fas fa-arrow-up text-danger';
      case 'interest':
        return 'fas fa-percentage text-info';
      case 'transfer_in':
        return 'fas fa-arrow-right text-success';
      case 'transfer_out':
        return 'fas fa-arrow-left text-warning';
      default:
        return 'fas fa-exchange-alt text-muted';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="modal-dialog modal-xl">
        <div className={`modal-content ${darkMode ? 'bg-dark text-light' : ''}`}>
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">Subaccount Details</h5>
              <small className="text-muted">{goalName}</small>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>

          <div className="modal-body">
            {loading ? (
              <div className="text-center py-5">
                <i className="fas fa-spinner fa-spin fa-2x mb-3"></i>
                <div>Loading subaccount data...</div>
              </div>
            ) : error ? (
              <div className="alert alert-danger">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            ) : subaccount ? (
              <>
                {/* Tab Navigation */}
                <ul className="nav nav-tabs mb-4">
                  {tabs.map((tab) => (
                    <li
                      key={tab.id}
                      className="nav-item"
                    >
                      <button
                        className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <i className={`${tab.icon} me-2`}></i>
                        {tab.name}
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                  <div className="row">
                    <div className="col-md-6">
                      <div className="card h-100">
                        <div className="card-header">
                          <h6 className="mb-0">
                            <i className="fas fa-wallet me-2"></i>
                            Balance Information
                          </h6>
                        </div>
                        <div className="card-body">
                          <div className="row">
                            <div className="col-6">
                              <div className="text-center">
                                <div className="h4 text-success mb-0">
                                  {formatCurrency(subaccount.balance.current)}
                                </div>
                                <small className="text-muted">Current Balance</small>
                              </div>
                            </div>
                            <div className="col-6">
                              <div className="text-center">
                                <div className="h4 text-info mb-0">
                                  {formatCurrency(subaccount.balance.available)}
                                </div>
                                <small className="text-muted">Available</small>
                              </div>
                            </div>
                          </div>

                          {subaccount.balance.pending > 0 && (
                            <div className="mt-3 text-center">
                              <div className="h6 text-warning mb-0">
                                {formatCurrency(subaccount.balance.pending)}
                              </div>
                              <small className="text-muted">Pending</small>
                            </div>
                          )}

                          <hr />

                          {subaccount.balance.interestEarned && (
                            <div>
                              <h6>Interest Earned</h6>
                              <div className="row text-center">
                                <div className="col-6">
                                  <div className="fw-bold text-info">
                                    {formatCurrency(subaccount.balance.interestEarned.monthly)}
                                  </div>
                                  <small className="text-muted">This Month</small>
                                </div>
                                <div className="col-6">
                                  <div className="fw-bold text-info">
                                    {formatCurrency(subaccount.balance.interestEarned.yearToDate)}
                                  </div>
                                  <small className="text-muted">Year to Date</small>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="card h-100">
                        <div className="card-header">
                          <h6 className="mb-0">
                            <i className="fas fa-chart-line me-2"></i>
                            Growth Projections
                          </h6>
                        </div>
                        <div className="card-body">
                          {projections.map((projection, index) => (
                            <div
                              key={index}
                              className="mb-3"
                            >
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="fw-bold">
                                  {projection.timeframe === 'month'
                                    ? 'Next Month'
                                    : projection.timeframe === 'quarter'
                                      ? 'Next Quarter'
                                      : 'Next Year'}
                                </span>
                                <span className="text-success">
                                  {formatCurrency(projection.projectedAmount)}
                                </span>
                              </div>
                              <div
                                className="progress mt-1"
                                style={{ height: '4px' }}
                              >
                                <div
                                  className="progress-bar bg-success"
                                  style={{
                                    width: `${Math.min((projection.transferComponent / projection.projectedAmount) * 100, 100)}%`,
                                  }}
                                ></div>
                                <div
                                  className="progress-bar bg-info"
                                  style={{
                                    width: `${Math.min((projection.interestComponent / projection.projectedAmount) * 100, 100)}%`,
                                  }}
                                ></div>
                              </div>
                              <small className="text-muted">
                                Transfers: {formatCurrency(projection.transferComponent)} |
                                Interest: {formatCurrency(projection.interestComponent)}
                              </small>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'transactions' && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6>Transaction History</h6>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={loadTransactions}
                      >
                        <i className="fas fa-sync-alt me-1"></i>Refresh
                      </button>
                    </div>

                    {transactions.length === 0 ? (
                      <div className="text-center py-4">
                        <i className="fas fa-inbox fa-2x text-muted mb-3"></i>
                        <div className="text-muted">No transactions found</div>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Description</th>
                              <th>Amount</th>
                              <th>Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((transaction) => (
                              <tr key={transaction.id}>
                                <td>{formatDate(transaction.timestamp)}</td>
                                <td>
                                  <i className={getTransactionTypeIcon(transaction.type)} />
                                  <span className="ms-2">{transaction.type.replace('_', ' ')}</span>
                                </td>
                                <td>{transaction.description}</td>
                                <td
                                  className={
                                    transaction.type === 'withdrawal'
                                      ? 'text-danger'
                                      : 'text-success'
                                  }
                                >
                                  {transaction.type === 'withdrawal' ? '-' : '+'}
                                  {formatCurrency(Math.abs(transaction.amount))}
                                </td>
                                <td>
                                  <span className="badge bg-secondary">
                                    {transaction.source.replace('_', ' ')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'analytics' && analytics && (
                  <div className="row">
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-header">
                          <h6 className="mb-0">90-Day Summary</h6>
                        </div>
                        <div className="card-body">
                          <div className="row text-center">
                            <div className="col-6 mb-3">
                              <div className="h5 text-success mb-0">
                                {formatCurrency(analytics.totalDeposits)}
                              </div>
                              <small className="text-muted">Total Deposits</small>
                            </div>
                            <div className="col-6 mb-3">
                              <div className="h5 text-danger mb-0">
                                {formatCurrency(analytics.totalWithdrawals)}
                              </div>
                              <small className="text-muted">Total Withdrawals</small>
                            </div>
                            <div className="col-6 mb-3">
                              <div className="h5 text-info mb-0">
                                {formatCurrency(analytics.interestEarned)}
                              </div>
                              <small className="text-muted">Interest Earned</small>
                            </div>
                            <div className="col-6 mb-3">
                              <div className="h5 text-primary mb-0">
                                {formatCurrency(analytics.netGrowth)}
                              </div>
                              <small className="text-muted">Net Growth</small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-header">
                          <h6 className="mb-0">Statistics</h6>
                        </div>
                        <div className="card-body">
                          <div className="mb-3">
                            <div className="d-flex justify-content-between">
                              <span>Average Balance:</span>
                              <span className="fw-bold">
                                {formatCurrency(analytics.averageBalance)}
                              </span>
                            </div>
                          </div>
                          <div className="mb-3">
                            <div className="d-flex justify-content-between">
                              <span>Transaction Count:</span>
                              <span className="fw-bold">{analytics.transactionCount}</span>
                            </div>
                          </div>
                          <div className="mb-3">
                            <div className="d-flex justify-content-between">
                              <span>Period:</span>
                              <span className="fw-bold">
                                {new Date(analytics.period.startDate).toLocaleDateString()} -
                                {new Date(analytics.period.endDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'transfer' && (
                  <div className="row justify-content-center">
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-header">
                          <h6 className="mb-0">
                            <i className="fas fa-exchange-alt me-2"></i>
                            Manual Transfer
                          </h6>
                        </div>
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label">Transfer Type</label>
                            <div
                              className="btn-group w-100"
                              role="group"
                            >
                              <input
                                type="radio"
                                className="btn-check"
                                name="transferType"
                                id="deposit"
                                checked={transferType === 'deposit'}
                                onChange={() => setTransferType('deposit')}
                              />
                              <label
                                className="btn btn-outline-success"
                                htmlFor="deposit"
                              >
                                <i className="fas fa-arrow-down me-1"></i>Deposit
                              </label>

                              <input
                                type="radio"
                                className="btn-check"
                                name="transferType"
                                id="withdrawal"
                                checked={transferType === 'withdrawal'}
                                onChange={() => setTransferType('withdrawal')}
                              />
                              <label
                                className="btn btn-outline-danger"
                                htmlFor="withdrawal"
                              >
                                <i className="fas fa-arrow-up me-1"></i>Withdrawal
                              </label>
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="form-label">Amount (AUD)</label>
                            <div className="input-group">
                              <span className="input-group-text">$</span>
                              <input
                                type="number"
                                className="form-control"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                              />
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="form-label">Description (Optional)</label>
                            <input
                              type="text"
                              className="form-control"
                              value={transferDescription}
                              onChange={(e) => setTransferDescription(e.target.value)}
                              placeholder={`Manual ${transferType}`}
                            />
                          </div>

                          <div className="mb-3">
                            <div className="alert alert-info">
                              <i className="fas fa-info-circle me-2"></i>
                              {transferType === 'deposit'
                                ? 'Funds will be added to your subaccount balance.'
                                : 'Funds will be deducted from your subaccount balance.'}
                            </div>
                          </div>

                          <button
                            className={`btn btn-${transferType === 'deposit' ? 'success' : 'danger'} w-100`}
                            onClick={handleTransfer}
                            disabled={processingTransfer || !transferAmount}
                          >
                            {processingTransfer ? (
                              <>
                                <i className="fas fa-spinner fa-spin me-2"></i>
                                Processing...
                              </>
                            ) : (
                              <>
                                <i
                                  className={`fas fa-${transferType === 'deposit' ? 'arrow-down' : 'arrow-up'} me-2`}
                                ></i>
                                {transferType === 'deposit' ? 'Deposit' : 'Withdraw'}{' '}
                                {transferAmount
                                  ? formatCurrency(parseFloat(transferAmount))
                                  : 'Funds'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubaccountDetailsModal;
