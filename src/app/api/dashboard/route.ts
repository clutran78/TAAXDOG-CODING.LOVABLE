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

    // Fetch user's financial data
    const [
      totalBalance,
      netIncome,
      totalExpenses,
      goals,
      bankAccounts,
      recentTransactions
    ] = await Promise.all([
      // Total balance from all accounts
      prisma.bankAccount.aggregate({
        where: { userId, isActive: true },
        _sum: { balance: true }
      }),

      // Net income for the period
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'INCOME',
          date: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true }
      }),

      // Total expenses for the period
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          date: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true }
      }),

      // Active goals
      prisma.goal.findMany({
        where: { userId, isCompleted: false },
        orderBy: { targetDate: 'asc' },
        take: 5
      }),

      // Bank accounts
      prisma.bankAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 3
      }),

      // Recent transactions
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 10,
        include: {
          bankAccount: {
            select: { institutionName: true }
          }
        }
      })
    ])

    // Calculate previous period for comparison
    const previousStartDate = new Date(startDate)
    previousStartDate.setMonth(previousStartDate.getMonth() - 1)
    const previousEndDate = new Date(startDate)
    previousEndDate.setDate(previousEndDate.getDate() - 1)

    const [previousIncome, previousExpenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'INCOME',
          date: { gte: previousStartDate, lte: previousEndDate }
        },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          date: { gte: previousStartDate, lte: previousEndDate }
        },
        _sum: { amount: true }
      })
    ])

    // Format response data
    const dashboardData = {
      totalBalance: totalBalance._sum.balance || 0,
      netIncome: {
        current: netIncome._sum.amount || 0,
        previous: previousIncome._sum.amount || 0
      },
      totalExpenses: {
        current: totalExpenses._sum.amount || 0,
        previous: previousExpenses._sum.amount || 0
      },
      netBalance: (netIncome._sum.amount || 0) - (totalExpenses._sum.amount || 0),
      goals: goals.map(goal => ({
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetDate: goal.targetDate.toISOString(),
        category: goal.category,
        progress: goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
      })),
      bankAccounts: bankAccounts.map(account => ({
        id: account.id,
        institutionName: account.institutionName,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        balance: account.balance,
        accountType: account.accountType,
        isActive: account.isActive
      })),
      recentTransactions: recentTransactions.map(transaction => ({
        id: transaction.id,
        date: transaction.date.toISOString(),
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type,
        category: transaction.category,
        institutionName: transaction.bankAccount?.institutionName
      }))
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}