#!/usr/bin/env tsx
/**
 * Database Cleanup Utilities
 *
 * Safe cleanup operations for maintaining database health
 */

import { PrismaClient } from '@prisma/client';
import { Migration, MigrationContext } from '../migrate-data';
import { subDays, subMonths } from 'date-fns';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

/**
 * Migration: Clean up old audit logs
 */
export class CleanupAuditLogsMigration extends Migration {
  name = 'cleanup-audit-logs';
  description = 'Archive and remove old audit logs (>90 days)';
  version = '1.0.0';

  private retentionDays = 90;
  private archivePath = join(process.cwd(), 'backups', 'audit-logs');

  async validate(): Promise<boolean> {
    const oldLogs = await prisma.auditLog.count({
      where: {
        createdAt: {
          lt: subDays(new Date(), this.retentionDays),
        },
      },
    });

    this.context.logger.log(
      'info',
      `Found ${oldLogs} audit logs older than ${this.retentionDays} days`,
    );
    return oldLogs > 0;
  }

  async estimateAffectedRecords(): Promise<number> {
    return prisma.auditLog.count({
      where: {
        createdAt: {
          lt: subDays(new Date(), this.retentionDays),
        },
      },
    });
  }

  async up(): Promise<void> {
    const cutoffDate = subDays(new Date(), this.retentionDays);

    // Archive logs before deletion
    const logsToArchive = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (logsToArchive.length > 0) {
      // Create archive file
      const archiveFile = join(
        this.archivePath,
        `audit-logs-${cutoffDate.toISOString().split('T')[0]}.json`,
      );

      writeFileSync(archiveFile, JSON.stringify(logsToArchive, null, 2));
      this.context.logger.log('info', `Archived ${logsToArchive.length} logs to ${archiveFile}`);

      // Delete archived logs
      if (!this.context.dryRun) {
        const deleted = await prisma.auditLog.deleteMany({
          where: {
            id: {
              in: logsToArchive.map((log) => log.id),
            },
          },
        });

        this.context.logger.log('success', `Deleted ${deleted.count} old audit logs`);
      }
    }
  }

  async down(): Promise<void> {
    this.context.logger.log('warn', 'Audit log cleanup cannot be rolled back');
    this.context.logger.log('info', 'Restore from archive files if needed');
  }
}

/**
 * Migration: Clean up orphaned records
 */
export class CleanupOrphanedDataMigration extends Migration {
  name = 'cleanup-orphaned-data';
  description = 'Remove orphaned records with no parent relationships';
  version = '1.0.0';

  private orphanedCounts = {
    transactions: 0,
    goals: 0,
    receipts: 0,
    bankAccounts: 0,
  };

  async validate(): Promise<boolean> {
    // Check for orphaned transactions
    this.orphanedCounts.transactions = await prisma.transaction.count({
      where: {
        OR: [
          {
            userId: { not: null },
            user: null,
          },
          {
            bankAccountId: { not: null },
            bankAccount: null,
          },
        ],
      },
    });

    // Check for orphaned goals
    this.orphanedCounts.goals = await prisma.goal.count({
      where: {
        userId: { not: null },
        user: null,
      },
    });

    // Check for orphaned receipts
    this.orphanedCounts.receipts = await prisma.receipt.count({
      where: {
        userId: { not: null },
        user: null,
      },
    });

    // Check for orphaned bank accounts
    this.orphanedCounts.bankAccounts = await prisma.bankAccount.count({
      where: {
        userId: { not: null },
        user: null,
      },
    });

    const totalOrphaned = Object.values(this.orphanedCounts).reduce((a, b) => a + b, 0);
    this.context.logger.log(
      'info',
      `Found ${totalOrphaned} total orphaned records`,
      this.orphanedCounts,
    );

    return totalOrphaned > 0;
  }

  async estimateAffectedRecords(): Promise<number> {
    return Object.values(this.orphanedCounts).reduce((a, b) => a + b, 0);
  }

