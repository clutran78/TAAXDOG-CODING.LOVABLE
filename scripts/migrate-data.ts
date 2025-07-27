#!/usr/bin/env tsx
/**
 * Comprehensive Database Migration Utility
 *
 * Features:
 * - Safe production migrations with rollback support
 * - Data validation before and after migration
 * - Dry-run capability
 * - Progress tracking and logging
 * - Automatic backups before migration
 *
 * Usage:
 * npm run migrate:data -- --type=<migration-type> [--dry-run] [--skip-backup]
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';
import chalk from 'chalk';
import { program } from 'commander';
import ora from 'ora';
import prompts from 'prompts';

// Import utilities
import { validateDatabaseIntegrity } from './utils/data-validator';
import { createBackup } from './utils/backup-manager';
import { MigrationTracker } from './utils/migration-tracker';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Migration configuration
const MIGRATION_DIR = join(process.cwd(), 'migrations', 'data');
const BACKUP_DIR = join(process.cwd(), 'backups');
const LOG_DIR = join(process.cwd(), 'logs', 'migrations');

// Ensure directories exist
[MIGRATION_DIR, BACKUP_DIR, LOG_DIR].forEach((dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

interface MigrationContext {
  dryRun: boolean;
  skipBackup: boolean;
  force: boolean;
  batchSize: number;
  logger: MigrationLogger;
  tracker: MigrationTracker;
}

class MigrationLogger {
  private logFile: string;
  private startTime: number;

  constructor(migrationName: string) {
    this.startTime = Date.now();
    this.logFile = join(LOG_DIR, `${migrationName}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.log`);
    this.log('info', `Migration started: ${migrationName}`);
  }

  log(level: 'info' | 'warn' | 'error' | 'success', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      elapsed: Date.now() - this.startTime,
    };

    // Console output with colors
    const colorMap = {
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
      success: chalk.green,
    };

    console.log(colorMap[level](`[${level.toUpperCase()}] ${message}`));
    if (data) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }

    // File output
    const logLine = JSON.stringify(logEntry) + '\n';
    writeFileSync(this.logFile, logLine, { flag: 'a' });
  }

  getLogFile() {
    return this.logFile;
  }
}

/**
 * Base Migration class that all migrations should extend
 */
abstract class Migration {
  abstract name: string;
  abstract description: string;
  abstract version: string;

  constructor(protected context: MigrationContext) {}

  /**
   * Validate that migration can be safely run
   */
  abstract validate(): Promise<boolean>;

  /**
   * Run the migration
   */
  abstract up(): Promise<void>;

  /**
   * Rollback the migration
   */
  abstract down(): Promise<void>;

  /**
   * Get estimated affected records
   */
  abstract estimateAffectedRecords(): Promise<number>;

