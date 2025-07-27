#!/usr/bin/env tsx
/**
 * Migration Runner
 *
 * Interactive tool to run database migrations with safety checks
 */

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import prompts from 'prompts';
import { Migration, MigrationContext, MigrationLogger } from './migrate-data';
import { MigrationTracker } from './utils/migration-tracker';
import { validateDatabaseIntegrity } from './utils/data-validator';
import { createBackup, listBackups } from './utils/backup-manager';
import { USER_MIGRATIONS } from './migrations/user-data-migrations';
import { CLEANUP_MIGRATIONS } from './migrations/database-cleanup';
import ora from 'ora';
import { table } from 'table';

const prisma = new PrismaClient();

// Combine all available migrations
const ALL_MIGRATIONS = {
  // Core migrations from migrate-data.ts
  'encrypt-user-data': 'core',
  'cleanup-orphaned': 'core',

  // User migrations
  ...Object.keys(USER_MIGRATIONS).reduce(
    (acc, key) => {
      acc[key] = 'user';
      return acc;
    },
    {} as Record<string, string>,
  ),

  // Cleanup migrations
  ...Object.keys(CLEANUP_MIGRATIONS).reduce(
    (acc, key) => {
      acc[key] = 'cleanup';
      return acc;
    },
    {} as Record<string, string>,
  ),
};

interface MigrationPlan {
  migrations: string[];
  mode: 'dry-run' | 'live';
  createBackup: boolean;
  validateBefore: boolean;
  validateAfter: boolean;
  batchSize: number;
}

/**
 * Main migration runner
 */
async function runMigrations() {
  console.clear();
  console.log(
    chalk.bold.cyan(`
╔══════════════════════════════════╗
║   TAAXDOG Migration Runner       ║
║   Safe Database Migrations       ║
╚══════════════════════════════════╝
  `),
  );

  // Show current database status
  await showDatabaseStatus();

  // Main menu
  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: 'Run Migrations', value: 'run' },
      { title: 'View Migration History', value: 'history' },
      { title: 'Validate Database Integrity', value: 'validate' },
      { title: 'Create Backup', value: 'backup' },
      { title: 'View Available Migrations', value: 'list' },
      { title: 'Exit', value: 'exit' },
    ],
  });

  switch (action) {
    case 'run':
      await runMigrationWizard();
      break;
    case 'history':
      await showMigrationHistory();
      break;
    case 'validate':
      await runValidation();
      break;
    case 'backup':
      await createManualBackup();
      break;
    case 'list':
      await listMigrations();
      break;
    case 'exit':
      console.log(chalk.gray('\nGoodbye! 👋\n'));
      process.exit(0);
  }

  // Return to menu
  const { again } = await prompts({
    type: 'confirm',
    name: 'again',
    message: 'Return to main menu?',
    initial: true,
  });

  if (again) {
    await runMigrations();
  }
}

/**
 * Show database status
 */
async function showDatabaseStatus() {
  const spinner = ora('Checking database status...').start();

  try {
    // Get counts
    const [userCount, transactionCount, goalCount] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.count(),
      prisma.goal.count(),
    ]);

    // Get migration tracker
    const tracker = new MigrationTracker(prisma);
    const recentMigrations = await tracker.getMigrationHistory(5);
    const failedCount = recentMigrations.filter((m) => m.status === 'failed').length;

    spinner.stop();

    console.log(chalk.bold('\n📊 Database Status:\n'));
    console.log(`  Users: ${chalk.cyan(userCount.toLocaleString())}`);
    console.log(`  Transactions: ${chalk.cyan(transactionCount.toLocaleString())}`);
    console.log(`  Goals: ${chalk.cyan(goalCount.toLocaleString())}`);
    console.log(`  Recent Migrations: ${chalk.cyan(recentMigrations.length)}`);

    if (failedCount > 0) {
      console.log(`  Failed Migrations: ${chalk.red(failedCount)} ⚠️`);
    }

    console.log('');
  } catch (error) {
    spinner.fail('Failed to get database status');
    console.error(error);
  }
}

/**
 * Migration wizard
 */
