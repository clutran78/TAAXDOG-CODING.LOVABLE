import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { GoalService } from '@/lib/goals/goal-service';
import { UpdateProgressRequest } from '@/lib/types/goal';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  const userId = session.user.id;
  const goalId = req.query.id as string;

  try {
    const data: UpdateProgressRequest = req.body;

    if (data.currentAmount === undefined || data.currentAmount < 0) {
      return apiResponse.error(res, { error: 'Invalid progress amount' });
    }

    // Verify the goal belongs to the user
    const existingGoal = await GoalService.getGoal(goalId, userId);
    if (!existingGoal) {
      return apiResponse.notFound(res, { error: 'Goal not found' });
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

    return apiResponse.success(res, formattedGoal);
  } catch (error) {
    logger.error('Error updating goal progress:', error);
    return apiResponse.internalError(res, { error: 'Failed to update goal progress' });
  }
}
