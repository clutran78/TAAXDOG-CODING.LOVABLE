const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');

// Validation configuration
const VALIDATION_CONFIG = {
  // Collection to table mapping
  collectionMapping: {
    users: 'users',
    basiqUsers: 'basiq_users',
    bankAccounts: 'bank_accounts',
    receipts: 'receipts',
    transactions: 'bank_transactions',
    budgets: 'budgets',
    budgetTracking: 'budget_tracking',
    financialInsights: 'financial_insights',
    aiConversations: 'ai_conversations',
    aiUsageTracking: 'ai_usage_tracking'
  },
  
  // Sampling configuration
  sampleSize: 100, // Number of records to sample for detailed comparison
  
  // Performance test configuration
  performanceTests: {
    queryTimeout: 5000, // 5 seconds
    concurrentConnections: 10
  },
  
  // Tolerance levels
  tolerances: {
    amountPrecision: 0.01, // Allow 1 cent difference
    timestampDiff: 1000, // Allow 1 second difference
    gstTolerance: 0.01 // Allow 1 cent GST difference
  }
};

// Australian validators
const AustralianValidators = {
  validateBSB: (bsb) => {
    if (!bsb) return { valid: false, error: 'BSB is missing' };
    const pattern = /^\d{3}-\d{3}$/;
    return {
      valid: pattern.test(bsb),
      error: pattern.test(bsb) ? null : `Invalid BSB format: ${bsb} (expected XXX-XXX)`
    };
  },

  validatePhone: (phone) => {
    if (!phone) return { valid: true }; // Optional
    const patterns = [
      /^\+61[0-9]\d{8}$/,  // International format
      /^04\d{8}$/,         // Mobile format
      /^0[2-9]\d{8}$/      // Landline format
    ];
    const valid = patterns.some(p => p.test(phone.replace(/[\s-]/g, '')));
    return {
      valid,
      error: valid ? null : `Invalid Australian phone format: ${phone}`
    };
  },

  validateGST: (totalAmount, gstAmount) => {
    if (!totalAmount || totalAmount === 0) return { valid: true };
    const expectedGST = Math.round(totalAmount / 11 * 100) / 100;
    const difference = Math.abs(gstAmount - expectedGST);
    return {
      valid: difference <= VALIDATION_CONFIG.tolerances.gstTolerance,
      error: difference > VALIDATION_CONFIG.tolerances.gstTolerance 
        ? `GST mismatch: got ${gstAmount}, expected ${expectedGST} (diff: ${difference})`
        : null,
      expectedGST,
      actualGST: gstAmount,
      difference
    };
  },

  validateATOCategory: (category) => {
    const validCategories = [
      'INCOME', 'BUSINESS_EXPENSE', 'PERSONAL', 'INVESTMENT',
      'GST_PAYABLE', 'GST_RECEIVABLE', 'CAPITAL', 'DEPRECIATION',
      'DEDUCTIBLE', 'NON_DEDUCTIBLE', 'UNCATEGORIZED'
    ];
    return {
      valid: validCategories.includes(category),
      error: validCategories.includes(category) 
        ? null 
        : `Invalid ATO category: ${category}`
    };
  }
};

// Main validator class
class MigrationValidator {
  constructor(firebaseDir, postgresConfig) {
    this.firebaseDir = firebaseDir;
    this.postgresPool = new Pool({
      connectionString: postgresConfig.connectionString || postgresConfig,
      ssl: postgresConfig.connectionString?.includes('sslmode=require') 
        ? { rejectUnauthorized: false } 
        : false
    });
    
    this.validationResults = {
      timestamp: new Date().toISOString(),
      summary: {
        totalCollections: 0,
        passedCollections: 0,
        failedCollections: 0,
        totalIssues: 0,
        criticalIssues: 0
      },
      recordCounts: {},
      relationships: {},
      dataIntegrity: {},
      australianCompliance: {},
      performance: {},
      issues: []
    };
  }

  // Main validation method
  async validate() {
    console.log('🔍 Firebase to PostgreSQL Migration Validator');
    console.log('===========================================\n');

    try {
      // Test PostgreSQL connection
      await this.testDatabaseConnection();

      // 1. Record count validation
      await this.validateRecordCounts();

      // 2. Relationship validation
      await this.validateRelationships();

      // 3. Data integrity validation
      await this.validateDataIntegrity();

      // 4. Australian compliance validation
      await this.validateAustralianCompliance();

      // 5. Table-specific validations
      await this.validateTableSpecific();

      // 6. Performance validation
      await this.validatePerformance();

      // Generate summary
      this.generateSummary();

      return this.validationResults;

    } catch (error) {
      console.error('❌ Validation failed:', error);
      throw error;
    }
  }

