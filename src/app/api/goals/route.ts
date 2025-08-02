import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unifiedMonitoredPrisma as prisma } from '@/lib/db/unifiedMonitoredPrisma';
import { z } from 'zod';

// Validation schema for goal creation
const createGoalSchema = z.object({
  title: z.string().min(1).max(255),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).default(0),
  targetDate: z.string().datetime(),
  category: z.string().optional(),
});

// GET /api/goals - Get all goals for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const goals = await prisma.goal.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ goals });
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

// POST /api/goals - Create a new goal
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createGoalSchema.parse(body);

    const goal = await prisma.goal.create({
      data: {
        userId: session.user.id,
        title: validatedData.title,
        targetAmount: validatedData.targetAmount,
        currentAmount: validatedData.currentAmount,
        targetDate: new Date(validatedData.targetDate),
        category: validatedData.category,
        status: 'ACTIVE',
      },
    });

    // Log the financial operation
    await prisma.financialAuditLog.create({
      data: {
        userId: session.user.id,
        operationType: 'GOAL_CREATE',
        resourceType: 'Goal',
        resourceId: goal.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
        httpMethod: 'POST',
        endpoint: '/api/goals',
        currentData: goal,
        amount: validatedData.targetAmount,
      },
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 },
      );
    }

    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}
