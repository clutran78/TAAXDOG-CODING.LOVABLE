'use client';
import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Goal } from '@/lib/types/goal';
import { showToast } from '@/lib/utils/helpers';
import { createGoal, updateGoal } from '@/lib/services/goals/client-goal-service';
import { Modal, Button } from 'react-bootstrap';
import { logger } from '@/lib/logger';
import {
  getDirectDebitEligibleAccounts,
  formatAccountDisplayName,
  calculateTransferAmount,
  validateAccountBalance,
  BasiqAccount,
} from '@/lib/services/banking/basiq-accounts-service';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface AddGoalFormProps {
  show: boolean;
  onClose: () => void;
  onAdd: () => void;
  goalToEdit?: Partial<Goal>;
  editGoalId?: string | null;
}

interface FormState {
  name: string;
  description: string;
  category: string;
  currentAmount: string;
  targetAmount: string;
  dueDate: string;
}

interface DirectDebitState {
  enabled: boolean;
  sourceAccountId: string;
  transferType: 'percentage' | 'fixed';
  transferAmount: string;
  frequency: 'weekly' | 'monthly' | 'bi-weekly';
  startDate: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORIES = [
  'Emergency Fund',
  'Savings',
  'Debt Payoff',
  'Retirement',
  'Home',
  'Car',
  'Education',
  'Travel',
  'Other',
] as const;

const INITIAL_FORM_STATE: FormState = {
  name: '',
  description: '',
  category: '',
  currentAmount: '',
  targetAmount: '',
  dueDate: '',
};

const INITIAL_DIRECT_DEBIT_STATE: DirectDebitState = {
  enabled: false,
  sourceAccountId: '',
  transferType: 'fixed',
  transferAmount: '',
  frequency: 'monthly',
  startDate: '',
};

// ============================================================================
// HELPER COMPONENTS (Memoized)
// ============================================================================

const CategorySelect = memo<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}>(({ value, onChange, disabled }) => (
  <select
    className="form-select"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    required
    disabled={disabled}
  >
    <option value="">-- Select --</option>
    {CATEGORIES.map((cat) => (
      <option
        key={cat}
        value={cat}
      >
        {cat}
      </option>
    ))}
  </select>
));

CategorySelect.displayName = 'CategorySelect';

