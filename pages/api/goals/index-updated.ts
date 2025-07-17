import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import prismaWithRLS from '@/lib/prisma-rls';
import { GoalServiceRLS } from '@/lib/goals/goal-service-rls';
import { CreateGoalRequest } from '@/lib/types/goal';
import { Prisma } from '@/generated/prisma';

async function handler(
  req: NextApiRequestWithRLS,
  res: NextApiResponse
) {
  if (!req.rlsContext) {
    return res.status(500).json({ error: 'RLS context not initialized' });
  }

  try {
    switch (req.method) {
      case 'GET':
        // Execute with RLS context
        const goals = await req.rlsContext.execute(async () => {
          return await GoalServiceRLS.fetchGoals();
        });
        
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

      case 'POST':
        const data: CreateGoalRequest = req.body;

        if (!data.name || !data.targetAmount || !data.dueDate) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Execute with RLS context
        const goal = await req.rlsContext.execute(async () => {
          return await GoalServiceRLS.createGoal(req.rlsContext!.userId, {
            title: data.name,
            targetAmount: data.targetAmount,
            targetDate: new Date(data.dueDate),
            category: data.category,
            currentAmount: data.currentAmount,
          });
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

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    return handleRLSError(error, res);
  }
}

export default withRLSMiddleware(handler);