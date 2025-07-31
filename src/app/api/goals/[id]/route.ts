import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const goalId = params.id
    const body = await request.json()

    // Check if goal exists and belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: { id: goalId, userId }
    })

    if (!existingGoal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      )
    }

    const {
      name,
      description,
      targetAmount,
      currentAmount,
      targetDate,
      category,
      isCompleted
    } = body

    // Validate target amount if provided
    if (targetAmount !== undefined && targetAmount <= 0) {
      return NextResponse.json(
        { error: 'Target amount must be positive' },
        { status: 400 }
      )
    }

    // Validate current amount if provided
    if (currentAmount !== undefined && currentAmount < 0) {
      return NextResponse.json(
        { error: 'Current amount cannot be negative' },
        { status: 400 }
      )
    }

    const updatedGoal = await prisma.goal.update({
      where: { id: goalId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(targetAmount !== undefined && { targetAmount }),
        ...(currentAmount !== undefined && { currentAmount }),
        ...(targetDate !== undefined && { targetDate: new Date(targetDate) }),
        ...(category !== undefined && { category }),
        ...(isCompleted !== undefined && { isCompleted })
      }
    })

    return NextResponse.json({
      id: updatedGoal.id,
      name: updatedGoal.name,
      description: updatedGoal.description,
      targetAmount: updatedGoal.targetAmount,
      currentAmount: updatedGoal.currentAmount,
      targetDate: updatedGoal.targetDate.toISOString(),
      category: updatedGoal.category,
      isCompleted: updatedGoal.isCompleted,
      updatedAt: updatedGoal.updatedAt.toISOString()
    })

  } catch (error) {
    console.error('Goal PUT API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const goalId = params.id

    // Check if goal exists and belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: { id: goalId, userId }
    })

    if (!existingGoal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      )
    }

    await prisma.goal.delete({
      where: { id: goalId }
    })

    return NextResponse.json(
      { message: 'Goal deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Goal DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}