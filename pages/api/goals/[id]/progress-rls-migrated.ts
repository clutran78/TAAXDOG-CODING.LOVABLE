import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { GoalService } from '@/lib/goals/goal-service';
import { UpdateProgressRequest } from '@/lib/types/goal';

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const goalId = req.query.id as string;

  try {
    const data: UpdateProgressRequest = req.body;

    if (data.currentAmount === undefined || data.currentAmount < 0) {
      return res.status(400).json({ error: 'Invalid progress amount' });
    }

    // Verify the goal belongs to the user
    const existingGoal = await GoalService.getGoal(goalId, userId);
    if (!existingGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const goal = await GoalService.updateGoalProgress(goalId, data.currentAmount);

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
}