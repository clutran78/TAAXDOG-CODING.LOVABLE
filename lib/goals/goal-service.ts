import prisma from '../prisma';
import { logger } from '../logger';
import { Decimal } from '@prisma/client/runtime/library';

export class GoalService {
  static async updateProgress(goalId: string, amount: number) {
    try {
      const goal = await prisma.goal.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        throw new Error('Goal not found');
      }

      const updatedGoal = await prisma.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: goal.currentAmount.add(amount),
          updatedAt: new Date(),
        },
      });

      // Check if goal is completed
      if (updatedGoal.currentAmount.gte(updatedGoal.targetAmount)) {
        await prisma.goal.update({
          where: { id: goalId },
          data: {
            status: 'COMPLETED',
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
    return prisma.goal.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createGoal(userId: string, data: any) {
    return prisma.goal.create({
      data: {
        ...data,
        userId: userId,
        currentAmount: 0,
        status: 'ACTIVE',
      },
    });
  }
}

export const { updateProgress, getGoalsByUserId, createGoal } = GoalService;
