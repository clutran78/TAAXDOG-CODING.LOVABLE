import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { GoalServiceRLS } from '@/lib/goals/goal-service-rls';
import { UpdateGoalRequest } from '@/lib/types/goal';

async function handler(
  req: NextApiRequestWithRLS,
  res: NextApiResponse
) {
  if (!req.rlsContext) {
    return res.status(500).json({ error: 'RLS context not initialized' });
  }

  const goalId = req.query.id as string;

  try {
    switch (req.method) {
      case 'GET':
        const goal = await req.rlsContext.execute(async () => {
          return await GoalServiceRLS.getGoal(goalId);
        });
        
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

      case 'PUT':
        const data: UpdateGoalRequest = req.body;

        const updateData: any = {};
        if (data.name !== undefined) updateData.title = data.name;
        if (data.targetAmount !== undefined) updateData.targetAmount = data.targetAmount;
        if (data.currentAmount !== undefined) updateData.currentAmount = data.currentAmount;
        if (data.dueDate !== undefined) updateData.targetDate = new Date(data.dueDate);
        if (data.category !== undefined) updateData.category = data.category;
        if (data.status !== undefined) updateData.status = data.status;

        const updatedGoal = await req.rlsContext.execute(async () => {
          return await GoalServiceRLS.updateGoal(goalId, updateData);
        });

        const formattedUpdatedGoal = {
          id: updatedGoal.id,
          name: updatedGoal.title,
          currentAmount: updatedGoal.currentAmount.toNumber(),
          targetAmount: updatedGoal.targetAmount.toNumber(),
          dueDate: updatedGoal.targetDate.toISOString(),
          userId: updatedGoal.userId,
          description: updatedGoal.category,
          category: updatedGoal.category,
          createdAt: updatedGoal.createdAt.toISOString(),
          updatedAt: updatedGoal.updatedAt.toISOString(),
          status: updatedGoal.status,
        };

        return res.status(200).json(formattedUpdatedGoal);

      case 'DELETE':
        await req.rlsContext.execute(async () => {
          await GoalServiceRLS.deleteGoal(goalId);
        });
        
        return res.status(204).end();

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    // Handle specific errors
    if (error.message === 'Goal not found or access denied') {
      return res.status(404).json({ error: 'Goal not found' });
    }
    return handleRLSError(error, res);
  }
}

export default withRLSMiddleware(handler);