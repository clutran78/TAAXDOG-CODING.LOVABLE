'use client';

import { useEffect, useState } from 'react';
import {
  performExpenseSearch,
  setupFinancialFeatureHandlers,
} from '@/services/helperFunction';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import AddExpenseModal from './AddExpensesForm';
import { onAuthStateChanged } from 'firebase/auth';

// Define the structure of an expense item
interface Expense {
  date: string;
  description?: string;
  merchant?: string;
  category?: string;
  accountName?: string;
  amount: string;
}

const TotalExpensesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expensesPerPage] = useState(10);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDetailedExpenses();
    setupFinancialFeatureHandlers();
    setTimeout(() => {
      setLoading(false)
    }, 2400);
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.trim() === '') {
        loadDetailedExpenses();
      } else {
        performExpenseSearch(searchTerm.trim(), setFilteredExpenses);
      }
    }, 400);

    return () => clearTimeout(debounce);
  }, [searchTerm]);


  const indexOfLastExpense = currentPage * expensesPerPage;
  const indexOfFirstExpense = indexOfLastExpense - expensesPerPage;
  const currentExpenses = filteredExpenses.slice(indexOfFirstExpense, indexOfLastExpense);
  const totalPages = Math.ceil(filteredExpenses.length / expensesPerPage);


  async function loadDetailedExpenses() {
    try {

      onAuthStateChanged(auth, async (user) => {

        if (!user) {
          console.error('No authenticated user found. Cannot fetch user-specific data.');
          return;
        }

        const q = query(
          collection(db, 'bankTransactions'),
          where('userId', '==', user?.uid)
        );


        const snapshot = await getDocs(q);

        // Map Firestore docs to Expense[]
        const transactions: Expense[] = snapshot.docs.map(doc => doc.data() as Expense);

        const expenses = transactions.filter(tx => parseFloat(tx.amount) < 0);
console.log("expenses",expenses);

        const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);
        const expensesValueElement = document.getElementById('modal-detailed-expenses-value');
        if (expensesValueElement) {
          expensesValueElement.textContent = formatCurrency(totalExpenses);
        }

        const sorted = expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // ✅ This needs to be defined somewhere in your component context or global state
        setFilteredExpenses(sorted);
      })
    } catch (error: any) {
      console.log(`Error loading detailed expenses: ${error.message}`);
    }
  }

  function formatCurrency(amount: number): string {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }

  return (
    <>
      <AddExpenseModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={loadDetailedExpenses}
      />
      <div className="container py-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3>
            <i className="fas fa-receipt text-danger me-2"></i>Detailed Expenses
          </h3>
          <button className="btn btn-outline-danger" onClick={() => setShowAddModal(true)}>
            + Add Expense
          </button>
        </div>

        {/* Totals and Search */}
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card bg-light">
              <div className="card-body d-flex justify-content-between align-items-center">
                <h4 className="mb-0">Total Expenses</h4>
                <h3 className="text-danger mb-0" id="modal-detailed-expenses-value">$0.00</h3>
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

        {/* Table */}
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : currentExpenses.length > 0 ? (
                currentExpenses.map((expense, index) => {
                  const amount = Math.abs(parseFloat(expense.amount)).toFixed(2);
                  const date = new Date(expense.date).toLocaleDateString();
                  return (
                    <tr key={index}>
                      <td>{date}</td>
                      <td>{expense.description || 'No description'}</td>
                      <td>{expense.merchant || 'Unknown'}</td>
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
                  <td colSpan={6} className="text-center">
                    No expenses found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 10 && !loading && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <button
                className="btn btn-outline-primary"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>

              <span className="mx-2">
                Page {currentPage} of {totalPages}
              </span>

              <button
                className="btn btn-outline-primary"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* View Categories Button */}
        <div className="d-flex justify-content-end mt-3">
          <button type="button" className="btn btn-primary" id="view-expense-categories-btn">
            <i className="fas fa-chart-pie me-2"></i>View Expense Categories
          </button>
        </div>
      </div>
    </>
  );
};

export default TotalExpensesPage;
