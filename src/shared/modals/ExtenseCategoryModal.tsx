'use client';

import { Modal } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getData } from '@/services/api/apiController';
import { formatCurrency } from '@/services/helperFunction.js';

interface ExpenseCategory {
  name: string;
  amount: number;
  percentage: number;
}

interface ExpenseCategoriesModalProps {
  show: boolean;
  handleClose: () => void;
}

interface Expense {
  date: string;
  description?: string;
  merchant?: string;
  category?: string;
  accountName?: string;
  amount: string;
}

const ExpenseCategoriesModal: React.FC<ExpenseCategoriesModalProps> = ({ show, handleClose }) => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: session } = useSession();

  useEffect(() => {
    if (show && session?.user) {
      loadExpenseCategories();
    }
  }, [show, session]);

  const loadExpenseCategories = async () => {
    try {
      setLoading(true);

      // Fetch transactions from API
      const response = await getData('/api/banking/transactions');
      const transactions = response.data || [];

      // Filter for expense transactions (negative amounts)
      const expenses = transactions.filter((t: any) => parseFloat(t.amount) < 0);

      // Calculate total expenses
      const total = expenses.reduce(
        (sum: number, t: any) => sum + Math.abs(parseFloat(t.amount)),
        0,
      );
      setTotalExpenses(total);

      // Group by category
      const categoryMap: { [key: string]: number } = {};
      expenses.forEach((expense: any) => {
        const category = expense.category || 'Other';
        const amount = Math.abs(parseFloat(expense.amount));
        categoryMap[category] = (categoryMap[category] || 0) + amount;
      });

      // Convert to array and calculate percentages
      const categoryData: ExpenseCategory[] = Object.entries(categoryMap)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      setCategories(categoryData);
    } catch (error) {
      console.error('Error loading expense categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="lg"
    >
      <Modal.Header closeButton>
        <Modal.Title>Expense Categories</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center p-4">
            <div
              className="spinner-border"
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <h5>Total Expenses: {formatCurrency(totalExpenses)}</h5>
            </div>

            <div className="expense-categories-list">
              {filteredCategories.length === 0 ? (
                <p className="text-muted">No categories found</p>
              ) : (
                filteredCategories.map((category) => (
                  <div
                    key={category.name}
                    className="category-item mb-3 p-3 border rounded"
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="mb-1">{category.name}</h6>
                        <div
                          className="progress"
                          style={{ width: '200px', height: '10px' }}
                        >
                          <div
                            className="progress-bar bg-primary"
                            role="progressbar"
                            style={{ width: `${category.percentage}%` }}
                            aria-valuenow={category.percentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          ></div>
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="fw-bold">{formatCurrency(category.amount)}</div>
                        <small className="text-muted">{category.percentage.toFixed(1)}%</small>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default ExpenseCategoriesModal;
