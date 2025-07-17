import { prisma } from '@/lib/prisma';
import { Goal, GoalStatus, Prisma } from '@/generated/prisma';

export interface CreateGoalData {
  title: string;
  targetAmount: number;
  targetDate: Date;
  category?: string;
  currentAmount?: number;
}

export interface UpdateGoalData {
  title?: string;
  targetAmount?: number;
  targetDate?: Date;
  category?: string;
  status?: GoalStatus;
  currentAmount?: number;
}

export class GoalService {
  /**
   * Fetch all goals for a specific user
   */
  static async fetchGoals(userId: string): Promise<Goal[]> {
    try {
      const goals = await prisma.goal.findMany({
        where: {
          userId,
        },
        orderBy: [
          { status: 'asc' },
          { targetDate: 'asc' },
        ],
      });

      return goals;
    } catch (error) {
      console.error('Error fetching goals:', error);
      throw new Error('Failed to fetch goals');
    }
  }

  /**
   * Create a new goal for a user
   */
  static async createGoal(userId: string, goalData: CreateGoalData): Promise<Goal> {
    try {
      const goal = await prisma.goal.create({
        data: {
          userId,
          title: goalData.title,
          targetAmount: new Prisma.Decimal(goalData.targetAmount),
          currentAmount: new Prisma.Decimal(goalData.currentAmount || 0),
          targetDate: goalData.targetDate,
          category: goalData.category,
          status: GoalStatus.ACTIVE,
        },
      });

      return goal;
    } catch (error) {
      console.error('Error creating goal:', error);
      throw new Error('Failed to create goal');
    }
  }

  /**
   * Update an existing goal
   */
  static async updateGoal(goalId: string, updates: UpdateGoalData): Promise<Goal> {
    try {
      const updateData: Prisma.GoalUpdateInput = {};

      if (updates.title !== undefined) {
        updateData.title = updates.title;
      }
      if (updates.targetAmount !== undefined) {
        updateData.targetAmount = new Prisma.Decimal(updates.targetAmount);
      }
      if (updates.currentAmount !== undefined) {
        updateData.currentAmount = new Prisma.Decimal(updates.currentAmount);
      }
      if (updates.targetDate !== undefined) {
        updateData.targetDate = updates.targetDate;
      }
      if (updates.category !== undefined) {
        updateData.category = updates.category;
      }
      if (updates.status !== undefined) {
        updateData.status = updates.status;
      }

      const goal = await prisma.goal.update({
        where: {
          id: goalId,
        },
        data: updateData,
      });

      return goal;
    } catch (error) {
      console.error('Error updating goal:', error);
      throw new Error('Failed to update goal');
    }
  }

  /**
   * Delete a goal
   */
  static async deleteGoal(goalId: string): Promise<void> {
    try {
      await prisma.goal.delete({
        where: {
          id: goalId,
        },
      });
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw new Error('Failed to delete goal');
    }
  }

  /**
   * Update goal progress (convenience method for updating currentAmount)
   */
  static async updateGoalProgress(goalId: string, progress: number): Promise<Goal> {
    try {
      const goal = await prisma.goal.update({
        where: {
          id: goalId,
        },
        data: {
          currentAmount: new Prisma.Decimal(progress),
        },
      });

      // Check if goal is completed
      if (goal.currentAmount.gte(goal.targetAmount) && goal.status === GoalStatus.ACTIVE) {
        await prisma.goal.update({
          where: {
            id: goalId,
          },
          data: {
            status: GoalStatus.COMPLETED,
          },
        });
      }

      return goal;
    } catch (error) {
      console.error('Error updating goal progress:', error);
      throw new Error('Failed to update goal progress');
    }
  }

  /**
   * Get a single goal by ID (with user validation)
   */
  static async getGoal(goalId: string, userId: string): Promise<Goal | null> {
    try {
      const goal = await prisma.goal.findFirst({
        where: {
          id: goalId,
          userId,
        },
      });

      return goal;
    } catch (error) {
      console.error('Error fetching goal:', error);
      throw new Error('Failed to fetch goal');
    }
  }

  /**
   * Get active goals for a user
   */
  static async getActiveGoals(userId: string): Promise<Goal[]> {
    try {
      const goals = await prisma.goal.findMany({
        where: {
          userId,
          status: GoalStatus.ACTIVE,
        },
        orderBy: {
          targetDate: 'asc',
        },
      });

      return goals;
    } catch (error) {
      console.error('Error fetching active goals:', error);
      throw new Error('Failed to fetch active goals');
    }
  }

  /**
   * Get goals by category
   */
  static async getGoalsByCategory(userId: string, category: string): Promise<Goal[]> {
    try {
      const goals = await prisma.goal.findMany({
        where: {
          userId,
          category,
        },
        orderBy: [
          { status: 'asc' },
          { targetDate: 'asc' },
        ],
      });

      return goals;
    } catch (error) {
      console.error('Error fetching goals by category:', error);
      throw new Error('Failed to fetch goals by category');
    }
  }

  /**
   * Calculate goal completion percentage
   */
  static calculateProgress(goal: Goal): number {
    if (goal.targetAmount.isZero()) {
      return 0;
    }

    const progress = goal.currentAmount.div(goal.targetAmount).mul(100).toNumber();
    return Math.min(Math.max(progress, 0), 100);
  }

  /**
   * Get goal statistics for a user
   */
  static async getGoalStats(userId: string) {
    try {
      const goals = await prisma.goal.findMany({
        where: { userId },
      });

      const stats = {
        total: goals.length,
        active: goals.filter(g => g.status === GoalStatus.ACTIVE).length,
        completed: goals.filter(g => g.status === GoalStatus.COMPLETED).length,
        paused: goals.filter(g => g.status === GoalStatus.PAUSED).length,
        cancelled: goals.filter(g => g.status === GoalStatus.CANCELLED).length,
        totalTargetAmount: goals.reduce((sum, g) => sum.add(g.targetAmount), new Prisma.Decimal(0)),
        totalCurrentAmount: goals.reduce((sum, g) => sum.add(g.currentAmount), new Prisma.Decimal(0)),
      };

      return stats;
    } catch (error) {
      console.error('Error calculating goal stats:', error);
      throw new Error('Failed to calculate goal statistics');
    }
  }
}

// Export the main functions for backward compatibility
export const fetchGoals = GoalService.fetchGoals;
export const createGoal = GoalService.createGoal;
export const updateGoal = GoalService.updateGoal;
export const deleteGoal = GoalService.deleteGoal;
export const updateGoalProgress = GoalService.updateGoalProgress;