"use client";

import React, { useEffect, useState } from "react";
import { loadDataDashboard } from "@/services/helperFunction";
import TransactionTable from "./transaction-table";
import { fetchBankTransactions } from "@/services/firebase-service";

const ITEMS_PER_PAGE = 10;
interface Transaction {
  date: string;
  merchant?: string;
  category?: string;
  amount: number | string;
}

const DataDashboardComponent = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);

  useEffect(() => {
    const fetchData = async () => {
      const dataDashboardSection = document.getElementById(
        "data-dashboard-section"
      ) as HTMLElement | null;
      if (dataDashboardSection) {
        dataDashboardSection.style.display = "block";
      }

      try {
        const transactions = await fetchBankTransactions();
        const tx: Transaction[] = transactions.map((t: any) => ({
          ...t,
          amount:
            typeof t.amount === "string" ? parseFloat(t.amount) : t.amount,
        }));
        setTransactions(tx);
        loadDataDashboard(); // Load charts or metrics
      } catch (error) {
        console.error("Error loading bank transactions:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      {/* <!-- Data Dashboard Section --> */}
      <div id="data-dashboard-section" style={{ display: "none" }}>
        <div className="container-fluid">
          {/* Financial Overview */}
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">Financial Overview</h5>
                </div>
                <div className="card-body h-sm-auto ">
                  <div className="row">
                    <div className="col-lg-6">
                      <h6 className="mb-3">Expenses by Category</h6>
                      <div style={{ height: "300px" }}>
                        <canvas id="categoryChart"></canvas>
                      </div>
                    </div>
                    <div className="col-lg-6">
                      <h6 className="mb-3">Income vs Expenses Over Time</h6>
                      <div style={{ height: "300px" }}>
                        <canvas id="timeChart"></canvas>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <TransactionTable
            transactions={transactions}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>
    </div>
  );
};

export default DataDashboardComponent;
