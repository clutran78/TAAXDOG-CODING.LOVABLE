import { Goal } from '@/lib/types/goal';
import { showToast } from '@/lib/utils/helpers';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

/**
 * Goal Service
 * Handles all goal-related operations using PostgreSQL via Next.js API routes
 * Previously firebase-service.ts - now using PostgreSQL exclusively
 */

// Fetch all goals for the current user
export const fetchGoals = async (): Promise<Goal[]> => {
  try {
    const response = await fetch('/api/goals', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch goals');
    }

    const data = await response.json();
    return data.data || data; // Handle both wrapped and unwrapped responses
  } catch (error) {
    logger.error('Error fetching goals:', error);
    showToast('Error fetching goals', 'danger');
    throw error;
  }
};

// Delete a specific goal
export const deleteGoal = async (goalId: string): Promise<void> => {
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete goal');
    }

    showToast('Goal deleted successfully', 'success');
  } catch (error) {
    logger.error('Error deleting goal:', error);
    showToast('Error deleting goal', 'danger');
    throw error;
  }
};

// Update goal progress
export const updateGoalProgress = async (goalId: string, newAmount: number): Promise<Goal> => {
  try {
    const response = await fetch(`/api/goals/${goalId}/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ currentAmount: newAmount }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update goal progress');
    }

    const data = await response.json();
    const updatedGoal = data.data || data;
    
    // Calculate progress percentage
    const progress = (updatedGoal.currentAmount / updatedGoal.targetAmount) * 100;
    
    if (progress >= 100) {
      showToast('Congratulations! Goal achieved! 🎉', 'success');
    } else {
      showToast(`Progress updated: ${progress.toFixed(0)}% complete`, 'success');
    }
    
    return updatedGoal;
  } catch (error) {
    logger.error('Error updating goal progress:', error);
    showToast('Error updating goal progress', 'danger');
    throw error;
  }
};

// Create a new goal
export const createGoal = async (goal: Partial<Goal>): Promise<Goal> => {
  try {
    // Validate required fields
    if (!goal.title || !goal.targetAmount || !goal.targetDate) {
      throw new Error('Missing required fields: title, targetAmount, and targetDate');
    }

    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...goal,
        currentAmount: goal.currentAmount || 0,
        type: goal.type || 'SAVINGS',
        status: 'ACTIVE',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create goal');
    }

    const data = await response.json();
    const newGoal = data.data || data;
    
    showToast('Goal created successfully', 'success');
    return newGoal;
  } catch (error) {
    logger.error('Error creating goal:', error);
    showToast(error instanceof Error ? error.message : 'Error creating goal', 'danger');
    throw error;
  }
};

// Update an existing goal
export const updateGoal = async (goalId: string, updates: Partial<Goal>): Promise<Goal> => {
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update goal');
    }

    const data = await response.json();
    const updatedGoal = data.data || data;
    
    showToast('Goal updated successfully', 'success');
    return updatedGoal;
  } catch (error) {
    logger.error('Error updating goal:', error);
    showToast('Error updating goal', 'danger');
    throw error;
  }
};

// Get a single goal by ID
export const fetchGoalById = async (goalId: string): Promise<Goal> => {
  try {
    const response = await fetch(`/api/goals/${goalId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch goal');
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    logger.error('Error fetching goal:', error);
    showToast('Error fetching goal details', 'danger');
    throw error;
  }
};

// Archive a goal (soft delete)
export const archiveGoal = async (goalId: string): Promise<Goal> => {
  try {
    const response = await fetch(`/api/goals/${goalId}/archive`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to archive goal');
    }

    const data = await response.json();
    const archivedGoal = data.data || data;
    
    showToast('Goal archived successfully', 'success');
    return archivedGoal;
  } catch (error) {
    logger.error('Error archiving goal:', error);
    showToast('Error archiving goal', 'danger');
    throw error;
  }
};

// Calculate goal statistics
export const calculateGoalStats = (goals: Goal[]) => {
  const activeGoals = goals.filter(g => g.status === 'ACTIVE');
  const completedGoals = goals.filter(g => g.status === 'COMPLETED');
  
  const totalTargetAmount = activeGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const totalCurrentAmount = activeGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const overallProgress = totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;
  
  const nearingCompletion = activeGoals.filter(goal => {
    const progress = (goal.currentAmount / goal.targetAmount) * 100;
    return progress >= 80 && progress < 100;
  });
  
  const overdue = activeGoals.filter(goal => {
    return new Date(goal.targetDate) < new Date() && goal.currentAmount < goal.targetAmount;
  });
  
  return {
    totalGoals: goals.length,
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    totalTargetAmount,
    totalCurrentAmount,
    overallProgress,
    nearingCompletion: nearingCompletion.length,
    overdueGoals: overdue.length,
  };
};

// Batch update multiple goals
export const batchUpdateGoals = async (updates: Array<{ id: string; updates: Partial<Goal> }>): Promise<Goal[]> => {
  try {
    const response = await fetch('/api/goals/batch', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ updates }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update goals');
    }

    const data = await response.json();
    const updatedGoals = data.data || data;
    
    showToast(`${updatedGoals.length} goals updated successfully`, 'success');
    return updatedGoals;
  } catch (error) {
    logger.error('Error batch updating goals:', error);
    showToast('Error updating goals', 'danger');
    throw error;
  }
};