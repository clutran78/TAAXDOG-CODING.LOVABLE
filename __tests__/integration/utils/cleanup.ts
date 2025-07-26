import { getTestPrisma } from '../setup/test-database';

export class TestCleanup {
  private static prisma = getTestPrisma();

  /**
   * Clean all test data for a specific user
   */
  static async cleanUserData(userId: string): Promise<void> {
    await this.prisma.$transaction([
      // Clean in correct order to respect foreign key constraints
      this.prisma.auditLog.deleteMany({ where: { userId } }),
      this.prisma.payment.deleteMany({ where: { userId } }),
      this.prisma.goalProgress.deleteMany({ where: { goal: { userId } } }),
      this.prisma.subaccount.deleteMany({ where: { userId } }),
      this.prisma.transaction.deleteMany({ where: { userId } }),
      this.prisma.receipt.deleteMany({ where: { userId } }),
      this.prisma.budget.deleteMany({ where: { userId } }),
      this.prisma.goal.deleteMany({ where: { userId } }),
      this.prisma.bankAccount.deleteMany({ where: { userId } }),
      this.prisma.subscription.deleteMany({ where: { userId } }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
      this.prisma.verificationToken.deleteMany({ where: { identifier: userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }

  /**
   * Clean test data by email pattern
   */
  static async cleanByEmailPattern(pattern: string): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { email: { contains: pattern } },
    });

    for (const user of users) {
      await this.cleanUserData(user.id);
    }
  }

  /**
   * Clean old test data
   */
  static async cleanOldTestData(daysOld = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Find old test users
    const oldTestUsers = await this.prisma.user.findMany({
      where: {
        AND: [{ email: { contains: 'test' } }, { createdAt: { lt: cutoffDate } }],
      },
    });

    for (const user of oldTestUsers) {
      await this.cleanUserData(user.id);
    }
  }

  /**
   * Reset sequences (PostgreSQL specific)
   */
  static async resetSequences(): Promise<void> {
    const tables = [
      'users',
      'transactions',
      'goals',
      'receipts',
      'budgets',
      'bank_accounts',
      'subscriptions',
    ];

    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1`);
      } catch (error) {
        // Sequence might not exist for UUID primary keys
      }
    }
  }

  /**
   * Clean specific test artifacts
   */
  static async cleanTestArtifacts(): Promise<void> {
    // Clean test receipts from S3 (mock in tests)
    const testReceipts = await this.prisma.receipt.findMany({
      where: { fileName: { contains: 'test-' } },
    });

    for (const receipt of testReceipts) {
      // In production, this would delete from S3
      // In tests, we just remove the database record
      await this.prisma.receipt.delete({ where: { id: receipt.id } });
    }

    // Clean test audit logs older than 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await this.prisma.auditLog.deleteMany({
      where: {
        AND: [{ metadata: { path: ['test'], equals: true } }, { createdAt: { lt: yesterday } }],
      },
    });
  }

  /**
   * Verify cleanup was successful
   */
  static async verifyCleanup(userId: string): Promise<boolean> {
    const counts = await this.prisma.$transaction([
      this.prisma.user.count({ where: { id: userId } }),
      this.prisma.transaction.count({ where: { userId } }),
      this.prisma.goal.count({ where: { userId } }),
      this.prisma.receipt.count({ where: { userId } }),
      this.prisma.budget.count({ where: { userId } }),
    ]);

    return counts.every((count) => count === 0);
  }

  /**
   * Get cleanup statistics
   */
  static async getCleanupStats(): Promise<{
    totalUsers: number;
    testUsers: number;
    totalTransactions: number;
    totalReceipts: number;
    oldTestData: number;
  }> {
    const [totalUsers, testUsers, totalTransactions, totalReceipts, oldTestData] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { email: { contains: 'test' } } }),
        this.prisma.transaction.count(),
        this.prisma.receipt.count(),
        this.prisma.user.count({
          where: {
            AND: [
              { email: { contains: 'test' } },
              { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            ],
          },
        }),
      ]);

    return {
      totalUsers,
      testUsers,
      totalTransactions,
      totalReceipts,
      oldTestData,
    };
  }
}

// Export convenience functions
export const cleanUserData = (userId: string) => TestCleanup.cleanUserData(userId);
export const cleanByEmailPattern = (pattern: string) => TestCleanup.cleanByEmailPattern(pattern);
export const cleanOldTestData = (daysOld?: number) => TestCleanup.cleanOldTestData(daysOld);
export const cleanTestArtifacts = () => TestCleanup.cleanTestArtifacts();
export const verifyCleanup = (userId: string) => TestCleanup.verifyCleanup(userId);
export const getCleanupStats = () => TestCleanup.getCleanupStats();