  // Test database connection
  async testDatabaseConnection() {
    try {
      const result = await this.postgresPool.query('SELECT NOW(), current_database()');
      console.log('✅ Connected to PostgreSQL:', result.rows[0].current_database);
      return true;
    } catch (error) {
      this.addIssue('DATABASE_CONNECTION', 'Failed to connect to PostgreSQL', 'critical', error.message);
      throw new Error('Database connection failed');
    }
  }

  // 1. Record count validation
  async validateRecordCounts() {
    console.log('\n📊 Validating record counts...');
    
    for (const [collection, tableName] of Object.entries(VALIDATION_CONFIG.collectionMapping)) {
      try {
        // Get Firebase count
        const firebasePath = path.join(this.firebaseDir, `${collection}.json`);
        let firebaseCount = 0;
        try {
          const firebaseData = JSON.parse(await fs.readFile(firebasePath, 'utf8'));
          firebaseCount = firebaseData.length;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }

        // Get PostgreSQL count
        const pgResult = await this.postgresPool.query(`SELECT COUNT(*) FROM ${tableName}`);
        const pgCount = parseInt(pgResult.rows[0].count);

        // Check for duplicates
        const duplicateQuery = `
          SELECT COUNT(*) as total, COUNT(DISTINCT id) as unique_count 
          FROM ${tableName}
        `;
        const duplicateResult = await this.postgresPool.query(duplicateQuery);
        const hasDuplicates = duplicateResult.rows[0].total !== duplicateResult.rows[0].unique_count;

        const validation = {
          collection,
          tableName,
          firebaseCount,
          postgresCount: pgCount,
          difference: pgCount - firebaseCount,
          match: firebaseCount === pgCount,
          hasDuplicates,
          status: firebaseCount === pgCount ? '✅' : '❌'
        };

        this.validationResults.recordCounts[collection] = validation;

        if (!validation.match) {
          this.addIssue(
            'RECORD_COUNT_MISMATCH',
            `${collection}: Firebase has ${firebaseCount} records, PostgreSQL has ${pgCount}`,
            'high',
            { collection, difference: validation.difference }
          );
        }

        if (hasDuplicates) {
          this.addIssue(
            'DUPLICATE_RECORDS',
            `${tableName} contains duplicate records`,
            'medium',
            { tableName }
          );
        }

        console.log(`   ${validation.status} ${collection}: ${firebaseCount} → ${pgCount} records`);

      } catch (error) {
        console.error(`   ❌ Error validating ${collection}:`, error.message);
        this.addIssue(
          'VALIDATION_ERROR',
          `Failed to validate ${collection}`,
          'medium',
          error.message
        );
      }
    }
  }

  // 2. Relationship validation
  async validateRelationships() {
    console.log('\n🔗 Validating relationships...');

    const relationships = [
      {
        name: 'Users → Bank Accounts',
        query: `
          SELECT COUNT(*) as orphaned 
          FROM bank_accounts ba 
          LEFT JOIN users u ON ba.user_id = u.id 
          WHERE ba.user_id IS NOT NULL AND u.id IS NULL
        `
      },
      {
        name: 'Bank Accounts → BASIQ Users',
        query: `
          SELECT COUNT(*) as orphaned 
          FROM bank_accounts ba 
          LEFT JOIN basiq_users bu ON ba.basiq_user_id = bu.id 
          WHERE ba.basiq_user_id IS NOT NULL AND bu.id IS NULL
        `
      },
      {
        name: 'Transactions → Bank Accounts',
        query: `
          SELECT COUNT(*) as orphaned 
          FROM bank_transactions bt 
          LEFT JOIN bank_accounts ba ON bt.bank_account_id = ba.id 
          WHERE bt.bank_account_id IS NOT NULL AND ba.id IS NULL
        `
      },
      {
        name: 'Transactions → Receipts',
        query: `
          SELECT COUNT(*) as orphaned 
          FROM bank_transactions bt 
          LEFT JOIN receipts r ON bt.receipt_id = r.id 
          WHERE bt.receipt_id IS NOT NULL AND r.id IS NULL
        `
      },
      {
        name: 'Budget Tracking → Budgets',
        query: `
          SELECT COUNT(*) as orphaned 
          FROM budget_tracking bt 
          LEFT JOIN budgets b ON bt.budget_id = b.id 
          WHERE bt.budget_id IS NOT NULL AND b.id IS NULL
        `
      },
      {
        name: 'Financial Insights → Users',
        query: `
          SELECT COUNT(*) as orphaned 
          FROM financial_insights fi 
          LEFT JOIN users u ON fi.user_id = u.id 
          WHERE fi.user_id IS NOT NULL AND u.id IS NULL
        `
      }
    ];

    for (const rel of relationships) {
      try {
        const result = await this.postgresPool.query(rel.query);
        const orphaned = parseInt(result.rows[0].orphaned);
        
        const validation = {
          relationship: rel.name,
          orphanedRecords: orphaned,
          valid: orphaned === 0,
          status: orphaned === 0 ? '✅' : '❌'
        };

        this.validationResults.relationships[rel.name] = validation;

        if (orphaned > 0) {
          this.addIssue(
            'ORPHANED_RECORDS',
            `${rel.name} has ${orphaned} orphaned records`,
            'high',
            { relationship: rel.name, count: orphaned }
          );
        }

        console.log(`   ${validation.status} ${rel.name}: ${orphaned} orphaned records`);

      } catch (error) {
        console.error(`   ❌ Error checking ${rel.name}:`, error.message);
      }
    }
  }