const DirectDebitSection = memo<{
  directDebit: DirectDebitState;
  bankAccounts: BasiqAccount[];
  loadingAccounts: boolean;
  onDirectDebitChange: (updates: Partial<DirectDebitState>) => void;
  estimatedTransferAmount: number;
  disabled?: boolean;
}>(
  ({
    directDebit,
    bankAccounts,
    loadingAccounts,
    onDirectDebitChange,
    estimatedTransferAmount,
    disabled,
  }) => (
    <div className="border-top pt-3 mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h6 className="mb-1">Automated Savings (Direct Debit)</h6>
          <small className="text-muted">Automatically transfer money to this goal</small>
        </div>
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id="directDebitToggle"
            checked={directDebit.enabled}
            onChange={(e) => onDirectDebitChange({ enabled: e.target.checked })}
            disabled={disabled}
          />
          <label
            className="form-check-label"
            htmlFor="directDebitToggle"
          >
            Enable
          </label>
        </div>
      </div>

      {directDebit.enabled && (
        <div className="direct-debit-config">
          {/* Bank Account Selection */}
          <div className="mb-3">
            <label className="form-label">Source Bank Account</label>
            {loadingAccounts ? (
              <div className="form-control d-flex align-items-center">
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                ></span>
                Loading bank accounts...
              </div>
            ) : (
              <select
                className="form-select"
                value={directDebit.sourceAccountId}
                onChange={(e) => onDirectDebitChange({ sourceAccountId: e.target.value })}
                required={directDebit.enabled}
                disabled={disabled}
              >
                <option value="">-- Select Bank Account --</option>
                {bankAccounts.map((account) => (
                  <option
                    key={account.id}
                    value={account.id}
                  >
                    {formatAccountDisplayName(account)}
                  </option>
                ))}
              </select>
            )}
            <div className="invalid-feedback">Please select a bank account.</div>
          </div>

          {/* Transfer Configuration */}
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Transfer Type</label>
              <select
                className="form-select"
                value={directDebit.transferType}
                onChange={(e) =>
                  onDirectDebitChange({
                    transferType: e.target.value as 'percentage' | 'fixed',
                  })
                }
                disabled={disabled}
              >
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage of Balance</option>
              </select>
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">
                {directDebit.transferType === 'fixed' ? 'Amount ($)' : 'Percentage (%)'}
              </label>
              <input
                type="number"
                className="form-control"
                value={directDebit.transferAmount}
                onChange={(e) => onDirectDebitChange({ transferAmount: e.target.value })}
                min="0"
                max={directDebit.transferType === 'percentage' ? '50' : undefined}
                step={directDebit.transferType === 'fixed' ? '0.01' : '1'}
                required={directDebit.enabled}
                disabled={disabled}
                placeholder={directDebit.transferType === 'fixed' ? '0.00' : '0'}
              />
              {directDebit.transferType === 'percentage' && (
                <small className="text-muted">Maximum 50% for safety</small>
              )}
              {estimatedTransferAmount > 0 && (
                <small className="text-success d-block mt-1">
                  Estimated transfer: ${estimatedTransferAmount.toFixed(2)}
                </small>
              )}
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Frequency</label>
              <select
                className="form-select"
                value={directDebit.frequency}
                onChange={(e) =>
                  onDirectDebitChange({
                    frequency: e.target.value as 'weekly' | 'monthly' | 'bi-weekly',
                  })
                }
                disabled={disabled}
              >
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-control"
                value={directDebit.startDate}
                onChange={(e) => onDirectDebitChange({ startDate: e.target.value })}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                required={directDebit.enabled}
                disabled={disabled}
              />
              <div className="invalid-feedback">Please select a future start date.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  ),
);

DirectDebitSection.displayName = 'DirectDebitSection';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AddGoalForm: React.FC<AddGoalFormProps> = ({
  show,
  onClose,
  onAdd,
  goalToEdit,
  editGoalId,
}) => {
  // ========================================
  // STATE
  // ========================================

  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const [directDebit, setDirectDebit] = useState<DirectDebitState>(INITIAL_DIRECT_DEBIT_STATE);
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BasiqAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // ========================================
  // MEMOIZED VALUES
  // ========================================

  const estimatedTransferAmount = useMemo(() => {
    if (!directDebit.sourceAccountId || !directDebit.transferAmount) return 0;

    const account = bankAccounts.find((acc) => acc.id === directDebit.sourceAccountId);
    if (!account) return 0;

    return calculateTransferAmount(
      account,
      directDebit.transferType,
      parseFloat(directDebit.transferAmount) || 0,
    );
  }, [
    directDebit.sourceAccountId,
    directDebit.transferAmount,
    directDebit.transferType,
    bankAccounts,
  ]);

  // ========================================
  // CALLBACKS
  // ========================================

  const handleFormChange = useCallback((updates: Partial<FormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleDirectDebitChange = useCallback((updates: Partial<DirectDebitState>) => {
    setDirectDebit((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(INITIAL_FORM_STATE);
    setDirectDebit(INITIAL_DIRECT_DEBIT_STATE);
    setValidated(false);
    setBankAccounts([]);
  }, []);

  const calculateNextTransferDate = useCallback((startDate: string, frequency: string): string => {
    const start = new Date(startDate);
    const next = new Date(start);

    switch (frequency) {
      case 'weekly':
        next.setDate(start.getDate() + 7);
        break;
      case 'bi-weekly':
        next.setDate(start.getDate() + 14);
        break;
      case 'monthly':
      default:
        next.setMonth(start.getMonth() + 1);
        break;
    }

    return next.toISOString().split('T')[0];
  }, []);

  const validateDirectDebit = useCallback((): boolean => {
    if (!directDebit.enabled) return true;

    if (!directDebit.sourceAccountId) {
      showToast('Please select a bank account for direct debit', 'danger');
      return false;
    }

    const amount = parseFloat(directDebit.transferAmount);
    if (!directDebit.transferAmount || amount <= 0) {
      showToast('Please enter a valid transfer amount', 'danger');
      return false;
    }

    if (directDebit.transferType === 'percentage' && amount > 50) {
      showToast('Percentage transfers cannot exceed 50% for safety', 'danger');
      return false;
    }

    if (!directDebit.startDate) {
      showToast('Please select a start date for direct debit', 'danger');
      return false;
    }

    const selectedDate = new Date(directDebit.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      showToast('Start date must be in the future', 'danger');
      return false;
    }

    // Validate account balance
    const account = bankAccounts.find((acc) => acc.id === directDebit.sourceAccountId);
    if (account && directDebit.transferType === 'fixed') {
      if (!validateAccountBalance(account, amount)) {
        showToast('Insufficient account balance for the specified transfer amount', 'danger');
        return false;
      }
    }

    return true;
  }, [directDebit, bankAccounts]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setValidated(true);

      const { name, category, targetAmount, dueDate, currentAmount, description } = formState;

      if (!name || !category || !targetAmount || !dueDate) return;

      const form = e.currentTarget;
      if (!form.checkValidity()) return;

      // Validate direct debit configuration
      if (!validateDirectDebit()) return;

      setLoading(true);

      try {
        // Build direct debit configuration if enabled
        const directDebitConfig = directDebit.enabled
          ? {
              isEnabled: true,
              sourceAccountId: directDebit.sourceAccountId,
              transferType: directDebit.transferType,
              transferAmount: parseFloat(directDebit.transferAmount),
              frequency: directDebit.frequency,
              startDate: directDebit.startDate,
              nextTransferDate: calculateNextTransferDate(
                directDebit.startDate,
                directDebit.frequency,
              ),
              lastTransferDate: goalToEdit?.directDebit?.lastTransferDate || undefined,
            }
          : undefined;

        const goal = {
          ...goalToEdit,
          name,
          description,
          category,
          currentAmount: parseFloat(currentAmount || '0'),
          targetAmount: parseFloat(targetAmount || '0'),
          dueDate,
          directDebit: directDebitConfig,
        };

        if (editGoalId) {
          await updateGoal(editGoalId, goal);
          showToast('Goal updated successfully', 'success');
        } else {
          await createGoal(goal);
          showToast('Goal added successfully', 'success');
        }
        onAdd();
        onClose();
        resetForm();
      } catch (err) {
        logger.error(err);
        showToast('Error adding goal', 'danger');
      } finally {
        setLoading(false);
      }
    },
    [
      formState,
      directDebit,
      goalToEdit,
      editGoalId,
      validateDirectDebit,
      calculateNextTransferDate,
      onAdd,
      onClose,
      resetForm,
    ],
  );

  // ========================================
  // EFFECTS
  // ========================================

  // Initialize form with existing goal data
  useEffect(() => {
    if (goalToEdit) {
      setFormState({
        name: goalToEdit.name || '',
        description: goalToEdit.description || '',
        category: goalToEdit.category || '',
        currentAmount: goalToEdit.currentAmount?.toString() || '',
        targetAmount: goalToEdit.targetAmount?.toString() || '',
        dueDate: goalToEdit.dueDate || '',
      });

      // Populate direct debit fields if they exist
      const dd = goalToEdit.directDebit;
      if (dd) {
        setDirectDebit({
          enabled: dd.isEnabled,
          sourceAccountId: dd.sourceAccountId || '',
          transferType: dd.transferType || 'fixed',
          transferAmount: dd.transferAmount?.toString() || '',
          frequency: dd.frequency || 'monthly',
          startDate: dd.startDate || '',
        });
      }
    }
  }, [goalToEdit]);

  // Load bank accounts when direct debit is enabled
  useEffect(() => {
    const loadBankAccounts = async () => {
      if (directDebit.enabled && bankAccounts.length === 0) {
        setLoadingAccounts(true);
        try {
          const accounts = await getDirectDebitEligibleAccounts();
          setBankAccounts(accounts);
          if (accounts.length === 0) {
            showToast(
              'No eligible bank accounts found for direct debit. Please connect a bank account first.',
              'warning',
            );
          }
        } catch (error) {
          logger.error('Error loading bank accounts:', error);
          showToast('Failed to load bank accounts', 'danger');
        } finally {
          setLoadingAccounts(false);
        }
      }
    };

    loadBankAccounts();
  }, [directDebit.enabled, bankAccounts.length]);

  // ========================================
  // RENDER
  // ========================================

  return (
    <Modal
      show={show}
      onHide={onClose}
      onExited={resetForm}
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>{editGoalId ? 'Edit' : 'Add'} Financial Goal</Modal.Title>
      </Modal.Header>
      <form
        noValidate
        className={`needs-validation goal-form ${validated ? 'was-validated' : ''}`}
        onSubmit={handleSubmit}
      >
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">Goal Name</label>
            <input
              type="text"
              className="form-control"
              value={formState.name}
              onChange={(e) => handleFormChange({ name: e.target.value })}
              required
              disabled={loading}
            />
            <div className="invalid-feedback">Goal name is required.</div>
          </div>

          <div className="mb-3">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-control"
              rows={2}
              value={formState.description}
              onChange={(e) => handleFormChange({ description: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Category</label>
            <CategorySelect
              value={formState.category}
              onChange={(value) => handleFormChange({ category: value })}
              disabled={loading}
            />
            <div className="invalid-feedback">Please select a category.</div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Current Amount ($)</label>
              <input
                type="number"
                className="form-control"
                value={formState.currentAmount}
                onChange={(e) => handleFormChange({ currentAmount: e.target.value })}
                min="0"
                step="0.01"
                required
                disabled={loading}
              />
              <div className="invalid-feedback">Enter a valid amount (0 or more).</div>
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Target Amount ($)</label>
              <input
                type="number"
                className="form-control"
                value={formState.targetAmount}
                onChange={(e) => handleFormChange({ targetAmount: e.target.value })}
                min="0.01"
                step="0.01"
                required
                disabled={loading}
              />
              <div className="invalid-feedback">Target must be greater than zero.</div>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Due Date</label>
            <input
              type="date"
              className="form-control"
              value={formState.dueDate}
              onChange={(e) => handleFormChange({ dueDate: e.target.value })}
              required
              disabled={loading}
            />
            <div className="invalid-feedback">Please select a due date.</div>
          </div>

          {/* Direct Debit Configuration */}
          <DirectDebitSection
            directDebit={directDebit}
            bankAccounts={bankAccounts}
            loadingAccounts={loadingAccounts}
            onDirectDebitChange={handleDirectDebitChange}
            estimatedTransferAmount={estimatedTransferAmount}
            disabled={loading}
          />
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                {editGoalId ? 'Updating...' : 'Adding...'}
              </>
            ) : editGoalId ? (
              'Update Goal'
            ) : (
              'Add Goal'
            )}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default memo(AddGoalForm);
