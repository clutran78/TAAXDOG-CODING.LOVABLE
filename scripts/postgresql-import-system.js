const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const { format } = require('date-fns');

// Import configuration with dependency order
const IMPORT_ORDER = [
  {
    name: 'users',
    table: 'users',
    file: 'users_transformed.json',
    dependencies: [],
    uniqueFields: ['email'],
    requiredFields: ['email', 'name'],
  },
  {
    name: 'basiqUsers',
    table: 'basiq_users',
    file: 'basiqUsers_transformed.json',
    dependencies: ['users'],
    uniqueFields: ['basiq_user_id'],
    requiredFields: ['user_id', 'basiq_user_id'],
  },
  {
    name: 'bankAccounts',
    table: 'bank_accounts',
    file: 'bankAccounts_transformed.json',
    dependencies: ['basiqUsers'],
    uniqueFields: ['account_number', 'bsb'],
    requiredFields: ['basiq_user_id', 'account_name', 'bsb', 'account_number'],
  },
  {
    name: 'receipts',
    table: 'receipts',
    file: 'receipts_transformed.json',
    dependencies: ['users'],
    uniqueFields: [],
    requiredFields: ['user_id'],
  },
  {
    name: 'bankTransactions',
    table: 'bank_transactions',
    file: 'transactions_transformed.json',
    dependencies: ['bankAccounts', 'receipts'],
    uniqueFields: ['basiq_transaction_id'],
    requiredFields: ['bank_account_id', 'amount', 'date'],
  },
  {
    name: 'budgets',
    table: 'budgets',
    file: 'budgets_transformed.json',
    dependencies: ['users'],
    uniqueFields: [],
    requiredFields: ['user_id', 'name', 'monthly_budget'],
  },
  {
    name: 'budgetTracking',
    table: 'budget_tracking',
    file: 'budgetTracking_transformed.json',
    dependencies: ['budgets', 'users'],
    uniqueFields: [],
    requiredFields: ['budget_id', 'user_id', 'month', 'year'],
  },
  {
    name: 'financialInsights',
    table: 'financial_insights',
    file: 'financialInsights_transformed.json',
    dependencies: ['users'],
    uniqueFields: [],
    requiredFields: ['user_id', 'insight_type'],
  },
  {
    name: 'aiConversations',
    table: 'ai_conversations',
    file: 'aiConversations_transformed.json',
    dependencies: ['users'],
    uniqueFields: [],
    requiredFields: ['user_id'],
  },
  {
    name: 'aiUsageTracking',
    table: 'ai_usage_tracking',
    file: 'aiUsageTracking_transformed.json',
    dependencies: ['users'],
    uniqueFields: [],
    requiredFields: ['user_id', 'provider', 'model'],
  },
];

// Import configuration
const IMPORT_CONFIG = {
  batchSize: 1000,
  maxRetries: 3,
  retryDelay: 1000,
  parallelConnections: 5,
  connectionTimeout: 30000,
  statementTimeout: 60000,
  progressUpdateInterval: 100,
};

// Australian validators
const AustralianValidators = {
  validateBSB: (bsb) => {
    if (!bsb) return false;
    const cleaned = bsb.toString().replace(/[\s-]/g, '');
    return /^\d{6}$/.test(cleaned);
  },

  validatePhone: (phone) => {
    if (!phone) return true; // Optional field
    const cleaned = phone.toString().replace(/[\s\-\(\)]/g, '');
    return /^(\+)?61[0-9]\d{8}$/.test(cleaned) || /^04\d{8}$/.test(cleaned);
  },

  validateGST: (amount, gstAmount) => {
    if (!amount || !gstAmount) return true;
    const expectedGST = Math.round((amount / 11) * 100) / 100;
    return Math.abs(gstAmount - expectedGST) < 0.1;
  },
};

