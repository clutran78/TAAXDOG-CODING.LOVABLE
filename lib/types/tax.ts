/**
 * Tax-related type definitions (Australian tax system)
 */

import { MoneyAmount, FinancialYear } from './financial';
import { TaxCategory } from './transactions';
import { AuditInfo } from './common';

// Tax return status
export enum TaxReturnStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  READY_TO_LODGE = 'READY_TO_LODGE',
  LODGED = 'LODGED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  AMENDED = 'AMENDED',
}

// Income types
export enum IncomeType {
  SALARY_WAGES = 'SALARY_WAGES',
  BUSINESS_INCOME = 'BUSINESS_INCOME',
  INVESTMENT_INCOME = 'INVESTMENT_INCOME',
  RENTAL_INCOME = 'RENTAL_INCOME',
  DIVIDEND_INCOME = 'DIVIDEND_INCOME',
  INTEREST_INCOME = 'INTEREST_INCOME',
  CAPITAL_GAINS = 'CAPITAL_GAINS',
  FOREIGN_INCOME = 'FOREIGN_INCOME',
  GOVERNMENT_PAYMENTS = 'GOVERNMENT_PAYMENTS',
  OTHER_INCOME = 'OTHER_INCOME',
}

// Tax file status
export enum TaxFileStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  PENDING = 'PENDING',
  NOT_PROVIDED = 'NOT_PROVIDED',
}

// Main tax return interface
export interface TaxReturn extends AuditInfo {
  id: string;
  userId: string;
  financialYear: FinancialYear;
  status: TaxReturnStatus;

  // Income
  totalIncome: number;
  taxableIncome: number;

  // Tax calculation
  taxPayable: number;
  taxWithheld: number;
  medicareLevy: number;
  medicareLevySurcharge?: number | null;

  // Offsets and benefits
  taxOffsets: number;
  frankedDividendCredits?: number | null;
  foreignTaxCredits?: number | null;

  // Result
  taxRefundOrDebt: number; // Positive = refund, Negative = debt

  // Lodgement
  lodgedAt?: Date | null;
  lodgementReference?: string | null;
  assessmentDate?: Date | null;
  noticeOfAssessment?: string | null; // URL to document

  // Professional lodgement
  taxAgentNumber?: string | null;
  taxAgentName?: string | null;

  // Soft delete
  deletedAt?: Date | null;
}

// Income details
export interface IncomeDetails {
  id: string;
  taxReturnId: string;
  type: IncomeType;

  // Source details
  payerName: string;
  payerAbn?: string | null;

  // Amounts
  grossAmount: number;
  taxWithheld: number;

  // Additional fields based on type
  // For salary/wages
  allowances?: number | null;
  reportableFringeBenefits?: number | null;
  reportableEmployerSuper?: number | null;

  // For investments
  frankedAmount?: number | null;
  unfrankedAmount?: number | null;
  frankingCredits?: number | null;
  tfi?: number | null; // Tax file number amount

  // Supporting documents
  paymentSummaryId?: string | null;
}

// Deduction summary
export interface DeductionSummary {
  id: string;
  taxReturnId: string;

  // Work-related deductions
  workRelatedCarExpenses: number; // D1
  workRelatedTravelExpenses: number; // D2
  workRelatedClothingExpenses: number; // D3
  workRelatedEducationExpenses: number; // D4
  otherWorkRelatedExpenses: number; // D5

  // Other deductions
  giftsAndDonations: number; // D7
  dividendDeductions: number; // D10
  interestDeductions: number; // D9
  taxManagementFees: number; // D11
  otherDeductions: number; // D12

  // Totals
  totalDeductions: number;

  // Supporting records
  deductionRecords: DeductionRecord[];
}

// Individual deduction record
export interface DeductionRecord {
  id: string;
  deductionSummaryId: string;

  category: TaxCategory;
  description: string;
  amount: number;
  date: Date;

  // Evidence
  receiptId?: string | null;
  transactionId?: string | null;
  documentUrl?: string | null;

  // Verification
  isVerified: boolean;
  verifiedAt?: Date | null;
  notes?: string | null;
}

// Tax calculation
export interface TaxCalculation {
  financialYear: FinancialYear;
  taxableIncome: number;

  // Tax brackets (2023-24 rates)
  baseTax: number;
  marginalTax: number;
  totalIncomeTax: number;

  // Medicare
  medicareLevy: number;
  medicareLevySurcharge: number;

  // Total tax
  totalTax: number;
  effectiveTaxRate: number;

  // After offsets
  taxAfterOffsets: number;

  // Final position
  taxWithheld: number;
  refundOrDebt: number;
}

// Tax estimates
export interface TaxEstimate {
  userId: string;
  financialYear: FinancialYear;

  // Income projections
  estimatedIncome: MoneyAmount;
  currentIncome: MoneyAmount;
  projectedIncome: MoneyAmount;

  // Deduction projections
  estimatedDeductions: MoneyAmount;
  currentDeductions: MoneyAmount;
  potentialDeductions: MoneyAmount;

  // Tax projections
  estimatedTax: MoneyAmount;
  estimatedRefund: MoneyAmount;

  // Recommendations
  recommendations: TaxRecommendation[];

  lastUpdated: Date;
}

// Tax recommendations
export interface TaxRecommendation {
  id: string;
  type:
    | 'DEDUCTION_OPPORTUNITY'
    | 'CONTRIBUTION_SUGGESTION'
    | 'TIMING_OPTIMIZATION'
    | 'STRUCTURE_ADVICE';
  title: string;
  description: string;
  potentialBenefit: MoneyAmount;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  deadline?: Date | null;
  actionItems: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

// BAS (Business Activity Statement)
export interface BAS {
  id: string;
  userId: string;

  // Period
  reportingPeriod: 'MONTHLY' | 'QUARTERLY';
  startDate: Date;
  endDate: Date;

  // GST
  totalSales: number;
  gstOnSales: number;
  totalPurchases: number;
  gstOnPurchases: number;
  netGST: number; // To pay or claim

  // PAYG
  paygWithholding?: number | null;
  paygIncome?: number | null;

  // Status
  status: 'DRAFT' | 'READY' | 'LODGED';
  dueDate: Date;
  lodgedAt?: Date | null;

  // Reference
  referenceNumber?: string | null;
}

// Tax document
export interface TaxDocument {
  id: string;
  userId: string;
  taxReturnId?: string | null;

  type:
    | 'PAYMENT_SUMMARY'
    | 'DIVIDEND_STATEMENT'
    | 'INTEREST_STATEMENT'
    | 'DEDUCTION_RECEIPT'
    | 'OTHER';
  name: string;
  description?: string | null;

  // Document details
  fileUrl: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;

  // Metadata
  taxYear: string;
  issuer?: string | null;
  issuerAbn?: string | null;

  // Processing
  isProcessed: boolean;
  extractedData?: Record<string, unknown> | null;
}

// Super contribution
export interface SuperContribution {
  id: string;
  userId: string;

  type: 'EMPLOYER' | 'PERSONAL' | 'SPOUSE' | 'GOVERNMENT';
  amount: number;
  date: Date;

  // Fund details
  fundName: string;
  fundAbn: string;
  memberNumber?: string | null;

  // Tax treatment
  isConcessional: boolean;
  isTaxDeductible: boolean;

  // Caps
  contributionCap: number;
  capSpaceRemaining: number;
}
