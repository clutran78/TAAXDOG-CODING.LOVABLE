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

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    })

    const formattedAccounts = bankAccounts.map(account => ({
      id: account.id,
      institutionName: account.institutionName,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      bsb: account.bsb,
      balance: account.balance,
      accountType: account.accountType,
      isActive: account.isActive,
      lastSynced: account.lastSynced?.toISOString(),
      connectionStatus: account.connectionStatus,
      transactionCount: account._count.transactions
    }))

    return NextResponse.json(formattedAccounts)

  } catch (error) {
    console.error('Banking accounts API error:', error)
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
      institutionName,
      accountName,
      accountNumber,
      bsb,
      accountType,
      balance
    } = body

    // Validate required fields
    if (!institutionName || !accountName || !accountNumber || !bsb || !accountType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if account already exists
    const existingAccount = await prisma.bankAccount.findFirst({
      where: {
        userId,
        accountNumber,
        bsb
      }
    })

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Account already exists' },
        { status: 409 }
      )
    }

    const newAccount = await prisma.bankAccount.create({
      data: {
        userId,
        institutionName,
        accountName,
        accountNumber,
        bsb,
        accountType,
        balance: balance || 0,
        isActive: true,
        connectionStatus: 'connected',
        lastSynced: new Date()
      }
    })

    return NextResponse.json({
      id: newAccount.id,
      institutionName: newAccount.institutionName,
      accountName: newAccount.accountName,
      accountNumber: newAccount.accountNumber,
      bsb: newAccount.bsb,
      balance: newAccount.balance,
      accountType: newAccount.accountType,
      isActive: newAccount.isActive,
      connectionStatus: newAccount.connectionStatus,
      lastSynced: newAccount.lastSynced?.toISOString()
    }, { status: 201 })

  } catch (error) {
    console.error('Banking accounts POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}