'use client';

import { Modal } from 'react-bootstrap';
import { useEffect, useState } from 'react';

interface ExpenseCategory {
  name: string;
  amount: number;
  percentage: number;
}

interface ExpenseCategoriesModalProps {
  show: boolean;
  handleClose: () => void;
}

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

const ExpenseCategoriesModal: React.FC<ExpenseCategoriesModalProps> = ({
  show,
  handleClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    if (show) {
      loadExpenseCategories();
    }
  }, [show]);

  const loadExpenseCategories = () => {
    try {
      setLoading(true);
      const transactions = JSON.parse(localStorage.getItem('bankTransactions') || '[]');
      const expenseTransactions = transactions.filter((tx: any) => parseFloat(tx.amount) < 0);

      const total = expenseTransactions.reduce(
        (sum: number, tx: any) => sum + Math.abs(parseFloat(tx.amount)),
        0
      );

      const categoryTotals: { [key: string]: number } = {};
      expenseTransactions.forEach((tx: any) => {
        const category = tx.category || 'Uncategorized';
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(parseFloat(tx.amount));
      });

      const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: (amount / total) * 100,
        }));

      setTotalExpenses(total);
      setCategories(sortedCategories);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load expense categories:', error);
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} className="modal-lg">
      <div className="modal-header">
        <h5 className="modal-title">
          <i className="fas fa-chart-pie text-danger me-2"></i>Expense Categories
        </h5>
        <button type="button" className="btn-close" onClick={handleClose}></button>
      </div>

      <div className="modal-body">
        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Loading expense data...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="alert alert-info">
            <i className="fas fa-info-circle me-2"></i>No expense categories found.
          </div>
        ) : (
          <>
            <h5 className="mb-3">Total Expenses: {formatCurrency(totalExpenses)}</h5>
            <ul className="list-group">
              {categories.map((category, index) => (
                <li
                  key={index}
                  className="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    <strong>{category.name}</strong>
                    <div className="text-muted small">{category.percentage.toFixed(1)}%</div>
                  </div>
                  <span className="text-danger">{formatCurrency(category.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={handleClose}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default ExpenseCategoriesModal;
