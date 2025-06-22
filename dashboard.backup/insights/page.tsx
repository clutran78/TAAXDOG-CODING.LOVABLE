'use client';

import { useState, useEffect } from 'react';
import { SpendingChart } from '../../../components/insights/SpendingChart';
import { TaxDeductionsPanel } from '../../../components/insights/TaxDeductionsPanel';
import { FinancialGoalsPanel } from '../../../components/insights/FinancialGoalsPanel';
import { RiskAssessmentPanel } from '../../../components/insights/RiskAssessmentPanel';

// Define types for insights data structure
interface InsightsSummary {
  total_income?: number;
  total_expenses?: number;
  potential_savings?: number;
  tax_deductions?: number;
}

interface InsightsData {
  summary?: InsightsSummary;
  spending_insights?: any;
  tax_optimization?: any;
  financial_goals?: any;
  risk_assessment?: any;
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/insights/comprehensive', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
      setError('Failed to load financial insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2 mb-0">Financial Insights</h1>
        <button 
          className="btn btn-primary" 
          onClick={fetchInsights} 
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
              Analyzing...
            </>
          ) : (
            'Refresh Analysis'
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <ul className="nav nav-tabs mb-4" role="tablist">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'spending' ? 'active' : ''}`}
            onClick={() => setActiveTab('spending')}
          >
            Spending Analysis
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'tax' ? 'active' : ''}`}
            onClick={() => setActiveTab('tax')}
          >
            Tax Deductions
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
          >
            Financial Goals
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'risk' ? 'active' : ''}`}
            onClick={() => setActiveTab('risk')}
          >
            Risk Assessment
          </button>
        </li>
      </ul>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="card-title mb-0">Financial Overview</h5>
                </div>
                <div className="card-body">
                  {loading ? (
                    <div className="text-center">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : insights ? (
                    <div className="row">
                      <div className="col-md-3">
                        <div className="card bg-primary text-white">
                          <div className="card-body">
                            <h6>Total Income</h6>
                            <h4>${insights.summary?.total_income?.toFixed(2) || '0.00'}</h4>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="card bg-danger text-white">
                          <div className="card-body">
                            <h6>Total Expenses</h6>
                            <h4>${insights.summary?.total_expenses?.toFixed(2) || '0.00'}</h4>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="card bg-success text-white">
                          <div className="card-body">
                            <h6>Potential Savings</h6>
                            <h4>${insights.summary?.potential_savings?.toFixed(2) || '0.00'}</h4>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="card bg-warning text-white">
                          <div className="card-body">
                            <h6>Tax Deductions</h6>
                            <h4>${insights.summary?.tax_deductions?.toFixed(2) || '0.00'}</h4>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p>No insights available. Click "Refresh Analysis" to generate insights.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'spending' && (
          <SpendingChart data={insights?.spending_insights} />
        )}

        {activeTab === 'tax' && (
          <TaxDeductionsPanel deductions={insights?.tax_optimization} />
        )}

        {activeTab === 'goals' && (
          <FinancialGoalsPanel goals={insights?.financial_goals} />
        )}

        {activeTab === 'risk' && (
          <RiskAssessmentPanel assessment={insights?.risk_assessment} />
        )}
      </div>
    </div>
  );
} 