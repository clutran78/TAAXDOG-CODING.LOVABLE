'use client';
import { auth, db } from '@/lib/firebase';
import { Goal } from '@/lib/types/goal';
import { showToast } from '@/services/helperFunction';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';

interface Props {
  show: boolean;
  onClose: () => void;
  onAdd: () => void;
  goalToEdit?: Partial<Goal>;
  editGoalId?: string | null;
}
const AddGoalModal = ({ show, onClose, onAdd, goalToEdit, editGoalId }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);

  const categories = [
    'Emergency Fund',
    'Savings',
    'Debt Payoff',
    'Retirement',
    'Home',
    'Car',
    'Education',
    'Travel',
    'Other',
  ];

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('');
    setCurrentAmount('');
    setTargetAmount('');
    setDueDate('');
    setValidated(false);
  };

  useEffect(() => {
    if (goalToEdit) {
      setName(goalToEdit.name || '');
      setDescription(goalToEdit.description || '');
      setCategory(goalToEdit.category || '');
      setCurrentAmount(goalToEdit.currentAmount?.toString() || '');
      setTargetAmount(goalToEdit.targetAmount?.toString() || '');
      setDueDate(goalToEdit.dueDate || '');
    }
  }, [goalToEdit]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidated(true);

    if (!name || !category || !targetAmount || !dueDate) return;

    const form = e.currentTarget;
    if (!form.checkValidity()) return;

    setLoading(true);

    try {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          showToast('User not authenticated', 'danger');
          return;
        }

        const goal = {
          ...goalToEdit,
          name,
          description,
          category,
          currentAmount: parseFloat(currentAmount || '0'),
          targetAmount: parseFloat(targetAmount || '0'),
          dueDate,
          userId: user.uid,
          updatedAt: new Date().toISOString(),
          createdAt: goalToEdit?.createdAt || new Date().toISOString(),
        };
        if (editGoalId) {
          await updateDoc(doc(db, 'goals', editGoalId), goal);
          showToast('Goal updated successfully', 'success');
        } else {
          await addDoc(collection(db, 'goals'), goal);
          showToast('Goal added successfully', 'success');
        }
        onAdd();
        onClose();
        resetForm();
      });
    } catch (err) {
      console.error(err);
      showToast('Error adding goal', 'danger');
    } finally {
      setLoading(false);
    }
  };

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
                <option
                  key={cat}
                  value={cat}
                >
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
              <div className="invalid-feedback">Enter a valid amount (0 or more).</div>
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
              <div className="invalid-feedback">Target must be greater than zero.</div>
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
            variant="primary"
            disabled={loading}
          >
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
              'Save Goal'
            )}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

export default AddGoalModal;
