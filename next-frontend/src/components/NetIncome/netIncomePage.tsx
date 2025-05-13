'use client';

import { useEffect, useState } from 'react';

interface Transaction {
  amount: string;
  category?: string;
}

interface IncomeSource {
  name: string;
  amount: number;
  percentage: number;
}

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

const NetIncomePage = () => {
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadIncomeDetails();
  }, []);

  const loadIncomeDetails = () => {
    try {
      const transactions: Transaction[] = JSON.parse(
        localStorage.getItem('bankTransactions') || '[]'
      );

      const incomeTransactions = transactions.filter(
        (tx) => parseFloat(tx.amount) > 0
      );

      const incomeTotal = incomeTransactions.reduce(
        (sum, tx) => sum + parseFloat(tx.amount),
        0
      );

      const incomeByCategory: { [key: string]: number } = {};
      incomeTransactions.forEach((tx) => {
        const category = tx.category || 'Other Income';
        incomeByCategory[category] =
          (incomeByCategory[category] || 0) + parseFloat(tx.amount);
      });

      const sortedSources: IncomeSource[] = Object.entries(incomeByCategory)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: (amount / incomeTotal) * 100,
        }))
        .sort((a, b) => b.amount - a.amount);

      setIncomeSources(sortedSources);
      setTotalIncome(incomeTotal);
    } catch (error) {
      console.error('Failed to load income details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>
          <i className="fas fa-money-bill-wave text-success me-2"></i>Net Income
          Details
        </h3>
        {/* You can optionally add a back button here */}
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
      ) : incomeSources.length === 0 ? (
        <div className="alert alert-info" id="no-income-sources-message">
          <i className="fas fa-info-circle me-2"></i>No income sources found.
          Connect your bank account to see your income details.
        </div>
      ) : (
        <div id="income-sources-container">
          {incomeSources.map((source, idx) => (
            <div className="card mb-3" key={idx}>
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
  );
};

export default NetIncomePage;
