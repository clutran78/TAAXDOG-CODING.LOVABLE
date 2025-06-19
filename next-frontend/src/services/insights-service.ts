/**
 * TAAXDOG Insights Service
 * Frontend service for communicating with the Financial Insights API
 * Provides comprehensive financial analysis and recommendations
 */

import { getData, postData } from './api/apiController';

// Define interfaces for insights data
export interface InsightsAnalysis {
  insights: FinancialInsight[];
  summary: InsightsSummary;
  metadata: InsightsMetadata;
  status: string;
  generated_at: string;
  top_categories?: CategorySpending[];
  recommendations?: InsightRecommendation[];
  spending_patterns?: SpendingPattern[];
}

export interface FinancialInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: string;
  amount?: number;
  recommendations: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence_score?: number;
  potential_savings?: number;
  created_at: string;
  data?: any;
}

export interface InsightsSummary {
  total_insights: number;
  high_priority_count: number;
  potential_savings: number;
  average_confidence: number;
  transaction_count?: number;
  data_quality_score?: number;
  message?: string;
}

export interface InsightsMetadata {
  user_id?: string;
  request_period?: string;
  total_insights?: number;
  data_sources?: string[];
  confidence_threshold?: number;
  generated_at: string;
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  transaction_count?: number;
}

export interface InsightRecommendation {
  type: string;
  description: string;
  potential_saving: number;
  priority: string;
  confidence_score?: number;
}

export interface SpendingPattern {
  pattern_type: string;
  description: string;
  frequency: string;
  impact_score: number;
}

export interface TaxDeduction {
  category: string;
  category_name: string;
  amount: number;
  confidence: string;
  description: string;
  documentation_required: string;
}

export interface FinancialGoal {
  goal_type: string;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  timeline_months: number;
  monthly_target: number;
  priority: string;
  achievability_score: number;
  action_steps: string[];
}

export interface SpendingInsights {
  analysis: any;
  metrics: SpendingMetrics;
  anomalies: SpendingAnomaly[];
  period: string;
  transaction_count: number;
  generated_at: string;
}

export interface SpendingMetrics {
  total_spending: number;
  average_transaction: number;
  median_transaction: number;
  largest_transaction: number;
  transaction_count: number;
  spending_variance: number;
  categories: CategorySpending[];
}

export interface SpendingAnomaly {
  date: string;
  amount: number;
  threshold: number;
  deviation: number;
  type: string;
}

export interface TaxOptimizationInsights {
  deductions: TaxDeduction[];
  insights: FinancialInsight[];
  metrics: TaxMetrics;
  tax_year: string;
  generated_at: string;
}

export interface TaxMetrics {
  total_deductions: number;
  deduction_count: number;
  estimated_tax_savings: number;
  deduction_percentage: number;
  compliance_score: number;
  missing_receipts: any[];
}

export interface BudgetRecommendations {
  recommendations: FinancialInsight[];
  current_spending: Record<string, number>;
  suggested_allocations: Record<string, any>;
  generated_at: string;
}

export interface FinancialGoalsResponse {
  suggested_goals: FinancialGoal[];
  financial_capacity: FinancialCapacity;
  existing_goals: any[];
  generated_at: string;
}

export interface FinancialCapacity {
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  savings_rate: number;
  available_for_goals: number;
}

export interface RiskAssessment {
  overall_risk_score: number;
  audit_risks: any[];
  cash_flow_risks: any[];
  spending_risks: any[];
  recommendations: string[];
  generated_at: string;
}

/**
 * Financial Insights Service Class
 * Handles all communication with the insights backend API
 */
class InsightsService {
  private readonly baseUrl = '/api/insights';

  /**
   * Get comprehensive financial analysis
   */
  async analyzeTransactions(period: string = 'monthly'): Promise<InsightsAnalysis> {
    try {
      const response = await getData(`${this.baseUrl}/comprehensive?period=${period}`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to analyze transactions');
      }
    } catch (error) {
      console.error('Error analyzing transactions:', error);
      throw new Error('Failed to fetch financial analysis');
    }
  }

