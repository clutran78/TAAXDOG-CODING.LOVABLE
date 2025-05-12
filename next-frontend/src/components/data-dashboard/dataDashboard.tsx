'use client';

import React, { useEffect, useRef } from 'react';
import { loadDataDashboard } from '@/services/helperFunction';


const DataDashboardComponent = () => {

    useEffect(() => {
        const dataDashboardSection = document.getElementById('data-dashboard-section') as HTMLElement | null;

        if (dataDashboardSection) {
            dataDashboardSection.style.display = 'block';
            loadDataDashboard();
        }
    }, []);

    return (
        <div>

            {/* <!-- Data Dashboard Section --> */}
            <div
                id="data-dashboard-section"
                style={{ display: 'none'}}
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
                                            <tbody id="transactionsTableBody">
                                                {/* Transactions will be dynamically injected here */}
                                            </tbody>
                                        </table>
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
