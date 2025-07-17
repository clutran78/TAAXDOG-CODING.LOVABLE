import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { GoalServiceRLS } from '@/lib/goals/goal-service-rls';
import { UpdateProgressRequest } from '@/lib/types/goal';

async function handler(
  req: NextApiRequestWithRLS,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!req.rlsContext) {
    return res.status(500).json({ error: 'RLS context not initialized' });
  }

  const goalId = req.query.id as string;

  try {
    const data: UpdateProgressRequest = req.body;

    if (data.currentAmount === undefined || data.currentAmount < 0) {
      return res.status(400).json({ error: 'Invalid progress amount' });
    }

    const goal = await req.rlsContext.execute(async () => {
      return await GoalServiceRLS.updateGoalProgress(goalId, data.currentAmount);
    });

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
  } catch (error: any) {
    if (error.message === 'Goal not found or access denied') {
      return res.status(404).json({ error: 'Goal not found' });
    }
    return handleRLSError(error, res);
  }
}

export default withRLSMiddleware(handler);