  // 3. Data integrity validation
  async validateDataIntegrity() {
    console.log('\n🔐 Validating data integrity...');

    // Sample records for detailed comparison
    const collections = ['users', 'bankAccounts', 'transactions', 'receipts', 'budgets'];
    
    for (const collection of collections) {
      try {
        const firebasePath = path.join(this.firebaseDir, `${collection}.json`);
        const tableName = VALIDATION_CONFIG.collectionMapping[collection];
        
        // Load Firebase data
        let firebaseData = [];
        try {
          firebaseData = JSON.parse(await fs.readFile(firebasePath, 'utf8'));
        } catch (error) {
          continue;
        }

        // Sample records
        const sampleSize = Math.min(VALIDATION_CONFIG.sampleSize, firebaseData.length);
        const sampleIndices = this.getRandomSample(firebaseData.length, sampleSize);
        
        const integrityIssues = [];

        for (const index of sampleIndices) {
          const firebaseRecord = firebaseData[index];
          const firebaseId = firebaseRecord._firebaseId || firebaseRecord.id;
          
          // Get corresponding PostgreSQL record
          const pgResult = await this.postgresPool.query(
            `SELECT * FROM ${tableName} WHERE id = $1`,
            [this.mapFirebaseIdToPostgres(firebaseId, collection)]
          );

          if (pgResult.rows.length === 0) {
            integrityIssues.push({
              type: 'MISSING_RECORD',
              firebaseId,
              message: 'Record exists in Firebase but not in PostgreSQL'
            });
            continue;
          }

          const pgRecord = pgResult.rows[0];
          
          // Compare fields
          const fieldIssues = this.compareRecords(firebaseRecord, pgRecord, collection);
          if (fieldIssues.length > 0) {
            integrityIssues.push({
              type: 'FIELD_MISMATCH',
              firebaseId,
              issues: fieldIssues
            });
          }
        }

        this.validationResults.dataIntegrity[collection] = {
          samplesChecked: sampleSize,
          issuesFound: integrityIssues.length,
          issues: integrityIssues,
          status: integrityIssues.length === 0 ? '✅' : '⚠️'
        };

        console.log(`   ${integrityIssues.length === 0 ? '✅' : '⚠️'} ${collection}: ${sampleSize} samples checked, ${integrityIssues.length} issues found`);

      } catch (error) {
        console.error(`   ❌ Error validating ${collection}:`, error.message);
      }
    }
  }

  // 4. Australian compliance validation
  async validateAustralianCompliance() {
    console.log('\n🇦🇺 Validating Australian compliance...');

    const complianceChecks = {
      bsbFormat: {
        query: `SELECT COUNT(*) as invalid FROM bank_accounts WHERE bsb !~ '^[0-9]{3}-[0-9]{3}$'`,
        description: 'BSB format (XXX-XXX)'
      },
      phoneFormat: {
        query: `
          SELECT COUNT(*) as invalid 
          FROM users 
          WHERE phone IS NOT NULL 
          AND phone !~ '^\\+61[0-9]{9}$'
        `,
        description: 'Phone number format (+61XXXXXXXXX)'
      },
      gstCalculations: {
        query: `
          SELECT COUNT(*) as invalid 
          FROM receipts 
          WHERE total_amount > 0 
          AND gst_amount > 0
          AND ABS(gst_amount - (total_amount / 11)) > 0.01
        `,
        description: 'GST calculations (10%)'
      },
      atoCategories: {
        query: `
          SELECT COUNT(*) as invalid 
          FROM bank_transactions 
          WHERE tax_category NOT IN (
            'INCOME', 'BUSINESS_EXPENSE', 'PERSONAL', 'INVESTMENT',
            'GST_PAYABLE', 'GST_RECEIVABLE', 'CAPITAL', 'DEPRECIATION',
            'DEDUCTIBLE', 'NON_DEDUCTIBLE', 'UNCATEGORIZED'
          )
        `,
        description: 'ATO tax categories'
      },
      currencyPrecision: {
        query: `
          SELECT COUNT(*) as invalid 
          FROM (
            SELECT id FROM bank_transactions WHERE amount::text !~ '^-?[0-9]+\\.[0-9]{2}$'
            UNION ALL
            SELECT id FROM receipts WHERE total_amount::text !~ '^[0-9]+\\.[0-9]{2}$'
            UNION ALL
            SELECT id FROM budgets WHERE monthly_budget::text !~ '^[0-9]+\\.[0-9]{2}$'
          ) as amounts
        `,
        description: 'Currency precision (2 decimal places)'
      }
    };

    for (const [check, config] of Object.entries(complianceChecks)) {
      try {
        const result = await this.postgresPool.query(config.query);
        const invalidCount = parseInt(result.rows[0].invalid);
        
        const validation = {
          check: config.description,
          invalidRecords: invalidCount,
          valid: invalidCount === 0,
          status: invalidCount === 0 ? '✅' : '❌'
        };

        this.validationResults.australianCompliance[check] = validation;

        if (invalidCount > 0) {
          this.addIssue(
            'COMPLIANCE_VIOLATION',
            `${config.description}: ${invalidCount} invalid records`,
            'medium',
            { check, count: invalidCount }
          );
        }

        console.log(`   ${validation.status} ${config.description}: ${invalidCount} invalid records`);

      } catch (error) {
        console.error(`   ❌ Error checking ${check}:`, error.message);
      }
    }
  }

