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

    // Fetch current period expenses
    const currentExpenses = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true }
    })

    // Fetch previous period expenses
    const previousExpenses = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: previousStartDate, lte: previousEndDate }
      },
      _sum: { amount: true }
    })

    // Fetch year to date expenses
    const yearStartDate = new Date(now.getFullYear(), 0, 1)
    const yearToDateExpenses = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: yearStartDate, lte: now }
      },
      _sum: { amount: true }
    })

    // Fetch expense categories breakdown
    const categoryBreakdown = await prisma.transaction.groupBy({
      by: ['category'],
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startDate, lte: endDate }
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } }
    })

    const totalExpenseAmount = currentExpenses._sum.amount || 0
    const categories = categoryBreakdown.map(item => ({
      name: item.category,
      amount: item._sum.amount || 0,
      percentage: totalExpenseAmount > 0 ? ((item._sum.amount || 0) / totalExpenseAmount) * 100 : 0
    }))

    // Fetch recent expense transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
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

    const expenseData = {
      currentMonth: totalExpenseAmount,
      previousMonth: previousExpenses._sum.amount || 0,
      yearToDate: yearToDateExpenses._sum.amount || 0,
      categories,
      transactions: transactions.map(transaction => ({
        id: transaction.id,
        date: transaction.date.toISOString(),
        description: transaction.description,
        amount: transaction.amount,
        category: transaction.category,
        merchant: transaction.merchant || 'Unknown'
      }))
    }

    return NextResponse.json(expenseData)

  } catch (error) {
    console.error('Total expenses API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}