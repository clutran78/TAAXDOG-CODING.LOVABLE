// This file is deprecated - Firebase has been replaced with PostgreSQL/Prisma
// All functions have been migrated to use API routes instead
// TODO: Remove this file once all references are updated

import { Transaction } from '@/lib/types/transactions';
import { Expense } from '@/lib/types/expenses';
import { showToast } from './helperFunction';
import { Goal } from '@/lib/types/goal';

export const subscribeToAuthState = (
  onAuthSuccess: (userId: string) => void,
  onAuthFail: () => void,
): void => {
  // Deprecated: Use NextAuth session instead
  console.warn('subscribeToAuthState is deprecated. Use NextAuth session instead.');
};

export const fetchIncomeTransactions = async () => {
  console.warn('fetchIncomeTransactions is deprecated. Use API routes instead.');
  return { sources: [], total: 0 };
};

export const fetchUserExpenses = async (): Promise<Expense[]> => {
  console.warn('fetchUserExpenses is deprecated. Use API routes instead.');
  return [];
};

export const fetchSubscriptions = (): Promise<any[]> => {
  console.warn('fetchSubscriptions is deprecated. Use API routes instead.');
  return Promise.resolve([]);
};

export const fetchTransactionsByCategory = async (category: string) => {
  console.warn('fetchTransactionsByCategory is deprecated. Use API routes instead.');
  return [];
};

export const fetchUserGoals = (): Promise<Goal[]> => {
  console.warn('fetchUserGoals is deprecated. Use API routes instead.');
  return Promise.resolve([]);
};

export const deleteGoal = async (goalId: string) => {
  console.warn('deleteGoal is deprecated. Use API routes instead.');
  showToast('Please use the API endpoint to delete goals', 'warning');
};

export const updateGoal = async (goalId: string, updatedData: Partial<Goal>) => {
  console.warn('updateGoal is deprecated. Use API routes instead.');
  showToast('Please use the API endpoint to update goals', 'warning');
};

export const getUserTaxProfile = () => {
  console.warn('getUserTaxProfile is deprecated. Use API routes instead.');
  return Promise.resolve(null);
};

export const getReceiptStats = () => {
  console.warn('getReceiptStats is deprecated. Use API routes instead.');
  return Promise.resolve({
    totalReceipts: 0,
    businessReceipts: 0,
    personalReceipts: 0,
    totalAmount: 0,
  });
};

export const createGoal = async (data: any) => {
  console.warn('createGoal is deprecated. Use API routes instead.');
  showToast('Please use the API endpoint to create goals', 'warning');
};

export const fetchBankTransactions = async (): Promise<any[]> => {
  console.warn('fetchBankTransactions is deprecated. Use API routes instead.');
  return [];
};

export const fetchGoals = async (): Promise<Goal[]> => {
  console.warn('fetchGoals is deprecated. Use API routes instead.');
  return [];
};

export const updateGoalProgress = async (goalId: string, progress: number) => {
  console.warn('updateGoalProgress is deprecated. Use API routes instead.');
  showToast('Please use the API endpoint to update goal progress', 'warning');
};

export const fetchReceiptStats = async (userId?: string) => {
  console.warn('fetchReceiptStats is deprecated. Use API routes instead.');
  return {
    totalReceipts: 0,
    businessReceipts: 0,
    personalReceipts: 0,
    totalAmount: 0,
    totalSpent: 0,
    matchedReceipts: 0,
    averageAmount: '$0.00',
  };
};

export const fetchTaxProfile = async (userId?: string) => {
  console.warn('fetchTaxProfile is deprecated. Use API routes instead.');
  return null;
};
