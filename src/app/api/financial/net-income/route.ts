import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
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
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'current-month'

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    switch (period) {
      case 'current-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'last-3-months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      case 'year-to-date':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Calculate previous period for comparison
    const previousStartDate = new Date(startDate)
    previousStartDate.setMonth(previousStartDate.getMonth() - 1)
    const previousEndDate = new Date(startDate)
    previousEndDate.setDate(previousEndDate.getDate() - 1)

    // Fetch current period income
    const currentIncome = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'INCOME',
        date: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    })

    // Fetch previous period income
    const previousIncome = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'INCOME',
        date: { gte: previousStartDate, lte: previousEndDate }
      },
      _sum: { amount: true }
    })

    // Fetch year to date income
    const yearStartDate = new Date(now.getFullYear(), 0, 1)
    const yearToDateIncome = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'INCOME',
        date: { gte: yearStartDate, lte: now }
      },
      _sum: { amount: true }
    })

    // Fetch recent income transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'INCOME',
        date: { gte: startDate, lte: endDate }
      },
      orderBy: { date: 'desc' },
      take: 20,
      include: {
        bankAccount: {
          select: { institutionName: true }
        }
      }
    })

    const incomeData = {
      currentMonth: currentIncome._sum.amount || 0,
      previousMonth: previousIncome._sum.amount || 0,
      yearToDate: yearToDateIncome._sum.amount || 0,
      transactions: transactions.map(transaction => ({
        id: transaction.id,
        date: transaction.date.toISOString(),
        description: transaction.description,
        amount: transaction.amount,
        category: transaction.category,
        source: transaction.bankAccount?.institutionName || 'Unknown'
      }))
    }

    return NextResponse.json(incomeData)

  } catch (error) {
    console.error('Net income API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}