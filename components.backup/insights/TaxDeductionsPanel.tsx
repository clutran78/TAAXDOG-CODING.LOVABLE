import React from 'react';
import { FaDollarSign, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

// Type definitions for deduction data
interface Deduction {
  category: string;
  description: string;
  amount: number;
  confidence: 'high' | 'medium' | 'low';
}

interface DeductionsData {
  potential_deductions: Deduction[];
}

interface TaxDeductionsPanelProps {
  deductions: DeductionsData | null;
}

export const TaxDeductionsPanel: React.FC<TaxDeductionsPanelProps> = ({ deductions }) => {
  if (!deductions) return <div className="text-center py-4">Loading tax analysis...</div>;
  
  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low'): string => {
    const colors = {
      high: 'bg-success text-white',
      medium: 'bg-warning text-dark',
      low: 'bg-danger text-white'
    };
    return colors[confidence] || colors.low;
  };
  
  return (
    <div className="mb-4">
      <div className="card">
        <div className="card-header">
          <h5 className="card-title d-flex align-items-center gap-2 mb-0">
            <FaDollarSign className="text-success" />
            Potential Tax Deductions
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {deductions.potential_deductions?.map((deduction, index) => (
              <div key={index} className="col-12">
                <div className="d-flex justify-content-between align-items-center p-3 border rounded">
                  <div className="flex-grow-1">
                    <h6 className="fw-bold mb-1">{deduction.category}</h6>
                    <p className="text-muted small mb-2">{deduction.description}</p>
                    <p className="h5 fw-bold text-success mb-0">
                      ${deduction.amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge ${getConfidenceBadge(deduction.confidence)}`}>
                      {deduction.confidence} confidence
                    </span>
                    {deduction.confidence === 'high' ? (
                      <FaCheckCircle className="text-success" />
                    ) : (
                      <FaExclamationTriangle className="text-warning" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 