"use client";
import { auth, db } from "@/lib/firebase";
import { Goal } from "@/lib/types/goal";
import { showToast } from "@/services/helperFunction";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Modal, Button } from "react-bootstrap";
import { 
  getDirectDebitEligibleAccounts, 
  formatAccountDisplayName, 
  calculateTransferAmount,
  validateAccountBalance,
  BasiqAccount 
} from "@/services/basiq-accounts-service";

interface Props {
  show: boolean;
  onClose: () => void;
  onAdd: () => void;
  goalToEdit?: Partial<Goal>;
  editGoalId?: string | null;
}
const AddGoalModal = ({
  show,
  onClose,
  onAdd,
  goalToEdit,
  editGoalId,
}: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Direct debit state variables
  const [directDebitEnabled, setDirectDebitEnabled] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [transferType, setTransferType] = useState<'percentage' | 'fixed'>('fixed');
  const [transferAmount, setTransferAmount] = useState("");
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'bi-weekly'>('monthly');
  const [startDate, setStartDate] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BasiqAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const categories = [
    "Emergency Fund",
    "Savings",
    "Debt Payoff",
    "Retirement",
    "Home",
    "Car",
    "Education",
    "Travel",
    "Other",
  ];

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory("");
    setCurrentAmount("");
    setTargetAmount("");
    setDueDate("");
    setValidated(false);
    
    // Reset direct debit fields
    setDirectDebitEnabled(false);
    setSourceAccountId("");
    setTransferType('fixed');
    setTransferAmount("");
    setFrequency('monthly');
    setStartDate("");
    setBankAccounts([]);
  };

  useEffect(() => {
    if (goalToEdit) {
      setName(goalToEdit.name || "");
      setDescription(goalToEdit.description || "");
      setCategory(goalToEdit.category || "");
      setCurrentAmount(goalToEdit.currentAmount?.toString() || "");
      setTargetAmount(goalToEdit.targetAmount?.toString() || "");
      setDueDate(goalToEdit.dueDate || "");
      
      // Populate direct debit fields if they exist
      const directDebit = goalToEdit.directDebit;
      if (directDebit) {
        setDirectDebitEnabled(directDebit.isEnabled);
        setSourceAccountId(directDebit.sourceAccountId || "");
        setTransferType(directDebit.transferType || 'fixed');
        setTransferAmount(directDebit.transferAmount?.toString() || "");
        setFrequency(directDebit.frequency || 'monthly');
        setStartDate(directDebit.startDate || "");
      }
    }
  }, [goalToEdit]);

  // Load bank accounts when direct debit is enabled
  useEffect(() => {
    const loadBankAccounts = async () => {
      if (directDebitEnabled && bankAccounts.length === 0) {
        setLoadingAccounts(true);
        try {
          const accounts = await getDirectDebitEligibleAccounts();
          setBankAccounts(accounts);
          if (accounts.length === 0) {
            showToast("No eligible bank accounts found for direct debit. Please connect a bank account first.", "warning");
          }
        } catch (error) {
          console.error("Error loading bank accounts:", error);
          showToast("Failed to load bank accounts", "danger");
        } finally {
          setLoadingAccounts(false);
        }
      }
    };

    loadBankAccounts();
  }, [directDebitEnabled, bankAccounts.length]);

  // Calculate next transfer date based on frequency and start date
  const calculateNextTransferDate = (startDate: string, frequency: string): string => {
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
  };

  // Get estimated transfer amount for display
  const getEstimatedTransferAmount = (): number => {
    if (!sourceAccountId || !transferAmount) return 0;
    
    const account = bankAccounts.find(acc => acc.id === sourceAccountId);
    if (!account) return 0;

    return calculateTransferAmount(account, transferType, parseFloat(transferAmount));
  };

  // Validate direct debit fields
  const validateDirectDebit = (): boolean => {
    if (!directDebitEnabled) return true;

    if (!sourceAccountId) {
      showToast("Please select a bank account for direct debit", "danger");
      return false;
    }

    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      showToast("Please enter a valid transfer amount", "danger");
      return false;
    }

    if (transferType === 'percentage' && parseFloat(transferAmount) > 50) {
      showToast("Percentage transfers cannot exceed 50% for safety", "danger");
      return false;
    }

    if (!startDate) {
      showToast("Please select a start date for direct debit", "danger");
      return false;
    }

    const selectedDate = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      showToast("Start date must be in the future", "danger");
      return false;
    }

    // Validate account balance
    const account = bankAccounts.find(acc => acc.id === sourceAccountId);
    if (account && transferType === 'fixed') {
      if (!validateAccountBalance(account, parseFloat(transferAmount))) {
        showToast("Insufficient account balance for the specified transfer amount", "danger");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidated(true);

    if (!name || !category || !targetAmount || !dueDate) return;

    const form = e.currentTarget;
    if (!form.checkValidity()) return;

    // Validate direct debit configuration
    if (!validateDirectDebit()) return;

    setLoading(true);

    try {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          showToast("User not authenticated", "danger");
          return;
        }

        // Build direct debit configuration if enabled
        const directDebitConfig = directDebitEnabled ? {
          isEnabled: true,
          sourceAccountId,
          transferType,
          transferAmount: parseFloat(transferAmount),
          frequency,
          startDate,
          nextTransferDate: calculateNextTransferDate(startDate, frequency),
          lastTransferDate: goalToEdit?.directDebit?.lastTransferDate || undefined
        } : undefined;

        const goal = {
          ...goalToEdit,
          name,
          description,
          category,
          currentAmount: parseFloat(currentAmount || "0"),
          targetAmount: parseFloat(targetAmount || "0"),
          dueDate,
          userId: user.uid,
          updatedAt: new Date().toISOString(),
          createdAt: goalToEdit?.createdAt || new Date().toISOString(),
          directDebit: directDebitConfig,
        };
        if (editGoalId) {
          await updateDoc(doc(db, "goals", editGoalId), goal);
          showToast("Goal updated successfully", "success");
        } else {
          await addDoc(collection(db, "goals"), goal);
          showToast("Goal added successfully", "success");
        }
        onAdd();
        onClose();
        resetForm();
      });
    } catch (err) {
      console.error(err);
      showToast("Error adding goal", "danger");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onClose} onExited={resetForm} centered>
      <Modal.Header closeButton>
        <Modal.Title>{editGoalId ? "Edit" : "Add"} Financial Goal</Modal.Title>
      </Modal.Header>
      <form
        noValidate
        className={`needs-validation goal-form ${
          validated ? "was-validated" : ""
        }`}
        onSubmit={handleSubmit}
      >
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">Goal Name</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="invalid-feedback">Goal name is required.</div>
          </div>

          <div className="mb-3">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-control"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">-- Select --</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <div className="invalid-feedback">Please select a category.</div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Current Amount ($)</label>
              <input
                type="number"
                className="form-control"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                min="0"
                step="0.01"
                required
              />
              <div className="invalid-feedback">
                Enter a valid amount (0 or more).
              </div>
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Target Amount ($)</label>
              <input
                type="number"
                className="form-control"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                min="0.01"
                step="0.01"
                required
              />
              <div className="invalid-feedback">
                Target must be greater than zero.
              </div>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">Due Date</label>
            <input
              type="date"
              className="form-control"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
            <div className="invalid-feedback">Please select a due date.</div>
          </div>

          {/* Direct Debit Configuration Section */}
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
                  checked={directDebitEnabled}
                  onChange={(e) => setDirectDebitEnabled(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="directDebitToggle">
                  Enable
                </label>
              </div>
            </div>

            {directDebitEnabled && (
              <div className="direct-debit-config">
                {/* Bank Account Selection */}
                <div className="mb-3">
                  <label className="form-label">Source Bank Account</label>
                  {loadingAccounts ? (
                    <div className="form-control d-flex align-items-center">
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Loading bank accounts...
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={sourceAccountId}
                      onChange={(e) => setSourceAccountId(e.target.value)}
                      required={directDebitEnabled}
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {formatAccountDisplayName(account)}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="invalid-feedback">Please select a bank account.</div>
                </div>

                {/* Transfer Type Selection */}
                <div className="mb-3">
                  <label className="form-label">Transfer Type</label>
                  <div className="d-flex gap-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="transferType"
                        id="transferTypeFixed"
                        value="fixed"
                        checked={transferType === 'fixed'}
                        onChange={(e) => setTransferType(e.target.value as 'fixed')}
                      />
                      <label className="form-check-label" htmlFor="transferTypeFixed">
                        Fixed Amount ($)
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="transferType"
                        id="transferTypePercentage"
                        value="percentage"
                        checked={transferType === 'percentage'}
                        onChange={(e) => setTransferType(e.target.value as 'percentage')}
                      />
                      <label className="form-check-label" htmlFor="transferTypePercentage">
                        Percentage (%)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Transfer Amount */}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">
                      {transferType === 'fixed' ? 'Amount ($)' : 'Percentage (%)'}
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      min={transferType === 'fixed' ? "0.01" : "1"}
                      max={transferType === 'percentage' ? "50" : undefined}
                      step={transferType === 'fixed' ? "0.01" : "1"}
                      required={directDebitEnabled}
                      placeholder={transferType === 'fixed' ? '50.00' : '10'}
                    />
                    <div className="invalid-feedback">
                      {transferType === 'fixed' 
                        ? 'Enter a valid amount (greater than $0)' 
                        : 'Enter a percentage (1-50%)'}
                    </div>
                    {transferAmount && sourceAccountId && (
                      <small className="text-muted">
                        Estimated transfer: ${getEstimatedTransferAmount().toFixed(2)}
                      </small>
                    )}
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Transfer Frequency</label>
                    <select
                      className="form-select"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as 'weekly' | 'monthly' | 'bi-weekly')}
                      required={directDebitEnabled}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="bi-weekly">Bi-weekly (every 2 weeks)</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                {/* Start Date */}
                <div className="mb-3">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]} // Tomorrow
                    required={directDebitEnabled}
                  />
                  <div className="invalid-feedback">Please select a future start date.</div>
                  {startDate && (
                    <small className="text-muted">
                      Next transfer: {calculateNextTransferDate(startDate, frequency)}
                    </small>
                  )}
                </div>

                {/* Goal Timeline Estimation */}
                {transferAmount && targetAmount && sourceAccountId && (
                  <div className="alert alert-info">
                    <small>
                      <strong>Goal Timeline:</strong> At ${getEstimatedTransferAmount().toFixed(2)} per {frequency}, 
                      you'll reach your goal of ${parseFloat(targetAmount).toFixed(2)} in approximately{' '}
                      {Math.ceil((parseFloat(targetAmount) - parseFloat(currentAmount || "0")) / getEstimatedTransferAmount())}{' '}
                      transfers.
                    </small>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Saving...
              </>
            ) : (
              "Save Goal"
            )}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default AddGoalModal;
