import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, FinancialOperation } from '@prisma/client';
import { createAuditLog } from '@/lib/services/auditLogger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schema
const createGoalSchema = z.object({
  title: z.string().min(1).max(255),
  targetAmount: z.number().positive(),
  targetDate: z.string().datetime(),
  category: z.string().optional()
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Validate request body
    const validatedData = createGoalSchema.parse(req.body);
    
    // Create the goal
    const goal = await prisma.goal.create({
      data: {
        userId: session.user.id,
        title: validatedData.title,
        targetAmount: validatedData.targetAmount,
        targetDate: new Date(validatedData.targetDate),
        category: validatedData.category,
        currentAmount: 0,
        status: 'ACTIVE'
      }
    });
    
    // Create audit log
    await createAuditLog({
      userId: session.user.id,
      operationType: FinancialOperation.GOAL_CREATE,
      resourceType: 'Goal',
      resourceId: goal.id,
      currentData: goal,
      amount: Number(goal.targetAmount),
      success: true
    }, {
      request: req,
      sessionId: session.user.id
    });
    
    return res.status(201).json({
      success: true,
      data: goal
    });
    
  } catch (error: any) {
    // Log the failure
    await createAuditLog({
      userId: session.user.id,
      operationType: FinancialOperation.GOAL_CREATE,
      resourceType: 'Goal',
      currentData: req.body,
      success: false,
      errorMessage: error.message
    }, {
      request: req,
      sessionId: session.user.id
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    
    console.error('Goal creation error:', error);
    return res.status(500).json({
      error: 'Failed to create goal'
    });
  }
}