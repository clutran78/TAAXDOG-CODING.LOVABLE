'use client';

import { useEffect, useState } from 'react';
import IncomeDetailModal from './incomeDetailModal';
import AddIncomeModal from './AddIncomeForm';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatCurrency } from '@/services/helperFunction';

export interface Transaction {
  id: string;
  amount: string;
  date: string;
  description: string;
  merchant: string;
  accountName: string;
  category?: string;
}

interface IncomeSource {
  name: string;
  amount: number;
  percentage: number;
  transactions?: Transaction[]
}

// const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

const NetIncomePage = () => {
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [show, setShow] = useState<boolean>(false);
  const [data, setData] = useState<IncomeSource | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadIncomeDetails = async () => {
    try {
      // const transactions: Transaction[] = JSON.parse(localStorage.getItem('bankTransactions') || '[]');

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

        const transactions: Transaction[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];

        const incomeTransactions = transactions.filter(tx => parseFloat(tx.amount) > 0);

        const incomeTotal = incomeTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

        const incomeByCategory: { [key: string]: { amount: number; transactions: Transaction[] } } = {};

        incomeTransactions.forEach(tx => {
          const category = tx.category || 'Other Income';
          if (!incomeByCategory[category]) {
            incomeByCategory[category] = { amount: 0, transactions: [] };
          }
          incomeByCategory[category].amount += parseFloat(tx.amount);
          incomeByCategory[category].transactions.push(tx);
        });

        const sortedSources: IncomeSource[] = Object.entries(incomeByCategory)
          .map(([name, data]) => ({
            name,
            amount: data.amount,
            percentage: (data.amount / incomeTotal) * 100,
            transactions: data.transactions
          }))
          .sort((a, b) => b.amount - a.amount);

        setIncomeSources(sortedSources);
        setTotalIncome(incomeTotal);
      })
    } catch (error) {
      console.error('Failed to load income details:', error);
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
  }

  const handleModal = () => setShow(false);

  return (
    <>
      <AddIncomeModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={loadIncomeDetails}
      />
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3>
            <i className="fas fa-money-bill-wave text-success me-2"></i>Net Income Details
          </h3>
          {/* Add Income Form */}
          <button className="btn btn-outline-success" onClick={() => setShowAddModal(true)}>
            + Add Income
          </button>

        </div>

        {/* Total Income Card */}
        <div className="card bg-light mb-4">
          <div className="card-body d-flex justify-content-between align-items-center">
            <h4 className="mb-0">Total Income</h4>
            <h3 className="text-success mb-0">{formatCurrency(totalIncome)}</h3>
          </div>
        </div>

        <h5 className="mb-3">Income Sources</h5>

        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-success" role="status"></div>
            <p className="mt-3">Loading income sources...</p>
          </div>
        ) : !loading && incomeSources.length === 0 ? (
          <div className="alert alert-info" id="no-income-sources-message">
            <i className="fas fa-info-circle me-2"></i>No income sources found. Add or connect your bank account.
          </div>
        ) : (
          <div id="income-sources-container">
            {incomeSources.map((source, idx) => (
              <div onClick={() => handleData(source)} className="cursor-pointer card mb-3" key={idx}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">{source.name}</h5>
                    <span className="badge bg-success">
                      {source.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <div className="text-muted">Monthly income</div>
                    <h4 className="text-success mb-0">
                      {formatCurrency(source.amount)}
                    </h4>
                  </div>
                  <div className="progress mt-3" style={{ height: '6px' }}>
                    <div
                      className="progress-bar bg-success"
                      style={{ width: `${source.percentage}%` }}
                      role="progressbar"
                      aria-valuenow={source.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {data && <IncomeDetailModal show={show} handleClose={handleModal} data={data} />}
    </>
  );
};

export default NetIncomePage;