async function runMigrationWizard() {
  console.log(chalk.bold('\n🚀 Migration Wizard\n'));

  // Step 1: Select migrations
  const migrationChoices = Object.entries(ALL_MIGRATIONS).map(([key, category]) => ({
    title: `${key} (${category})`,
    value: key,
  }));

  const { selectedMigrations } = await prompts({
    type: 'multiselect',
    name: 'selectedMigrations',
    message: 'Select migrations to run:',
    choices: migrationChoices,
    hint: 'Space to select, Enter to confirm',
  });

  if (!selectedMigrations || selectedMigrations.length === 0) {
    console.log(chalk.yellow('\nNo migrations selected.'));
    return;
  }

  // Step 2: Configure options
  const config = await prompts([
    {
      type: 'select',
      name: 'mode',
      message: 'Run mode:',
      choices: [
        { title: 'Dry Run (preview changes)', value: 'dry-run' },
        { title: 'Live (apply changes)', value: 'live' },
      ],
      initial: 0,
    },
    {
      type: 'confirm',
      name: 'createBackup',
      message: 'Create backup before migration?',
      initial: true,
    },
    {
      type: 'confirm',
      name: 'validateBefore',
      message: 'Validate database integrity before migration?',
      initial: true,
    },
    {
      type: 'confirm',
      name: 'validateAfter',
      message: 'Validate database integrity after migration?',
      initial: true,
    },
    {
      type: 'number',
      name: 'batchSize',
      message: 'Batch size for processing:',
      initial: 100,
      min: 10,
      max: 1000,
    },
  ]);

  const plan: MigrationPlan = {
    migrations: selectedMigrations,
    ...config,
  };

  // Show migration plan
  console.log(chalk.bold('\n📋 Migration Plan:\n'));
  console.log(`  Migrations: ${chalk.cyan(plan.migrations.join(', '))}`);
  console.log(`  Mode: ${plan.mode === 'dry-run' ? chalk.yellow('DRY RUN') : chalk.green('LIVE')}`);
  console.log(`  Backup: ${plan.createBackup ? chalk.green('Yes') : chalk.yellow('No')}`);
  console.log(`  Pre-validation: ${plan.validateBefore ? chalk.green('Yes') : chalk.gray('No')}`);
  console.log(`  Post-validation: ${plan.validateAfter ? chalk.green('Yes') : chalk.gray('No')}`);
  console.log(`  Batch Size: ${chalk.cyan(plan.batchSize)}`);

  // Confirm
  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: 'Proceed with migration plan?',
    initial: false,
  });

  if (!confirm) {
    console.log(chalk.yellow('\nMigration cancelled.'));
    return;
  }

  // Execute migration plan
  await executeMigrationPlan(plan);
}

/**
 * Execute migration plan
 */
