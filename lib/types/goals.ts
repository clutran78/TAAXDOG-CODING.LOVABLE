/**
 * Financial goals type definitions
 */

import { MoneyAmount, FinancialPeriod } from './financial';
import { AuditInfo } from './common';

// Goal status
export enum GoalStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

// Goal categories
export enum GoalCategory {
  SAVINGS = 'SAVINGS',
  INVESTMENT = 'INVESTMENT',
  PURCHASE = 'PURCHASE',
  DEBT_PAYOFF = 'DEBT_PAYOFF',
  EMERGENCY_FUND = 'EMERGENCY_FUND',
  VACATION = 'VACATION',
  EDUCATION = 'EDUCATION',
  RETIREMENT = 'RETIREMENT',
  HOME_DEPOSIT = 'HOME_DEPOSIT',
  GENERAL = 'GENERAL',
}

// Goal priority
export enum GoalPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Main goal interface
export interface Goal extends AuditInfo {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  category: GoalCategory;
  status: GoalStatus;
  priority: GoalPriority;
  targetAmount: number;
  currentAmount: number;
  currency: 'AUD';
  deadline?: Date | null;
  completedAt?: Date | null;
  imageUrl?: string | null;
  color?: string | null;

  // Auto-transfer settings
  autoTransferEnabled: boolean;
  autoTransferAmount?: number | null;
  autoTransferFrequency?: FinancialPeriod | null;
  autoTransferDay?: number | null; // Day of month/week
  autoTransferAccountId?: string | null;
  nextTransferDate?: Date | null;

  // Tracking
  milestones?: GoalMilestone[];
  linkedTransactionIds?: string[];
  tags?: string[];

  // Soft delete
  deletedAt?: Date | null;
}

// Goal with calculated fields
export interface GoalWithProgress extends Goal {
  progressPercentage: number;
  remainingAmount: number;
  daysRemaining: number | null;
  isOverdue: boolean;
  projectedCompletionDate: Date | null;
  monthlyContributionRequired: number | null;
  isOnTrack: boolean;
}

// Goal milestones
export interface GoalMilestone {
  id: string;
  goalId: string;
  name: string;
  targetAmount: number;
  reachedAt?: Date | null;
  celebrationMessage?: string;
}

// Goal creation/update DTOs
export interface CreateGoalInput {
  name: string;
  description?: string;
  category: GoalCategory;
  targetAmount: number;
  currentAmount?: number;
  deadline?: Date;
  priority?: GoalPriority;
  autoTransferEnabled?: boolean;
  autoTransferAmount?: number;
  autoTransferFrequency?: FinancialPeriod;
  autoTransferAccountId?: string;
}

export interface UpdateGoalInput {
  name?: string;
  description?: string;
  category?: GoalCategory;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: Date;
  status?: GoalStatus;
  priority?: GoalPriority;
  autoTransferEnabled?: boolean;
  autoTransferAmount?: number;
  autoTransferFrequency?: FinancialPeriod;
  autoTransferAccountId?: string;
}

// Goal progress update
export interface GoalProgressUpdate {
  goalId: string;
  amount: number;
  note?: string;
  transactionId?: string;
  date?: Date;
}

// Goal analytics
export interface GoalAnalytics {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: MoneyAmount;
  totalSavedAmount: MoneyAmount;
  averageCompletionTime: number; // days
  successRate: number; // percentage
  projectedCompletions: {
    month: number;
    quarter: number;
    year: number;
  };
  categoriesBreakdown: Array<{
    category: GoalCategory;
    count: number;
    totalAmount: MoneyAmount;
    averageProgress: number;
  }>;
}

// Goal recommendations
export interface GoalRecommendation {
  type: 'INCREASE_CONTRIBUTION' | 'EXTEND_DEADLINE' | 'REDUCE_TARGET' | 'PAUSE_GOAL';
  goalId: string;
  reason: string;
  suggestion: string;
  impact: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}
