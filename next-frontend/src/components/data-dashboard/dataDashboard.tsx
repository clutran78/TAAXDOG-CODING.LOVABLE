'use client';

import React, { useEffect, useState } from 'react';
import { loadDataDashboard } from '@/services/helperFunction';

const ITEMS_PER_PAGE = 10
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
        const dataDashboardSection = document.getElementById('data-dashboard-section') as HTMLElement | null;
        if (dataDashboardSection) {
            dataDashboardSection.style.display = 'block';
        }

        // Load transactions from localStorage
        const tx: Transaction[] = (JSON.parse(localStorage.getItem('bankTransactions') || '[]') as Transaction[]).map(t => ({
            ...t,
            amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
        }));
        setTransactions(tx);
        loadDataDashboard(); // Load charts
    }, [])

    // Pagination logic
    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE)

   const paginatedData = transactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);


    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(currentPage => currentPage - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage => currentPage + 1);
    };

    const renderPagination = () => (
        <div className="d-flex justify-content-between align-items-center mt-3">
            <button className="btn btn-outline-primary" disabled={currentPage === 1} onClick={handlePrev}>
                Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button className="btn btn-outline-primary" disabled={currentPage === totalPages} onClick={handleNext}>
                Next
            </button>
        </div>
    );

    return (
        <div>

            {/* <!-- Data Dashboard Section --> */}
            <div
                id="data-dashboard-section"
                style={{ display: 'none' }}
            >
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
                                            <div style={{ height: '300px' }}>
                                                <canvas id="categoryChart"></canvas>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <h6 className="mb-3">Income vs Expenses Over Time</h6>
                                            <div style={{ height: '300px' }}>
                                                <canvas id="timeChart"></canvas>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transaction History */}
                    <div className="row">
                        <div className="col-12">
                            <div className="card">
                                <div className="card-header d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">Transaction History</h5>
                                </div>
                                <div className="card-body">
                                    <div className="table-responsive">
                                        <table className="table table-hover">
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
                                                {paginatedData.map((tx:any, index) => {
                                                    const amount = parseFloat(tx.amount);
                                                    const date = new Date(tx.date).toLocaleDateString();
                                                    const type = amount >= 0 ? 'Income' : 'Expense';
                                                    const amountClass = amount >= 0 ? 'text-success' : 'text-danger';

                                                    return (
                                                        <tr key={index}>
                                                            <td>{date}</td>
                                                            <td>{tx.merchant || 'Unknown'}</td>
                                                            <td>{tx.category || 'Uncategorized'}</td>
                                                            <td className={amountClass}>${Math.abs(amount).toFixed(2)}</td>
                                                            <td>{type}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {renderPagination()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default DataDashboardComponent;
