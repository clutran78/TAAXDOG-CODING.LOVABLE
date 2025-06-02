"use client";

import { useEffect, useState } from "react";
import IncomeDetailModal from "./incomeDetailModal";
import AddIncomeModal from "./AddIncomeForm";
import { formatCurrency } from "@/services/helperFunction";
import { fetchIncomeTransactions } from "@/services/firebase-service";
import { IncomeSource, Transaction } from "@/lib/types/transactions";
import IncomeSourceCard from "./income-source-card";
import { useDarkMode } from "@/providers/dark-mode-provider";

interface IncomeTransactionResult {
  sources: IncomeSource[];
  total: number;
}

const NetIncomePage = () => {
  const { darkMode } = useDarkMode();
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [show, setShow] = useState<boolean>(false);
  const [data, setData] = useState<IncomeSource | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadIncomeDetails = async () => {
    try {
      setLoading(true);
      const { sources, total } =
        (await fetchIncomeTransactions()) as IncomeTransactionResult;

      setIncomeSources(sources);
      setTotalIncome(total);
    } catch (error) {
      console.error("Failed to load income details:", error);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 2800);
    }
  };

  useEffect(() => {
    loadIncomeDetails();
  }, []);

  const handleData = (source: IncomeSource) => {
    setData(source);
    setShow(true);
  };

  const handleModal = () => setShow(false);

  return (
    <>
      <AddIncomeModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={loadIncomeDetails}
      />
      <div className={`"container py-4`}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3>
            <i className="fas fa-money-bill-wave text-success me-2"></i>Net
            Income Details
          </h3>
          {/* Add Income Form */}
          <button
            className="btn btn-outline-success"
            onClick={() => setShowAddModal(true)}
          >
            + Add Income
          </button>
        </div>

        {/* Total Income Card */}
        <div className="card  mb-4">
          <div className="card-body d-flex justify-content-between align-items-center">
            <h4 className={`mb-0`}>Total Income</h4>
            <h3 className="text-success mb-0">{formatCurrency(totalIncome)}</h3>
          </div>
        </div>

        <h5 className={`mb-3`}>Income Sources</h5>

        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-success" role="status"></div>
            <p className="mt-3">Loading income sources...</p>
          </div>
        ) : !loading && incomeSources.length === 0 ? (
          <div className="alert alert-info" id="no-income-sources-message">
            <i className="fas fa-info-circle me-2"></i>No income sources found.
            Add or connect your bank account.
          </div>
        ) : (
          <div id="income-sources-container">
            {incomeSources.map((source, idx) => (
              <IncomeSourceCard
                key={idx}
                source={source}
                onClick={() => handleData(source)}
              />
            ))}
          </div>
        )}
      </div>
      {data && (
        <IncomeDetailModal show={show} handleClose={handleModal} data={data} />
      )}
    </>
  );
};

export default NetIncomePage;
