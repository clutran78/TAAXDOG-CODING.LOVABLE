/**
 * API Service Layer
 * This replaces the Firebase service after migration to PostgreSQL
 */

import { getData, postData, putData, deleteData } from '@/services/api/apiController';

// Bank Transactions
export async function fetchBankTransactions() {
  try {
    const response = await getData('/api/banking/transactions');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching bank transactions:', error);
    return [];
  }
}

// Goals
export async function fetchGoals() {
  try {
    const response = await getData('/api/goals');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching goals:', error);
    return [];
  }
}

// Subscriptions
export async function fetchSubscriptions() {
  try {
    // For now, return mock data as subscription tracking might not be implemented yet
    return [
      {
        id: '1',
        name: 'Netflix',
        amount: 15.99,
        isActive: true,
        nextBillingDate: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Spotify',
        amount: 9.99,
        isActive: true,
        nextBillingDate: new Date().toISOString(),
      },
    ];
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return [];
  }
}

// Financial Summary Calculator
export function calculateFinancialSummary(transactions: any[]) {
  const totalIncome = transactions
    .filter((t) => t.type === 'income' || t.amount > 0)
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense' || t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  const netBalance = totalIncome - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    netBalance,
  };
}

// User Profile
export async function fetchUserProfile() {
  try {
    const response = await getData('/api/user/settings');
    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

// Update Goal
export async function updateGoal(goalId: string, updates: any) {
  try {
    const response = await putData(`/api/goals/${goalId}`, updates);
    return response.data;
  } catch (error) {
    console.error('Error updating goal:', error);
    throw error;
  }
}

// Create Goal
export async function createGoal(goalData: any) {
  try {
    const response = await postData('/api/goals', goalData);
    return response.data;
  } catch (error) {
    console.error('Error creating goal:', error);
    throw error;
  }
}

// Delete Goal
export async function deleteGoal(goalId: string) {
  try {
    await deleteData(`/api/goals/${goalId}`);
    return true;
  } catch (error) {
    console.error('Error deleting goal:', error);
    throw error;
  }
}

// Update Goal Progress
export async function updateGoalProgress(goalId: string, newAmount: number) {
  try {
    const response = await putData(`/api/goals/${goalId}/progress`, {
      currentAmount: newAmount,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating goal progress:', error);
    throw error;
  }
}
