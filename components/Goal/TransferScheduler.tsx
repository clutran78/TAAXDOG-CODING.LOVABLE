import React, { useState, useEffect } from 'react';
import { useDarkMode } from '@/providers/dark-mode-provider';
import { BasiqAccount } from '@/lib/services/banking/basiq-accounts-service';
import { fetchUserBankAccounts } from '@/lib/services/banking/basiq-accounts-service';
import { Goal } from '@/lib/types/goal';
import { Subaccount } from '@/lib/types/subaccount';
import { logger } from '@/lib/logger';

interface TransferRule {
  id?: string;
  goal_id: string;
  source_account_id: string;
  target_subaccount_id: string;
  transfer_type: 'fixed_amount' | 'percentage_income' | 'income_based' | 'smart_surplus';
  amount: number;
  frequency: 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly';
  start_date: string;
  end_date?: string;
  income_detection_enabled?: boolean;
  minimum_income_threshold?: number;
  maximum_transfer_per_period?: number;
  surplus_calculation_enabled?: boolean;
  is_active?: boolean;
}

interface IncomeAnalysis {
  income_patterns: Array<{
    source_description: string;
    income_type: string;
    amount: number;
    frequency_days: number;
    confidence_score: number;
    next_expected_date: string;
  }>;
  total_monthly_income: number;
  confidence_level: number;
}

interface TransferRecommendation {
  recommended_monthly_amount: number;
  target_percentage: number;
  available_surplus: number;
  confidence_level: number;
  frequency_options: Array<{
    frequency: string;
    amount: number;
    description: string;
  }>;
  analysis_summary: {
    monthly_income: number;
    essential_expenses: number;
    discretionary_expenses: number;
  };
}

interface TransferSchedulerProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal;
  subaccount?: Subaccount;
  onRuleCreated?: (rule: TransferRule) => void;
  existingRule?: TransferRule;
}