async function executeMigrationPlan(plan: MigrationPlan) {
  console.log(chalk.bold('\n🔄 Executing Migration Plan...\n'));

  const context: MigrationContext = {
    dryRun: plan.mode === 'dry-run',
    skipBackup: !plan.createBackup,
    force: false,
    batchSize: plan.batchSize,
    logger: new MigrationLogger('batch-migration'),
    tracker: new MigrationTracker(prisma),
  };

  // Pre-validation
  if (plan.validateBefore) {
    console.log(chalk.cyan('Running pre-migration validation...'));
    const isValid = await validateDatabaseIntegrity();
    if (!isValid && plan.mode === 'live') {
      const { proceed } = await prompts({
        type: 'confirm',
        name: 'proceed',
        message: 'Validation failed. Proceed anyway?',
        initial: false,
      });
      if (!proceed) return;
    }
  }

  // Create backup
  if (plan.createBackup && plan.mode === 'live') {
    const spinner = ora('Creating backup...').start();
    try {
      const backupPath = await createBackup('pre-migration', {
        compress: true,
      });
      spinner.succeed(`Backup created: ${backupPath}`);
    } catch (error) {
      spinner.fail('Backup failed');
      console.error(error);
      return;
    }
  }

  // Run migrations
  const results: Array<{ migration: string; status: 'success' | 'failed'; error?: string }> = [];

  for (const migrationName of plan.migrations) {
    console.log(chalk.bold(`\n▶️  Running migration: ${migrationName}\n`));

    try {
      // Import the appropriate migration
      let MigrationClass: typeof Migration | undefined;

      if (USER_MIGRATIONS[migrationName as keyof typeof USER_MIGRATIONS]) {
        MigrationClass = USER_MIGRATIONS[migrationName as keyof typeof USER_MIGRATIONS];
      } else if (CLEANUP_MIGRATIONS[migrationName as keyof typeof CLEANUP_MIGRATIONS]) {
        MigrationClass = CLEANUP_MIGRATIONS[migrationName as keyof typeof CLEANUP_MIGRATIONS];
      } else {
        // Load from core migrations
        const { default: coreModule } = await import('./migrate-data');
        // This would need to be exported from migrate-data.ts
        throw new Error(`Migration ${migrationName} not found`);
      }

      const migration = new MigrationClass(context);
      await migration.run();

      results.push({ migration: migrationName, status: 'success' });
    } catch (error) {
      results.push({
        migration: migrationName,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      console.error(chalk.red(`\n❌ Migration failed: ${migrationName}`));
      console.error(error);

      // Ask whether to continue
      if (plan.migrations.indexOf(migrationName) < plan.migrations.length - 1) {
        const { continueOnError } = await prompts({
          type: 'confirm',
          name: 'continueOnError',
          message: 'Continue with remaining migrations?',
          initial: false,
        });
        if (!continueOnError) break;
      }
    }
  }

  // Post-validation
  if (plan.validateAfter && plan.mode === 'live') {
    console.log(chalk.cyan('\nRunning post-migration validation...'));
    const isValid = await validateDatabaseIntegrity();
    if (!isValid) {
      console.log(chalk.yellow('⚠️  Post-migration validation found issues'));
    }
  }

  // Show results
  console.log(chalk.bold('\n📊 Migration Results:\n'));
  const tableData = [
    ['Migration', 'Status', 'Error'],
    ...results.map((r) => [
      r.migration,
      r.status === 'success' ? chalk.green('✓ Success') : chalk.red('✗ Failed'),
      r.error || '-',
    ]),
  ];
  console.log(table(tableData));

  // Generate report
  const tracker = new MigrationTracker(prisma);
  const report = await tracker.generateReport();
  console.log(report);
}

/**
 * Show migration history
 */
async function showMigrationHistory() {
  const tracker = new MigrationTracker(prisma);
  const history = await tracker.getMigrationHistory(20);

  if (history.length === 0) {
    console.log(chalk.yellow('\nNo migration history found.'));
    return;
  }

  console.log(chalk.bold('\n📜 Migration History:\n'));

  const tableData = [
    ['Migration', 'Version', 'Status', 'Date', 'Records'],
    ...history.map((m) => [
      m.name,
      m.version,
      m.status === 'completed'
        ? chalk.green('Completed')
        : m.status === 'failed'
          ? chalk.red('Failed')
          : m.status === 'running'
            ? chalk.yellow('Running')
            : chalk.gray('Unknown'),
      new Date(m.startedAt).toLocaleString(),
      m.affectedRecords.toLocaleString(),
    ]),
  ];

  console.log(table(tableData));
}

/**
 * Run validation
 */
async function runValidation() {
  console.log(chalk.bold('\n🔍 Running Database Validation...\n'));

  const spinner = ora('Validating database integrity...').start();

  try {
    const isValid = await validateDatabaseIntegrity();
    spinner.stop();

    if (isValid) {
      console.log(chalk.green('\n✅ Database validation passed!\n'));
    } else {
      console.log(chalk.red('\n❌ Database validation failed. See errors above.\n'));
    }
  } catch (error) {
    spinner.fail('Validation error');
    console.error(error);
  }
}

/**
 * Create manual backup
 */
async function createManualBackup() {
  console.log(chalk.bold('\n💾 Create Backup\n'));

  const config = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Backup name:',
      initial: 'manual-backup',
    },
    {
      type: 'confirm',
      name: 'compress',
      message: 'Compress backup?',
      initial: true,
    },
    {
      type: 'multiselect',
      name: 'tables',
      message: 'Select tables to backup (leave empty for all):',
      choices: [
        { title: 'users', value: 'users' },
        { title: 'transactions', value: 'transactions' },
        { title: 'goals', value: 'goals' },
        { title: 'bank_accounts', value: 'bank_accounts' },
        { title: 'receipts', value: 'receipts' },
        { title: 'audit_logs', value: 'audit_logs' },
      ],
      hint: 'Space to select, Enter to confirm',
    },
  ]);

  const spinner = ora('Creating backup...').start();

  try {
    const backupPath = await createBackup(config.name, {
      compress: config.compress,
      tables: config.tables.length > 0 ? config.tables : undefined,
    });

    spinner.succeed(`Backup created: ${backupPath}`);

    // Show recent backups
    const backups = await listBackups();
    console.log(chalk.bold('\n📦 Recent Backups:\n'));
    backups.slice(0, 5).forEach((b) => {
      console.log(`  • ${b.id} - ${new Date(b.timestamp).toLocaleString()}`);
    });
  } catch (error) {
    spinner.fail('Backup failed');
    console.error(error);
  }
}

/**
 * List available migrations
 */
async function listMigrations() {
  console.log(chalk.bold('\n📋 Available Migrations:\n'));

  const categories = {
    core: '🔧 Core Migrations',
    user: '👤 User Data Migrations',
    cleanup: '🧹 Cleanup Migrations',
  };

  Object.entries(categories).forEach(([category, title]) => {
    console.log(chalk.cyan(`\n${title}:\n`));

    Object.entries(ALL_MIGRATIONS)
      .filter(([, cat]) => cat === category)
      .forEach(([key]) => {
        console.log(`  • ${key}`);
      });
  });

  console.log('');
}

// Run the migration runner
if (require.main === module) {
  runMigrations()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
