import { GoalStatus } from '@prisma/client';

export interface Goal {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  dueDate: string;
  userId: string;
  description?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: GoalStatus;
  directDebit?: DirectDebitConfig;
  subaccount?: {
    id: string;
    balance: number;
  };
}

export interface DirectDebitConfig {
  isEnabled: boolean;
  sourceAccountId?: string;
  transferType?: 'percentage' | 'fixed';
  transferAmount?: number;
  frequency?: 'weekly' | 'monthly' | 'bi-weekly';
  startDate?: string;
  nextTransferDate?: string;
  lastTransferDate?: string;
}

export interface CreateGoalRequest {
  name: string;
  targetAmount: number;
  dueDate: string;
  category?: string;
  currentAmount?: number;
  description?: string;
  directDebit?: DirectDebitConfig;
}

export interface UpdateGoalRequest {
  name?: string;
  targetAmount?: number;
  dueDate?: string;
  category?: string;
  status?: GoalStatus;
  currentAmount?: number;
  description?: string;
  directDebit?: DirectDebitConfig;
}

export interface UpdateProgressRequest {
  currentAmount: number;
}
