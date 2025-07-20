const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const readline = require('readline');

// Rollback configuration
const ROLLBACK_CONFIG = {
  // Tables in reverse dependency order
  tablesInOrder: [
    'ai_usage_tracking',
    'ai_conversations',
    'financial_insights',
    'budget_tracking',
    'budgets',
    'bank_transactions',
    'receipts',
    'bank_accounts',
    'basiq_users',
    'users'
  ],
  
  // Backup configuration
  backupBeforeRollback: true,
  backupDir: 'rollback-backups',
  
  // Safety checks
  requireConfirmation: true,
  dryRun: false
};

// Rollback manager class
class MigrationRollbackManager {
  constructor(connectionString, options = {}) {
    this.options = { ...ROLLBACK_CONFIG, ...options };
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false
    });
    
    this.rollbackLog = {
      timestamp: new Date().toISOString(),
      phase: 'initialization',
      actions: [],
      errors: [],
      summary: {}
    };
  }

  // Main rollback method
  async rollback(importTimestamp = null) {
    console.log('🔄 Firebase to PostgreSQL Migration Rollback');
    console.log('==========================================\n');

    try {
      // Phase 1: Pre-rollback checks
      await this.performPreRollbackChecks();

      // Phase 2: Create backup if required
      if (this.options.backupBeforeRollback) {
        await this.createBackup();
      }

      // Phase 3: Get user confirmation
      if (this.options.requireConfirmation && !this.options.dryRun) {
        const confirmed = await this.getUserConfirmation();
        if (!confirmed) {
          console.log('\n❌ Rollback cancelled by user');
          return;
        }
      }

      // Phase 4: Execute rollback
      await this.executeRollback(importTimestamp);

      // Phase 5: Verify rollback
      await this.verifyRollback();

      // Phase 6: Generate report
      await this.generateRollbackReport();

      console.log('\n✅ Rollback completed successfully');

    } catch (error) {
      console.error('\n❌ Rollback failed:', error);
      this.rollbackLog.errors.push({
        phase: this.rollbackLog.phase,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  // Phase 1: Pre-rollback checks
  async performPreRollbackChecks() {
    console.log('📋 Performing pre-rollback checks...');
    this.rollbackLog.phase = 'pre-checks';

    // Test database connection
    try {
      const result = await this.pool.query('SELECT NOW(), current_database()');
      console.log('   ✅ Database connection verified');
      this.logAction('Database connection verified', 'success');
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Check if migration tracking exists
    const trackingExists = await this.checkMigrationTracking();
    if (!trackingExists) {
      console.log('   ⚠️  No migration tracking table found');
      console.log('   Creating tracking based on data analysis...');
      await this.createMigrationTracking();
    }

    // Get current record counts
    const currentCounts = await this.getCurrentRecordCounts();
    this.rollbackLog.currentCounts = currentCounts;
    
    console.log('\n   Current record counts:');
    for (const [table, count] of Object.entries(currentCounts)) {
      console.log(`   - ${table}: ${count} records`);
    }
  }

  // Phase 2: Create backup
  async createBackup() {
    console.log('\n💾 Creating backup before rollback...');
    this.rollbackLog.phase = 'backup';

    const backupDir = path.join(__dirname, '..', this.options.backupDir, `backup_${Date.now()}`);
    await fs.mkdir(backupDir, { recursive: true });

    for (const table of this.options.tablesInOrder) {
      try {
        console.log(`   Backing up ${table}...`);
        
        const query = `
          COPY (SELECT * FROM ${table}) 
          TO STDOUT WITH CSV HEADER
        `;
        
        const stream = await this.pool.query(query);
        const csvData = [];
        
        stream.on('data', chunk => csvData.push(chunk));
        await new Promise((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
        });
        
        const backupPath = path.join(backupDir, `${table}.csv`);
        await fs.writeFile(backupPath, csvData.join(''), 'utf8');
        
        this.logAction(`Backed up ${table}`, 'success', { path: backupPath });
        
      } catch (error) {
        console.error(`   ❌ Failed to backup ${table}:`, error.message);
        this.logAction(`Failed to backup ${table}`, 'error', error.message);
      }
    }

    console.log(`   ✅ Backup completed: ${backupDir}`);
    this.rollbackLog.backupLocation = backupDir;
  }

  // Phase 3: Get user confirmation
  async getUserConfirmation() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      console.log('\n⚠️  WARNING: This will remove all imported data!');
      console.log('   Affected tables:', this.options.tablesInOrder.join(', '));
      
      rl.question('\nAre you sure you want to proceed? Type "ROLLBACK" to confirm: ', answer => {
        rl.close();
        resolve(answer === 'ROLLBACK');
      });
    });
  }

  // Phase 4: Execute rollback
  async executeRollback(importTimestamp) {
    console.log('\n🔄 Executing rollback...');
    this.rollbackLog.phase = 'execution';

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Disable foreign key checks
      await client.query('SET session_replication_role = replica');
      console.log('   ✅ Foreign key checks disabled');

      // Delete data from each table
      for (const table of this.options.tablesInOrder) {
        try {
          let deleteQuery;
          let params = [];
          
          if (importTimestamp) {
            // Delete records imported after specific timestamp
            deleteQuery = `DELETE FROM ${table} WHERE created_at >= $1`;
            params = [importTimestamp];
          } else {
            // Delete all records (use with caution!)
            if (await this.hasExistingData(table)) {
              console.log(`   ⚠️  ${table} contains existing data - skipping full delete`);
              continue;
            }
            deleteQuery = `DELETE FROM ${table}`;
          }

          if (this.options.dryRun) {
            const countResult = await client.query(
              `SELECT COUNT(*) FROM ${table} ${importTimestamp ? 'WHERE created_at >= $1' : ''}`,
              params
            );
            console.log(`   🔍 [DRY RUN] Would delete ${countResult.rows[0].count} records from ${table}`);
            this.logAction(`Dry run: would delete from ${table}`, 'info', { count: countResult.rows[0].count });
          } else {
            const result = await client.query(deleteQuery, params);
            console.log(`   ✅ Deleted ${result.rowCount} records from ${table}`);
            this.logAction(`Deleted from ${table}`, 'success', { count: result.rowCount });
          }

        } catch (error) {
          console.error(`   ❌ Failed to rollback ${table}:`, error.message);
          this.logAction(`Failed to rollback ${table}`, 'error', error.message);
          throw error;
        }
      }

      // Re-enable foreign key checks
      await client.query('SET session_replication_role = origin');
      console.log('   ✅ Foreign key checks re-enabled');

      // Reset sequences
      if (!this.options.dryRun) {
        await this.resetSequences(client);
      }

      // Commit or rollback based on mode
      if (this.options.dryRun) {
        await client.query('ROLLBACK');
        console.log('\n   🔍 [DRY RUN] Changes rolled back - no data was actually deleted');
      } else {
        await client.query('COMMIT');
        console.log('\n   ✅ Rollback transaction committed');
      }

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Phase 5: Verify rollback
  async verifyRollback() {
    if (this.options.dryRun) return;

    console.log('\n🔍 Verifying rollback...');
    this.rollbackLog.phase = 'verification';

    const afterCounts = await this.getCurrentRecordCounts();
    this.rollbackLog.afterCounts = afterCounts;

    console.log('\n   Record counts after rollback:');
    let allClean = true;

    for (const [table, afterCount] of Object.entries(afterCounts)) {
      const beforeCount = this.rollbackLog.currentCounts[table] || 0;
      const removed = beforeCount - afterCount;
      
      console.log(`   - ${table}: ${afterCount} records (removed ${removed})`);
      
      if (afterCount > 0 && removed === 0) {
        allClean = false;
      }
    }

    this.rollbackLog.summary.allClean = allClean;
    this.rollbackLog.summary.tablesProcessed = Object.keys(afterCounts).length;
  }

  // Phase 6: Generate rollback report
  async generateRollbackReport() {
    console.log('\n📄 Generating rollback report...');
    
    const reportDir = path.join(__dirname, '..', 'rollback-reports');
    await fs.mkdir(reportDir, { recursive: true });
    
    const reportPath = path.join(reportDir, `rollback_report_${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(this.rollbackLog, null, 2), 'utf8');
    
    // Generate markdown report
    const markdownPath = path.join(reportDir, `rollback_report_${Date.now()}.md`);
    const markdown = this.generateMarkdownReport();
    await fs.writeFile(markdownPath, markdown, 'utf8');
    
    console.log(`   ✅ Report saved to: ${reportPath}`);
    this.rollbackLog.reportLocation = reportPath;
  }

  // Helper methods
  async checkMigrationTracking() {
    try {
      const result = await this.pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'migration_tracking'
        )
      `);
      return result.rows[0].exists;
    } catch (error) {
      return false;
    }
  }

  async createMigrationTracking() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS migration_tracking (
          id SERIAL PRIMARY KEY,
          collection VARCHAR(100),
          imported_at TIMESTAMP DEFAULT NOW(),
          record_count INTEGER,
          success BOOLEAN DEFAULT true
        )
      `);
    } catch (error) {
      console.error('Failed to create migration tracking:', error.message);
    }
  }

  async getCurrentRecordCounts() {
    const counts = {};
    
    for (const table of this.options.tablesInOrder) {
      try {
        const result = await this.pool.query(`SELECT COUNT(*) FROM ${table}`);
        counts[table] = parseInt(result.rows[0].count);
      } catch (error) {
        counts[table] = 0;
      }
    }
    
    return counts;
  }

  async hasExistingData(table) {
    try {
      // Check if table has data older than 30 days (likely pre-existing)
      const result = await this.pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM ${table} 
          WHERE created_at < NOW() - INTERVAL '30 days'
          LIMIT 1
        )
      `);
      return result.rows[0].exists;
    } catch (error) {
      return true; // Assume it has data to be safe
    }
  }

  async resetSequences(client) {
    console.log('\n   🔢 Resetting sequences...');
    
    const sequences = [
      { table: 'users', sequence: 'users_id_seq' },
      { table: 'bank_accounts', sequence: 'bank_accounts_id_seq' },
      { table: 'bank_transactions', sequence: 'bank_transactions_id_seq' },
      { table: 'receipts', sequence: 'receipts_id_seq' },
      { table: 'budgets', sequence: 'budgets_id_seq' },
      { table: 'budget_tracking', sequence: 'budget_tracking_id_seq' },
      { table: 'financial_insights', sequence: 'financial_insights_id_seq' }
    ];
    
    for (const { table, sequence } of sequences) {
      try {
        await client.query(
          `SELECT setval('${sequence}', COALESCE((SELECT MAX(id::bigint) FROM ${table}), 1))`
        );
      } catch (error) {
        // Sequence might not exist or table uses UUID
      }
    }
  }

  logAction(action, status, details = null) {
    this.rollbackLog.actions.push({
      timestamp: new Date().toISOString(),
      action,
      status,
      details
    });
  }

  generateMarkdownReport() {
    const log = this.rollbackLog;
    const isDryRun = this.options.dryRun ? ' (DRY RUN)' : '';
    
    return `# Migration Rollback Report${isDryRun}

**Date:** ${new Date(log.timestamp).toLocaleString()}
**Mode:** ${this.options.dryRun ? 'Dry Run' : 'Live Execution'}
${log.backupLocation ? `**Backup Location:** ${log.backupLocation}` : ''}

## Summary

- **Tables Processed:** ${log.summary.tablesProcessed || 0}
- **Total Errors:** ${log.errors.length}
- **Status:** ${log.errors.length === 0 ? '✅ Success' : '❌ Failed'}

## Record Counts

### Before Rollback
${Object.entries(log.currentCounts || {}).map(([table, count]) => 
  `- ${table}: ${count} records`
).join('\n')}

### After Rollback
${Object.entries(log.afterCounts || {}).map(([table, count]) => 
  `- ${table}: ${count} records`
).join('\n')}

## Actions Performed

${log.actions.map(action => 
  `- [${new Date(action.timestamp).toLocaleTimeString()}] ${action.status === 'success' ? '✅' : action.status === 'error' ? '❌' : '📌'} ${action.action}`
).join('\n')}

## Errors

${log.errors.length === 0 ? 'No errors occurred.' : log.errors.map(error => 
  `- [${error.phase}] ${error.error}`
).join('\n')}

## Next Steps

${log.errors.length === 0 ? `
1. Verify application functionality
2. Check for any remaining data inconsistencies
3. ${log.backupLocation ? 'Keep backup for reference' : 'Create a new backup'}
4. Document the rollback in your change log
` : `
1. Review the errors above
2. Manually check affected tables
3. Contact support if needed
4. Consider restoring from backup
`}
`;
  }

  async close() {
    await this.pool.end();
  }
}

