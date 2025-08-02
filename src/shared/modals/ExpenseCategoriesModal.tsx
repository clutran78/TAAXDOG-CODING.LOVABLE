import { useEffect, useRef, useState } from 'react';
import {
  openExpenseCategoriesModal,
  performExpenseSearch,
  setupFinancialFeatureHandlers,
} from '@/services/helperFunction';
import { useSession } from 'next-auth/react';
import { apiRequest } from '@/lib/api-request';
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
  const { data: session } = useSession();
  const modalRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredExpenses, setFilteredExpenses] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [expensesPerPage] = useState(10);

  useEffect(() => {
    if (session) {
      loadAndSetExpenses();
    }
    setupFinancialFeatureHandlers();
  }, [session]);

  const indexOfLastExpense = currentPage * expensesPerPage;
  const indexOfFirstExpense = indexOfLastExpense - expensesPerPage;
  const currentExpenses = filteredExpenses.slice(indexOfFirstExpense, indexOfLastExpense);
  const totalPages = Math.ceil(filteredExpenses.length / expensesPerPage);

  const loadAndSetExpenses = async () => {
    try {
      if (!session?.user) {
        console.error('No authenticated user found. Cannot fetch user-specific data.');
        return;
      }

      // Fetch transactions from API
      const response = await apiRequest('/api/banking/transactions', {
        method: 'GET',
      });

      const transactions = response.transactions || [];

      // Filter for expenses (negative amounts)
      const expenses = transactions.filter(
        (tx: any) => (typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount) < 0,
      );

      const total = expenses.reduce(
        (sum: number, tx: any) =>
          sum + Math.abs(typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount),
        0,
      );

      const display = document.getElementById('modal-detailed-expenses-value');
      if (display)
        display.textContent = total.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        });

      setFilteredExpenses(
        expenses.sort(
          (a: any, b: any) =>
            new Date(b.transactionDate || b.date).getTime() -
            new Date(a.transactionDate || a.date).getTime(),
        ),
      );
    } catch (e) {
      console.error('Failed to load expenses', e);
    }
  };

  // Debounced search
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.trim() === '') {
        loadAndSetExpenses();
      } else {
        performExpenseSearch(searchTerm, setFilteredExpenses);
      }
    }, 400);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const openModal = () => {
    import('bootstrap/js/dist/modal').then(({ default: Modal }) => {
      if (modalRef.current) {
        const modal = Modal.getOrCreateInstance(modalRef.current);
        modal.show();
      }
    });
  };

  const closeModal = () => {
    import('bootstrap/js/dist/modal').then(({ default: Modal }) => {
      if (modalRef.current) {
        const modal = Modal.getInstance(modalRef.current);
        modal?.hide();
      }
    });
  };

  useEffect(() => {
    (window as any).openExpensesModal = openModal;
  }, []);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div
      className="modal fade"
      id="total-expenses-modal"
      tabIndex={-1}
      aria-labelledby="total-expenses-modal-label"
      style={{ zIndex: '9999' }}
      aria-hidden="true"
      ref={modalRef}
    >
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-danger text-white">
            <h5
              className="modal-title"
              id="total-expenses-modal-label"
            >
              <i className="fas fa-receipt me-2"></i> Detailed Expenses
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={closeModal}
              aria-label="Close"
            ></button>
          </div>

          <div className="modal-body">
            {/* Totals and Search */}
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="card bg-light">
                  <div className="card-body d-flex justify-content-between align-items-center">
                    <h4 className="mb-0">Total Expenses</h4>
                    <h3
                      className="text-danger mb-0"
                      id="modal-detailed-expenses-value"
                    >
                      $0.00
                    </h3>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search expenses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* No Results Message */}
            {filteredExpenses.length === 0 && (
              <div className="alert alert-info">
                <i className="fas fa-info-circle me-2"></i>No expenses found. Connect your bank
                account to see your expenses.
              </div>
            )}

            <div className="table-responsive">
              <table className="table table-hover">
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
                <tbody>
                  {currentExpenses.length > 0 ? (
                    currentExpenses.map((expense, index) => {
                      const amount = Math.abs(
                        typeof expense.amount === 'string'
                          ? parseFloat(expense.amount)
                          : expense.amount,
                      ).toFixed(2);
                      const date = new Date(
                        expense.transactionDate || expense.date,
                      ).toLocaleDateString();
                      return (
                        <tr key={index}>
                          <td>{date}</td>
                          <td>{expense.description || 'No description'}</td>
                          <td>{expense.merchantName || expense.merchant || 'Unknown'}</td>
                          <td>
                            <span className="badge bg-primary">
                              {expense.category || 'Uncategorized'}
                            </span>
                          </td>
                          <td>{expense.accountName || 'Unknown Account'}</td>
                          <td className="text-end text-danger">${amount}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center"
                      >
                        No expenses found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {currentExpenses.length > 10 && (
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPrev={handlePrev}
                  onNext={handleNext}
                />
              )}
            </div>

            <div className="d-flex justify-content-end mt-3 cursor-pointer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setTimeout(() => openExpenseCategoriesModal(), 400)}
              >
                <i className="fas fa-chart-pie me-2"></i>View Expense Categories
              </button>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeModal}
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
