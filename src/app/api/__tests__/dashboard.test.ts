import { NextRequest } from 'next/server'
import { GET } from '../dashboard/route'

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    bankAccount: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    transaction: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    goal: {
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}))

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

import { getServerSession } from 'next-auth'
import { PrismaClient } from '@prisma/client'

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>

describe('/api/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/dashboard')
    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns dashboard data when user is authenticated', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id' },
    } as any)

    // Mock Prisma responses
    mockPrisma.bankAccount.aggregate.mockResolvedValue({
      _sum: { balance: 5000 },
    } as any)

    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 3000 } } as any) // income
      .mockResolvedValueOnce({ _sum: { amount: 1500 } } as any) // expenses
      .mockResolvedValueOnce({ _sum: { amount: 2800 } } as any) // previous income
      .mockResolvedValueOnce({ _sum: { amount: 1400 } } as any) // previous expenses

    mockPrisma.goal.findMany.mockResolvedValue([
      {
        id: 'goal-1',
        name: 'Emergency Fund',
        targetAmount: 10000,
        currentAmount: 2500,
        targetDate: new Date('2024-12-31'),
        category: 'Emergency',
      },
    ] as any)

    mockPrisma.bankAccount.findMany.mockResolvedValue([
      {
        id: 'account-1',
        institutionName: 'Test Bank',
        accountName: 'Savings',
        accountNumber: '123456789',
        balance: 5000,
        accountType: 'SAVINGS',
        isActive: true,
      },
    ] as any)

    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 'transaction-1',
        date: new Date('2024-01-15'),
        description: 'Salary',
        amount: 3000,
        type: 'INCOME',
        category: 'Salary',
        bankAccount: { institutionName: 'Test Bank' },
      },
    ] as any)

    const request = new NextRequest('http://localhost:3000/api/dashboard')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data).toHaveProperty('totalBalance', 5000)
    expect(data).toHaveProperty('netIncome')
    expect(data.netIncome).toHaveProperty('current', 3000)
    expect(data.netIncome).toHaveProperty('previous', 2800)
    expect(data).toHaveProperty('totalExpenses')
    expect(data).toHaveProperty('goals')
    expect(data).toHaveProperty('bankAccounts')
    expect(data).toHaveProperty('recentTransactions')
  })

  it('handles database errors gracefully', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'test-user-id' },
    } as any)

    mockPrisma.bankAccount.aggregate.mockRejectedValue(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/dashboard')
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Internal server error')
  })
})