/**
 * Backup Manager for Database Migrations
 *
 * Handles creating and restoring database backups before migrations
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';
import chalk from 'chalk';
import { PrismaClient, Prisma } from '@prisma/client';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

const prisma = new PrismaClient();

// Validate table name to prevent SQL injection
function isValidTableName(tableName: string): boolean {
  // Only allow alphanumeric characters and underscores
  // Must start with a letter and be a known Prisma model table
  const validTables = [
    'User',
    'Account',
    'Session',
    'Transaction',
    'Goal',
    'Budget',
    'BankAccount',
    'BankConnection',
    'Receipt',
    'ReceiptItem',
    'Subscription',
    'Payment',
    'TaxReturn',
    'TaxCalculation',
    'TransferSchedule',
    'UserPreferences',
    'AuditLog',
    'ApiKey',
    'ComplianceCheck',
    'ComplianceReport',
    'RiskAssessment',
    'TransactionPattern',
    'GoalProgress',
    'VerificationToken',
  ];

  return validTables.includes(tableName) && /^[A-Z][a-zA-Z0-9_]*$/.test(tableName);
}

export interface BackupOptions {
  includeLogs?: boolean;
  compress?: boolean;
  tables?: string[];
  excludeTables?: string[];
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  version: string;
  tables: string[];
  rowCounts: Record<string, number>;
  checksums: Record<string, string>;
  compressed: boolean;
  size: number;
}

const BACKUP_DIR = join(process.cwd(), 'backups');

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Create a database backup
 */
