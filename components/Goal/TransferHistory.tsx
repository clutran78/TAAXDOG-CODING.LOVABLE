import React, { useState, useEffect } from 'react';
import { useDarkMode } from '@/providers/dark-mode-provider';
import { logger } from '@/lib/logger';

interface TransferRecord {
  id: string;
  rule_id: string;
  goal_id: string;
  user_id: string;
  source_account_id: string;
  target_subaccount_id: string;
  amount: number;
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'retrying'
    | 'cancelled'
    | 'scheduled';
  scheduled_date: string;
  executed_date?: string;
  external_transaction_id?: string;
  error_message?: string;
  retry_count: number;
  detected_income_amount?: number;
  income_source?: string;
  surplus_calculation?: {
    detected_income: number;
    essential_expenses: number;
    available_surplus: number;
    transfer_percentage: number;
  };
  created_at: string;
  updated_at: string;
}

interface TransferStatistics {
  period_days: number;
  total_transfers: number;
  successful_transfers: number;
  failed_transfers: number;
  success_rate: number;
  total_amount_transferred: number;
  average_transfer_amount: number;
  goal_breakdown: Record<
    string,
    {
      total_amount: number;
      transfer_count: number;
    }
  >;
}

interface TransferHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  goalId?: string;
  goalName?: string;
}

