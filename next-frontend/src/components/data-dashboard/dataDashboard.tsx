"use client";

import React, { useEffect, useState } from "react";
import { loadDataDashboard } from "@/services/helperFunction";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import TransactionTable from "./transaction-table";

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
        onAuthStateChanged(auth, async (user) => {
          if (!user) {
            console.error(
              "No authenticated user found. Cannot fetch user-specific data."
            );
            return;
          }

          const q = query(
            collection(db, "bankTransactions"),
            where("userId", "==", user?.uid)
          );

          const snapshot = await getDocs(q);
          const transactions = snapshot.docs.map((doc) => doc.data());

          const tx: Transaction[] = transactions.map((t: any) => ({
            ...t,
            amount:
              typeof t.amount === "string" ? parseFloat(t.amount) : t.amount,
          }));
          setTransactions(tx);
          loadDataDashboard(); // Load charts or metrics
        });
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
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <h6 className="mb-3">Expenses by Category</h6>
                      <div style={{ height: "300px" }}>
                        <canvas id="categoryChart"></canvas>
                      </div>
                    </div>
                    <div className="col-md-6">
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
