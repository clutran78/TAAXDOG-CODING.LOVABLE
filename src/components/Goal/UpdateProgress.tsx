'use client';
import { Goal } from '@/lib/types/goal';
import { updateGoalProgress } from '@/services/firebase-service';
import { showToast } from '@/services/helperFunction';
import React, { useEffect, useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';

interface Props {
  show: boolean;
  onClose: () => void;
  goal: Goal | null;
}

const UpdateProgressModal: React.FC<Props> = ({ show, onClose, goal }) => {
  const [amountToAdd, setAmountToAdd] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAmountToAdd('');
  }, [goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal) return;

    const additional = parseFloat(amountToAdd);
    if (isNaN(additional) || additional <= 0) {
      showToast('Please enter a valid positive number.', 'warning');
      return;
    }

    let newAmount = goal.currentAmount + additional;

    if (newAmount > goal.targetAmount) {
      const confirmCap = window.confirm("You've exceeded the target. Cap at target amount?");
      if (confirmCap) newAmount = goal.targetAmount;
    }

    try {
      setLoading(true);
      await updateGoalProgress(goal.id, newAmount);
      showToast(`Added $${additional.toFixed(2)} to "${goal.name}"`, 'success');
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Error updating progress', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
    >
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>Update Progress</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {goal && (
            <>
              <p className="mb-1">
                <strong>Goal:</strong> {goal.name}
              </p>
              <p className="mb-1">
                <strong>Current:</strong> ${goal.currentAmount.toFixed(2)}
              </p>
              <p className="mb-3">
                <strong>Target:</strong> ${goal.targetAmount.toFixed(2)}
              </p>

              <Form.Group controlId="amountToAdd">
                <Form.Label>Amount to Add</Form.Label>
                <Form.Control
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amountToAdd}
                  onChange={(e) => setAmountToAdd(e.target.value)}
                  placeholder="Enter amount"
                />
              </Form.Group>
            </>
          )}
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
                <span className="spinner-border spinner-border-sm me-2" />
                Updating...
              </>
            ) : (
              'Update Progress'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default UpdateProgressModal;
