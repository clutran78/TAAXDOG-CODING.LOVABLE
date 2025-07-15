'use client';

import React from 'react';

interface RiskFactor {
  type: string;
  level: string;
  description: string;
  impact_score: number;
  mitigation_steps: string[];
}

interface RiskAssessment {
  overall_risk_score: number;
  risk_level: string;
  risk_factors: RiskFactor[];
  recommendations: string[];
}

interface RiskAssessmentPanelProps {
  assessment: RiskAssessment | undefined;
}

/**
 * Risk Assessment Panel Component
 * Displays financial risk analysis and mitigation recommendations
 */
export const RiskAssessmentPanel: React.FC<RiskAssessmentPanelProps> = ({ assessment }) => {
  if (!assessment) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <p>No risk assessment available. Generate insights to see your financial risk analysis.</p>
        </div>
      </div>
    );
  }

  const getRiskLevelColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'HIGH': return 'bg-danger';
      case 'MEDIUM': return 'bg-warning';
      case 'LOW': return 'bg-success';
      default: return 'bg-secondary';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-danger';
    if (score >= 40) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="row">
      {/* Overall Risk Score */}
      <div className="col-12 mb-4">
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">Overall Risk Assessment</h5>
          </div>
          <div className="card-body">
            <div className="row align-items-center">
              <div className="col-md-4 text-center">
                <div className={`display-4 fw-bold ${getScoreColor(assessment.overall_risk_score)}`}>
                  {assessment.overall_risk_score}
                </div>
                <div className="text-muted">Risk Score</div>
              </div>
              <div className="col-md-4 text-center">
                <span className={`badge ${getRiskLevelColor(assessment.risk_level)} fs-6 px-3 py-2`}>
                  {assessment.risk_level} RISK
                </span>
              </div>
              <div className="col-md-4">
                <div className="progress" style={{ height: '10px' }}>
                  <div 
                    className={`progress-bar ${assessment.overall_risk_score >= 70 ? 'bg-danger' : 
                                               assessment.overall_risk_score >= 40 ? 'bg-warning' : 'bg-success'}`}
                    style={{ width: `${assessment.overall_risk_score}%` }}
                  />
                </div>
                <small className="text-muted">Risk Level Indicator</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="col-md-8 mb-4">
        <div className="card">
          <div className="card-header">
            <h6 className="card-title mb-0">Risk Factors</h6>
          </div>
          <div className="card-body">
            {assessment.risk_factors && assessment.risk_factors.length > 0 ? (
              <div className="space-y-3">
                {assessment.risk_factors.map((factor, index) => (
                  <div key={index} className="border rounded p-3 mb-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className="mb-1">{factor.type}</h6>
                        <p className="text-muted small mb-0">{factor.description}</p>
                      </div>
                      <div className="text-end">
                        <span className={`badge ${getRiskLevelColor(factor.level)}`}>
                          {factor.level}
                        </span>
                        <div className="small text-muted">
                          Impact: {factor.impact_score}/100
                        </div>
                      </div>
                    </div>
                    
                    {/* Mitigation steps */}
                    {factor.mitigation_steps && factor.mitigation_steps.length > 0 && (
                      <div className="mt-2">
                        <small className="text-muted fw-bold">Mitigation Steps:</small>
                        <ul className="list-unstyled mt-1">
                          {factor.mitigation_steps.slice(0, 2).map((step, stepIndex) => (
                            <li key={stepIndex} className="small">
                              • {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted">No specific risk factors identified.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="col-md-4 mb-4">
        <div className="card">
          <div className="card-header">
            <h6 className="card-title mb-0">Recommendations</h6>
          </div>
          <div className="card-body">
            {assessment.recommendations && assessment.recommendations.length > 0 ? (
              <ul className="list-unstyled">
                {assessment.recommendations.map((recommendation, index) => (
                  <li key={index} className="mb-2 p-2 bg-light rounded">
                    <small>{recommendation}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-muted">No specific recommendations available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 