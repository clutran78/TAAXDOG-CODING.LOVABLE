'use client';

import { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { useSession } from 'next-auth/react';
import { apiRequest } from '@/lib/api-request';
import { showToast } from '@/services/helperFunction';

interface Props {
  show: boolean;
  onClose: () => void;
  onAdd: () => void;
}

const AddExpenseModal = ({ show, onClose, onAdd }: Props) => {
  const { data: session } = useSession();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setValidated(true);

    if (!category || !amount || !session?.user) return;

    setLoading(true);
    try {
      const expenseData = {
        date: new Date().toISOString(),
        amount: Math.abs(parseFloat(amount)), // API will handle negative conversion
        category,
        merchant_name: merchant || 'Manual Entry',
        description: description || category,
      };

      await apiRequest('/api/banking/transactions', {
        method: 'POST',
        body: {
          ...expenseData,
          transaction_type: 'expense',
          direction: 'debit',
        },
      });

      showToast('Expense added successfully', 'success');
      onAdd();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('❌ Failed to add expense:', err);
      showToast(err.message || 'Error adding expense', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setMerchant('');
    setDescription('');
    setValidated(false);
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
    >
      <form
        noValidate
        onSubmit={handleAdd}
        className={`needs-validation ${validated ? 'was-validated' : ''}`}
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Expense</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">Amount</label>
            <input
              type="number"
              className="form-control"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Category</label>
            <input
              type="text"
              className="form-control"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Merchant</label>
            <input
              type="text"
              className="form-control"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <input
              type="text"
              className="form-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
            variant="danger"
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
              'Add Expense'
            )}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default AddExpenseModal;
