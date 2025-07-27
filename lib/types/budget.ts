/**
 * Budget type definitions
 */

import { MoneyAmount, FinancialPeriod } from './financial';
import { TransactionCategory } from './transactions';
import { AuditInfo } from './common';

// Budget status
export enum BudgetStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

// Budget period type
export enum BudgetPeriod {
  WEEKLY = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

// Alert thresholds
export enum AlertThreshold {
  FIFTY_PERCENT = 50,
  SEVENTY_FIVE_PERCENT = 75,
  NINETY_PERCENT = 90,
  HUNDRED_PERCENT = 100,
}

// Main budget interface
export interface Budget extends AuditInfo {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  status: BudgetStatus;

  // Budget period
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date;

  // Amounts
  totalBudget: number;
  currency: 'AUD';

  // Income tracking
  expectedIncome?: number | null;
  actualIncome?: number | null;

  // Categories
  categories: BudgetCategory[];

  // Settings
  alertsEnabled: boolean;
  alertThresholds: AlertThreshold[];
  rolloverEnabled: boolean;

  // Tracking
  lastCalculatedAt?: Date | null;

  // Soft delete
  deletedAt?: Date | null;
}

// Budget category
export interface BudgetCategory {
  id: string;
  budgetId: string;
  category: TransactionCategory;
  name: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;

  // Settings
  isEssential: boolean;
  alertThreshold?: number | null;
  color?: string | null;
  icon?: string | null;

  // Sub-categories
  subCategories?: BudgetSubCategory[];
}

// Budget sub-category
export interface BudgetSubCategory {
  id: string;
  categoryId: string;
  name: string;
  budgetAmount: number;
  spentAmount: number;
}

// Budget tracking
export interface BudgetTracking {
  budgetId: string;
  date: Date;
  totalBudget: MoneyAmount;
  totalSpent: MoneyAmount;
  totalRemaining: MoneyAmount;
  percentageUsed: number;
  projectedOverspend?: MoneyAmount | null;
  isOnTrack: boolean;

  // Daily tracking
  dailyBudget: MoneyAmount;
  dailySpent: MoneyAmount;
  daysRemaining: number;

  // Category breakdown
  categoryBreakdown: Array<{
    category: TransactionCategory;
    budgeted: MoneyAmount;
    spent: MoneyAmount;
    remaining: MoneyAmount;
    percentageUsed: number;
    trend: 'UNDER' | 'ON_TRACK' | 'OVER';
  }>;
}

// Budget creation/update DTOs
export interface CreateBudgetInput {
  name: string;
  description?: string;
  period: BudgetPeriod;
  startDate: Date;
  endDate?: Date; // Required for CUSTOM period
  totalBudget: number;
  expectedIncome?: number;
  categories: CreateBudgetCategoryInput[];
  alertsEnabled?: boolean;
  alertThresholds?: AlertThreshold[];
  rolloverEnabled?: boolean;
}

export interface CreateBudgetCategoryInput {
  category: TransactionCategory;
  name?: string;
  budgetAmount: number;
  isEssential?: boolean;
  alertThreshold?: number;
}

export interface UpdateBudgetInput {
  name?: string;
  description?: string;
  status?: BudgetStatus;
  totalBudget?: number;
  expectedIncome?: number;
  alertsEnabled?: boolean;
  alertThresholds?: AlertThreshold[];
  rolloverEnabled?: boolean;
}

export interface UpdateBudgetCategoryInput {
  budgetAmount?: number;
  isEssential?: boolean;
  alertThreshold?: number;
}

// Budget alerts
export interface BudgetAlert {
  id: string;
  budgetId: string;
  categoryId?: string | null;
  type: 'THRESHOLD_REACHED' | 'OVERSPEND' | 'UNUSUAL_ACTIVITY';
  threshold: number;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  acknowledged: boolean;
  acknowledgedAt?: Date | null;
  createdAt: Date;
}

// Budget insights
export interface BudgetInsight {
  id: string;
  budgetId: string;
  type: 'SAVING_OPPORTUNITY' | 'SPENDING_PATTERN' | 'CATEGORY_OPTIMIZATION' | 'TREND_ALERT';
  title: string;
  description: string;
  recommendation: string;
  potentialSaving?: MoneyAmount | null;
  confidence: number; // 0-100
  dismissed: boolean;
  createdAt: Date;
}

// Budget analytics
export interface BudgetAnalytics {
  currentBudget?: BudgetTracking | null;
  historicalPerformance: {
    averageMonthlySpend: MoneyAmount;
    averageSavings: MoneyAmount;
    budgetAccuracy: number; // How close actual spending is to budget
    overspendFrequency: number; // Percentage of periods with overspend
  };
  categoryInsights: Array<{
    category: TransactionCategory;
    averageSpend: MoneyAmount;
    trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    volatility: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendation?: string;
  }>;
  recommendations: string[];
  savingsPotential: MoneyAmount;
}

// Budget templates
export interface BudgetTemplate {
  id: string;
  name: string;
  description: string;
  type: 'SYSTEM' | 'USER' | 'SHARED';
  categories: Array<{
    category: TransactionCategory;
    percentageOfIncome: number;
    isEssential: boolean;
  }>;
  targetSavingsRate: number;
  suitableFor: string[];
}