export async function createBackup(name: string, options: BackupOptions = {}): Promise<string> {
  const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
  const backupId = `${name}-${timestamp}`;
  const backupPath = join(BACKUP_DIR, backupId);

  // Create backup directory
  mkdirSync(backupPath, { recursive: true });

  console.log(chalk.blue(`Creating backup: ${backupId}`));

  try {
    // Get database connection info
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not set');
    }

    // Parse connection string
    const urlParts = new URL(dbUrl);
    const dbConfig = {
      host: urlParts.hostname,
      port: urlParts.port || '5432',
      database: urlParts.pathname.slice(1),
      username: urlParts.username,
      password: urlParts.password,
    };

    // Determine tables to backup
    let tables: string[] = [];
    if (options.tables && options.tables.length > 0) {
      tables = options.tables;
    } else {
      // Get all tables
      const result = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT LIKE '_prisma%'
      `;
      tables = result.map((r) => r.tablename);

      // Exclude tables if specified
      if (options.excludeTables) {
        tables = tables.filter((t) => !options.excludeTables!.includes(t));
      }
    }

    // Create metadata
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      tables,
      rowCounts: {},
      checksums: {},
      compressed: options.compress || false,
      size: 0,
    };

    // Backup each table
    for (const table of tables) {
      console.log(chalk.gray(`  Backing up table: ${table}`));

      // Get row count - use Prisma's count method instead of raw SQL
      let rowCount = 0;
      try {
        // Use Prisma's model methods for safe querying
        const model = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)];
        if (model && typeof model.count === 'function') {
          rowCount = await model.count();
        } else {
          // For tables without direct Prisma models, use safe table name validation
          if (!isValidTableName(table)) {
            throw new Error(`Invalid table name: ${table}`);
          }
          const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM ${Prisma.sql`"${Prisma.raw(table)}"`}
          `;
          rowCount = Number(countResult[0].count);
        }
      } catch (error) {
        console.warn(`Could not count rows in ${table}:`, error);
      }
      metadata.rowCounts[table] = rowCount;

      // Export table data as JSON
      let data: any[] = [];
      try {
        const model = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)];
        if (model && typeof model.findMany === 'function') {
          data = await model.findMany();
        } else {
          // For tables without direct Prisma models, use safe query
          if (!isValidTableName(table)) {
            throw new Error(`Invalid table name: ${table}`);
          }
          data = await prisma.$queryRaw`
            SELECT * FROM ${Prisma.sql`"${Prisma.raw(table)}"`}
          `;
        }
      } catch (error) {
        console.warn(`Could not export data from ${table}:`, error);
        continue;
      }
      const jsonPath = join(backupPath, `${table}.json`);
      writeFileSync(jsonPath, JSON.stringify(data, null, 2));

      // Generate checksum
      const crypto = await import('crypto');
      const fileContent = readFileSync(jsonPath);
      metadata.checksums[table] = crypto.createHash('sha256').update(fileContent).digest('hex');
    }

    // Backup schema
    console.log(chalk.gray('  Backing up schema...'));
    const schemaPath = join(backupPath, 'schema.sql');

    // Use pg_dump for schema
    const pgDumpCommand = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} --schema-only --no-owner --no-privileges -f ${schemaPath}`;

    try {
      execSync(pgDumpCommand, { stdio: 'pipe' });
    } catch (error) {
      console.warn(chalk.yellow('Warning: pg_dump failed, using Prisma schema instead'));
      const prismaSchema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf-8');
      writeFileSync(join(backupPath, 'schema.prisma'), prismaSchema);
    }

    // Save metadata
    writeFileSync(join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

    // Compress if requested
    let finalPath = backupPath;
    if (options.compress) {
      console.log(chalk.gray('  Compressing backup...'));
      finalPath = `${backupPath}.tar.gz`;
      await compressBackup(backupPath, finalPath);

      // Update metadata with compressed size
      const stats = require('fs').statSync(finalPath);
      metadata.size = stats.size;
    }

    console.log(chalk.green(`✅ Backup created: ${finalPath}`));

    // Log backup creation
    await logBackup(metadata);

    return finalPath;
  } catch (error) {
    console.error(chalk.red('Backup failed:'), error);
    throw error;
  }
}

/**
 * Restore from backup
 */
export async function restoreBackup(
  backupPath: string,
  options: { tables?: string[]; dryRun?: boolean } = {},
): Promise<void> {
  console.log(chalk.blue(`Restoring from backup: ${backupPath}`));

  try {
    // Check if backup exists
    if (!existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    // Decompress if needed
    let workingPath = backupPath;
    if (backupPath.endsWith('.tar.gz')) {
      console.log(chalk.gray('  Decompressing backup...'));
      workingPath = backupPath.replace('.tar.gz', '');
      await decompressBackup(backupPath, workingPath);
    }

    // Load metadata
    const metadataPath = join(workingPath, 'metadata.json');
    if (!existsSync(metadataPath)) {
      throw new Error('Backup metadata not found');
    }
    const metadata: BackupMetadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

    console.log(chalk.cyan('Backup info:'));
    console.log(`  Created: ${metadata.timestamp}`);
    console.log(`  Tables: ${metadata.tables.length}`);
    console.log(`  Total rows: ${Object.values(metadata.rowCounts).reduce((a, b) => a + b, 0)}`);

    if (options.dryRun) {
      console.log(chalk.yellow('\nDRY RUN: No changes will be made'));
      return;
    }

    // Confirm restore
    const prompts = await import('prompts');
    const { confirm } = await prompts.default({
      type: 'confirm',
      name: 'confirm',
      message: 'This will overwrite existing data. Continue?',
      initial: false,
    });

    if (!confirm) {
      console.log('Restore cancelled');
      return;
    }

    // Determine tables to restore
    const tablesToRestore = options.tables || metadata.tables;

    // Restore in transaction
    await prisma.$transaction(async (tx) => {
      for (const table of tablesToRestore) {
        if (!metadata.tables.includes(table)) {
          console.warn(chalk.yellow(`Table ${table} not found in backup, skipping`));
          continue;
        }

        console.log(chalk.gray(`  Restoring table: ${table}`));

        // Load table data
        const dataPath = join(workingPath, `${table}.json`);
        if (!existsSync(dataPath)) {
          console.warn(chalk.yellow(`Data file for ${table} not found, skipping`));
          continue;
        }

        const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

        // Verify checksum
        const crypto = await import('crypto');
        const fileContent = readFileSync(dataPath);
        const checksum = crypto.createHash('sha256').update(fileContent).digest('hex');

        if (metadata.checksums[table] && checksum !== metadata.checksums[table]) {
          throw new Error(`Checksum mismatch for table ${table}`);
        }

        // Clear existing data - use safe table name validation
        if (!isValidTableName(table)) {
          throw new Error(`Invalid table name: ${table}`);
        }

        // Use Prisma model methods when available
        const model = (tx as any)[table.charAt(0).toLowerCase() + table.slice(1)];
        if (model && typeof model.deleteMany === 'function') {
          await model.deleteMany();
        } else {
          // For tables without direct Prisma models, use validated query
          await tx.$executeRaw`TRUNCATE TABLE ${Prisma.sql`"${Prisma.raw(table)}"`} CASCADE`;
        }

        // Restore data in batches
        const batchSize = 1000;
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);

          // Build insert query dynamically - use safe methods
          if (batch.length > 0) {
            // Use Prisma model methods when available for safe inserts
            const model = (tx as any)[table.charAt(0).toLowerCase() + table.slice(1)];
            if (model && typeof model.createMany === 'function') {
              try {
                await model.createMany({
                  data: batch,
                  skipDuplicates: true,
                });
              } catch (error) {
                console.error(`Failed to restore batch for ${table}:`, error);
                // Try individual inserts as fallback
                for (const row of batch) {
                  try {
                    await model.create({ data: row });
                  } catch (err) {
                    console.warn(`Skipped duplicate or invalid row in ${table}`);
                  }
                }
              }
            } else {
              // For tables without Prisma models, skip with warning
              console.warn(
                chalk.yellow(
                  `Cannot restore ${table} - no Prisma model available. Manual restoration required.`,
                ),
              );
            }
          }

          console.log(
            chalk.gray(`    Restored ${Math.min(i + batchSize, data.length)}/${data.length} rows`),
          );
        }
      }
    });

    console.log(chalk.green('✅ Restore completed successfully'));
  } catch (error) {
    console.error(chalk.red('Restore failed:'), error);
    throw error;
  }
}

/**
 * List available backups
 */
export async function listBackups(): Promise<BackupMetadata[]> {
  const fs = await import('fs/promises');
  const files = await fs.readdir(BACKUP_DIR);
  const backups: BackupMetadata[] = [];

  for (const file of files) {
    const metadataPath = join(BACKUP_DIR, file, 'metadata.json');
    if (existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
        backups.push(metadata);
      } catch (error) {
        // Skip invalid metadata
      }
    }
  }

  return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Compress backup directory
 */
async function compressBackup(source: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(destination);
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: { level: 9 },
    });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(source, false);
    archive.finalize();
  });
}

/**
 * Decompress backup archive
 */
async function decompressBackup(source: string, destination: string): Promise<void> {
  const tar = await import('tar');
  await tar.extract({
    file: source,
    cwd: join(destination, '..'),
  });
}

/**
 * Log backup creation
 */
async function logBackup(metadata: BackupMetadata): Promise<void> {
  const logFile = join(BACKUP_DIR, 'backup-log.json');
  let log: BackupMetadata[] = [];

  if (existsSync(logFile)) {
    try {
      log = JSON.parse(readFileSync(logFile, 'utf-8'));
    } catch (error) {
      // Start fresh if log is corrupted
    }
  }

  log.push(metadata);

  // Keep only last 100 entries
  if (log.length > 100) {
    log = log.slice(-100);
  }

  writeFileSync(logFile, JSON.stringify(log, null, 2));
}

/**
 * Clean old backups
 */
export async function cleanOldBackups(daysToKeep: number = 30): Promise<void> {
  const fs = await import('fs/promises');
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  console.log(chalk.blue(`Cleaning backups older than ${daysToKeep} days...`));

  const files = await fs.readdir(BACKUP_DIR);
  let cleaned = 0;

  for (const file of files) {
    const path = join(BACKUP_DIR, file);
    const stats = await fs.stat(path);

    if (stats.mtime < cutoffDate) {
      await fs.rm(path, { recursive: true, force: true });
      cleaned++;
      console.log(chalk.gray(`  Removed: ${file}`));
    }
  }

  console.log(chalk.green(`✅ Cleaned ${cleaned} old backups`));
}

export default {
  createBackup,
  restoreBackup,
  listBackups,
  cleanOldBackups,
};
