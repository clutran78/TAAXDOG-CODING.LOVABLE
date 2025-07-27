/**
 * Migration Tracker
 *
 * Tracks migration history and provides rollback data storage
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export interface MigrationRecord {
  id: string;
  name: string;
  version: string;
  status: 'running' | 'completed' | 'failed' | 'rolled_back';
  startedAt: Date;
  completedAt?: Date;
  affectedRecords: number;
  error?: string;
  rollbackData?: any;
  checksum?: string;
}

const MIGRATION_LOG_DIR = join(process.cwd(), 'migrations', 'history');

// Ensure directory exists
if (!existsSync(MIGRATION_LOG_DIR)) {
  require('fs').mkdirSync(MIGRATION_LOG_DIR, { recursive: true });
}

export class MigrationTracker {
  private logFile: string;

  constructor(private prisma: PrismaClient) {
    this.logFile = join(MIGRATION_LOG_DIR, 'migration-history.json');
    this.ensureMigrationTable();
  }

  /**
   * Ensure migration tracking table exists
   */
  private async ensureMigrationTable(): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS _data_migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          version VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          started_at TIMESTAMP NOT NULL,
          completed_at TIMESTAMP,
          affected_records INTEGER DEFAULT 0,
          error TEXT,
          rollback_data JSONB,
          checksum VARCHAR(64),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create index
      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_data_migrations_name_version 
        ON _data_migrations(name, version)
      `;
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not create migration tracking table'));
    }
  }

  /**
   * Check if a migration has been run
   */
  async wasMigrationRun(name: string, version: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count 
        FROM _data_migrations 
        WHERE name = ${name} 
        AND version = ${version}
        AND status IN ('completed', 'running')
      `;

      return Number(result[0].count) > 0;
    } catch (error) {
      // Fall back to file-based tracking
      return this.wasMigrationRunFromFile(name, version);
    }
  }

  /**
   * Start tracking a migration
   */
  async startMigration(name: string, version: string, affectedRecords: number): Promise<string> {
    const id = `${name}-${version}-${Date.now()}`;
    const record: MigrationRecord = {
      id,
      name,
      version,
      status: 'running',
      startedAt: new Date(),
      affectedRecords,
    };

    try {
      // Save to database
      await this.prisma.$executeRaw`
        INSERT INTO _data_migrations (
          id, name, version, status, started_at, affected_records
        ) VALUES (
          ${id}, ${name}, ${version}, 'running', ${record.startedAt}, ${affectedRecords}
        )
      `;
    } catch (error) {
      console.warn('Could not save to database, using file tracking');
    }

    // Also save to file
    this.saveToFile(record);

    return id;
  }

  /**
   * Mark migration as completed
   */
  async completeMigration(id: string): Promise<void> {
    const completedAt = new Date();

    try {
      await this.prisma.$executeRaw`
        UPDATE _data_migrations 
        SET status = 'completed', 
            completed_at = ${completedAt},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    } catch (error) {
      console.warn('Could not update database, updating file record');
    }

    // Update file record
    this.updateFileRecord(id, {
      status: 'completed',
      completedAt,
    });
  }

  /**
   * Mark migration as failed
   */
  async failMigration(id: string, error: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE _data_migrations 
        SET status = 'failed', 
            error = ${error},
            completed_at = ${new Date()},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    } catch (err) {
      console.warn('Could not update database, updating file record');
    }

    // Update file record
    this.updateFileRecord(id, {
      status: 'failed',
      error,
      completedAt: new Date(),
    });
  }

  /**
   * Store rollback data
   */
  async storeRollbackData(migrationName: string, data: any): Promise<void> {
    const rollbackFile = join(MIGRATION_LOG_DIR, `rollback-${migrationName}-${Date.now()}.json`);

    writeFileSync(rollbackFile, JSON.stringify(data, null, 2));

    // Also store reference in database if possible
    try {
      const lastMigration = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM _data_migrations 
        WHERE name = ${migrationName} 
        ORDER BY started_at DESC 
        LIMIT 1
      `;

      if (lastMigration.length > 0) {
        await this.prisma.$executeRaw`
          UPDATE _data_migrations 
          SET rollback_data = ${JSON.stringify({ file: rollbackFile })}
          WHERE id = ${lastMigration[0].id}
        `;
      }
    } catch (error) {
      // Ignore database errors
    }
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(limit: number = 50): Promise<MigrationRecord[]> {
    try {
      const records = await this.prisma.$queryRaw<MigrationRecord[]>`
        SELECT * FROM _data_migrations 
        ORDER BY started_at DESC 
        LIMIT ${limit}
      `;

      return records;
    } catch (error) {
      // Fall back to file-based history
      return this.getFileHistory().slice(0, limit);
    }
  }

  /**
   * Get failed migrations
   */
  async getFailedMigrations(): Promise<MigrationRecord[]> {
    try {
      const records = await this.prisma.$queryRaw<MigrationRecord[]>`
        SELECT * FROM _data_migrations 
        WHERE status = 'failed'
        ORDER BY started_at DESC
      `;

      return records;
    } catch (error) {
      return this.getFileHistory().filter((r) => r.status === 'failed');
    }
  }

  /**
   * Generate migration report
   */
  async generateReport(): Promise<string> {
    const history = await this.getMigrationHistory(100);
    const failed = history.filter((r) => r.status === 'failed');
    const completed = history.filter((r) => r.status === 'completed');
    const running = history.filter((r) => r.status === 'running');

    let report = chalk.bold('\n📊 Migration Report\n\n');

    report += chalk.cyan('Summary:\n');
    report += `  Total migrations: ${history.length}\n`;
    report += `  Completed: ${chalk.green(completed.length)}\n`;
    report += `  Failed: ${chalk.red(failed.length)}\n`;
    report += `  Running: ${chalk.yellow(running.length)}\n\n`;

    if (running.length > 0) {
      report += chalk.yellow('⚠️  Running Migrations:\n');
      running.forEach((m) => {
        report += `  - ${m.name} v${m.version} (started ${m.startedAt})\n`;
      });
      report += '\n';
    }

    if (failed.length > 0) {
      report += chalk.red('❌ Failed Migrations:\n');
      failed.forEach((m) => {
        report += `  - ${m.name} v${m.version}: ${m.error}\n`;
      });
      report += '\n';
    }

    report += chalk.cyan('Recent Migrations:\n');
    history.slice(0, 10).forEach((m) => {
      const status =
        m.status === 'completed'
          ? chalk.green('✓')
          : m.status === 'failed'
            ? chalk.red('✗')
            : chalk.yellow('⟳');
      report += `  ${status} ${m.name} v${m.version} - ${m.affectedRecords} records\n`;
    });

    return report;
  }

  /**
   * File-based tracking methods (fallback)
   */
  private getFileHistory(): MigrationRecord[] {
    if (!existsSync(this.logFile)) {
      return [];
    }

    try {
      return JSON.parse(readFileSync(this.logFile, 'utf-8'));
    } catch (error) {
      return [];
    }
  }

  private saveToFile(record: MigrationRecord): void {
    const history = this.getFileHistory();
    history.push(record);
    writeFileSync(this.logFile, JSON.stringify(history, null, 2));
  }

  private updateFileRecord(id: string, updates: Partial<MigrationRecord>): void {
    const history = this.getFileHistory();
    const index = history.findIndex((r) => r.id === id);

    if (index >= 0) {
      history[index] = { ...history[index], ...updates };
      writeFileSync(this.logFile, JSON.stringify(history, null, 2));
    }
  }

  private wasMigrationRunFromFile(name: string, version: string): boolean {
    const history = this.getFileHistory();
    return history.some(
      (r) =>
        r.name === name && r.version === version && ['completed', 'running'].includes(r.status),
    );
  }
}

/**
 * Create rollback script
 */
export function createRollbackScript(migrationName: string, rollbackSteps: string[]): string {
  const script = `#!/bin/bash
# Rollback script for migration: ${migrationName}
# Generated: ${new Date().toISOString()}

set -e

echo "🔄 Starting rollback for ${migrationName}..."

${rollbackSteps.join('\n')}

echo "✅ Rollback completed"
`;

  const scriptPath = join(MIGRATION_LOG_DIR, `rollback-${migrationName}-${Date.now()}.sh`);

  writeFileSync(scriptPath, script);
  require('fs').chmodSync(scriptPath, '755');

  return scriptPath;
}