  async up(): Promise<void> {
    const deletedIds = {
      transactions: [] as string[],
      goals: [] as string[],
      receipts: [] as string[],
      bankAccounts: [] as string[],
    };

    // Clean orphaned transactions
    if (this.orphanedCounts.transactions > 0) {
      const orphaned = await prisma.transaction.findMany({
        where: {
          OR: [
            {
              userId: { not: null },
              user: null,
            },
            {
              bankAccountId: { not: null },
              bankAccount: null,
            },
          ],
        },
        select: { id: true },
      });

      deletedIds.transactions = orphaned.map((t) => t.id);

      if (!this.context.dryRun) {
        await prisma.transaction.deleteMany({
          where: { id: { in: deletedIds.transactions } },
        });
      }

      this.context.logger.log(
        'info',
        `Cleaned ${deletedIds.transactions.length} orphaned transactions`,
      );
    }

    // Clean orphaned goals
    if (this.orphanedCounts.goals > 0) {
      const orphaned = await prisma.goal.findMany({
        where: {
          userId: { not: null },
          user: null,
        },
        select: { id: true },
      });

      deletedIds.goals = orphaned.map((g) => g.id);

      if (!this.context.dryRun) {
        await prisma.goal.deleteMany({
          where: { id: { in: deletedIds.goals } },
        });
      }

      this.context.logger.log('info', `Cleaned ${deletedIds.goals.length} orphaned goals`);
    }

    // Clean orphaned receipts
    if (this.orphanedCounts.receipts > 0) {
      const orphaned = await prisma.receipt.findMany({
        where: {
          userId: { not: null },
          user: null,
        },
        select: { id: true },
      });

      deletedIds.receipts = orphaned.map((r) => r.id);

      if (!this.context.dryRun) {
        await prisma.receipt.deleteMany({
          where: { id: { in: deletedIds.receipts } },
        });
      }

      this.context.logger.log('info', `Cleaned ${deletedIds.receipts.length} orphaned receipts`);
    }

    // Store deleted IDs for potential recovery
    this.context.tracker.storeRollbackData(this.name, deletedIds);
  }

  async down(): Promise<void> {
    this.context.logger.log('warn', 'Orphaned data cleanup cannot be rolled back');
    this.context.logger.log('info', 'Restore from backup if recovery is needed');
  }
}

/**
 * Migration: Clean up expired sessions
 */
export class CleanupExpiredSessionsMigration extends Migration {
  name = 'cleanup-expired-sessions';
  description = 'Remove expired user sessions';
  version = '1.0.0';

  async validate(): Promise<boolean> {
    const expiredSessions = await prisma.session.count({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });

    this.context.logger.log('info', `Found ${expiredSessions} expired sessions`);
    return expiredSessions > 0;
  }

  async estimateAffectedRecords(): Promise<number> {
    return prisma.session.count({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });
  }

  async up(): Promise<void> {
    if (!this.context.dryRun) {
      const deleted = await prisma.session.deleteMany({
        where: {
          expires: {
            lt: new Date(),
          },
        },
      });

      this.context.logger.log('success', `Deleted ${deleted.count} expired sessions`);
    }
  }

  async down(): Promise<void> {
    this.context.logger.log('info', 'Session cleanup is not reversible');
  }
}

/**
 * Migration: Clean up failed payment attempts
 */
export class CleanupFailedPaymentsMigration extends Migration {
  name = 'cleanup-failed-payments';
  description = 'Archive old failed payment records (>6 months)';
  version = '1.0.0';

  private retentionMonths = 6;

  async validate(): Promise<boolean> {
    const oldFailedPayments = await prisma.payment.count({
      where: {
        status: 'failed',
        createdAt: {
          lt: subMonths(new Date(), this.retentionMonths),
        },
      },
    });

    this.context.logger.log(
      'info',
      `Found ${oldFailedPayments} failed payments older than ${this.retentionMonths} months`,
    );
    return oldFailedPayments > 0;
  }

  async estimateAffectedRecords(): Promise<number> {
    return prisma.payment.count({
      where: {
        status: 'failed',
        createdAt: {
          lt: subMonths(new Date(), this.retentionMonths),
        },
      },
    });
  }

  async up(): Promise<void> {
    const cutoffDate = subMonths(new Date(), this.retentionMonths);

    // Archive before deletion
    const paymentsToArchive = await prisma.payment.findMany({
      where: {
        status: 'failed',
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    if (paymentsToArchive.length > 0) {
      const archiveFile = join(
        process.cwd(),
        'backups',
        'payments',
        `failed-payments-${cutoffDate.toISOString().split('T')[0]}.json`,
      );

      writeFileSync(archiveFile, JSON.stringify(paymentsToArchive, null, 2));
      this.context.logger.log('info', `Archived ${paymentsToArchive.length} failed payments`);

      if (!this.context.dryRun) {
        const deleted = await prisma.payment.deleteMany({
          where: {
            id: {
              in: paymentsToArchive.map((p) => p.id),
            },
          },
        });

        this.context.logger.log('success', `Deleted ${deleted.count} old failed payments`);
      }
    }
  }

  async down(): Promise<void> {
    this.context.logger.log('warn', 'Payment cleanup cannot be rolled back');
    this.context.logger.log('info', 'Restore from archive files if needed');
  }
}

/**
 * Migration: Optimize database performance
 */
export class OptimizeDatabaseMigration extends Migration {
  name = 'optimize-database';
  description = 'Run database optimization queries (VACUUM, ANALYZE)';
  version = '1.0.0';

  async validate(): Promise<boolean> {
    // Always valid - performance optimization
    return true;
  }

  async estimateAffectedRecords(): Promise<number> {
    // Get total record count across main tables
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.transaction.count(),
      prisma.goal.count(),
      prisma.bankAccount.count(),
    ]);

    return counts.reduce((a, b) => a + b, 0);
  }

  async up(): Promise<void> {
    if (!this.context.dryRun) {
      this.context.logger.log('info', 'Running database optimization...');

      // VACUUM ANALYZE on main tables
      const tables = ['users', 'transactions', 'goals', 'bank_accounts', 'audit_logs', 'receipts'];

      for (const table of tables) {
        try {
          await prisma.$executeRawUnsafe(`VACUUM ANALYZE ${table}`);
          this.context.logger.log('info', `Optimized table: ${table}`);
        } catch (error) {
          this.context.logger.log('warn', `Could not optimize ${table}: ${error}`);
        }
      }

      // Update statistics
      await prisma.$executeRaw`ANALYZE`;

      this.context.logger.log('success', 'Database optimization completed');
    }
  }

  async down(): Promise<void> {
    // Optimization cannot be rolled back
    this.context.logger.log('info', 'Database optimization cannot be rolled back');
  }
}

/**
 * Migration: Clean up soft-deleted records
 */
export class CleanupSoftDeletedMigration extends Migration {
  name = 'cleanup-soft-deleted';
  description = 'Permanently remove soft-deleted records older than 30 days';
  version = '1.0.0';