  /**
   * Run migration with safety checks
   */
  async run(): Promise<void> {
    const spinner = ora();

    try {
      // Check if migration was already run
      const wasRun = await this.context.tracker.wasMigrationRun(this.name, this.version);
      if (wasRun && !this.context.force) {
        this.context.logger.log('warn', 'Migration was already run. Use --force to re-run.');
        return;
      }

      // Validate migration can run
      spinner.start('Validating migration prerequisites...');
      const isValid = await this.validate();
      spinner.stop();

      if (!isValid) {
        throw new Error('Migration validation failed');
      }

      // Estimate affected records
      const affectedRecords = await this.estimateAffectedRecords();
      this.context.logger.log('info', `Estimated affected records: ${affectedRecords}`);

      // Confirm if not dry-run
      if (!this.context.dryRun && affectedRecords > 0) {
        const { confirm } = await prompts({
          type: 'confirm',
          name: 'confirm',
          message: `This will affect ${affectedRecords} records. Continue?`,
          initial: false,
        });

        if (!confirm) {
          this.context.logger.log('info', 'Migration cancelled by user');
          return;
        }
      }

      // Create backup if not skipped
      if (!this.context.skipBackup && !this.context.dryRun) {
        spinner.start('Creating backup...');
        const backupFile = await this.createBackup();
        spinner.succeed(`Backup created: ${backupFile}`);
      }

      // Run migration
      if (this.context.dryRun) {
        this.context.logger.log('info', 'DRY RUN: No changes will be made');
      }

      spinner.start('Running migration...');

      // Start migration tracking
      const migrationId = await this.context.tracker.startMigration(
        this.name,
        this.version,
        affectedRecords,
      );

      try {
        await this.up();

        // Mark migration as complete
        await this.context.tracker.completeMigration(migrationId);

        spinner.succeed('Migration completed successfully');
        this.context.logger.log('success', 'Migration completed', {
          migrationId,
          affectedRecords,
        });
      } catch (error) {
        spinner.fail('Migration failed');

        // Mark migration as failed
        await this.context.tracker.failMigration(
          migrationId,
          error instanceof Error ? error.message : 'Unknown error',
        );

        // Attempt rollback
        if (!this.context.dryRun) {
          spinner.start('Attempting rollback...');
          try {
            await this.down();
            spinner.succeed('Rollback completed');
            this.context.logger.log('info', 'Rollback successful');
          } catch (rollbackError) {
            spinner.fail('Rollback failed');
            this.context.logger.log('error', 'Rollback failed', {
              error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
            });
          }
        }

        throw error;
      }

      // Validate data integrity after migration
      if (!this.context.dryRun) {
        spinner.start('Validating data integrity...');
        const isIntegrityValid = await validateDatabaseIntegrity();
        spinner.stop();

        if (!isIntegrityValid) {
          this.context.logger.log('warn', 'Data integrity validation failed');
        } else {
          this.context.logger.log('success', 'Data integrity validated');
        }
      }
    } catch (error) {
      this.context.logger.log('error', 'Migration failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Create a backup before migration
   */
  protected async createBackup(): Promise<string> {
    const backupName = `${this.name}-${this.version}-${Date.now()}`;
    return createBackup(backupName);
  }

  /**
   * Helper to process records in batches
   */
  protected async processBatch<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    progressMessage?: string,
  ): Promise<void> {
    const total = items.length;
    let processed = 0;

    for (let i = 0; i < items.length; i += this.context.batchSize) {
      const batch = items.slice(i, i + this.context.batchSize);

      await Promise.all(batch.map((item) => processor(item)));

      processed += batch.length;

      if (progressMessage) {
        this.context.logger.log('info', progressMessage, {
          processed,
          total,
          percentage: Math.round((processed / total) * 100),
        });
      }
    }
  }
}

/**
 * Example Migration: Encrypt sensitive user data
 */
class EncryptUserDataMigration extends Migration {
  name = 'encrypt-user-data';
  description = 'Encrypt sensitive user data fields (TFN, mobile numbers)';
  version = '1.0.0';

  async validate(): Promise<boolean> {
    // Check if encryption key is available
    if (!process.env.FIELD_ENCRYPTION_KEY) {
      this.context.logger.log('error', 'FIELD_ENCRYPTION_KEY not found in environment');
      return false;
    }

    // Check if there are unencrypted records
    const unencryptedCount = await prisma.user.count({
      where: {
        OR: [
          { tfn: { not: null, notcontains: 'encrypted:' } },
          { mobile: { not: null, notcontains: 'encrypted:' } },
        ],
      },
    });

    this.context.logger.log('info', `Found ${unencryptedCount} users with unencrypted data`);
    return unencryptedCount > 0;
  }

  async estimateAffectedRecords(): Promise<number> {
    return prisma.user.count({
      where: {
        OR: [
          { tfn: { not: null, notcontains: 'encrypted:' } },
          { mobile: { not: null, notcontains: 'encrypted:' } },
        ],
      },
    });
  }

  async up(): Promise<void> {
    const crypto = await import('../lib/utils/crypto');

    // Get users with unencrypted data
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { tfn: { not: null, notcontains: 'encrypted:' } },
          { mobile: { not: null, notcontains: 'encrypted:' } },
        ],
      },
      select: {
        id: true,
        tfn: true,
        mobile: true,
      },
    });

    // Process in batches
    await this.processBatch(
      users,
      async (user) => {
        const updates: any = {};

        if (user.tfn && !user.tfn.startsWith('encrypted:')) {
          updates.tfn = await crypto.encrypt(user.tfn);
        }

        if (user.mobile && !user.mobile.startsWith('encrypted:')) {
          updates.mobile = await crypto.encrypt(user.mobile);
        }

        if (Object.keys(updates).length > 0 && !this.context.dryRun) {
          await prisma.user.update({
            where: { id: user.id },
            data: updates,
          });
        }
      },
      'Encrypting user data',
    );
  }

  async down(): Promise<void> {
    const crypto = await import('../lib/utils/crypto');

    // Get users with encrypted data
    const users = await prisma.user.findMany({
      where: {
        OR: [{ tfn: { startsWith: 'encrypted:' } }, { mobile: { startsWith: 'encrypted:' } }],
      },
      select: {
        id: true,
        tfn: true,
        mobile: true,
      },
    });

    // Process in batches
    await this.processBatch(
      users,
      async (user) => {
        const updates: any = {};

        if (user.tfn?.startsWith('encrypted:')) {
          updates.tfn = await crypto.decrypt(user.tfn);
        }

        if (user.mobile?.startsWith('encrypted:')) {
          updates.mobile = await crypto.decrypt(user.mobile);
        }

        if (Object.keys(updates).length > 0 && !this.context.dryRun) {
          await prisma.user.update({
            where: { id: user.id },
            data: updates,
          });
        }
      },
      'Decrypting user data (rollback)',
    );
  }
}

/**
 * Example Migration: Clean up orphaned records
 */
class CleanupOrphanedRecordsMigration extends Migration {
  name = 'cleanup-orphaned-records';
  description = 'Remove orphaned records from the database';
  version = '1.0.0';

  async validate(): Promise<boolean> {
    return true; // Always valid
  }

