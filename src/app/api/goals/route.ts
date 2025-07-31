import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    const formattedGoals = goals.map(goal => ({
      id: goal.id,
      name: goal.name,
      description: goal.description,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: goal.targetDate.toISOString(),
      category: goal.category,
      isCompleted: goal.isCompleted,
      createdAt: goal.createdAt.toISOString(),
      progress: goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
    }))

    return NextResponse.json(formattedGoals)

  } catch (error) {
    console.error('Goals GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()

    const {
      name,
      description,
      targetAmount,
      currentAmount,
      targetDate,
      category
    } = body

    // Validate required fields
    if (!name || !targetAmount || !targetDate || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate target amount is positive
    if (targetAmount <= 0) {
      return NextResponse.json(
        { error: 'Target amount must be positive' },
        { status: 400 }
      )
    }

    // Validate target date is in the future
    if (new Date(targetDate) <= new Date()) {
      return NextResponse.json(
        { error: 'Target date must be in the future' },
        { status: 400 }
      )
    }

    const newGoal = await prisma.goal.create({
      data: {
        userId,
        name,
        description: description || '',
        targetAmount,
        currentAmount: currentAmount || 0,
        targetDate: new Date(targetDate),
        category,
        isCompleted: false
      }
    })

    return NextResponse.json({
      id: newGoal.id,
      name: newGoal.name,
      description: newGoal.description,
      targetAmount: newGoal.targetAmount,
      currentAmount: newGoal.currentAmount,
      targetDate: newGoal.targetDate.toISOString(),
      category: newGoal.category,
      isCompleted: newGoal.isCompleted,
      createdAt: newGoal.createdAt.toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('Goals POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}