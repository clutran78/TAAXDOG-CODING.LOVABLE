import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { GoalService } from '@/lib/goals/goal-service';
import { CreateGoalRequest } from '@/lib/types/goal';
import { Prisma } from '@prisma/client';

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  switch (req.method) {
    case 'GET':
      try {
        const goals = await GoalService.fetchGoals(userId);
        
        // Convert Prisma Decimal to number and format response
        const formattedGoals = goals.map(goal => ({
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
        }));

        return res.status(200).json(formattedGoals);
      } catch (error) {
    return handleRLSError(error, res);
  });
      }

    case 'POST':
      try {
        const data: CreateGoalRequest = req.body;

        if (!data.name || !data.targetAmount || !data.dueDate) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const goal = await GoalService.createGoal(userId, {
          title: data.name,
          targetAmount: data.targetAmount,
          targetDate: new Date(data.dueDate),
          category: data.category,
          currentAmount: data.currentAmount,
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

        return res.status(201).json(formattedGoal);
      } catch (error) {
    return handleRLSError(error, res);
  });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: 'Method not allowed' });
  }
}