  async estimateAffectedRecords(): Promise<number> {
    const counts = await Promise.all([
      // Transactions without bank accounts
      prisma.transaction.count({
        where: {
          bankAccount: null,
        },
      }),
      // Goals without users
      prisma.goal.count({
        where: {
          user: null,
        },
      }),
      // Old audit logs
      prisma.auditLog.count({
        where: {
          createdAt: {
            lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
          },
        },
      }),
    ]);

    return counts.reduce((sum, count) => sum + count, 0);
  }

  async up(): Promise<void> {
    // Store deleted record IDs for rollback
    const deletedRecords = {
      transactions: [] as string[],
      goals: [] as string[],
      auditLogs: [] as string[],
    };

    // Delete orphaned transactions
    if (!this.context.dryRun) {
      const orphanedTransactions = await prisma.transaction.findMany({
        where: { bankAccount: null },
        select: { id: true },
      });

      deletedRecords.transactions = orphanedTransactions.map((t) => t.id);

      await prisma.transaction.deleteMany({
        where: { id: { in: deletedRecords.transactions } },
      });
    }

    // Delete orphaned goals
    if (!this.context.dryRun) {
      const orphanedGoals = await prisma.goal.findMany({
        where: { user: null },
        select: { id: true },
      });

      deletedRecords.goals = orphanedGoals.map((g) => g.id);

      await prisma.goal.deleteMany({
        where: { id: { in: deletedRecords.goals } },
      });
    }

    // Archive old audit logs
    if (!this.context.dryRun) {
      const oldLogs = await prisma.auditLog.findMany({
        where: {
          createdAt: {
            lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      });

      // Save to archive file
      const archiveFile = join(BACKUP_DIR, `audit-logs-archive-${Date.now()}.json`);
      writeFileSync(archiveFile, JSON.stringify(oldLogs, null, 2));

      deletedRecords.auditLogs = oldLogs.map((l) => l.id);

      await prisma.auditLog.deleteMany({
        where: { id: { in: deletedRecords.auditLogs } },
      });
    }

    // Store deleted records for potential rollback
    this.context.tracker.storeRollbackData(this.name, deletedRecords);
  }

  async down(): Promise<void> {
    // Rollback is not possible for deleted records without backup
    this.context.logger.log('warn', 'Rollback not available for cleanup migration');
    this.context.logger.log('info', 'Restore from backup if needed');
  }
}

// Migration registry
const AVAILABLE_MIGRATIONS: Record<string, typeof Migration> = {
  'encrypt-user-data': EncryptUserDataMigration,
  'cleanup-orphaned': CleanupOrphanedRecordsMigration,
};

// CLI setup
program
  .name('migrate-data')
  .description('Run data migrations safely')
  .version('1.0.0')
  .requiredOption('-t, --type <type>', 'Migration type to run')
  .option('-d, --dry-run', 'Run migration in dry-run mode', false)
  .option('-s, --skip-backup', 'Skip backup creation', false)
  .option('-f, --force', 'Force re-run migration', false)
  .option('-b, --batch-size <size>', 'Batch size for processing', '100')
  .option('--list', 'List available migrations')
  .parse(process.argv);

const options = program.opts();

async function main() {
  // List migrations if requested
  if (options.list) {
    console.log(chalk.bold('\nAvailable Migrations:\n'));
    Object.entries(AVAILABLE_MIGRATIONS).forEach(([key, MigrationClass]) => {
      const temp = new MigrationClass({} as any);
      console.log(chalk.cyan(`  ${key}`) + ` - ${temp.description}`);
    });
    console.log('\n');
    process.exit(0);
  }

  // Validate migration type
  const MigrationClass = AVAILABLE_MIGRATIONS[options.type];
  if (!MigrationClass) {
    console.error(chalk.red(`Unknown migration type: ${options.type}`));
    console.log('\nAvailable migrations:', Object.keys(AVAILABLE_MIGRATIONS).join(', '));
    process.exit(1);
  }

  // Create migration context
  const context: MigrationContext = {
    dryRun: options.dryRun,
    skipBackup: options.skipBackup,
    force: options.force,
    batchSize: parseInt(options.batchSize, 10),
    logger: new MigrationLogger(options.type),
    tracker: new MigrationTracker(prisma),
  };

  // Show migration details
  console.log(chalk.bold('\nMigration Details:'));
  console.log(`  Type: ${chalk.cyan(options.type)}`);
  console.log(`  Mode: ${options.dryRun ? chalk.yellow('DRY RUN') : chalk.green('LIVE')}`);
  console.log(`  Backup: ${options.skipBackup ? chalk.yellow('SKIPPED') : chalk.green('ENABLED')}`);
  console.log(`  Batch Size: ${options.batchSize}`);
  console.log('');

  try {
    // Run migration
    const migration = new MigrationClass(context);
    await migration.run();

    console.log(chalk.green('\n✅ Migration completed successfully'));
    console.log(`Log file: ${context.logger.getLogFile()}`);
  } catch (error) {
    console.error(chalk.red('\n❌ Migration failed'));
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { Migration, MigrationContext, MigrationLogger };