  // 5. Table-specific validations
  async validateTableSpecific() {
    console.log('\n📋 Performing table-specific validations...');

    // Users table
    await this.validateUsersTable();
    
    // Bank accounts table
    await this.validateBankAccountsTable();
    
    // Transactions table
    await this.validateTransactionsTable();
    
    // Receipts table
    await this.validateReceiptsTable();
    
    // Budgets and tracking tables
    await this.validateBudgetTables();
    
    // Financial insights table
    await this.validateFinancialInsightsTable();
  }

  async validateUsersTable() {
    console.log('\n   👤 Validating Users table...');

    const checks = [
      {
        name: 'Email uniqueness',
        query: 'SELECT email, COUNT(*) as count FROM users GROUP BY email HAVING COUNT(*) > 1'
      },
      {
        name: 'Required fields',
        query: `SELECT COUNT(*) as missing FROM users WHERE email IS NULL OR name IS NULL`
      },
      {
        name: 'Email format',
        query: `SELECT COUNT(*) as invalid FROM users WHERE email !~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'`
      }
    ];

    for (const check of checks) {
      try {
        const result = await this.postgresPool.query(check.query);
        const hasIssues = result.rows.length > 0 && 
          (result.rows[0].count > 1 || result.rows[0].missing > 0 || result.rows[0].invalid > 0);
        
        if (hasIssues) {
          this.addIssue(
            'USER_VALIDATION',
            `Users table: ${check.name} failed`,
            'medium',
            result.rows[0]
          );
        }
        
        console.log(`      ${hasIssues ? '❌' : '✅'} ${check.name}`);
      } catch (error) {
        console.error(`      ❌ Error checking ${check.name}:`, error.message);
      }
    }
  }

  async validateBankAccountsTable() {
    console.log('\n   🏦 Validating Bank Accounts table...');

    const checks = [
      {
        name: 'BSB format',
        query: `SELECT COUNT(*) as invalid FROM bank_accounts WHERE bsb !~ '^[0-9]{3}-[0-9]{3}$'`
      },
      {
        name: 'Account number format',
        query: `SELECT COUNT(*) as invalid FROM bank_accounts WHERE account_number !~ '^[0-9]{6,10}$'`
      },
      {
        name: 'Balance precision',
        query: `SELECT COUNT(*) as invalid FROM bank_accounts WHERE balance::numeric % 0.01 != 0`
      }
    ];

    for (const check of checks) {
      try {
        const result = await this.postgresPool.query(check.query);
        const invalidCount = parseInt(result.rows[0].invalid);
        
        if (invalidCount > 0) {
          this.addIssue(
            'BANK_ACCOUNT_VALIDATION',
            `Bank Accounts: ${check.name} - ${invalidCount} invalid records`,
            'medium',
            { check: check.name, count: invalidCount }
          );
        }
        
        console.log(`      ${invalidCount === 0 ? '✅' : '❌'} ${check.name}: ${invalidCount} invalid`);
      } catch (error) {
        console.error(`      ❌ Error checking ${check.name}:`, error.message);
      }
    }
  }

  async validateTransactionsTable() {
    console.log('\n   💰 Validating Transactions table...');

    const checks = [
      {
        name: 'Amount precision',
        query: `SELECT COUNT(*) as invalid FROM bank_transactions WHERE amount::numeric % 0.01 != 0`
      },
      {
        name: 'Date range',
        query: `
          SELECT COUNT(*) as invalid 
          FROM bank_transactions 
          WHERE date < '2020-01-01' OR date > CURRENT_DATE + INTERVAL '1 day'
        `
      },
      {
        name: 'Tax category',
        query: `
          SELECT COUNT(*) as invalid 
          FROM bank_transactions 
          WHERE tax_category IS NULL OR tax_category = ''
        `
      }
    ];

    for (const check of checks) {
      try {
        const result = await this.postgresPool.query(check.query);
        const invalidCount = parseInt(result.rows[0].invalid);
        
        if (invalidCount > 0) {
          this.addIssue(
            'TRANSACTION_VALIDATION',
            `Transactions: ${check.name} - ${invalidCount} invalid records`,
            'medium',
            { check: check.name, count: invalidCount }
          );
        }
        
        console.log(`      ${invalidCount === 0 ? '✅' : '❌'} ${check.name}: ${invalidCount} invalid`);
      } catch (error) {
        console.error(`      ❌ Error checking ${check.name}:`, error.message);
      }
    }
  }

