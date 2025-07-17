import { Goal } from '@/lib/types/goal';
import { showToast } from './helperFunction';

// Goal-related functions that call our PostgreSQL API via Next.js API routes
export const fetchGoals = async (): Promise<Goal[]> => {
  try {
    const response = await fetch('/api/goals', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch goals');
    }

    const goals = await response.json();
    return goals;
  } catch (error) {
    console.error('Error fetching goals:', error);
    showToast('Error fetching goals', 'danger');
    throw error;
  }
};

export const deleteGoal = async (goalId: string): Promise<void> => {
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete goal');
    }
  } catch (error) {
    console.error('Error deleting goal:', error);
    throw error;
  }
};

export const updateGoalProgress = async (
  goalId: string,
  newAmount: number
): Promise<void> => {
  try {
    const response = await fetch(`/api/goals/${goalId}/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentAmount: newAmount }),
    });

    if (!response.ok) {
      throw new Error('Failed to update goal progress');
    }
  } catch (error) {
    console.error('Error updating goal progress:', error);
    throw new Error('Failed to update goal progress.');
  }
};

export const createGoal = async (goal: Partial<Goal>): Promise<Goal> => {
  try {
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(goal),
    });

    if (!response.ok) {
      throw new Error('Failed to create goal');
    }

    const newGoal = await response.json();
    return newGoal;
  } catch (error) {
    console.error('Error creating goal:', error);
    showToast('Error creating goal', 'danger');
    throw error;
  }
};

export const updateGoal = async (goalId: string, updates: Partial<Goal>): Promise<Goal> => {
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update goal');
    }

    const updatedGoal = await response.json();
    return updatedGoal;
  } catch (error) {
    console.error('Error updating goal:', error);
    showToast('Error updating goal', 'danger');
    throw error;
  }
};