const TransferHistory: React.FC<TransferHistoryProps> = ({ isOpen, onClose, goalId, goalName }) => {
  const { darkMode } = useDarkMode();

  // State management
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [statistics, setStatistics] = useState<TransferStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter and pagination state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('30'); // Last 30 days
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(20);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Export state
  const [exporting, setExporting] = useState<boolean>(false);

  // Load transfer history when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTransferHistory();
      loadStatistics();
    }
  }, [isOpen, goalId, dateFilter, statusFilter]);

  const loadTransferHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: '100', // Load more for filtering
      });

      if (goalId) {
        params.append('goal_id', goalId);
      }

      if (dateFilter !== 'all') {
        const days = parseInt(dateFilter);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.append('start_date', startDate.toISOString());
      }

      const response = await fetch(`/api/automated-transfers/history?${params}`, {
        headers: {
          'X-User-ID': 'current-user-id', // Replace with actual user ID
        },
      });

      const result = await response.json();

      if (result.success) {
        let filteredTransfers = result.data || [];

        // Apply status filter
        if (statusFilter !== 'all') {
          filteredTransfers = filteredTransfers.filter(
            (t: TransferRecord) => t.status === statusFilter,
          );
        }

        // Apply sorting
        filteredTransfers.sort((a: TransferRecord, b: TransferRecord) => {
          let aValue, bValue;

          switch (sortBy) {
            case 'date':
              aValue = new Date(a.scheduled_date).getTime();
              bValue = new Date(b.scheduled_date).getTime();
              break;
            case 'amount':
              aValue = a.amount;
              bValue = b.amount;
              break;
            case 'status':
              aValue = a.status;
              bValue = b.status;
              break;
            default:
              aValue = new Date(a.scheduled_date).getTime();
              bValue = new Date(b.scheduled_date).getTime();
          }

          if (sortOrder === 'asc') {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });

        setTransfers(filteredTransfers);
      } else {
        setError(result.error || 'Failed to load transfer history');
      }
    } catch (error) {
      setError('Error loading transfer history');
      logger.error('Failed to load transfer history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const params = new URLSearchParams();

      if (dateFilter !== 'all') {
        params.append('period_days', dateFilter);
      }

      const response = await fetch(`/api/automated-transfers/statistics?${params}`, {
        headers: {
          'X-User-ID': 'current-user-id', // Replace with actual user ID
        },
      });

      const result = await response.json();

      if (result.success) {
        setStatistics(result.data);
      }
    } catch (error) {
      logger.error('Failed to load transfer statistics:', error);
    }
  };

  const exportTransferHistory = async () => {
    setExporting(true);

    try {
      const params = new URLSearchParams({
        format: 'csv',
        limit: '1000',
      });

      if (goalId) {
        params.append('goal_id', goalId);
      }

      if (dateFilter !== 'all') {
        const days = parseInt(dateFilter);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.append('start_date', startDate.toISOString());
      }

      // Create CSV content
      const csvHeader = 'Date,Amount,Status,Goal,Account,Type,Reference\n';
      const csvData = transfers
        .map((transfer) => {
          const date = new Date(transfer.scheduled_date).toLocaleDateString();
          const amount = transfer.amount.toFixed(2);
          const status = transfer.status;
          const reference = transfer.external_transaction_id || transfer.id;

          return `${date},${amount},${status},${goalName || 'Goal'},Account,Transfer,${reference}`;
        })
        .join('\n');

      const csvContent = csvHeader + csvData;

      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `transfer-history-${new Date().toISOString().split('T')[0]}.csv`,
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      logger.error('Failed to export transfer history:', error);
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: string; label: string }> = {
      completed: { color: 'success', icon: 'check-circle', label: 'Completed' },
      failed: { color: 'danger', icon: 'times-circle', label: 'Failed' },
      pending: { color: 'warning', icon: 'clock', label: 'Pending' },
      processing: { color: 'info', icon: 'spinner fa-spin', label: 'Processing' },
      retrying: { color: 'warning', icon: 'redo', label: 'Retrying' },
      cancelled: { color: 'secondary', icon: 'ban', label: 'Cancelled' },
      scheduled: { color: 'primary', icon: 'calendar', label: 'Scheduled' },
    };

    const config = statusConfig[status] || { color: 'secondary', icon: 'question', label: status };

    return (
      <span className={`badge bg-${config.color}`}>
        <i className={`fas fa-${config.icon} me-1`}></i>
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Pagination
  const totalPages = Math.ceil(transfers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransfers = transfers.slice(startIndex, endIndex);

  if (!isOpen) return null;

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="modal-dialog modal-xl">
        <div className={`modal-content ${darkMode ? 'bg-dark text-light' : ''}`}>
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-history me-2"></i>
              Transfer History {goalName && `- ${goalName}`}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>

          <div className="modal-body">
            {error && (
              <div
                className="alert alert-danger"
                role="alert"
              >
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {/* Statistics Cards */}
            {statistics && (
              <div className="row mb-4">
                <div className="col-md-3">
                  <div className="card text-center">
                    <div className="card-body">
                      <i className="fas fa-exchange-alt fa-2x text-primary mb-2"></i>
                      <h4 className="mb-0">{statistics.total_transfers}</h4>
                      <small className="text-muted">Total Transfers</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card text-center">
                    <div className="card-body">
                      <i className="fas fa-check-circle fa-2x text-success mb-2"></i>
                      <h4 className="mb-0">{statistics.success_rate.toFixed(1)}%</h4>
                      <small className="text-muted">Success Rate</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card text-center">
                    <div className="card-body">
                      <i className="fas fa-dollar-sign fa-2x text-info mb-2"></i>
                      <h4 className="mb-0">
                        {formatCurrency(statistics.total_amount_transferred)}
                      </h4>
                      <small className="text-muted">Total Transferred</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card text-center">
                    <div className="card-body">
                      <i className="fas fa-chart-line fa-2x text-warning mb-2"></i>
                      <h4 className="mb-0">{formatCurrency(statistics.average_transfer_amount)}</h4>
                      <small className="text-muted">Average Amount</small>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters and Controls */}
            <div className="row mb-3">
              <div className="col-md-3">
                <label className="form-label">Status Filter</label>
                <select
                  className="form-select form-select-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="retrying">Retrying</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Date Range</label>
                <select
                  className="form-select form-select-sm"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="365">Last year</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Sort By</label>
                <select
                  className="form-select form-select-sm"
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as 'date' | 'amount' | 'status');
                    setSortOrder(order as 'asc' | 'desc');
                  }}
                >
                  <option value="date-desc">Date (Newest)</option>
                  <option value="date-asc">Date (Oldest)</option>
                  <option value="amount-desc">Amount (High to Low)</option>
                  <option value="amount-asc">Amount (Low to High)</option>
                  <option value="status-asc">Status (A-Z)</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">&nbsp;</label>
                <div>
                  <button
                    className="btn btn-outline-primary btn-sm me-2"
                    onClick={loadTransferHistory}
                    disabled={loading}
                  >
                    <i className="fas fa-refresh me-1"></i>
                    Refresh
                  </button>
                  <button
                    className="btn btn-outline-success btn-sm"
                    onClick={exportTransferHistory}
                    disabled={exporting || transfers.length === 0}
                  >
                    {exporting ? (
                      <i className="fas fa-spinner fa-spin me-1"></i>
                    ) : (
                      <i className="fas fa-download me-1"></i>
                    )}
                    Export
                  </button>
                </div>
              </div>
            </div>

            {/* Transfer Table */}
            <div className="table-responsive">
              {loading ? (
                <div className="text-center py-4">
                  <i className="fas fa-spinner fa-spin fa-2x text-muted"></i>
                  <p className="text-muted mt-2">Loading transfer history...</p>
                </div>
              ) : transfers.length === 0 ? (
                <div className="text-center py-4">
                  <i className="fas fa-history fa-3x text-muted mb-3"></i>
                  <p className="text-muted">No transfers found for the selected criteria.</p>
                </div>
              ) : (
                <>
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Goal Impact</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentTransfers.map((transfer) => (
                        <tr key={transfer.id}>
                          <td>
                            <div>
                              <small className="text-muted">Scheduled:</small>
                              <div>{formatDate(transfer.scheduled_date)}</div>
                              {transfer.executed_date && (
                                <>
                                  <small className="text-muted">Executed:</small>
                                  <div>{formatDate(transfer.executed_date)}</div>
                                </>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold text-success">
                              {formatCurrency(transfer.amount)}
                            </div>
                            {transfer.detected_income_amount && (
                              <small className="text-muted">
                                From income: {formatCurrency(transfer.detected_income_amount)}
                              </small>
                            )}
                          </td>
                          <td>
                            <div>
                              {getStatusBadge(transfer.status)}
                              {transfer.retry_count > 0 && (
                                <div className="mt-1">
                                  <small className="text-warning">
                                    <i className="fas fa-redo me-1"></i>
                                    Retry {transfer.retry_count}
                                  </small>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div>
                              <i className="fas fa-robot me-1"></i>
                              Automated
                            </div>
                            {transfer.income_source && (
                              <small className="text-muted">{transfer.income_source}</small>
                            )}
                          </td>
                          <td>
                            {transfer.status === 'completed' ? (
                              <div className="text-success">
                                <i className="fas fa-arrow-up me-1"></i>
                                Goal progress increased
                              </div>
                            ) : transfer.status === 'failed' ? (
                              <div className="text-danger">
                                <i className="fas fa-times me-1"></i>
                                No impact
                              </div>
                            ) : (
                              <div className="text-muted">
                                <i className="fas fa-clock me-1"></i>
                                Pending
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-primary"
                                onClick={() => {
                                  // Show transfer details
                                  logger.info('Transfer details:', transfer);
                                }}
                                title="View Details"
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                              {transfer.status === 'failed' && transfer.retry_count < 3 && (
                                <button
                                  className="btn btn-outline-warning"
                                  onClick={() => {
                                    // Retry transfer
                                    logger.info('Retry transfer:', transfer.id);
                                  }}
                                  title="Retry Transfer"
                                >
                                  <i className="fas fa-redo"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <nav aria-label="Transfer history pagination">
                      <ul className="pagination justify-content-center">
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </button>
                        </li>

                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <li
                              key={pageNum}
                              className={`page-item ${currentPage === pageNum ? 'active' : ''}`}
                            >
                              <button
                                className="page-link"
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {pageNum}
                              </button>
                            </li>
                          );
                        })}

                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                          </button>
                        </li>
                      </ul>
                    </nav>
                  )}
                </>
              )}
            </div>
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

export default TransferHistory;
