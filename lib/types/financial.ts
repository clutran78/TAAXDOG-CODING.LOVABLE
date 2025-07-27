/**
 * Core financial type definitions
 */

import { AuditInfo } from './common';

// Currency and money types
export interface MoneyAmount {
  amount: number;
  currency: 'AUD';
  formatted?: string;
}

// Financial period types
export type FinancialPeriod =
  | 'daily'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export interface FinancialYear {
  startDate: Date; // July 1
  endDate: Date; // June 30
  year: number; // e.g., 2024 for FY 2023-24
}

// Account types
export enum AccountType {
  SAVINGS = 'SAVINGS',
  CHECKING = 'CHECKING',
  CREDIT_CARD = 'CREDIT_CARD',
  LOAN = 'LOAN',
  MORTGAGE = 'MORTGAGE',
  INVESTMENT = 'INVESTMENT',
  SUPERANNUATION = 'SUPERANNUATION',
}

// Transaction types
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

// Financial summary
export interface FinancialSummary {
  totalIncome: MoneyAmount;
  totalExpenses: MoneyAmount;
  netIncome: MoneyAmount;
  savingsRate: number;
  period: DateRange;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Cash flow
export interface CashFlow {
  date: Date;
  inflow: MoneyAmount;
  outflow: MoneyAmount;
  netFlow: MoneyAmount;
  runningBalance: MoneyAmount;
}

export interface CashFlowProjection {
  projections: CashFlow[];
  assumptions: {
    incomeGrowthRate: number;
    expenseGrowthRate: number;
    inflationRate: number;
  };
}

// Financial metrics
export interface FinancialMetrics {
  liquidityRatio: number;
  debtToIncomeRatio: number;
  savingsRate: number;
  emergencyFundMonths: number;
  netWorth: MoneyAmount;
  monthlyBurnRate: MoneyAmount;
  financialHealthScore: number; // 0-100
}

// Spending insights
export interface SpendingInsight {
  id: string;
  type: 'OVERSPENDING' | 'UNUSUAL_ACTIVITY' | 'SAVING_OPPORTUNITY' | 'BILL_INCREASE';
  category: string;
  message: string;
  amount?: MoneyAmount;
  percentageChange?: number;
  recommendation: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: Date;
}

// Financial goals summary
export interface FinancialGoalsSummary {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: MoneyAmount;
  totalSavedAmount: MoneyAmount;
  overallProgress: number;
  projectedCompletionDate?: Date;
}

// GST/Tax related
export interface GSTAmount {
  totalAmount: MoneyAmount;
  gstComponent: MoneyAmount;
  netAmount: MoneyAmount;
  gstRate: number; // 0.10 for 10%
}

// Financial alerts
export interface FinancialAlert {
  id: string;
  userId: string;
  type: 'LOW_BALANCE' | 'LARGE_TRANSACTION' | 'BILL_DUE' | 'GOAL_MILESTONE' | 'BUDGET_EXCEEDED';
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  actionRequired: boolean;
  actionUrl?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}