// Recovery utilities
class RecoveryUtilities {
  static async restoreFromBackup(backupDir, connectionString) {
    console.log('📥 Restoring from backup...');
    
    const pool = new Pool({ connectionString });
    
    try {
      // List backup files
      const files = await fs.readdir(backupDir);
      const csvFiles = files.filter(f => f.endsWith('.csv'));
      
      console.log(`Found ${csvFiles.length} backup files`);
      
      for (const file of csvFiles) {
        const table = path.basename(file, '.csv');
        const filePath = path.join(backupDir, file);
        
        console.log(`   Restoring ${table}...`);
        
        const query = `COPY ${table} FROM STDIN WITH CSV HEADER`;
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        await pool.query(query, (stream) => {
          stream.write(fileContent);
          stream.end();
        });
        
        console.log(`   ✅ Restored ${table}`);
      }
      
    } catch (error) {
      console.error('❌ Restore failed:', error);
      throw error;
    } finally {
      await pool.end();
    }
  }

  static async generateCorrectionScript(validationReport) {
    const corrections = [];
    
    // Add corrections based on validation issues
    if (validationReport.australianCompliance?.bsbFormat?.invalidRecords > 0) {
      corrections.push(`
-- Fix BSB format
UPDATE bank_accounts 
SET bsb = SUBSTRING(bsb FROM 1 FOR 3) || '-' || SUBSTRING(bsb FROM 4 FOR 3)
WHERE bsb ~ '^[0-9]{6}$';
`);
    }
    
    if (validationReport.australianCompliance?.phoneFormat?.invalidRecords > 0) {
      corrections.push(`
-- Fix phone number format
UPDATE users 
SET phone = '+61' || SUBSTRING(phone FROM 2)
WHERE phone ~ '^0[0-9]{9}$';
`);
    }
    
    return corrections.join('\n');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL with your PostgreSQL connection string');
    process.exit(1);
  }
  
