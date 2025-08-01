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
      // TODO: Fix to query through basiq_users relation
      Promise.resolve({ _sum: { balance: 0 } }),

      // Net income for the period
      // TODO: Fix to query through proper relations
      Promise.resolve({ _sum: { amount: 0 } }),

      // Total expenses for the period
      // TODO: Fix to query through proper relations
      Promise.resolve({ _sum: { amount: 0 } }),

      // Active goals
      prisma.goal.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { targetDate: 'asc' },
        take: 5
      }),

      // Bank accounts
      // TODO: Fix to query through basiq_users relation
      Promise.resolve([]),

      // Recent transactions
      // TODO: Fix to query through proper relations
      Promise.resolve([])
    ])

    // Calculate previous period for comparison
    const previousStartDate = new Date(startDate)
    previousStartDate.setMonth(previousStartDate.getMonth() - 1)
    const previousEndDate = new Date(startDate)
    previousEndDate.setDate(previousEndDate.getDate() - 1)

    // TODO: Fix to query through proper relations
    const [previousIncome, previousExpenses] = [
      { _sum: { amount: 0 } },
      { _sum: { amount: 0 } }
    ]

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
        name: goal.title,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        targetDate: goal.targetDate.toISOString(),
        category: goal.category,
        progress: Number(goal.targetAmount) > 0 ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 : 0
      })),
      bankAccounts: (bankAccounts as any[]).map((account: any) => ({
        id: account.id,
        institutionName: account.institution_name || '',
        accountName: account.account_name || '',
        accountNumber: account.account_number || '****',
        balance: account.balance_current || 0,
        accountType: account.account_type || 'Unknown',
        isActive: account.status === 'active'
      })),
      recentTransactions: (recentTransactions as any[]).map((transaction: any) => ({
        id: transaction.id,
        date: transaction.transaction_date.toISOString(),
        description: transaction.description,
        amount: Number(transaction.amount),
        type: Number(transaction.amount) > 0 ? 'INCOME' : 'EXPENSE',
        category: transaction.category,
        institutionName: transaction.bank_accounts?.institutionName
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