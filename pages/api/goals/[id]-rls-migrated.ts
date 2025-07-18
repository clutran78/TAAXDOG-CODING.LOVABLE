import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { GoalService } from '@/lib/goals/goal-service';
import { UpdateGoalRequest } from '@/lib/types/goal';

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const goalId = req.query.id as string;

  switch (req.method) {
    case 'GET':
      try {
        const goal = await GoalService.getGoal(goalId, userId);
        
        if (!goal) {
          return res.status(404).json({ error: 'Goal not found' });
        }

        const formattedGoal = {
          id: goal.id,
          name: goal.title,
          currentAmount: goal.currentAmount.toNumber(),
          targetAmount: goal.targetAmount.toNumber(),
          dueDate: goal.targetDate.toISOString(),
          userId: goal.userId,
          description: goal.category,
          category: goal.category,
          createdAt: goal.createdAt.toISOString(),
          updatedAt: goal.updatedAt.toISOString(),
          status: goal.status,
        };

        return res.status(200).json(formattedGoal);
      } catch (error) {
    return handleRLSError(error, res);
      }

    case 'PUT':
      try {
        const data: UpdateGoalRequest = req.body;

        // Verify the goal belongs to the user
        const existingGoal = await GoalService.getGoal(goalId, userId);
        if (!existingGoal) {
          return res.status(404).json({ error: 'Goal not found' });
        }

        const updateData: any = {};

        if (data.name !== undefined) updateData.title = data.name;
        if (data.targetAmount !== undefined) updateData.targetAmount = data.targetAmount;
        if (data.currentAmount !== undefined) updateData.currentAmount = data.currentAmount;
        if (data.dueDate !== undefined) updateData.targetDate = new Date(data.dueDate);
        if (data.category !== undefined) updateData.category = data.category;
        if (data.status !== undefined) updateData.status = data.status;

        const goal = await GoalService.updateGoal(goalId, updateData);

        const formattedGoal = {
          id: goal.id,
          name: goal.title,
          currentAmount: goal.currentAmount.toNumber(),
          targetAmount: goal.targetAmount.toNumber(),
          dueDate: goal.targetDate.toISOString(),
          userId: goal.userId,
          description: goal.category,
          category: goal.category,
          createdAt: goal.createdAt.toISOString(),
          updatedAt: goal.updatedAt.toISOString(),
          status: goal.status,
        };

        return res.status(200).json(formattedGoal);
      } catch (error) {
    return handleRLSError(error, res);
      }

    case 'DELETE':
      try {
        // Verify the goal belongs to the user
        const existingGoal = await GoalService.getGoal(goalId, userId);
        if (!existingGoal) {
          return res.status(404).json({ error: 'Goal not found' });
        }

        await GoalService.deleteGoal(goalId);
        return res.status(204).end();
      } catch (error) {
    return handleRLSError(error, res);
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ error: 'Method not allowed' });
  }
}