// Main importer class
class PostgreSQLImporter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      max: IMPORT_CONFIG.parallelConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: IMPORT_CONFIG.connectionTimeout,
      statement_timeout: IMPORT_CONFIG.statementTimeout,
    });

    this.importStats = {
      startTime: null,
      endTime: null,
      collections: {},
      totalRecords: 0,
      successfulImports: 0,
      failedImports: 0,
      duplicatesSkipped: 0,
      errors: [],
      validationErrors: [],
    };

    this.importedIds = new Map(); // Track imported IDs for validation
  }

  // Test database connection
  async testConnection() {
    console.log('Testing database connection...');
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW(), current_database(), current_user');
      const dbInfo = result.rows[0];
      console.log('✅ Connected to PostgreSQL');
      console.log(`   Database: ${dbInfo.current_database}`);
      console.log(`   User: ${dbInfo.current_user}`);
      console.log(`   Time: ${dbInfo.now}`);
      client.release();
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      if (error.message.includes('ENOTFOUND')) {
        console.error('   Check your hostname: the database host could not be found');
      } else if (error.message.includes('password authentication failed')) {
        console.error('   Check your username and password');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.error('   The specified database does not exist');
      }
      return false;
    }
  }

  // Validate record before import
  validateRecord(record, config) {
    const errors = [];

    // Check required fields
    for (const field of config.requiredFields) {
      if (record[field] === undefined || record[field] === null || record[field] === '') {
        errors.push({
          field,
          error: 'Required field is missing or empty',
          value: record[field],
        });
      }
    }

    // Australian-specific validations
    if (record.bsb && !AustralianValidators.validateBSB(record.bsb)) {
      errors.push({
        field: 'bsb',
        error: 'Invalid BSB format (must be 6 digits)',
        value: record.bsb,
      });
    }

    if (record.phone && !AustralianValidators.validatePhone(record.phone)) {
      errors.push({
        field: 'phone',
        error: 'Invalid Australian phone number format',
        value: record.phone,
      });
    }

    if (record.total_amount && record.gst_amount) {
      if (!AustralianValidators.validateGST(record.total_amount, record.gst_amount)) {
        errors.push({
          field: 'gst_amount',
          error: 'GST amount does not match expected 10% calculation',
          value: record.gst_amount,
          expected: Math.round((record.total_amount / 11) * 100) / 100,
        });
      }
    }

    // Validate foreign key references
    if (record.user_id && !this.importedIds.get('users')?.has(record.user_id)) {
      errors.push({
        field: 'user_id',
        error: 'Referenced user does not exist',
        value: record.user_id,
      });
    }

    if (record.basiq_user_id && !this.importedIds.get('basiqUsers')?.has(record.basiq_user_id)) {
      errors.push({
        field: 'basiq_user_id',
        error: 'Referenced BASIQ user does not exist',
        value: record.basiq_user_id,
      });
    }

    if (
      record.bank_account_id &&
      !this.importedIds.get('bankAccounts')?.has(record.bank_account_id)
    ) {
      errors.push({
        field: 'bank_account_id',
        error: 'Referenced bank account does not exist',
        value: record.bank_account_id,
      });
    }

    if (record.budget_id && !this.importedIds.get('budgets')?.has(record.budget_id)) {
      errors.push({
        field: 'budget_id',
        error: 'Referenced budget does not exist',
        value: record.budget_id,
      });
    }

    return errors;
  }

  // Check for duplicates
  async checkDuplicates(client, tableName, record, uniqueFields) {
    if (uniqueFields.length === 0) return false;

    const conditions = uniqueFields.map((field, index) => `${field} = $${index + 1}`);
    const values = uniqueFields.map((field) => record[field]);

    const query = `SELECT id FROM ${tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`;

    try {
      const result = await client.query(query, values);
      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error checking duplicates: ${error.message}`);
      return false;
    }
  }

  // Build insert query with ON CONFLICT handling
  buildInsertQuery(tableName, records, columns) {
    const columnNames = Object.keys(records[0]).filter((key) =>
      columns.some((col) => col.column_name === key),
    );

    const valuePlaceholders = [];
    const values = [];
    let paramIndex = 1;

    records.forEach((record) => {
      const recordPlaceholders = [];
      columnNames.forEach((column) => {
        recordPlaceholders.push(`$${paramIndex++}`);
        values.push(record[column] !== undefined ? record[column] : null);
      });
      valuePlaceholders.push(`(${recordPlaceholders.join(', ')})`);
    });

    const query = `
      INSERT INTO ${tableName} (${columnNames.join(', ')})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
      ${columnNames
        .filter((col) => col !== 'id' && col !== 'created_at')
        .map((col) => `${col} = EXCLUDED.${col}`)
        .join(', ')}
      RETURNING id
    `;

    return { query, values, columnNames };
  }

  // Import batch with transaction
  async importBatch(client, tableName, records, columns, config) {
    const results = {
      successful: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    try {
      await client.query('BEGIN');

      // Validate all records first
      const validRecords = [];
      for (const record of records) {
        const validationErrors = this.validateRecord(record, config);

        if (validationErrors.length > 0) {
          results.failed++;
          results.errors.push({
            record: record.id,
            validationErrors,
          });
          continue;
        }

        // Check for duplicates
        const isDuplicate = await this.checkDuplicates(
          client,
          tableName,
          record,
          config.uniqueFields,
        );
        if (isDuplicate) {
          results.duplicates++;
          continue;
        }

        validRecords.push(record);
      }

      if (validRecords.length > 0) {
        // Batch insert valid records
        const { query, values } = this.buildInsertQuery(tableName, validRecords, columns);
        const insertResult = await client.query(query, values);

        results.successful = insertResult.rowCount;

        // Track imported IDs
        if (!this.importedIds.has(config.name)) {
          this.importedIds.set(config.name, new Set());
        }
        insertResult.rows.forEach((row) => {
          this.importedIds.get(config.name).add(row.id);
        });
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');

      // Try individual inserts on batch failure
      for (const record of records) {
        try {
          await client.query('BEGIN');

          const validationErrors = this.validateRecord(record, config);
          if (validationErrors.length > 0) {
            results.failed++;
            results.errors.push({
              record: record.id,
              validationErrors,
            });
            await client.query('ROLLBACK');
            continue;
          }

          const { query, values } = this.buildInsertQuery(tableName, [record], columns);
          const result = await client.query(query, values);

          if (result.rowCount > 0) {
            results.successful++;
            if (!this.importedIds.has(config.name)) {
              this.importedIds.set(config.name, new Set());
            }
            this.importedIds.get(config.name).add(result.rows[0].id);
          }

          await client.query('COMMIT');
        } catch (individualError) {
          await client.query('ROLLBACK');
          results.failed++;
          results.errors.push({
            record: record.id,
            error: individualError.message,
          });
        }
      }
    }

    return results;
  }

  // Get table columns
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

  // Import collection with progress tracking
  async importCollection(config, dataPath) {
    console.log(`\n🔄 Importing ${config.name} into ${config.table}...`);

    const startTime = Date.now();
    const stats = {
      total: 0,
      successful: 0,
      failed: 0,
      duplicates: 0,
      batches: 0,
      errors: [],
    };

    try {
      // Load data
      const records = JSON.parse(await fs.readFile(dataPath, 'utf8'));
      stats.total = records.length;

      if (records.length === 0) {
        console.log('   No records to import');
        return stats;
      }

      console.log(`   Found ${records.length} records to import`);

      // Get table schema
      const columns = await this.getTableColumns(config.table);
      if (columns.length === 0) {
        throw new Error(`Table ${config.table} not found or has no columns`);
      }

      // Create client for this import
      const client = await this.pool.connect();

      try {
        // Process in batches
        for (let i = 0; i < records.length; i += IMPORT_CONFIG.batchSize) {
          const batch = records.slice(i, Math.min(i + IMPORT_CONFIG.batchSize, records.length));
          stats.batches++;

          const batchResults = await this.importBatch(client, config.table, batch, columns, config);

          stats.successful += batchResults.successful;
          stats.failed += batchResults.failed;
          stats.duplicates += batchResults.duplicates;
          stats.errors.push(...batchResults.errors);

          // Progress update
          if (
            i % (IMPORT_CONFIG.progressUpdateInterval * IMPORT_CONFIG.batchSize) === 0 ||
            i + IMPORT_CONFIG.batchSize >= records.length
          ) {
            const progress = Math.round(((i + batch.length) / records.length) * 100);
            console.log(
              `   Progress: ${progress}% (✓ ${stats.successful} | ✗ ${stats.failed} | ⚡ ${stats.duplicates} duplicates)`,
            );
          }
        }
      } finally {
        client.release();
      }

      const duration = Date.now() - startTime;
      console.log(`   ✅ Completed in ${(duration / 1000).toFixed(2)}s`);
      console.log(
        `   📊 Results: ${stats.successful} imported, ${stats.failed} failed, ${stats.duplicates} duplicates skipped`,
      );
    } catch (error) {
      console.error(`   ❌ Error importing ${config.name}:`, error.message);
      stats.errors.push({ general: error.message });
    }

    this.importStats.collections[config.name] = stats;
    this.importStats.totalRecords += stats.total;
    this.importStats.successfulImports += stats.successful;
    this.importStats.failedImports += stats.failed;
    this.importStats.duplicatesSkipped += stats.duplicates;

    return stats;
  }

  // Verify imported data
  async verifyImportedData() {
    console.log('\n🔍 Verifying imported data...');

    const verification = {
      recordCounts: {},
      foreignKeyIntegrity: {},
      dataIntegrity: [],
    };

    // Check record counts
    for (const config of IMPORT_ORDER) {
      try {
        const result = await this.pool.query(`SELECT COUNT(*) FROM ${config.table}`);
        const dbCount = parseInt(result.rows[0].count);
        const importedCount = this.importStats.collections[config.name]?.successful || 0;

        verification.recordCounts[config.name] = {
          table: config.table,
          databaseCount: dbCount,
          importedCount: importedCount,
          match: dbCount >= importedCount, // >= because table might have existing data
        };
      } catch (error) {
        verification.recordCounts[config.name] = {
          error: error.message,
        };
      }
    }

    // Check foreign key integrity
    const fkChecks = [
      {
        name: 'bankAccounts->basiqUsers',
        query: `
          SELECT COUNT(*) as orphaned 
          FROM bank_accounts ba 
          LEFT JOIN basiq_users bu ON ba.basiq_user_id = bu.id 
          WHERE ba.basiq_user_id IS NOT NULL AND bu.id IS NULL
        `,
      },
      {
        name: 'transactions->bankAccounts',
        query: `
          SELECT COUNT(*) as orphaned 
          FROM bank_transactions bt 
          LEFT JOIN bank_accounts ba ON bt.bank_account_id = ba.id 
          WHERE bt.bank_account_id IS NOT NULL AND ba.id IS NULL
        `,
      },
      {
        name: 'budgetTracking->budgets',
        query: `
          SELECT COUNT(*) as orphaned 
          FROM budget_tracking bt 
          LEFT JOIN budgets b ON bt.budget_id = b.id 
          WHERE bt.budget_id IS NOT NULL AND b.id IS NULL
        `,
      },
    ];

    for (const check of fkChecks) {
      try {
        const result = await this.pool.query(check.query);
        const orphaned = parseInt(result.rows[0].orphaned);
        verification.foreignKeyIntegrity[check.name] = {
          orphanedRecords: orphaned,
          valid: orphaned === 0,
        };
      } catch (error) {
        verification.foreignKeyIntegrity[check.name] = {
          error: error.message,
        };
      }
    }

    // Check data integrity
    const integrityChecks = [
      {
        name: 'Unique emails',
        query: 'SELECT email, COUNT(*) as count FROM users GROUP BY email HAVING COUNT(*) > 1',
      },
      {
        name: 'Valid BSB format',
        query: `SELECT COUNT(*) as invalid FROM bank_accounts WHERE bsb !~ '^[0-9]{3}-[0-9]{3}$'`,
      },
      {
        name: 'GST calculations',
        query: `
          SELECT COUNT(*) as invalid 
          FROM receipts 
          WHERE gst_amount > 0 
          AND ABS(gst_amount - (total_amount / 11)) > 0.1
        `,
      },
    ];

    for (const check of integrityChecks) {
      try {
        const result = await this.pool.query(check.query);
        const isValid =
          result.rows.length === 0 ||
          (result.rows[0].invalid !== undefined && parseInt(result.rows[0].invalid) === 0);

        verification.dataIntegrity.push({
          name: check.name,
          valid: isValid,
          details: result.rows,
        });
      } catch (error) {
        verification.dataIntegrity.push({
          name: check.name,
          error: error.message,
        });
      }
    }

    return verification;
  }

  // Generate import report
  async generateReport(outputDir) {
    const reportPath = path.join(outputDir, 'postgresql_import_report.json');
    const readmePath = path.join(outputDir, 'POSTGRESQL_IMPORT_REPORT.md');

    this.importStats.endTime = Date.now();
    const duration = this.importStats.endTime - this.importStats.startTime;

    // Verify imported data
    const verification = await this.verifyImportedData();

    const report = {
      ...this.importStats,
      duration,
      verification,
      importDate: new Date().toISOString(),
      successRate:
        this.importStats.totalRecords > 0
          ? ((this.importStats.successfulImports / this.importStats.totalRecords) * 100).toFixed(
              2,
            ) + '%'
          : '0%',
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    // Generate markdown report
    let markdown = `# PostgreSQL Import Report

**Import Date:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
**Duration:** ${(duration / 1000).toFixed(2)} seconds
**Database:** ${this.connectionString.split('@')[1]?.split('/')[0] || 'PostgreSQL'}

## Summary

- **Total Records:** ${this.importStats.totalRecords.toLocaleString()}
- **✅ Successful:** ${this.importStats.successfulImports.toLocaleString()}
- **❌ Failed:** ${this.importStats.failedImports}
- **⚡ Duplicates Skipped:** ${this.importStats.duplicatesSkipped}
- **Success Rate:** ${report.successRate}

## Import Details by Collection

| Collection | Table | Total | Imported | Failed | Duplicates | Batches |
|------------|-------|-------|----------|---------|------------|---------|
`;

    for (const config of IMPORT_ORDER) {
      const stats = this.importStats.collections[config.name] || {};
      markdown += `| ${config.name} | ${config.table} | ${stats.total || 0} | ${stats.successful || 0} | ${stats.failed || 0} | ${stats.duplicates || 0} | ${stats.batches || 0} |\n`;
    }

    // Verification section
    markdown += '\n## Data Verification\n\n### Record Counts\n\n';
    markdown += '| Collection | Database Count | Imported Count | Status |\n';
    markdown += '|------------|----------------|----------------|--------|\n';

    for (const [name, info] of Object.entries(verification.recordCounts)) {
      if (info.error) {
        markdown += `| ${name} | Error | - | ❌ ${info.error} |\n`;
      } else {
        const status = info.match ? '✅' : '⚠️';
        markdown += `| ${name} | ${info.databaseCount} | ${info.importedCount} | ${status} |\n`;
      }
    }

    markdown += '\n### Foreign Key Integrity\n\n';
    markdown += '| Relationship | Orphaned Records | Status |\n';
    markdown += '|--------------|------------------|--------|\n';

    for (const [name, info] of Object.entries(verification.foreignKeyIntegrity)) {
      if (info.error) {
        markdown += `| ${name} | Error | ❌ ${info.error} |\n`;
      } else {
        const status = info.valid ? '✅ Valid' : '❌ Invalid';
        markdown += `| ${name} | ${info.orphanedRecords} | ${status} |\n`;
      }
    }

    markdown += '\n### Data Integrity Checks\n\n';
    for (const check of verification.dataIntegrity) {
      if (check.error) {
        markdown += `- **${check.name}:** ❌ Error - ${check.error}\n`;
      } else {
        const status = check.valid ? '✅' : '❌';
        markdown += `- **${check.name}:** ${status} ${check.valid ? 'Passed' : 'Failed'}\n`;
        if (!check.valid && check.details.length > 0) {
          markdown += `  Details: ${JSON.stringify(check.details[0])}\n`;
        }
      }
    }

    // Errors section
    if (
      this.importStats.errors.length > 0 ||
      Object.values(this.importStats.collections).some((c) => c.errors?.length > 0)
    ) {
      markdown += '\n## Import Errors\n\n';

      for (const [collection, stats] of Object.entries(this.importStats.collections)) {
        if (stats.errors && stats.errors.length > 0) {
          markdown += `### ${collection}\n\n`;
          stats.errors.slice(0, 10).forEach((error) => {
            if (error.record) {
              markdown += `- Record ${error.record}:\n`;
              if (error.validationErrors) {
                error.validationErrors.forEach((ve) => {
                  markdown += `  - ${ve.field}: ${ve.error} (value: ${ve.value})\n`;
                });
              } else if (error.error) {
                markdown += `  - ${error.error}\n`;
              }
            } else if (error.general) {
              markdown += `- General error: ${error.general}\n`;
            }
          });

          if (stats.errors.length > 10) {
            markdown += `\n*... and ${stats.errors.length - 10} more errors*\n`;
          }
        }
      }
    }

    markdown += `
## Recommendations

${report.successRate === '100%' ? '✅ All records imported successfully!' : ''}
${this.importStats.failedImports > 0 ? '1. **Review Failed Records:** Check the error details above and fix data issues' : ''}
${this.importStats.duplicatesSkipped > 0 ? '2. **Duplicate Records:** Review skipped duplicates to ensure data consistency' : ''}
${Object.values(verification.foreignKeyIntegrity).some((v) => !v.valid) ? '3. **Fix Orphaned Records:** Resolve foreign key constraint violations' : ''}
${verification.dataIntegrity.some((v) => !v.valid) ? '4. **Data Integrity:** Address data integrity issues identified above' : ''}

## Next Steps

1. Review this report for any issues
2. Run application tests to verify functionality
3. Create a database backup
4. Monitor application performance
`;

    await fs.writeFile(readmePath, markdown, 'utf8');

    console.log(`\n📄 Reports generated:`);
    console.log(`   - ${reportPath}`);
    console.log(`   - ${readmePath}`);

    return report;
  }

  // Close database connection
  async close() {
    await this.pool.end();
  }
}

