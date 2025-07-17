import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError, getPaginationParams } from '@/lib/middleware/rls-middleware';
import prismaWithRLS from '@/lib/prisma-rls';

/**
 * Example API route using RLS middleware
 * GET /api/goals/index-rls - Get user's goals with RLS protection
 * POST /api/goals/index-rls - Create a new goal with RLS protection
 */
async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await handleGetGoals(req, res);
      case 'POST':
        return await handleCreateGoal(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    return handleRLSError(error, res);
  }
}

async function handleGetGoals(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (!req.rlsContext) {
    return res.status(500).json({ error: 'RLS context not initialized' });
  }

  const { skip, take, orderBy, order } = getPaginationParams(req);

  // Execute query with RLS context
  const result = await req.rlsContext.execute(async () => {
    const [goals, total] = await Promise.all([
      prismaWithRLS.goal.findMany({
        skip,
        take,
        orderBy: { [orderBy]: order },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prismaWithRLS.goal.count()
    ]);

    return { goals, total };
  });

  return res.status(200).json({
    success: true,
    data: result.goals,
    pagination: {
      total: result.total,
      page: Math.floor(skip / take) + 1,
      limit: take,
      pages: Math.ceil(result.total / take)
    }
  });
}

async function handleCreateGoal(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (!req.rlsContext) {
    return res.status(500).json({ error: 'RLS context not initialized' });
  }

  const { title, description, targetAmount, targetDate, category } = req.body;

  // Validate input
  if (!title || !targetAmount || !targetDate) {
    return res.status(400).json({ 
      error: 'Validation error',
      message: 'Title, target amount, and target date are required' 
    });
  }

  // Create goal with RLS context
  const goal = await req.rlsContext.execute(async () => {
    return await prismaWithRLS.goal.create({
      data: {
        title,
        description: description || '',
        targetAmount: parseFloat(targetAmount),
        currentAmount: 0,
        targetDate: new Date(targetDate),
        category: category || 'OTHER',
        userId: req.rlsContext!.userId,
        status: 'ACTIVE'
      }
    });
  });

  return res.status(201).json({
    success: true,
    data: goal
  });
}

export default withRLSMiddleware(handler);