  private retentionDays = 30;
  private deleteCounts = {
    users: 0,
    goals: 0,
    bankAccounts: 0,
  };

  async validate(): Promise<boolean> {
    const cutoffDate = subDays(new Date(), this.retentionDays);

    // Count soft-deleted records
    this.deleteCounts.users = await prisma.user.count({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    });

    this.deleteCounts.goals = await prisma.goal.count({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    });

    this.deleteCounts.bankAccounts = await prisma.bankAccount.count({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    });

    const totalDeleted = Object.values(this.deleteCounts).reduce((a, b) => a + b, 0);
    this.context.logger.log(
      'info',
      `Found ${totalDeleted} soft-deleted records ready for cleanup`,
      this.deleteCounts,
    );

    return totalDeleted > 0;
  }

  async estimateAffectedRecords(): Promise<number> {
    return Object.values(this.deleteCounts).reduce((a, b) => a + b, 0);
  }

  async up(): Promise<void> {
    const cutoffDate = subDays(new Date(), this.retentionDays);

    // Archive before permanent deletion
    const archive: any = {
      users: [],
      goals: [],
      bankAccounts: [],
    };

    // Archive and delete users
    if (this.deleteCounts.users > 0) {
      archive.users = await prisma.user.findMany({
        where: {
          deletedAt: {
            not: null,
            lt: cutoffDate,
          },
        },
      });

      if (!this.context.dryRun) {
        await prisma.user.deleteMany({
          where: {
            id: {
              in: archive.users.map((u: any) => u.id),
            },
          },
        });
      }

      this.context.logger.log('info', `Permanently deleted ${archive.users.length} users`);
    }

    // Archive and delete goals
    if (this.deleteCounts.goals > 0) {
      archive.goals = await prisma.goal.findMany({
        where: {
          deletedAt: {
            not: null,
            lt: cutoffDate,
          },
        },
      });

      if (!this.context.dryRun) {
        await prisma.goal.deleteMany({
          where: {
            id: {
              in: archive.goals.map((g: any) => g.id),
            },
          },
        });
      }

      this.context.logger.log('info', `Permanently deleted ${archive.goals.length} goals`);
    }

    // Save archive
    const archiveFile = join(
      process.cwd(),
      'backups',
      'soft-deleted',
      `soft-deleted-${new Date().toISOString().split('T')[0]}.json`,
    );

    writeFileSync(archiveFile, JSON.stringify(archive, null, 2));
    this.context.logger.log('info', `Archived deleted records to ${archiveFile}`);
  }

  async down(): Promise<void> {
    this.context.logger.log('warn', 'Permanent deletion cannot be rolled back');
    this.context.logger.log('info', 'Restore from archive files if recovery is needed');
  }
}

// Export all cleanup migrations
export const CLEANUP_MIGRATIONS = {
  'cleanup-audit-logs': CleanupAuditLogsMigration,
  'cleanup-orphaned': CleanupOrphanedDataMigration,
  'cleanup-sessions': CleanupExpiredSessionsMigration,
  'cleanup-payments': CleanupFailedPaymentsMigration,
  'cleanup-soft-deleted': CleanupSoftDeletedMigration,
  'optimize-database': OptimizeDatabaseMigration,
};

// CLI if run directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--list') {
    console.log(chalk.bold('\nAvailable Cleanup Migrations:\n'));
    Object.entries(CLEANUP_MIGRATIONS).forEach(([key, MigrationClass]) => {
      const temp = new MigrationClass({} as any);
      console.log(chalk.cyan(`  ${key}`) + ` - ${temp.description}`);
    });
    console.log('\n');
    process.exit(0);
  }
}
