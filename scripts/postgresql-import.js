const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const { format } = require('date-fns');

// Import configuration
const IMPORT_CONFIG = {
  batchSize: 1000,
  retryAttempts: 3,
  retryDelay: 1000,
  collections: [
    { name: 'users', table: 'users', primaryKey: 'id' },
    { name: 'bankAccounts', table: 'bank_accounts', primaryKey: 'id' },
    { name: 'budgets', table: 'budgets', primaryKey: 'id' },
    { name: 'transactions', table: 'transactions', primaryKey: 'id' },
    { name: 'receipts', table: 'receipts', primaryKey: 'id' },
    { name: 'budgetTracking', table: 'budget_tracking', primaryKey: 'id' },
    { name: 'financialInsights', table: 'financial_insights', primaryKey: 'id' },
  ],
};

// Database connection
class DatabaseImporter {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.importStats = {
      startTime: null,
      endTime: null,
      collections: {},
      totalRecords: 0,
      successfulImports: 0,
      failedImports: 0,
      errors: [],
    };
  }

  // Test database connection
  async testConnection() {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('✓ Database connected:', result.rows[0].now);
      client.release();
      return true;
    } catch (error) {
      console.error('✗ Database connection failed:', error.message);
      return false;
    }
  }

  // Disable foreign key checks
  async disableForeignKeyChecks(client) {
    await client.query('SET session_replication_role = replica');
  }

  // Enable foreign key checks
  async enableForeignKeyChecks(client) {
    await client.query('SET session_replication_role = origin');
  }

  // Get column information for a table
  async getTableColumns(tableName) {
    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;

    const result = await this.pool.query(query, [tableName]);
    return result.rows;
  }

  // Build insert query
  buildInsertQuery(tableName, records, columns) {
    if (records.length === 0) return null;

    const columnNames = columns.map((col) => col.column_name);
    const recordKeys = Object.keys(records[0]);

    // Filter to only include columns that exist in the table
    const validColumns = recordKeys.filter((key) => columnNames.includes(key));

    if (validColumns.length === 0) {
      throw new Error(`No valid columns found for table ${tableName}`);
    }

    // Build placeholders
    const valuePlaceholders = [];
    const values = [];
    let paramCounter = 1;

    records.forEach((record) => {
      const recordPlaceholders = [];
      validColumns.forEach((column) => {
        recordPlaceholders.push(`$${paramCounter++}`);
        values.push(record[column] !== undefined ? record[column] : null);
      });
      valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
    });

    const query = `
      INSERT INTO ${tableName} (${validColumns.join(', ')})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
      ${validColumns
        .filter((col) => col !== 'id')
        .map((col) => `${col} = EXCLUDED.${col}`)
        .join(', ')}
    `;

    return { query, values };
  }

  // Import batch of records
  async importBatch(tableName, records, columns) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const { query, values } = this.buildInsertQuery(tableName, records, columns);

      if (!query) return { success: 0, failed: 0 };

      await client.query(query, values);

      await client.query('COMMIT');

      return { success: records.length, failed: 0 };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error importing batch to ${tableName}:`, error.message);

      // Try individual inserts on batch failure
      let individualSuccess = 0;
      let individualFailed = 0;

      for (const record of records) {
        try {
          const { query, values } = this.buildInsertQuery(tableName, [record], columns);
          await client.query(query, values);
          individualSuccess++;
        } catch (individualError) {
          individualFailed++;
          this.importStats.errors.push({
            table: tableName,
            record: record.id,
            error: individualError.message,
          });
        }
      }

      return { success: individualSuccess, failed: individualFailed };
    } finally {
      client.release();
    }
  }

  // Import collection
  async importCollection(collectionConfig, dataPath) {
    console.log(`\nImporting ${collectionConfig.name} to ${collectionConfig.table}...`);

    const startTime = Date.now();
    const stats = {
      total: 0,
      imported: 0,
      failed: 0,
      batches: 0,
    };

    try {
      // Load transformed data
      const records = JSON.parse(await fs.readFile(dataPath, 'utf8'));
      stats.total = records.length;

      if (records.length === 0) {
        console.log('  No records to import');
        return stats;
      }

      // Get table columns
      const columns = await this.getTableColumns(collectionConfig.table);
      if (columns.length === 0) {
        throw new Error(`Table ${collectionConfig.table} not found or has no columns`);
      }

      // Import in batches
      for (let i = 0; i < records.length; i += IMPORT_CONFIG.batchSize) {
        const batch = records.slice(i, i + IMPORT_CONFIG.batchSize);
        stats.batches++;

        console.log(`  Processing batch ${stats.batches} (${batch.length} records)...`);

        const result = await this.importBatch(collectionConfig.table, batch, columns);
        stats.imported += result.success;
        stats.failed += result.failed;

        // Progress update
        const progress = (((i + batch.length) / records.length) * 100).toFixed(1);
        console.log(
          `  Progress: ${progress}% (${stats.imported} imported, ${stats.failed} failed)`,
        );
      }

      const duration = Date.now() - startTime;
      console.log(`  ✓ Completed in ${(duration / 1000).toFixed(2)}s`);
      console.log(`  ✓ Imported: ${stats.imported}/${stats.total} records`);

      if (stats.failed > 0) {
        console.log(`  ⚠ Failed: ${stats.failed} records`);
      }
    } catch (error) {
      console.error(`  ✗ Error importing ${collectionConfig.name}:`, error.message);
      this.importStats.errors.push({
        collection: collectionConfig.name,
        error: error.message,
      });
    }

    this.importStats.collections[collectionConfig.name] = stats;
    this.importStats.totalRecords += stats.total;
    this.importStats.successfulImports += stats.imported;
    this.importStats.failedImports += stats.failed;

    return stats;
  }

  // Update sequences after import
  async updateSequences() {
    console.log('\nUpdating sequences...');

    const sequences = [
      { table: 'users', sequence: 'users_id_seq' },
      { table: 'bank_accounts', sequence: 'bank_accounts_id_seq' },
      { table: 'transactions', sequence: 'transactions_id_seq' },
      { table: 'receipts', sequence: 'receipts_id_seq' },
      { table: 'budgets', sequence: 'budgets_id_seq' },
      { table: 'budget_tracking', sequence: 'budget_tracking_id_seq' },
      { table: 'financial_insights', sequence: 'financial_insights_id_seq' },
    ];

    for (const { table, sequence } of sequences) {
      try {
        // Check if the sequence exists
        const seqCheck = await this.pool.query(
          "SELECT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = $1)",
          [sequence],
        );

        if (seqCheck.rows[0].exists) {
          await this.pool.query(
            `SELECT setval('${sequence}', COALESCE((SELECT MAX(id::bigint) FROM ${table}), 1))`,
          );
          console.log(`  ✓ Updated ${sequence}`);
        }
      } catch (error) {
        console.log(`  ⚠ Skipping ${sequence}: ${error.message}`);
      }
    }
  }

  // Verify import
  async verifyImport() {
    console.log('\nVerifying import...');

    const verification = {};

    for (const config of IMPORT_CONFIG.collections) {
      try {
        const result = await this.pool.query(`SELECT COUNT(*) FROM ${config.table}`);
        verification[config.name] = {
          table: config.table,
          count: parseInt(result.rows[0].count),
          expected: this.importStats.collections[config.name]?.imported || 0,
        };
      } catch (error) {
        verification[config.name] = {
          table: config.table,
          error: error.message,
        };
      }
    }

    console.log('\nImport Verification:');
    console.log('===================');

    for (const [collection, info] of Object.entries(verification)) {
      if (info.error) {
        console.log(`${collection}: ✗ Error - ${info.error}`);
      } else {
        const match = info.count === info.expected ? '✓' : '⚠';
        console.log(`${collection}: ${match} ${info.count} records (expected ${info.expected})`);
      }
    }

    return verification;
  }

  // Generate import report
  async generateReport(outputDir) {
    const reportPath = path.join(outputDir, 'import_report.json');
    const readmePath = path.join(outputDir, 'IMPORT_REPORT.md');

    this.importStats.endTime = Date.now();
    const duration = this.importStats.endTime - this.importStats.startTime;

    const report = {
      ...this.importStats,
      duration: duration,
      importDate: new Date().toISOString(),
      successRate:
        ((this.importStats.successfulImports / this.importStats.totalRecords) * 100).toFixed(2) +
        '%',
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    // Generate markdown report
    let markdown = `# PostgreSQL Import Report

