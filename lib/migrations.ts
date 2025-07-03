import db from './database';
import { envConfig } from './env-config';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

interface Migration {
  id: string;
  name: string;
  checksum: string;
  applied_at?: Date;
  execution_time?: number;
}

class MigrationRunner {
  private migrationsPath: string;
  private tableName: string = 'schema_migrations';

  constructor(migrationsPath: string = './migrations') {
    this.migrationsPath = migrationsPath;
  }

  async initialize(): Promise<void> {
    // Create migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        execution_time INTEGER
      )
    `);

    // Create audit logs table for sensitive operations
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        operation VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        details JSONB,
        ip_address VARCHAR(45)
      )
    `);
  }

  async getMigrations(): Promise<Migration[]> {
    const files = await readdir(this.migrationsPath);
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of migrationFiles) {
      const content = await readFile(join(this.migrationsPath, file), 'utf-8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      
      migrations.push({
        id: file.replace('.sql', ''),
        name: file,
        checksum,
      });
    }

    return migrations;
  }

  async getAppliedMigrations(): Promise<Migration[]> {
    const result = await db.query<Migration>(
      `SELECT * FROM ${this.tableName} ORDER BY applied_at`
    );
    return result.rows;
  }

  async runMigration(migration: Migration): Promise<void> {
    const filePath = join(this.migrationsPath, migration.name);
    const sql = await readFile(filePath, 'utf-8');
    
    // Validate migration checksum
    const currentChecksum = crypto.createHash('sha256').update(sql).digest('hex');
    if (currentChecksum !== migration.checksum) {
      throw new Error(`Checksum mismatch for migration ${migration.name}`);
    }

    const startTime = Date.now();

    await db.transaction(async (client) => {
      // Execute migration
      await client.query(sql);
      
      // Record migration
      await client.query(
        `INSERT INTO ${this.tableName} (id, name, checksum, execution_time) 
         VALUES ($1, $2, $3, $4)`,
        [
          migration.id,
          migration.name,
          migration.checksum,
          Date.now() - startTime,
        ]
      );
    });

    console.log(`✓ Migration ${migration.name} applied successfully`);
  }

  async run(options: { dryRun?: boolean } = {}): Promise<void> {
    await this.initialize();

    const allMigrations = await this.getMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));

    const pendingMigrations = allMigrations.filter(m => !appliedIds.has(m.id));

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migrations`);

    if (options.dryRun) {
      console.log('Dry run - migrations that would be applied:');
      pendingMigrations.forEach(m => console.log(`  - ${m.name}`));
      return;
    }

    for (const migration of pendingMigrations) {
      try {
        await this.runMigration(migration);
      } catch (error) {
        console.error(`Failed to apply migration ${migration.name}:`, error);
        throw error;
      }
    }

    console.log('All migrations applied successfully');
  }

  async rollback(steps: number = 1): Promise<void> {
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationsToRollback = appliedMigrations
      .slice(-steps)
      .reverse();

    if (migrationsToRollback.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    for (const migration of migrationsToRollback) {
      const rollbackFile = join(
        this.migrationsPath,
        'rollback',
        migration.name
      );

      try {
        const sql = await readFile(rollbackFile, 'utf-8');
        
        await db.transaction(async (client) => {
          await client.query(sql);
          await client.query(
            `DELETE FROM ${this.tableName} WHERE id = $1`,
            [migration.id]
          );
        });

        console.log(`✓ Rolled back migration ${migration.name}`);
      } catch (error) {
        console.error(`Failed to rollback migration ${migration.name}:`, error);
        throw error;
      }
    }
  }

  async status(): Promise<void> {
    await this.initialize();

    const allMigrations = await this.getMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedIds = new Set(appliedMigrations.map(m => m.id));

    console.log('\nMigration Status:');
    console.log(`Environment: ${envConfig.getConfig().NODE_ENV}`);
    console.log(`Database: ${envConfig.getDatabaseUrl().replace(/:[^:@]+@/, ':[REDACTED]@')}\n`);

    for (const migration of allMigrations) {
      const applied = appliedIds.has(migration.id);
      const appliedMigration = appliedMigrations.find(m => m.id === migration.id);
      
      if (applied && appliedMigration) {
        console.log(
          `✓ ${migration.name} (applied at ${appliedMigration.applied_at}, ${appliedMigration.execution_time}ms)`
        );
      } else {
        console.log(`  ${migration.name} (pending)`);
      }
    }
  }
}

// CLI utilities
export async function runMigrations(options: { dryRun?: boolean } = {}) {
  const runner = new MigrationRunner();
  await runner.run(options);
}

export async function rollbackMigrations(steps: number = 1) {
  const runner = new MigrationRunner();
  await runner.rollback(steps);
}

export async function migrationStatus() {
  const runner = new MigrationRunner();
  await runner.status();
}

// Export for programmatic use
export { MigrationRunner };