const TransferScheduler: React.FC<TransferSchedulerProps> = ({
  isOpen,
  onClose,
  goal,
  subaccount,
  onRuleCreated,
  existingRule,
}) => {
  const { darkMode } = useDarkMode();

  // Form state
  const [transferRule, setTransferRule] = useState<Partial<TransferRule>>({
    goal_id: goal.id,
    target_subaccount_id: subaccount?.id || '',
    transfer_type: 'fixed_amount',
    amount: 100,
    frequency: 'monthly',
    start_date: new Date().toISOString().split('T')[0],
    income_detection_enabled: false,
    minimum_income_threshold: 500,
    maximum_transfer_per_period: 1000,
    surplus_calculation_enabled: false,
  });

  // Data state
  const [bankAccounts, setBankAccounts] = useState<BasiqAccount[]>([]);
  const [incomeAnalysis, setIncomeAnalysis] = useState<IncomeAnalysis | null>(null);
  const [transferRecommendations, setTransferRecommendations] =
    useState<TransferRecommendation | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'smart' | 'advanced'>('basic');

  // Load existing rule data if editing
  useEffect(() => {
    if (existingRule && isOpen) {
      setTransferRule({
        ...existingRule,
        start_date: existingRule.start_date.split('T')[0], // Convert to date format
        end_date: existingRule.end_date?.split('T')[0],
      });
    }
  }, [existingRule, isOpen]);

  // Load bank accounts
  useEffect(() => {
    const loadBankAccounts = async () => {
      if (!isOpen) return;

      try {
        const response = await fetchUserBankAccounts();
        if (response.success && response.data) {
          setBankAccounts(response.data);
        } else {
          setError('Failed to load bank accounts');
        }
      } catch (error) {
        setError('Error loading bank accounts');
        logger.error('Failed to load bank accounts:', error);
      }
    };

    loadBankAccounts();
  }, [isOpen]);

  // Auto-select first account if none selected
  useEffect(() => {
    if (bankAccounts.length > 0 && !transferRule.source_account_id) {
      setTransferRule((prev) => ({
        ...prev,
        source_account_id: bankAccounts[0].id,
      }));
    }
  }, [bankAccounts, transferRule.source_account_id]);

  const handleInputChange = (
    field: keyof TransferRule,
    value: TransferRule[keyof TransferRule],
  ) => {
    setTransferRule((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const analyzeIncome = async () => {
    if (!transferRule.source_account_id) {
      setError('Please select a source account first');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      // Analyze income patterns
      const incomeResponse = await fetch(
        `/api/automated-transfers/income-analysis/${transferRule.source_account_id}`,
        {
          headers: {
            'X-User-ID': 'current-user-id', // Replace with actual user ID
          },
        },
      );

      if (incomeResponse.ok) {
        const incomeData = await incomeResponse.json();
        if (incomeData.success) {
          setIncomeAnalysis(incomeData.data);
        }
      }

      // Get transfer recommendations
      const recommendationsResponse = await fetch(
        `/api/automated-transfers/transfer-recommendations/${transferRule.source_account_id}?target_percentage=20`,
        {
          headers: {
            'X-User-ID': 'current-user-id', // Replace with actual user ID
          },
        },
      );

      if (recommendationsResponse.ok) {
        const recommendationsData = await recommendationsResponse.json();
        if (recommendationsData.success) {
          setTransferRecommendations(recommendationsData.data);

          // Auto-suggest amount based on recommendations
          if (transferRule.transfer_type === 'fixed_amount') {
            handleInputChange(
              'amount',
              Math.round(recommendationsData.data.recommended_monthly_amount),
            );
          }
        }
      }
    } catch (error) {
      logger.error('Error analyzing income:', error);
      setError('Failed to analyze income patterns');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!transferRule.source_account_id || !transferRule.target_subaccount_id) {
        throw new Error('Please select both source account and target subaccount');
      }

      if (!transferRule.amount || transferRule.amount <= 0) {
        throw new Error('Please enter a valid transfer amount');
      }

      // Prepare request data
      const requestData = {
        ...transferRule,
        start_date: new Date(transferRule.start_date!).toISOString(),
        end_date: transferRule.end_date ? new Date(transferRule.end_date).toISOString() : undefined,
      };

      // API call to create or update transfer rule
      const url = existingRule
        ? `/api/automated-transfers/rules/${existingRule.id}`
        : '/api/automated-transfers/rules';

      const method = existingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'current-user-id', // Replace with actual user ID
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (result.success) {
        if (onRuleCreated) {
          onRuleCreated(result.data || (requestData as TransferRule));
        }
        onClose();
      } else {
        throw new Error(result.error || 'Failed to save transfer rule');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save transfer rule');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      bi_weekly: 'Bi-weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
    };
    return labels[frequency] || frequency;
  };

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
              {existingRule ? 'Edit' : 'Set Up'} Automated Transfers for {goal.name}
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

            {/* Navigation Tabs */}
            <ul className="nav nav-tabs mb-4">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'basic' ? 'active' : ''}`}
                  onClick={() => setActiveTab('basic')}
                >
                  <i className="fas fa-cog me-2"></i>
                  Basic Setup
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'smart' ? 'active' : ''}`}
                  onClick={() => setActiveTab('smart')}
                >
                  <i className="fas fa-brain me-2"></i>
                  Smart Analysis
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === 'advanced' ? 'active' : ''}`}
                  onClick={() => setActiveTab('advanced')}
                >
                  <i className="fas fa-sliders-h me-2"></i>
                  Advanced Options
                </button>
              </li>
            </ul>

            <form onSubmit={handleSubmit}>
              {/* Basic Setup Tab */}
              {activeTab === 'basic' && (
                <div className="row">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-university me-2"></i>
                        Source Bank Account
                      </label>
                      <select
                        className="form-select"
                        value={transferRule.source_account_id || ''}
                        onChange={(e) => handleInputChange('source_account_id', e.target.value)}
                        required
                      >
                        <option value="">Select account...</option>
                        {bankAccounts.map((account) => (
                          <option
                            key={account.id}
                            value={account.id}
                          >
                            {account.name} - {formatCurrency(account.balance || 0)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-piggy-bank me-2"></i>
                        Target Subaccount
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={subaccount?.name || 'Goal Subaccount'}
                        disabled
                      />
                      <small className="text-muted">
                        Transfers will go to the subaccount for this goal
                      </small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-exchange-alt me-2"></i>
                        Transfer Type
                      </label>
                      <select
                        className="form-select"
                        value={transferRule.transfer_type}
                        onChange={(e) => handleInputChange('transfer_type', e.target.value)}
                      >
                        <option value="fixed_amount">Fixed Amount</option>
                        <option value="percentage_income">Percentage of Income</option>
                        <option value="smart_surplus">Smart Surplus Detection</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-dollar-sign me-2"></i>
                        {transferRule.transfer_type === 'percentage_income'
                          ? 'Percentage (%)'
                          : 'Amount (AUD)'}
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={transferRule.amount}
                        onChange={(e) => handleInputChange('amount', parseFloat(e.target.value))}
                        min={transferRule.transfer_type === 'percentage_income' ? 1 : 1}
                        max={transferRule.transfer_type === 'percentage_income' ? 100 : undefined}
                        step={transferRule.transfer_type === 'percentage_income' ? 1 : 1}
                        required
                      />
                      {transferRule.transfer_type === 'percentage_income' && (
                        <small className="text-muted">
                          Percentage of detected monthly income to transfer
                        </small>
                      )}
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-calendar me-2"></i>
                        Transfer Frequency
                      </label>
                      <select
                        className="form-select"
                        value={transferRule.frequency}
                        onChange={(e) => handleInputChange('frequency', e.target.value)}
                      >
                        <option value="weekly">Weekly</option>
                        <option value="bi_weekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-calendar-alt me-2"></i>
                        Start Date
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={transferRule.start_date}
                        onChange={(e) => handleInputChange('start_date', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-calendar-times me-2"></i>
                        End Date (Optional)
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={transferRule.end_date || ''}
                        onChange={(e) => handleInputChange('end_date', e.target.value || undefined)}
                        min={transferRule.start_date}
                      />
                      <small className="text-muted">Leave empty for ongoing transfers</small>
                    </div>

                    <div className="card">
                      <div className="card-body">
                        <h6 className="card-title">
                          <i className="fas fa-calculator me-2"></i>
                          Transfer Preview
                        </h6>
                        <div className="row">
                          <div className="col-6">
                            <small className="text-muted">Amount:</small>
                            <div className="fw-bold">
                              {transferRule.transfer_type === 'percentage_income'
                                ? `${transferRule.amount}% of income`
                                : formatCurrency(transferRule.amount || 0)}
                            </div>
                          </div>
                          <div className="col-6">
                            <small className="text-muted">Frequency:</small>
                            <div className="fw-bold">
                              {getFrequencyLabel(transferRule.frequency || 'monthly')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Smart Analysis Tab */}
              {activeTab === 'smart' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h6>
                      <i className="fas fa-brain me-2"></i>
                      Income Analysis & Smart Recommendations
                    </h6>
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={analyzeIncome}
                      disabled={analyzing || !transferRule.source_account_id}
                    >
                      {analyzing ? (
                        <>
                          <i className="fas fa-spinner fa-spin me-2"></i>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-search me-2"></i>
                          Analyze Income
                        </>
                      )}
                    </button>
                  </div>

                  {incomeAnalysis && (
                    <div className="row">
                      <div className="col-md-6">
                        <div className="card">
                          <div className="card-header">
                            <h6 className="mb-0">
                              <i className="fas fa-chart-line me-2"></i>
                              Income Patterns
                            </h6>
                          </div>
                          <div className="card-body">
                            <div className="mb-3">
                              <small className="text-muted">Monthly Income</small>
                              <h4 className="text-success">
                                {formatCurrency(incomeAnalysis.total_monthly_income)}
                              </h4>
                            </div>

                            <div className="mb-3">
                              <small className="text-muted">Confidence Level</small>
                              <div className="progress">
                                <div
                                  className="progress-bar bg-info"
                                  style={{ width: `${incomeAnalysis.confidence_level * 100}%` }}
                                ></div>
                              </div>
                              <small>
                                {Math.round(incomeAnalysis.confidence_level * 100)}% confident
                              </small>
                            </div>

                            {incomeAnalysis.income_patterns.map((pattern, index) => (
                              <div
                                key={index}
                                className="border-bottom py-2"
                              >
                                <div className="d-flex justify-content-between">
                                  <span className="fw-bold">{pattern.source_description}</span>
                                  <span className="text-success">
                                    {formatCurrency(pattern.amount)}
                                  </span>
                                </div>
                                <small className="text-muted">
                                  Every {pattern.frequency_days} days • {pattern.income_type}
                                </small>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        {transferRecommendations && (
                          <div className="card">
                            <div className="card-header">
                              <h6 className="mb-0">
                                <i className="fas fa-lightbulb me-2"></i>
                                Smart Recommendations
                              </h6>
                            </div>
                            <div className="card-body">
                              <div className="mb-3">
                                <small className="text-muted">Recommended Monthly Savings</small>
                                <h4 className="text-primary">
                                  {formatCurrency(
                                    transferRecommendations.recommended_monthly_amount,
                                  )}
                                </h4>
                                <small className="text-muted">
                                  {transferRecommendations.target_percentage}% of your income
                                </small>
                              </div>

                              <div className="mb-3">
                                <small className="text-muted">Available Surplus</small>
                                <div className="fw-bold text-info">
                                  {formatCurrency(transferRecommendations.available_surplus)}
                                </div>
                              </div>

                              <h6>Frequency Options:</h6>
                              {transferRecommendations.frequency_options.map((option, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className={`btn btn-outline-secondary btn-sm me-2 mb-2 ${
                                    transferRule.frequency === option.frequency ? 'active' : ''
                                  }`}
                                  onClick={() => {
                                    handleInputChange('frequency', option.frequency);
                                    if (transferRule.transfer_type === 'fixed_amount') {
                                      handleInputChange('amount', Math.round(option.amount));
                                    }
                                  }}
                                >
                                  {option.description}
                                </button>
                              ))}

                              <div className="mt-3">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    handleInputChange('transfer_type', 'fixed_amount');
                                    handleInputChange(
                                      'amount',
                                      Math.round(
                                        transferRecommendations.recommended_monthly_amount,
                                      ),
                                    );
                                    handleInputChange('frequency', 'monthly');
                                    setActiveTab('basic');
                                  }}
                                >
                                  Use Recommendation
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!incomeAnalysis && !analyzing && (
                    <div className="text-center py-5">
                      <i className="fas fa-search fa-3x text-muted mb-3"></i>
                      <p className="text-muted">
                        Click "Analyze Income" to get smart transfer recommendations based on your
                        transaction history.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Advanced Options Tab */}
              {activeTab === 'advanced' && (
                <div className="row">
                  <div className="col-md-6">
                    <div className="form-check form-switch mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="incomeDetection"
                        checked={transferRule.income_detection_enabled || false}
                        onChange={(e) =>
                          handleInputChange('income_detection_enabled', e.target.checked)
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="incomeDetection"
                      >
                        Enable Income Detection
                      </label>
                      <small className="d-block text-muted">
                        Automatically detect income patterns for percentage-based transfers
                      </small>
                    </div>

                    {transferRule.income_detection_enabled && (
                      <div className="mb-3">
                        <label className="form-label">Minimum Income Threshold</label>
                        <input
                          type="number"
                          className="form-control"
                          value={transferRule.minimum_income_threshold}
                          onChange={(e) =>
                            handleInputChange(
                              'minimum_income_threshold',
                              parseFloat(e.target.value),
                            )
                          }
                          min={0}
                          step={50}
                        />
                        <small className="text-muted">
                          Minimum amount to be considered as income
                        </small>
                      </div>
                    )}

                    <div className="mb-3">
                      <label className="form-label">Maximum Transfer Per Period</label>
                      <input
                        type="number"
                        className="form-control"
                        value={transferRule.maximum_transfer_per_period}
                        onChange={(e) =>
                          handleInputChange(
                            'maximum_transfer_per_period',
                            parseFloat(e.target.value),
                          )
                        }
                        min={0}
                        step={50}
                      />
                      <small className="text-muted">
                        Maximum amount to transfer in a single period
                      </small>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="form-check form-switch mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="surplusCalculation"
                        checked={transferRule.surplus_calculation_enabled || false}
                        onChange={(e) =>
                          handleInputChange('surplus_calculation_enabled', e.target.checked)
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="surplusCalculation"
                      >
                        Enable Smart Surplus Calculation
                      </label>
                      <small className="d-block text-muted">
                        Calculate transfers based on available surplus after expenses
                      </small>
                    </div>

                    <div className="card">
                      <div className="card-body">
                        <h6 className="card-title">
                          <i className="fas fa-info-circle me-2"></i>
                          Advanced Features
                        </h6>
                        <ul className="list-unstyled mb-0">
                          <li>
                            <i className="fas fa-check text-success me-2"></i>
                            Automatic retry for failed transfers
                          </li>
                          <li>
                            <i className="fas fa-check text-success me-2"></i>
                            Intelligent amount adjustment
                          </li>
                          <li>
                            <i className="fas fa-check text-success me-2"></i>
                            Transfer notifications
                          </li>
                          <li>
                            <i className="fas fa-check text-success me-2"></i>
                            Goal progress tracking
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !transferRule.source_account_id || !transferRule.amount}
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin me-2"></i>
                      {existingRule ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save me-2"></i>
                      {existingRule ? 'Update' : 'Create'} Transfer Rule
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferScheduler;
