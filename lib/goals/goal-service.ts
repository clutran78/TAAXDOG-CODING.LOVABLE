import { prisma } from '../prisma';
import { logger } from '../logger';

export class GoalService {
  static async updateProgress(goalId: string, amount: number) {
    try {
      const goal = await prisma.goals.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        throw new Error('Goal not found');
      }

      const updatedGoal = await prisma.goals.update({
        where: { id: goalId },
        data: {
          current_amount: goal.current_amount + amount,
          updated_at: new Date(),
        },
      });

      // Check if goal is completed
      if (updatedGoal.current_amount >= updatedGoal.target_amount) {
        await prisma.goals.update({
          where: { id: goalId },
          data: {
            status: 'COMPLETED',
            completed_at: new Date(),
          },
        });
      }

      return updatedGoal;
    } catch (error) {
      logger.error('Failed to update goal progress', { error, goalId, amount });
      throw error;
    }
  }

  static async getGoalsByUserId(userId: string) {
    return prisma.goals.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  static async createGoal(userId: string, data: any) {
    return prisma.goals.create({
      data: {
        ...data,
        user_id: userId,
        current_amount: 0,
        status: 'ACTIVE',
      },
    });
  }
}

export const { updateProgress, getGoalsByUserId, createGoal } = GoalService;