  /**
   * Get detailed spending insights
   */
  async getSpendingInsights(period: string = 'monthly'): Promise<SpendingInsights> {
    try {
      const response = await getData(`${this.baseUrl}/spending?period=${period}`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get spending insights');
      }
    } catch (error) {
      console.error('Error getting spending insights:', error);
      throw new Error('Failed to fetch spending insights');
    }
  }

  /**
   * Get tax deduction opportunities
   */
  async getTaxDeductions(taxYear?: string): Promise<TaxDeduction[]> {
    try {
      const url = taxYear ? `${this.baseUrl}/tax-optimization?tax_year=${taxYear}` : `${this.baseUrl}/tax-optimization`;
      const response = await getData(url);
      
      if (response.success && response.data) {
        return response.data.deductions || [];
      } else {
        throw new Error(response.error || 'Failed to get tax deductions');
      }
    } catch (error) {
      console.error('Error getting tax deductions:', error);
      return [];
    }
  }

  /**
   * Get tax optimization insights
   */
  async getTaxOptimization(taxYear?: string): Promise<TaxOptimizationInsights> {
    try {
      const url = taxYear ? `${this.baseUrl}/tax-optimization?tax_year=${taxYear}` : `${this.baseUrl}/tax-optimization`;
      const response = await getData(url);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get tax optimization');
      }
    } catch (error) {
      console.error('Error getting tax optimization:', error);
      throw new Error('Failed to fetch tax optimization insights');
    }
  }

  /**
   * Get budget recommendations
   */
  async getBudgetRecommendations(): Promise<BudgetRecommendations> {
    try {
      const response = await getData(`${this.baseUrl}/budget-recommendations`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get budget recommendations');
      }
    } catch (error) {
      console.error('Error getting budget recommendations:', error);
      throw new Error('Failed to fetch budget recommendations');
    }
  }

  /**
   * Generate financial goals
   */
  async generateGoals(): Promise<FinancialGoal[]> {
    try {
      const response = await getData(`${this.baseUrl}/financial-goals`);
      
      if (response.success && response.data) {
        return response.data.suggested_goals || [];
      } else {
        throw new Error(response.error || 'Failed to generate goals');
      }
    } catch (error) {
      console.error('Error generating goals:', error);
      return [];
    }
  }

  /**
   * Get financial goals suggestions
   */
  async getFinancialGoals(): Promise<FinancialGoalsResponse> {
    try {
      const response = await getData(`${this.baseUrl}/financial-goals`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get financial goals');
      }
    } catch (error) {
      console.error('Error getting financial goals:', error);
      throw new Error('Failed to fetch financial goals');
    }
  }

  /**
   * Get risk assessment
   */
  async getRiskAssessment(): Promise<RiskAssessment> {
    try {
      const response = await getData(`${this.baseUrl}/risk-assessment`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get risk assessment');
      }
    } catch (error) {
      console.error('Error getting risk assessment:', error);
      throw new Error('Failed to fetch risk assessment');
    }
  }

  /**
   * Generate comprehensive financial report
   */
  async getFinancialReport(period: string = 'monthly'): Promise<any> {
    try {
      const response = await getData(`${this.baseUrl}/report?period=${period}`);
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      throw new Error('Failed to generate financial report');
    }
  }

  /**
   * Refresh all insights data
   */
  async refreshInsights(period: string = 'monthly'): Promise<InsightsAnalysis> {
    try {
      const response = await postData(`${this.baseUrl}/refresh`, { period });
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to refresh insights');
      }
    } catch (error) {
      console.error('Error refreshing insights:', error);
      throw new Error('Failed to refresh insights');
    }
  }
}

// Export singleton instance
export const insightsService = new InsightsService();
export default insightsService; 