import { useEffect, useRef, useState } from 'react';
import { fetchBankTransactions } from '@/services/firebase-service';
import PaginationControls from '../pagination-controls';

interface Expense {
  date: string;
  description?: string;
  merchant?: string;
  category?: string;
  accountName?: string;
  amount: string;
}

const TotalExpensesModal = () => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredExpenses, setFilteredExpenses] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [expensesPerPage] = useState(10);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);

  useEffect(() => {
    loadAndSetExpenses();
  }, []);

  const indexOfLastExpense = currentPage * expensesPerPage;
  const indexOfFirstExpense = indexOfLastExpense - expensesPerPage;
  const currentExpenses = filteredExpenses.slice(indexOfFirstExpense, indexOfLastExpense);
  const totalPages = Math.ceil(filteredExpenses.length / expensesPerPage);

  const loadAndSetExpenses = async () => {
    try {
      const transactions = await fetchBankTransactions();

      // Filter for expenses (negative amounts)
      const expenses = transactions
        .filter((tx: any) => parseFloat(tx.amount) < 0)
        .map((tx: any) => ({
          date: tx.date,
          description: tx.description,
          merchant: tx.merchant,
          category: tx.category,
          accountName: tx.accountName,
          amount: tx.amount,
        }));

      setAllExpenses(expenses);
      setFilteredExpenses(expenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    if (term === '') {
      setFilteredExpenses(allExpenses);
    } else {
      const filtered = allExpenses.filter(
        (expense) =>
          expense.description?.toLowerCase().includes(term) ||
          expense.merchant?.toLowerCase().includes(term) ||
          expense.category?.toLowerCase().includes(term),
      );
      setFilteredExpenses(filtered);
    }
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return Math.abs(num).toFixed(2);
  };

  return (
    <div
      className="modal fade"
      id="totalExpensesModal"
      tabIndex={-1}
      aria-labelledby="totalExpensesModalLabel"
      aria-hidden="true"
      ref={modalRef}
    >
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-danger text-white">
            <h5
              className="modal-title"
              id="totalExpensesModalLabel"
            >
              <i className="fas fa-arrow-down-circle me-2"></i>
              Total Expenses Details
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <div className="input-group">
                <span className="input-group-text">
                  <i className="fas fa-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control"
                  id="expenseSearch"
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={handleSearch}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th className="text-end">Amount</th>
                  </tr>
                </thead>
                <tbody id="expensesList">
                  {currentExpenses.map((expense, index) => (
                    <tr key={index}>
                      <td>{formatDate(expense.date)}</td>
                      <td>
                        <div className="fw-medium">{expense.description}</div>
                        {expense.merchant && (
                          <small className="text-muted">{expense.merchant}</small>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {expense.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td>{expense.accountName}</td>
                      <td className="text-end text-danger">${formatCurrency(expense.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              data-bs-dismiss="modal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalExpensesModal;
