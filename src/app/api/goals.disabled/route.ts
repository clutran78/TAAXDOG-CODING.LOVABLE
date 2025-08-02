import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const formattedGoals = goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      targetAmount: goal.targetAmount.toNumber(),
      currentAmount: goal.currentAmount.toNumber(),
      targetDate: goal.targetDate.toISOString(),
      category: goal.category,
      status: goal.status,
      createdAt: goal.createdAt.toISOString(),
      progress:
        goal.targetAmount.toNumber() > 0
          ? (goal.currentAmount.toNumber() / goal.targetAmount.toNumber()) * 100
          : 0,
      isActive: goal.status === 'ACTIVE',
      isCompleted: goal.status === 'COMPLETED',
    }));

    return NextResponse.json(formattedGoals);
  } catch (error) {
    console.error('Goals GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    const { title, targetAmount, currentAmount, targetDate, category } = body;

    // Validate required fields
    if (!title || !targetAmount || !targetDate) {
      return NextResponse.json(
        { error: 'Missing required fields: title, targetAmount, and targetDate' },
        { status: 400 },
      );
    }

    // Validate target amount is positive
    if (targetAmount <= 0) {
      return NextResponse.json({ error: 'Target amount must be positive' }, { status: 400 });
    }

    // Validate target date is in the future
    if (new Date(targetDate) <= new Date()) {
      return NextResponse.json({ error: 'Target date must be in the future' }, { status: 400 });
    }

    const newGoal = await prisma.goal.create({
      data: {
        userId,
        title,
        targetAmount,
        currentAmount: currentAmount || 0,
        targetDate: new Date(targetDate),
        category: category || 'SAVINGS',
        status: 'ACTIVE',
      },
    });

    return NextResponse.json(
      {
        id: newGoal.id,
        title: newGoal.title,
        targetAmount: newGoal.targetAmount.toNumber(),
        currentAmount: newGoal.currentAmount.toNumber(),
        targetDate: newGoal.targetDate.toISOString(),
        category: newGoal.category,
        status: newGoal.status,
        createdAt: newGoal.createdAt.toISOString(),
        isActive: newGoal.status === 'ACTIVE',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Goals POST API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