  async validateReceiptsTable() {
    console.log('\n   🧾 Validating Receipts table...');

    // Get sample receipts for GST validation
    const gstCheckQuery = `
      SELECT id, total_amount, gst_amount 
      FROM receipts 
      WHERE total_amount > 0 AND gst_amount > 0
      LIMIT 100
    `;

    try {
      const result = await this.postgresPool.query(gstCheckQuery);
      let gstIssues = 0;

      for (const receipt of result.rows) {
        const gstValidation = AustralianValidators.validateGST(
          receipt.total_amount, 
          receipt.gst_amount
        );
        if (!gstValidation.valid) {
          gstIssues++;
        }
      }

      console.log(`      ${gstIssues === 0 ? '✅' : '❌'} GST calculations: ${gstIssues} issues in sample of ${result.rows.length}`);

      if (gstIssues > 0) {
        this.addIssue(
          'GST_VALIDATION',
          `Receipts: ${gstIssues} GST calculation issues found`,
          'medium',
          { sampleSize: result.rows.length, issues: gstIssues }
        );
      }

    } catch (error) {
      console.error('      ❌ Error checking GST calculations:', error.message);
    }

    // Check AI processing metadata
    const aiCheckQuery = `
      SELECT COUNT(*) as invalid 
      FROM receipts 
      WHERE ai_processed = true 
      AND (ai_confidence IS NULL OR ai_confidence < 0 OR ai_confidence > 1)
    `;

    try {
      const result = await this.postgresPool.query(aiCheckQuery);
      const invalidCount = parseInt(result.rows[0].invalid);
      
      console.log(`      ${invalidCount === 0 ? '✅' : '❌'} AI confidence scores: ${invalidCount} invalid`);

    } catch (error) {
      console.error('      ❌ Error checking AI metadata:', error.message);
    }
  }

  async validateBudgetTables() {
    console.log('\n   📊 Validating Budget tables...');

    const checks = [
      {
        name: 'Budget amounts',
        query: `SELECT COUNT(*) as invalid FROM budgets WHERE monthly_budget <= 0`
      },
      {
        name: 'Variance calculations',
        query: `
          SELECT COUNT(*) as invalid 
          FROM budget_tracking 
          WHERE ABS(variance - (predicted_amount - actual_amount)) > 0.01
        `
      },
      {
        name: 'Australian tax year',
        query: `
          SELECT COUNT(*) as invalid 
          FROM budget_tracking 
          WHERE month < 1 OR month > 12 OR year < 2020 OR year > 2030
        `
      }
    ];

    for (const check of checks) {
      try {
        const result = await this.postgresPool.query(check.query);
        const invalidCount = parseInt(result.rows[0].invalid);
        
        if (invalidCount > 0) {
          this.addIssue(
            'BUDGET_VALIDATION',
            `Budgets: ${check.name} - ${invalidCount} invalid records`,
            'medium',
            { check: check.name, count: invalidCount }
          );
        }
        
        console.log(`      ${invalidCount === 0 ? '✅' : '❌'} ${check.name}: ${invalidCount} invalid`);
      } catch (error) {
        console.error(`      ❌ Error checking ${check.name}:`, error.message);
      }
    }
  }

  async validateFinancialInsightsTable() {
    console.log('\n   💡 Validating Financial Insights table...');

    const checks = [
      {
        name: 'Confidence scores',
        query: `
          SELECT COUNT(*) as invalid 
          FROM financial_insights 
          WHERE confidence_score IS NOT NULL 
          AND (confidence_score < 0 OR confidence_score > 1)
        `
      },
      {
        name: 'JSONB structure',
        query: `
          SELECT COUNT(*) as invalid 
          FROM financial_insights 
          WHERE (content IS NOT NULL AND jsonb_typeof(content) != 'object')
          OR (recommendations IS NOT NULL AND jsonb_typeof(recommendations) != 'object')
        `
      },
      {
        name: 'Expiration logic',
        query: `
          SELECT COUNT(*) as invalid 
          FROM financial_insights 
          WHERE expires_at IS NOT NULL AND expires_at < created_at
        `
      }
    ];

    for (const check of checks) {
      try {
        const result = await this.postgresPool.query(check.query);
        const invalidCount = parseInt(result.rows[0].invalid);
        
        if (invalidCount > 0) {
          this.addIssue(
            'INSIGHT_VALIDATION',
            `Financial Insights: ${check.name} - ${invalidCount} invalid records`,
            'medium',
            { check: check.name, count: invalidCount }
          );
        }
        
        console.log(`      ${invalidCount === 0 ? '✅' : '❌'} ${check.name}: ${invalidCount} invalid`);
      } catch (error) {
        console.error(`      ❌ Error checking ${check.name}:`, error.message);
      }
    }
  }