  console.log('🔧 Migration Rollback Tool');
  console.log('========================\n');
  
  try {
    switch (command) {
      case 'rollback':
        const options = {
          dryRun: args.includes('--dry-run'),
          requireConfirmation: !args.includes('--no-confirm'),
          backupBeforeRollback: !args.includes('--no-backup')
        };
        
        const manager = new MigrationRollbackManager(connectionString, options);
        await manager.rollback(args[1]); // Optional timestamp
        await manager.close();
        break;
        
      case 'restore':
        if (!args[1]) {
          console.error('Please provide backup directory path');
          process.exit(1);
        }
        await RecoveryUtilities.restoreFromBackup(args[1], connectionString);
        break;
        
      case 'help':
      default:
        console.log(`Usage:
  rollback [timestamp] [options]  - Rollback migration
    Options:
      --dry-run       - Preview what would be deleted
      --no-confirm    - Skip confirmation prompt
      --no-backup     - Skip backup creation
      
  restore <backup-dir>           - Restore from backup
  
Examples:
  npm run rollback -- rollback --dry-run
  npm run rollback -- rollback "2024-01-01 00:00:00"
  npm run rollback -- restore rollback-backups/backup_1234567890
`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Operation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  MigrationRollbackManager,
  RecoveryUtilities,
  ROLLBACK_CONFIG
};