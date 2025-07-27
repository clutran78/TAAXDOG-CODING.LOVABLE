import { PrismaClient } from '@prisma/client';
import { mockData } from '../fixtures/mockData';

export class DatabaseHelper {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Clean all data from the database
   */
  async cleanDatabase(): Promise<void> {
    // Delete in correct order to respect foreign key constraints
    const deleteOperations = [
      // Financial data
      this.prisma.aIUsageTracking.deleteMany(),
      this.prisma.aICache.deleteMany(),
      this.prisma.receiptItem.deleteMany(),
      this.prisma.receipt.deleteMany(),
      this.prisma.transaction.deleteMany(),
      this.prisma.bankAccount.deleteMany(),
      this.prisma.budget.deleteMany(),
      this.prisma.goal.deleteMany(),
      this.prisma.insight.deleteMany(),

      // GST and compliance
      this.prisma.gSTTransactionDetail.deleteMany(),
      this.prisma.invoiceLineItem.deleteMany(),
      this.prisma.invoice.deleteMany(),

      // User data
      this.prisma.auditLog.deleteMany(),
      this.prisma.session.deleteMany(),
      this.prisma.account.deleteMany(),
      this.prisma.user.deleteMany(),

      // System data
      this.prisma.systemConfig.deleteMany(),
    ];

    // Execute all delete operations
    await this.prisma.$transaction(deleteOperations);
  }

  /**
   * Seed database with test data
   */
  async seedDatabase(): Promise<{
    users: any[];
    accounts: any[];
    transactions: any[];
    goals: any[];
    receipts: any[];
  }> {
    // Create test users
    const users = await Promise.all([
      this.createUser(mockData.users.regular),
      this.createUser(mockData.users.admin),
      this.createUser(mockData.users.business),
    ]);

    // Create bank accounts
    const accounts = await Promise.all([
      this.createBankAccount(users[0].id, mockData.bankAccounts.checking),
      this.createBankAccount(users[0].id, mockData.bankAccounts.savings),
      this.createBankAccount(users[2].id, mockData.bankAccounts.business),
    ]);

    // Create transactions
    const transactions = [];
    for (const account of accounts) {
      const accountTransactions = await this.createTransactions(
        account.userId,
        account.id,
        10, // 10 transactions per account
      );
      transactions.push(...accountTransactions);
    }

    // Create goals
    const goals = await Promise.all([
      this.createGoal(users[0].id, mockData.goals.vacation),
      this.createGoal(users[0].id, mockData.goals.emergency),
      this.createGoal(users[2].id, mockData.goals.business),
    ]);

    // Create receipts
    const receipts = await Promise.all([
      this.createReceipt(users[0].id, mockData.receipts.grocery),
      this.createReceipt(users[2].id, mockData.receipts.business),
    ]);

    return {
      users,
      accounts,
      transactions,
      goals,
      receipts,
    };
  }

  /**
   * Create a test user
   */
  async createUser(userData: any): Promise<any> {
    return this.prisma.user.create({
      data: {
        ...userData,
        password: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', // 'password123'
        emailVerified: new Date(),
      },
    });
  }

  /**
   * Create a bank account
   */
  async createBankAccount(userId: string, accountData: any): Promise<any> {
    return this.prisma.bankAccount.create({
      data: {
        ...accountData,
        userId,
      },
    });
  }

  /**
   * Create transactions for an account
   */
  async createTransactions(userId: string, bankAccountId: string, count: number): Promise<any[]> {
    const transactions = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(Math.random() * 90); // Random date within last 90 days
      const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      const isIncome = Math.random() > 0.7; // 30% income, 70% expenses
      const amount = isIncome
        ? Math.floor(Math.random() * 5000) + 1000 // Income: $1000-$6000
        : -(Math.floor(Math.random() * 500) + 10); // Expense: $10-$510

      const transaction = await this.prisma.transaction.create({
        data: {
          userId,
          bankAccountId,
          amount,
          description: isIncome
            ? mockData.transactions.incomeDescriptions[
                i % mockData.transactions.incomeDescriptions.length
              ]
            : mockData.transactions.expenseDescriptions[
                i % mockData.transactions.expenseDescriptions.length
              ],
          date,
          type: isIncome ? 'INCOME' : 'EXPENSE',
          category: isIncome
            ? mockData.transactions.incomeCategories[
                i % mockData.transactions.incomeCategories.length
              ]
            : mockData.transactions.expenseCategories[
                i % mockData.transactions.expenseCategories.length
              ],
          isBusinessExpense: Math.random() > 0.8,
          gstAmount: Math.random() > 0.5 ? Math.abs(amount) * 0.1 : null,
          taxCategory: Math.random() > 0.7 ? 'D5' : null,
        },
      });
      transactions.push(transaction);
    }

    return transactions;
  }

  /**
   * Create a goal
   */
  async createGoal(userId: string, goalData: any): Promise<any> {
    return this.prisma.goal.create({
      data: {
        ...goalData,
        userId,
        deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months from now
      },
    });
  }

  /**
   * Create a receipt
   */
  async createReceipt(userId: string, receiptData: any): Promise<any> {
    return this.prisma.receipt.create({
      data: {
        ...receiptData,
        userId,
        date: new Date(),
        fileUrl: '/test/receipt.jpg',
        fileHash: 'test-hash-' + Date.now(),
      },
    });
  }

  /**
   * Create an audit log entry
   */
  async createAuditLog(data: {
    userId: string;
    event: string;
    success?: boolean;
    metadata?: any;
  }): Promise<any> {
    return this.prisma.auditLog.create({
      data: {
        event: data.event,
        userId: data.userId,
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Test',
        success: data.success ?? true,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Get user with all relations
   */
  async getUserWithRelations(userId: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        bankAccounts: true,
        transactions: true,
        goals: true,
        receipts: true,
        _count: {
          select: {
            transactions: true,
            goals: true,
            receipts: true,
            bankAccounts: true,
          },
        },
      },
    });
  }
}

// Export singleton instance
export const db = new DatabaseHelper((global as any).prisma);