  // 6. Performance validation
  async validatePerformance() {
    console.log('\n⚡ Validating performance...');

    const performanceTests = [
      {
        name: 'User lookup by email',
        query: 'SELECT * FROM users WHERE email = $1 LIMIT 1',
        params: ['test@example.com']
      },
      {
        name: 'Transaction aggregation',
        query: `
          SELECT COUNT(*), SUM(amount) 
          FROM bank_transactions 
          WHERE user_id = $1 
          AND date >= $2 AND date <= $3
        `,
        params: ['test-user-id', '2024-01-01', '2024-12-31']
      },
      {
        name: 'Budget tracking query',
        query: `
          SELECT bt.*, b.name, b.monthly_budget 
          FROM budget_tracking bt 
          JOIN budgets b ON bt.budget_id = b.id 
          WHERE bt.user_id = $1 AND bt.year = $2
        `,
        params: ['test-user-id', 2024]
      }
    ];

    for (const test of performanceTests) {
      try {
        const startTime = Date.now();
        await this.postgresPool.query(test.query, test.params);
        const duration = Date.now() - startTime;
        
        const validation = {
          test: test.name,
          duration,
          status: duration < VALIDATION_CONFIG.performanceTests.queryTimeout ? '✅' : '⚠️',
          withinThreshold: duration < VALIDATION_CONFIG.performanceTests.queryTimeout
        };

        this.validationResults.performance[test.name] = validation;

        if (!validation.withinThreshold) {
          this.addIssue(
            'PERFORMANCE_ISSUE',
            `${test.name} took ${duration}ms (threshold: ${VALIDATION_CONFIG.performanceTests.queryTimeout}ms)`,
            'low',
            { test: test.name, duration }
          );
        }

        console.log(`   ${validation.status} ${test.name}: ${duration}ms`);

      } catch (error) {
        console.error(`   ❌ Error testing ${test.name}:`, error.message);
      }
    }

    // Test connection pooling
    await this.testConnectionPooling();
  }

  async testConnectionPooling() {
    console.log('\n   🔌 Testing connection pooling...');

    const queries = Array(VALIDATION_CONFIG.performanceTests.concurrentConnections)
      .fill(null)
      .map(() => this.postgresPool.query('SELECT pg_sleep(0.1)'));

    try {
      const startTime = Date.now();
      await Promise.all(queries);
      const duration = Date.now() - startTime;
      
      console.log(`      ✅ ${VALIDATION_CONFIG.performanceTests.concurrentConnections} concurrent connections: ${duration}ms`);
      
      this.validationResults.performance.connectionPooling = {
        concurrentConnections: VALIDATION_CONFIG.performanceTests.concurrentConnections,
        duration,
        status: '✅'
      };

    } catch (error) {
      console.error('      ❌ Connection pooling test failed:', error.message);
      this.addIssue(
        'CONNECTION_POOL_ISSUE',
        'Failed to handle concurrent connections',
        'medium',
        error.message
      );
    }
  }

  // Helper methods
  getRandomSample(totalSize, sampleSize) {
    const indices = [];
    const usedIndices = new Set();
    
    while (indices.length < sampleSize && indices.length < totalSize) {
      const index = Math.floor(Math.random() * totalSize);
      if (!usedIndices.has(index)) {
        usedIndices.add(index);
        indices.push(index);
      }
    }
    
    return indices;
  }