// Main import function
async function importToPostgreSQL(dataDir, connectionString) {
  console.log('🚀 PostgreSQL Data Import System');
  console.log('================================\n');

  const importer = new PostgreSQLImporter(connectionString);

  try {
    // Test connection
    const connected = await importer.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    importer.importStats.startTime = Date.now();

    // Import collections in dependency order
    console.log('\n📦 Starting import process...');
    console.log('Following dependency order to maintain referential integrity\n');

    for (const config of IMPORT_ORDER) {
      const dataPath = path.join(dataDir, config.file);

      // Check if dependencies are satisfied
      if (config.dependencies.length > 0) {
        const unsatisfied = config.dependencies.filter(
          (dep) =>
            !importer.importStats.collections[dep] ||
            importer.importStats.collections[dep].successful === 0,
        );

        if (unsatisfied.length > 0) {
          console.log(
            `\n⚠️  Skipping ${config.name}: Missing dependencies [${unsatisfied.join(', ')}]`,
          );
          continue;
        }
      }

      try {
        await fs.access(dataPath);
        await importer.importCollection(config, dataPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log(`\n⚠️  Skipping ${config.name}: File not found (${config.file})`);
        } else {
          console.error(`\n❌ Error with ${config.name}:`, error.message);
        }
      }
    }

    // Generate report
    console.log('\n📊 Generating import report...');
    await importer.generateReport(dataDir);

    // Final summary
    console.log('\n✨ Import Complete!');
    console.log('==================');
    console.log(
      `Total time: ${((Date.now() - importer.importStats.startTime) / 1000).toFixed(2)}s`,
    );
    console.log(`Records processed: ${importer.importStats.totalRecords.toLocaleString()}`);
    console.log(`✅ Successful: ${importer.importStats.successfulImports.toLocaleString()}`);
    console.log(`❌ Failed: ${importer.importStats.failedImports}`);
    console.log(`⚡ Duplicates: ${importer.importStats.duplicatesSkipped}`);
  } catch (error) {
    console.error('\n💥 Import failed:', error);
    throw error;
  } finally {
    await importer.close();
  }
}

// CLI interface
if (require.main === module) {
  const dataDir = process.argv[2] || path.join(__dirname, '../firebase-transformed');
  const connectionString = process.argv[3] || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('Please provide connection string as argument or set DATABASE_URL');
    console.log('\nUsage:');
    console.log('  node postgresql-import-system.js [data-dir] [connection-string]');
    console.log('  DATABASE_URL=... node postgresql-import-system.js');
    process.exit(1);
  }

  console.log(`Data directory: ${dataDir}`);
  console.log(`Connecting to: ${connectionString.split('@')[1]?.split('/')[0] || 'database'}\n`);

  importToPostgreSQL(dataDir, connectionString)
    .then(() => {
      console.log('\n✅ Import process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Import process failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  PostgreSQLImporter,
  importToPostgreSQL,
  IMPORT_ORDER,
};
