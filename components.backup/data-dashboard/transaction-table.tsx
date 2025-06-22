import { useDarkMode } from "@/providers/dark-mode-provider";
import PaginationControls from "@/shared/pagination-controls";
import React from "react";

interface Transaction {
  date: string;
  merchant?: string;
  category?: string;
  amount: number | string;
}

interface TransactionTableProps {
  transactions: Transaction[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
}

const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  currentPage,
  setCurrentPage,
  itemsPerPage,
}) => {
  const { darkMode } = useDarkMode();
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  const paginatedData = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage((currentPage) => currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages)
      setCurrentPage((currentPage) => currentPage + 1);
  };

  return (
    <div className="row">
      <div className="col-12">
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Transaction History</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table
                className={`table table-hover ${darkMode ? "table-dark" : ""}`}
              >
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length > 0 ? (
                    paginatedData.map((tx: any, index) => {
                      const amount = parseFloat(tx.amount);
                      const date = new Date(tx.date).toLocaleDateString();
                      const type = amount >= 0 ? "Income" : "Expense";
                      const amountClass =
                        amount >= 0 ? "text-success" : "text-danger";

                      return (
                        <tr key={index}>
                          <td>{date}</td>
                          <td>{tx.merchant || "Unknown"}</td>
                          <td>{tx.category || "Uncategorized"}</td>
                          <td className={amountClass}>
                            ${Math.abs(amount).toFixed(2)}
                          </td>
                          <td>{type}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center">
                        No transaction found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {transactions.length > itemsPerPage && (
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPrev={handlePrev}
                  onNext={handleNext}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionTable;
