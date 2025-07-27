/**
 * Transaction type definitions
 */

import { MoneyAmount, TransactionType, GSTAmount } from './financial';
import { AuditInfo } from './common';

// Transaction status
export enum TransactionStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

// Transaction categories (for personal finance)
export enum TransactionCategory {
  FOOD_DINING = 'FOOD_DINING',
  GROCERIES = 'GROCERIES',
  TRANSPORT = 'TRANSPORT',
  SHOPPING = 'SHOPPING',
  BILLS_UTILITIES = 'BILLS_UTILITIES',
  ENTERTAINMENT = 'ENTERTAINMENT',
  HEALTH_FITNESS = 'HEALTH_FITNESS',
  EDUCATION = 'EDUCATION',
  TRAVEL = 'TRAVEL',
  INSURANCE = 'INSURANCE',
  INVESTMENT = 'INVESTMENT',
  INCOME = 'INCOME',
  TRANSFER = 'TRANSFER',
  OTHER = 'OTHER',
}

// Tax categories (Australian tax deductions)
export enum TaxCategory {
  D1 = 'D1', // Work-related car expenses
  D2 = 'D2', // Work-related travel expenses
  D3 = 'D3', // Work-related clothing expenses
  D4 = 'D4', // Work-related self-education expenses
  D5 = 'D5', // Other work-related expenses
  D7 = 'D7', // Gifts and donations
  D8 = 'D8', // Dividend income
  D9 = 'D9', // Interest deductions
  D10 = 'D10', // Dividend deductions
  D11 = 'D11', // Managing tax affairs
  D12 = 'D12', // Other deductions
  D13 = 'D13', // Foreign income tax offset
  D14 = 'D14', // Other income
  D15 = 'D15', // Other tax offsets
  P8 = 'P8', // Partnership and trust income
  NONE = 'NONE',
}

// Main transaction interface
export interface Transaction extends AuditInfo {
  id: string;
  userId: string;
  bankAccountId?: string | null;
  basiqTransactionId?: string | null;

  // Transaction details
  description: string;
  merchantName?: string | null;
  amount: number;
  currency: 'AUD';
  type: TransactionType;
  status: TransactionStatus;

  // Dates
  transactionDate: Date;
  postDate?: Date | null;

  // Categorization
  category: TransactionCategory;
  subCategory?: string | null;
  isBusinessExpense: boolean;
  taxCategory?: TaxCategory | null;

  // GST handling
  gstAmount?: number | null;
  hasGST: boolean;

  // Additional data
  reference?: string | null;
  notes?: string | null;
  tags?: string[];
  location?: TransactionLocation | null;

  // Linked entities
  receiptId?: string | null;
  goalId?: string | null;
  budgetCategoryId?: string | null;

  // Reconciliation
  isReconciled: boolean;
  reconciledAt?: Date | null;

  // Soft delete
  deletedAt?: Date | null;
}

// Transaction location
export interface TransactionLocation {
  merchantAddress?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

// Transaction with enriched data
export interface EnrichedTransaction extends Transaction {
  merchant?: MerchantInfo;
  receipt?: ReceiptSummary;
  taxDeductible: boolean;
  taxDeductibleAmount: MoneyAmount;
  gstDetails?: GSTAmount;
}

// Merchant information
export interface MerchantInfo {
  id: string;
  name: string;
  displayName: string;
  category: string;
  abn?: string;
  website?: string;
  logoUrl?: string;
}

// Receipt summary (for transaction display)
export interface ReceiptSummary {
  id: string;
  hasImage: boolean;
  itemCount: number;
  verified: boolean;
}

// Transaction filters
export interface TransactionFilters {
  accountIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  type?: TransactionType;
  categories?: TransactionCategory[];
  taxCategories?: TaxCategory[];
  isBusinessExpense?: boolean;
  hasReceipt?: boolean;
  isReconciled?: boolean;
  search?: string;
}

// Transaction update DTO
export interface UpdateTransactionInput {
  description?: string;
  category?: TransactionCategory;
  subCategory?: string;
  isBusinessExpense?: boolean;
  taxCategory?: TaxCategory;
  gstAmount?: number;
  notes?: string;
  tags?: string[];
  goalId?: string;
  budgetCategoryId?: string;
}

// Bulk categorization
export interface BulkCategorizeInput {
  transactionIds: string[];
  category: TransactionCategory;
  isBusinessExpense?: boolean;
  taxCategory?: TaxCategory;
}

// Transaction analytics
export interface TransactionAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalIncome: MoneyAmount;
    totalExpenses: MoneyAmount;
    netAmount: MoneyAmount;
    transactionCount: number;
  };
  byCategory: Array<{
    category: TransactionCategory;
    amount: MoneyAmount;
    count: number;
    percentage: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
  }>;
  byMerchant: Array<{
    merchantName: string;
    amount: MoneyAmount;
    count: number;
    lastTransaction: Date;
  }>;
  taxDeductible: {
    totalAmount: MoneyAmount;
    totalGST: MoneyAmount;
    byCategory: Record<TaxCategory, MoneyAmount>;
  };
  trends: {
    dailyAverage: MoneyAmount;
    weeklyAverage: MoneyAmount;
    monthlyAverage: MoneyAmount;
    growthRate: number;
  };
}
