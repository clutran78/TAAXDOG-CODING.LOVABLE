import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient, FinancialOperation, Goal } from '@prisma/client';
import { createAuditLog } from '@/lib/services/auditLogger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schema
const updateGoalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  targetAmount: z.number().positive().optional(),
  currentAmount: z.number().min(0).optional(),
  targetDate: z.string().datetime().optional(),
  category: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED']).optional()
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Validate request body
    const validatedData = updateGoalSchema.parse(req.body);
    
    // Get the existing goal for audit trail
    const existingGoal = await prisma.goal.findFirst({
      where: {
        id: validatedData.id,
        userId: session.user.id
      }
    });
    
    if (!existingGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    
    // Prepare update data
    const updateData: any = {};
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.targetAmount !== undefined) updateData.targetAmount = validatedData.targetAmount;
    if (validatedData.currentAmount !== undefined) updateData.currentAmount = validatedData.currentAmount;
    if (validatedData.targetDate !== undefined) updateData.targetDate = new Date(validatedData.targetDate);
    if (validatedData.category !== undefined) updateData.category = validatedData.category;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    
    // Update the goal
    const updatedGoal = await prisma.goal.update({
      where: { id: validatedData.id },
      data: updateData
    });
    
    // Determine operation type based on status change
    let operationType = FinancialOperation.GOAL_UPDATE;
    if (validatedData.status === 'COMPLETED' && existingGoal.status !== 'COMPLETED') {
      operationType = FinancialOperation.GOAL_COMPLETE;
    }
    
    // Create audit log with before/after data
    await createAuditLog({
      userId: session.user.id,
      operationType,
      resourceType: 'Goal',
      resourceId: updatedGoal.id,
      previousData: existingGoal,
      currentData: updatedGoal,
      amount: Number(updatedGoal.targetAmount),
      success: true
    }, {
      request: req,
      sessionId: session.user.id
    });
    
    return res.status(200).json({
      success: true,
      data: updatedGoal
    });
    
  } catch (error: any) {
    // Log the failure
    await createAuditLog({
      userId: session.user.id,
      operationType: FinancialOperation.GOAL_UPDATE,
      resourceType: 'Goal',
      resourceId: req.body.id,
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
    
    console.error('Goal update error:', error);
    return res.status(500).json({
      error: 'Failed to update goal'
    });
  }
}