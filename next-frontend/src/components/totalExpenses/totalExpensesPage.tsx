"use client";

import { useEffect, useMemo, useState } from "react";
import {
  performExpenseSearch,
  setupFinancialFeatureHandlers,
} from "@/services/helperFunction";
import AddExpenseModal from "./AddExpensesForm";
import SearchBar from "../search-bar";
import { Expense } from "@/lib/types/expenses";
import ExpensesTable from "./expenses-table";
import PaginationControls from "@/shared/pagination-controls";
import { fetchUserExpenses } from "@/services/firebase-service";

const TotalExpensesPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expensesPerPage] = useState(10);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDetailedExpenses();
    setupFinancialFeatureHandlers();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.trim() === "") {
        loadDetailedExpenses();
      } else {
        performExpenseSearch(searchTerm.trim(), setFilteredExpenses);
      }
    }, 400);

    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const currentExpenses = useMemo(() => {
    const indexOfLastExpense = currentPage * expensesPerPage;
    const indexOfFirstExpense = indexOfLastExpense - expensesPerPage;
    return filteredExpenses.slice(indexOfFirstExpense, indexOfLastExpense);
  }, [filteredExpenses, currentPage, expensesPerPage]);

  const totalPages = useMemo(
    () => Math.ceil(filteredExpenses.length / expensesPerPage),
    [filteredExpenses, expensesPerPage]
  );

  async function loadDetailedExpenses() {
    try {
      const expenses = await fetchUserExpenses();

      const totalExpenses = expenses.reduce(
        (sum, tx) => sum + Math.abs(parseFloat(tx.amount)),
        0
      );
      const expensesValueElement = document.getElementById(
        "modal-detailed-expenses-value"
      );
      if (expensesValueElement) {
        expensesValueElement.textContent = formatCurrency(totalExpenses);
      }

      const sorted = expenses.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setFilteredExpenses(sorted);
      setLoading(false);
    } catch (error: any) {
      console.log(`Error loading detailed expenses: ${error.message}`);
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNext = () => {
    if (currentPage < totalPages)
      setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

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
          <button
            className="btn btn-outline-danger"
            onClick={() => setShowAddModal(true)}
          >
            + Add Expense
          </button>
        </div>

        {/* Totals and Search */}
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card">
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
              <SearchBar
                searchTerm={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search expenses..."
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          <ExpensesTable expenses={currentExpenses} loading={loading} />

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          )}
        </div>

        {/* View Categories Button */}
        <div className="d-flex justify-content-end mt-3">
          <button
            type="button"
            className="btn btn-primary"
            id="view-expense-categories-btn"
          >
            <i className="fas fa-chart-pie me-2"></i>View Expense Categories
          </button>
        </div>
      </div>
    </>
  );
};

export default TotalExpensesPage;