**Import Date:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
**Duration:** ${(duration / 1000).toFixed(2)} seconds
**Total Records:** ${this.importStats.totalRecords.toLocaleString()}
**Successful Imports:** ${this.importStats.successfulImports.toLocaleString()}
**Failed Imports:** ${this.importStats.failedImports}
**Success Rate:** ${report.successRate}

## Collection Import Summary

| Collection | Table | Total | Imported | Failed | Batches |
|------------|-------|-------|----------|---------|---------|
`;

    for (const [collection, stats] of Object.entries(this.importStats.collections)) {
      const config = IMPORT_CONFIG.collections.find((c) => c.name === collection);
      markdown += `| ${collection} | ${config?.table || 'N/A'} | ${stats.total} | ${stats.imported} | ${stats.failed} | ${stats.batches} |\n`;
    }

    if (this.importStats.errors.length > 0) {
      markdown += '\n## Import Errors\n\n';
      markdown += '| Type | Details |\n';
      markdown += '|------|---------||\n';

      this.importStats.errors.slice(0, 20).forEach((error) => {
        if (error.collection) {
          markdown += `| Collection Error | ${error.collection}: ${error.error} |\n`;
        } else if (error.table) {
          markdown += `| Record Error | ${error.table} (${error.record}): ${error.error} |\n`;
        }
      });

      if (this.importStats.errors.length > 20) {
        markdown += `\n*... and ${this.importStats.errors.length - 20} more errors*\n`;
      }
    }

    markdown += '\n## Next Steps\n\n';
    markdown += '1. Review the import verification results\n';
    markdown += '2. Check for any failed imports in the error log\n';
    markdown += '3. Run data integrity checks\n';
    markdown += '4. Test application functionality with imported data\n';

    await fs.writeFile(readmePath, markdown, 'utf8');

    return report;
  }

  // Close database connection
  async close() {
    await this.pool.end();
  }
}

// Main import function
async function importToPostgreSQL(transformedDir, connectionString) {
  console.log('PostgreSQL Data Import');
  console.log('=====================\n');

  const importer = new DatabaseImporter(connectionString);

  try {
    // Test connection
    const connected = await importer.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    importer.importStats.startTime = Date.now();

    // Import collections in order
    for (const config of IMPORT_CONFIG.collections) {
      const dataPath = path.join(transformedDir, `${config.name}_transformed.json`);

      try {
        await fs.access(dataPath);
        await importer.importCollection(config, dataPath);
      } catch (error) {
        console.log(`Skipping ${config.name}: ${error.message}`);
      }
    }

    // Update sequences
    await importer.updateSequences();

    // Verify import
    await importer.verifyImport();

    // Generate report
    await importer.generateReport(transformedDir);

    console.log('\n\nImport Complete!');
    console.log('================');
    console.log(`Total records: ${importer.importStats.totalRecords}`);
    console.log(`Successful: ${importer.importStats.successfulImports}`);
    console.log(`Failed: ${importer.importStats.failedImports}`);
    console.log(`\nReport saved to: ${path.join(transformedDir, 'IMPORT_REPORT.md')}`);
  } catch (error) {
    console.error('\nImport failed:', error);
    throw error;
  } finally {
    await importer.close();
  }
}

// CLI interface
if (require.main === module) {
  const transformedDir = process.argv[2] || path.join(__dirname, '../firebase-transformed');
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://genesis@localhost:5432/taaxdog_development';

  console.log(`Transformed data directory: ${transformedDir}`);
  console.log(`Database: ${connectionString.split('@')[1]?.split('/')[0] || 'localhost'}\n`);

  importToPostgreSQL(transformedDir, connectionString)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  DatabaseImporter,
  importToPostgreSQL,
};
