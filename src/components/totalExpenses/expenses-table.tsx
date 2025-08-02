import { Expense } from '@/lib/types/expenses';
import { useDarkMode } from '@/providers/dark-mode-provider';
import React from 'react';

interface ExpensesTableProps {
  expenses: Expense[];
  loading: boolean;
  error?: string;
}

const ExpensesTable: React.FC<ExpensesTableProps> = ({ expenses, loading, error }) => {
  const { darkMode } = useDarkMode();
  const renderTableBody = () => {
    if (loading) {
      return (
        <tr>
          <td
            colSpan={6}
            className="text-center"
          >
            <div
              className="spinner-border text-primary"
              role="status"
            >
              <span className="visually-hidden">Loading...</span>
            </div>
          </td>
        </tr>
      );
    }

    if (error) {
      return (
        <tr>
          <td
            colSpan={6}
            className="text-center"
          >
            <div className="alert alert-danger mb-0">{error}</div>
          </td>
        </tr>
      );
    }

    if (expenses.length === 0) {
      return (
        <tr>
          <td
            colSpan={6}
            className="text-center"
          >
            No expenses found.
          </td>
        </tr>
      );
    }

    return expenses.map((expense, index) => {
      const amount = Math.abs(
        typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount,
      ).toFixed(2);
      const date = new Date(expense.date).toLocaleDateString();
      return (
        <tr key={index}>
          <td>{date}</td>
          <td>{expense.description || 'No description'}</td>
          <td>{expense.merchant || 'Unknown'}</td>
          <td>
            <span className="badge bg-primary">{expense.category || 'Uncategorized'}</span>
          </td>
          <td>{expense.accountName || 'Unknown Account'}</td>
          <td className="text-end text-danger">${amount}</td>
        </tr>
      );
    });
  };

  return (
    <div className="table-responsive">
      <table className={`table table-hover ${darkMode ? 'table-dark' : ''}`}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Merchant</th>
            <th>Category</th>
            <th>Account</th>
            <th className="text-end">Amount</th>
          </tr>
        </thead>
        <tbody>{renderTableBody()}</tbody>
      </table>
    </div>
  );
};

export default ExpensesTable;
