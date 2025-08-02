import { showToast } from '@/services/helperFunction';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { apiRequest } from '@/lib/api-request';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  category: string;
  merchant: string;
  accountName: string;
  userId: string;
}

interface Props {
  show: boolean;
  onClose: () => void;
  onAdd: () => void;
}

const AddIncomeModal = ({ show, onClose, onAdd }: Props) => {
  const { data: session } = useSession();
  const [source, setSource] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);

  const commonSources = ['Salary', 'Business', 'Investments', 'Real Estate', 'Other'];

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const form = e.currentTarget;
    setValidated(true);

    const category = source === 'Other' ? customSource : source;
    const isValid = form.checkValidity();

    if (!isValid || !category || !amount) return;
    setLoading(true);

    try {
      if (!session?.user) {
        console.error('No authenticated user found. Cannot fetch user-specific data.');
        return;
      }

      const incomeData = {
        date: new Date().toISOString(),
        description: category,
        amount: parseFloat(amount),
        category,
        merchant_name: merchant || 'Manual Entry',
      };

      await apiRequest('/api/banking/transactions', {
        method: 'POST',
        body: {
          ...incomeData,
          transaction_type: 'income',
          direction: 'credit',
        },
      });

      showToast('Income added successfully', 'success');
      onAdd();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error adding income:', error);
      showToast(error.message || 'Error adding income', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSource('');
    setCustomSource('');
    setAmount('');
    setMerchant('');
    setValidated(false);
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      onExited={resetForm}
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>Add Income</Modal.Title>
      </Modal.Header>
      <form
        noValidate
        className={`needs-validation ${validated ? 'was-validated' : ''}`}
        onSubmit={handleAdd}
      >
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">Source</label>
            <select
              className="form-select"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
            >
              <option value="">-- Select --</option>
              {commonSources.map((src) => (
                <option
                  key={src}
                  value={src}
                >
                  {src}
                </option>
              ))}
            </select>
            <div className="invalid-feedback">Please select a source.</div>
          </div>

          {source === 'Other' && (
            <div className="mb-3">
              <label className="form-label">Custom Source</label>
              <input
                type="text"
                className="form-control"
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                required
              />
              <div className="invalid-feedback">Please enter a custom source.</div>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label">Amount</label>
            <input
              type="number"
              className="form-control"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="0.01"
              step="0.01"
            />
            <div className="invalid-feedback">Please enter a valid amount.</div>
          </div>

          <div className="mb-3">
            <label className="form-label">Payer</label>
            <input
              type="text"
              className="form-control"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              required
            />
            <div className="invalid-feedback">Please enter a payer name.</div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="success"
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                Adding...
              </>
            ) : (
              'Add Income'
            )}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default AddIncomeModal;