  mapFirebaseIdToPostgres(firebaseId, collection) {
    // This should match the ID mapping logic from the transformation
    const namespace = `taaxdog-${collection}`;
    const hash = crypto.createHash('sha256')
      .update(namespace + firebaseId)
      .digest('hex');
    
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      '4' + hash.substring(13, 16),
      ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  compareRecords(firebaseRecord, pgRecord, collection) {
    const issues = [];
    
    // Define field mappings for each collection
    const fieldMappings = {
      users: {
        email: 'email',
        name: 'name',
        phone: 'phone',
        abn: 'abn',
        tfn: 'tfn'
      },
      bankAccounts: {
        accountName: 'account_name',
        bsb: 'bsb',
        accountNumber: 'account_number',
        balance: 'balance'
      },
      transactions: {
        amount: 'amount',
        description: 'description',
        taxCategory: 'tax_category',
        gstAmount: 'gst_amount'
      },
      receipts: {
        totalAmount: 'total_amount',
        gstAmount: 'gst_amount',
        merchant: 'merchant'
      },
      budgets: {
        monthlyBudget: 'monthly_budget',
        targetSavings: 'target_savings'
      }
    };

    const mappings = fieldMappings[collection] || {};
    
    for (const [firebaseField, pgField] of Object.entries(mappings)) {
      const firebaseValue = firebaseRecord[firebaseField];
      const pgValue = pgRecord[pgField];
      
      // Handle different data types
      if (firebaseValue !== undefined && firebaseValue !== null) {
        if (typeof firebaseValue === 'number' && typeof pgValue === 'string') {
          // Compare numeric values with tolerance
          const diff = Math.abs(parseFloat(pgValue) - firebaseValue);
          if (diff > VALIDATION_CONFIG.tolerances.amountPrecision) {
            issues.push({
              field: firebaseField,
              firebaseValue,
              postgresValue: pgValue,
              difference: diff
            });
          }
        } else if (firebaseValue !== pgValue) {
          // Direct comparison for other types
          issues.push({
            field: firebaseField,
            firebaseValue,
            postgresValue: pgValue
          });
        }
      }
    }
    
    return issues;
  }

  addIssue(type, message, severity, details = null) {
    const issue = {
      type,
      message,
      severity,
      timestamp: new Date().toISOString(),
      details
    };
    
    this.validationResults.issues.push(issue);
    this.validationResults.summary.totalIssues++;
    
    if (severity === 'critical' || severity === 'high') {
      this.validationResults.summary.criticalIssues++;
    }
  }

  generateSummary() {
    const results = this.validationResults;
    
    // Count passed/failed collections
    let passedCollections = 0;
    let failedCollections = 0;
    
    for (const [collection, validation] of Object.entries(results.recordCounts)) {
      if (validation.match && !validation.hasDuplicates) {
        passedCollections++;
      } else {
        failedCollections++;
      }
    }
    
    results.summary.totalCollections = Object.keys(results.recordCounts).length;
    results.summary.passedCollections = passedCollections;
    results.summary.failedCollections = failedCollections;
    
    // Overall status
    results.summary.overallStatus = 
      results.summary.criticalIssues === 0 && 
      results.summary.totalIssues < 5 ? 'PASSED' : 'FAILED';
    
    // Success percentage
    results.summary.successRate = results.summary.totalCollections > 0
      ? ((passedCollections / results.summary.totalCollections) * 100).toFixed(2) + '%'
      : '0%';
  }

  // Generate comprehensive report
  async generateReport(outputPath) {
    const report = this.validationResults;
    
    // Save JSON report
    const jsonPath = path.join(outputPath, `validation_report_${Date.now()}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    
    // Generate markdown report
    const markdownPath = path.join(outputPath, `validation_report_${Date.now()}.md`);
    const markdown = this.generateMarkdownReport(report);
    await fs.writeFile(markdownPath, markdown, 'utf8');
    
    // Generate rollback script if needed
    if (report.summary.criticalIssues > 0) {
      const rollbackPath = path.join(outputPath, `rollback_script_${Date.now()}.sql`);
      const rollbackScript = this.generateRollbackScript(report);
      await fs.writeFile(rollbackPath, rollbackScript, 'utf8');
    }
    
    console.log(`\n📄 Reports generated in ${outputPath}`);
    
    return { jsonPath, markdownPath };
  }

  generateMarkdownReport(report) {
    const status = report.summary.overallStatus === 'PASSED' ? '✅ PASSED' : '❌ FAILED';
    
    return `# Firebase to PostgreSQL Migration Validation Report

**Date:** ${new Date(report.timestamp).toLocaleString()}
**Overall Status:** ${status}
**Success Rate:** ${report.summary.successRate}

## Summary

- **Total Collections:** ${report.summary.totalCollections}
- **✅ Passed:** ${report.summary.passedCollections}
- **❌ Failed:** ${report.summary.failedCollections}
- **Total Issues:** ${report.summary.totalIssues}
- **Critical Issues:** ${report.summary.criticalIssues}

## Record Count Validation

| Collection | Firebase | PostgreSQL | Difference | Duplicates | Status |
|------------|----------|------------|------------|------------|--------|
${Object.entries(report.recordCounts).map(([collection, val]) => 
  `| ${collection} | ${val.firebaseCount} | ${val.postgresCount} | ${val.difference} | ${val.hasDuplicates ? 'Yes' : 'No'} | ${val.status} |`
).join('\n')}

## Relationship Validation

| Relationship | Orphaned Records | Status |
|--------------|------------------|--------|
${Object.entries(report.relationships).map(([rel, val]) => 
  `| ${rel} | ${val.orphanedRecords} | ${val.status} |`
).join('\n')}

## Data Integrity

${Object.entries(report.dataIntegrity).map(([collection, val]) => `
### ${collection}
- Samples Checked: ${val.samplesChecked}
- Issues Found: ${val.issuesFound}
- Status: ${val.status}
${val.issues.length > 0 ? `\nSample Issues:\n${val.issues.slice(0, 3).map(i => `- ${i.type}: ${i.message || JSON.stringify(i.issues)}`).join('\n')}` : ''}
`).join('\n')}

## Australian Compliance

| Check | Invalid Records | Status |
|-------|-----------------|--------|
${Object.entries(report.australianCompliance).map(([check, val]) => 
  `| ${val.check} | ${val.invalidRecords} | ${val.status} |`
).join('\n')}

## Performance Tests

| Test | Duration | Status |
|------|----------|--------|
${Object.entries(report.performance).map(([test, val]) => 
  `| ${test} | ${val.duration || val.concurrentConnections}ms | ${val.status} |`
).join('\n')}

## Issues Found

${report.issues.length === 0 ? 'No issues found! 🎉' : report.issues.map(issue => `
### ${issue.type} (${issue.severity})
- **Message:** ${issue.message}
- **Time:** ${new Date(issue.timestamp).toLocaleTimeString()}
${issue.details ? `- **Details:** ${JSON.stringify(issue.details, null, 2)}` : ''}
`).join('\n')}

## Recommendations

${report.summary.criticalIssues > 0 ? `
### ⚠️ Critical Issues Detected

1. **DO NOT proceed with production deployment**
2. Review all critical issues above
3. Run the rollback script if data has been corrupted
4. Re-run the transformation and import process
5. Validate again before proceeding
` : ''}

${report.summary.totalIssues > 0 ? `
### 📋 Action Items

1. Review and fix all validation issues
2. Re-import affected collections
3. Run validation again to confirm fixes
` : `
### ✅ Migration Successful

The migration has passed all validation checks. The system is ready for:
1. Application testing
2. Performance monitoring
3. Production deployment
`}

## Next Steps

1. ${report.summary.overallStatus === 'PASSED' ? 'Create a database backup' : 'Fix identified issues'}
2. ${report.summary.overallStatus === 'PASSED' ? 'Run application integration tests' : 'Re-run migration for failed collections'}
3. ${report.summary.overallStatus === 'PASSED' ? 'Monitor application performance' : 'Validate again after fixes'}
4. ${report.summary.overallStatus === 'PASSED' ? 'Plan production deployment' : 'Contact support if issues persist'}
`;
  }

  generateRollbackScript(report) {
    return `-- Rollback Script for Firebase to PostgreSQL Migration
-- Generated: ${new Date().toISOString()}
-- Reason: ${report.summary.criticalIssues} critical issues found

-- WARNING: This script will remove all imported data
-- Make sure to backup current state before running

BEGIN;

-- Disable foreign key checks
SET session_replication_role = 'replica';

-- Delete imported data in reverse dependency order
${Object.keys(VALIDATION_CONFIG.collectionMapping).reverse().map(collection => {
  const table = VALIDATION_CONFIG.collectionMapping[collection];
  return `DELETE FROM ${table} WHERE created_at >= (SELECT MIN(created_at) FROM ${table} WHERE id IN (SELECT id FROM firebase_import_tracking WHERE collection = '${collection}'));`;
}).join('\n')}

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Verify rollback
${Object.values(VALIDATION_CONFIG.collectionMapping).map(table => 
  `SELECT '${table}' as table_name, COUNT(*) as remaining_records FROM ${table};`
).join('\n')}

-- If counts look correct, commit the rollback
-- COMMIT;

-- If something went wrong, rollback the rollback
-- ROLLBACK;
`;
  }

  async close() {
    await this.postgresPool.end();
  }
}

// CLI interface
async function main() {
  const firebaseDir = process.argv[2] || path.join(__dirname, '../firebase-exports');
  const connectionString = process.argv[3] || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('Please provide connection string as argument or set DATABASE_URL');
    console.log('\nUsage:');
    console.log('  node migration-validator.js [firebase-dir] [connection-string] [output-dir]');
    console.log('  DATABASE_URL=... node migration-validator.js');
    process.exit(1);
  }
  const outputDir = process.argv[4] || path.join(__dirname, '../validation-reports');
  
  console.log('Firebase Directory:', firebaseDir);
  console.log('Database:', connectionString.split('@')[1]?.split('/')[0] || 'PostgreSQL');
  console.log('Output Directory:', outputDir);
  
  const validator = new MigrationValidator(firebaseDir, { connectionString });
  
  try {
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    // Run validation
    const results = await validator.validate();
    
    // Generate reports
    await validator.generateReport(outputDir);
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`VALIDATION ${results.summary.overallStatus}`);
    console.log('='.repeat(50));
    console.log(`Success Rate: ${results.summary.successRate}`);
    console.log(`Total Issues: ${results.summary.totalIssues}`);
    console.log(`Critical Issues: ${results.summary.criticalIssues}`);
    
    process.exit(results.summary.overallStatus === 'PASSED' ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await validator.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  MigrationValidator,
  AustralianValidators,
  VALIDATION_CONFIG
};