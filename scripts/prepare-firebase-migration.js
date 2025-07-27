const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// ID mapping storage
const idMappings = {
  users: {},
  bankAccounts: {},
  transactions: {},
  receipts: {},
  budgets: {},
  budgetTracking: {},
  financialInsights: {},
};

// Generate deterministic UUID from Firebase ID
function generateUUID(firebaseId, collection) {
  const namespace = 'taaxdog-' + collection;
  const hash = crypto
    .createHash('sha256')
    .update(namespace + firebaseId)
    .digest('hex');

  // Format as UUID v4
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-');
}

// Transform data for PostgreSQL
async function transformForPostgreSQL(exportDir) {
  const transformedDir = path.join(exportDir, 'postgresql-ready');
  await fs.mkdir(transformedDir, { recursive: true });

  console.log('Transforming data for PostgreSQL import...\n');

  // Load all data first to build complete ID mappings
  const allData = {};
  for (const collection of Object.keys(idMappings)) {
    try {
      const dataPath = path.join(exportDir, `${collection}.json`);
      allData[collection] = JSON.parse(await fs.readFile(dataPath, 'utf8'));

      // Build ID mappings
      allData[collection].forEach((doc) => {
        const uuid = generateUUID(doc._firebaseId, collection);
        idMappings[collection][doc._firebaseId] = uuid;
      });
    } catch (error) {
      console.log(`Skipping ${collection}: ${error.message}`);
    }
  }

  // Transform each collection
  for (const [collection, documents] of Object.entries(allData)) {
    console.log(`Transforming ${collection}...`);
    const transformed = await transformCollection(collection, documents, allData);

    const outputPath = path.join(transformedDir, `${collection}.json`);
    await fs.writeFile(outputPath, JSON.stringify(transformed, null, 2), 'utf8');

    console.log(`  ✓ Transformed ${transformed.length} documents`);
  }

  // Save ID mappings
  const mappingsPath = path.join(transformedDir, 'id_mappings.json');
  await fs.writeFile(mappingsPath, JSON.stringify(idMappings, null, 2), 'utf8');

  // Generate SQL scripts
  await generateSQLScripts(transformedDir, allData);

  console.log('\nTransformation complete!');
  console.log(`Output directory: ${transformedDir}`);
}

// Transform specific collection
async function transformCollection(collectionName, documents, allData) {
  return documents.map((doc) => {
    const transformed = { ...doc };

    // Set PostgreSQL ID
    transformed.id = idMappings[collectionName][doc._firebaseId];
    delete transformed._firebaseId;

    // Transform based on collection
    switch (collectionName) {
      case 'users':
        // Ensure required fields
        transformed.email = transformed.email || '';
        transformed.name = transformed.name || '';
        transformed.role = transformed.role || 'USER';
        transformed.taxResidency = transformed.taxResidency || 'RESIDENT';
        transformed.failedLoginAttempts = transformed.failedLoginAttempts || 0;
        transformed.twoFactorEnabled = transformed.twoFactorEnabled || false;

        // Transform auth fields
        if (transformed.password) {
          // Assuming Firebase passwords are already hashed
          transformed.password = transformed.password;
        }

        // Set timestamps
        transformed.createdAt = transformed.createdAt || transformed._exportedAt;
        transformed.updatedAt = transformed.updatedAt || transformed._exportedAt;
        break;

      case 'bankAccounts':
        // Transform user reference
        if (transformed.userId && idMappings.users[transformed.userId]) {
          transformed.userId = idMappings.users[transformed.userId];
        }

        // Ensure required fields
        transformed.accountName = transformed.accountName || 'Unknown Account';
        transformed.isActive = transformed.isActive !== false;

        // Transform BASIQ fields
        if (transformed.basiqConnection) {
          transformed.basiqConnectionId = transformed.basiqConnection.id;
          transformed.basiqInstitutionId = transformed.basiqConnection.institutionId;
          transformed.lastSyncedAt = transformed.basiqConnection.lastSyncedAt;
        }
        break;

      case 'transactions':
        // Transform references
        if (transformed.userId && idMappings.users[transformed.userId]) {
          transformed.userId = idMappings.users[transformed.userId];
        }
        if (transformed.bankAccountId && idMappings.bankAccounts[transformed.bankAccountId]) {
          transformed.bankAccountId = idMappings.bankAccounts[transformed.bankAccountId];
        }

        // Ensure required fields
        transformed.amount = parseFloat(transformed.amount) || 0;
        transformed.taxCategory = transformed.taxCategory || 'UNCATEGORIZED';
        transformed.description = transformed.description || '';

        // Calculate GST if not present
        if (transformed.gstAmount === undefined && transformed.amount) {
          // Assume GST inclusive for business expenses
          if (transformed.taxCategory === 'BUSINESS_EXPENSE') {
            transformed.gstAmount = Math.round((transformed.amount / 11) * 100) / 100;
          } else {
            transformed.gstAmount = 0;
          }
        }
        break;

      case 'receipts':
        // Transform references
        if (transformed.userId && idMappings.users[transformed.userId]) {
          transformed.user_id = idMappings.users[transformed.userId];
          delete transformed.userId;
        }
        if (transformed.transactionId && idMappings.transactions[transformed.transactionId]) {
          transformed.transaction_id = idMappings.transactions[transformed.transactionId];
          delete transformed.transactionId;
        }

        // Transform field names to match PostgreSQL schema
        transformed.total_amount = transformed.totalAmount || 0;
        transformed.gst_amount = transformed.gstAmount || 0;
        transformed.image_url = transformed.imageUrl;
        transformed.ai_processed = transformed.aiProcessed || false;
        transformed.ai_confidence = transformed.aiConfidence;
        transformed.ai_provider = transformed.aiProvider;
        transformed.ai_model = transformed.aiModel;
        transformed.processing_status = transformed.processingStatus || 'pending';
        transformed.created_at = transformed.createdAt || transformed._exportedAt;
        transformed.updated_at = transformed.updatedAt || transformed._exportedAt;

        // Clean up old field names
        delete transformed.totalAmount;
        delete transformed.gstAmount;
        delete transformed.imageUrl;
        delete transformed.aiProcessed;
        delete transformed.aiConfidence;
        delete transformed.aiProvider;
        delete transformed.aiModel;
        delete transformed.processingStatus;
        delete transformed.createdAt;
        delete transformed.updatedAt;
        break;

      case 'budgets':
        // Transform references
        if (transformed.userId && idMappings.users[transformed.userId]) {
          transformed.user_id = idMappings.users[transformed.userId];
          delete transformed.userId;
        }

        // Transform field names
        transformed.monthly_budget = transformed.monthlyBudget || 0;
        transformed.target_savings = transformed.targetSavings || 0;
        transformed.monthly_income = transformed.monthlyIncome || 0;
        transformed.category_limits = transformed.categoryLimits || {};
        transformed.confidence_score = transformed.confidenceScore;
        transformed.ai_provider = transformed.aiProvider;
        transformed.ai_model = transformed.aiModel;
        transformed.analysis_period = transformed.analysisPeriod;
        transformed.prediction_period = transformed.predictionPeriod;
        transformed.created_at = transformed.createdAt || transformed._exportedAt;
        transformed.updated_at = transformed.updatedAt || transformed._exportedAt;

        // Clean up
        delete transformed.monthlyBudget;
        delete transformed.targetSavings;
        delete transformed.monthlyIncome;
        delete transformed.categoryLimits;
        delete transformed.confidenceScore;
        delete transformed.aiProvider;
        delete transformed.aiModel;
        delete transformed.analysisPeriod;
        delete transformed.predictionPeriod;
        delete transformed.createdAt;
        delete transformed.updatedAt;
        break;

      case 'budgetTracking':
        // Transform references
        if (transformed.userId && idMappings.users[transformed.userId]) {
          transformed.user_id = idMappings.users[transformed.userId];
          delete transformed.userId;
        }
        if (transformed.budgetId && idMappings.budgets[transformed.budgetId]) {
          transformed.budget_id = idMappings.budgets[transformed.budgetId];
          delete transformed.budgetId;
        }

        // Transform field names
        transformed.predicted_amount = transformed.predictedAmount || 0;
        transformed.actual_amount = transformed.actualAmount || 0;
        transformed.created_at = transformed.createdAt || transformed._exportedAt;

        // Clean up
        delete transformed.predictedAmount;
        delete transformed.actualAmount;
        delete transformed.createdAt;
        break;

      case 'financialInsights':
        // Transform references
        if (transformed.userId && idMappings.users[transformed.userId]) {
          transformed.user_id = idMappings.users[transformed.userId];
          delete transformed.userId;
        }

        // Transform field names
        transformed.insight_type = transformed.insightType;
        transformed.confidence_score = transformed.confidenceScore;
        transformed.source_data_ids = transformed.sourceDataIds || [];
        transformed.is_active = transformed.isActive !== false;
        transformed.created_at = transformed.createdAt || transformed._exportedAt;
        transformed.expires_at = transformed.expiresAt;

        // Clean up
        delete transformed.insightType;
        delete transformed.confidenceScore;
        delete transformed.sourceDataIds;
        delete transformed.isActive;
        delete transformed.createdAt;
        delete transformed.expiresAt;
        break;
    }

    // Remove export metadata
    delete transformed._exportedAt;
    delete transformed._postgresTable;

    return transformed;
  });
}

// Generate SQL scripts for import
async function generateSQLScripts(outputDir, allData) {
  console.log('\nGenerating SQL import scripts...');

  const sqlDir = path.join(outputDir, 'sql');
  await fs.mkdir(sqlDir, { recursive: true });

  // Generate import order based on dependencies
  const importOrder = [
    'users',
    'bankAccounts',
    'budgets',
    'transactions',
    'receipts',
    'budgetTracking',
    'financialInsights',
  ];

  // Main import script
  let mainScript = `-- Firebase to PostgreSQL Migration Script
-- Generated: ${new Date().toISOString()}
-- 
-- This script imports Firebase data into PostgreSQL
-- Run this script after creating the database schema

\\set ON_ERROR_STOP on
\\timing on

BEGIN;

-- Disable foreign key checks during import
SET session_replication_role = 'replica';

`;

  for (const collection of importOrder) {
    if (!allData[collection] || allData[collection].length === 0) continue;

    const tableName = getPostgreSQLTableName(collection);
    mainScript += `\n-- Import ${collection} (${allData[collection].length} records)\n`;
    mainScript += `\\echo 'Importing ${collection}...'\n`;
    mainScript += `\\copy ${tableName} FROM '${path.join(outputDir, `${collection}.csv`)}' WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"', ESCAPE '"', NULL '');\n`;

    // Generate CSV for this collection
    await generateCSV(collection, outputDir);
  }

  mainScript += `
-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Update sequences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('bank_accounts_id_seq', (SELECT MAX(id) FROM bank_accounts));
SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions));
SELECT setval('receipts_id_seq', (SELECT MAX(id) FROM receipts));
SELECT setval('budgets_id_seq', (SELECT MAX(id) FROM budgets));
SELECT setval('budget_tracking_id_seq', (SELECT MAX(id) FROM budget_tracking));
SELECT setval('financial_insights_id_seq', (SELECT MAX(id) FROM financial_insights));

-- Verify import
\\echo ''
\\echo 'Import Summary:'
\\echo '==============='
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'bank_accounts', COUNT(*) FROM bank_accounts
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'receipts', COUNT(*) FROM receipts
UNION ALL
SELECT 'budgets', COUNT(*) FROM budgets
UNION ALL
SELECT 'budget_tracking', COUNT(*) FROM budget_tracking
UNION ALL
SELECT 'financial_insights', COUNT(*) FROM financial_insights;

COMMIT;

\\echo ''
\\echo 'Migration completed successfully!'
`;

  await fs.writeFile(path.join(sqlDir, 'import_all.sql'), mainScript, 'utf8');

  // Generate rollback script
  const rollbackScript = `-- Rollback script for Firebase migration
-- This will remove all imported data

BEGIN;

DELETE FROM financial_insights WHERE created_at >= (SELECT MIN(created_at) FROM financial_insights WHERE id IN (SELECT id FROM id_mappings.financialInsights));
DELETE FROM budget_tracking WHERE created_at >= (SELECT MIN(created_at) FROM budget_tracking WHERE id IN (SELECT id FROM id_mappings.budgetTracking));
DELETE FROM receipts WHERE created_at >= (SELECT MIN(created_at) FROM receipts WHERE id IN (SELECT id FROM id_mappings.receipts));
DELETE FROM transactions WHERE created_at >= (SELECT MIN(created_at) FROM transactions WHERE id IN (SELECT id FROM id_mappings.transactions));
DELETE FROM budgets WHERE created_at >= (SELECT MIN(created_at) FROM budgets WHERE id IN (SELECT id FROM id_mappings.budgets));
DELETE FROM bank_accounts WHERE created_at >= (SELECT MIN(created_at) FROM bank_accounts WHERE id IN (SELECT id FROM id_mappings.bankAccounts));
DELETE FROM users WHERE created_at >= (SELECT MIN(created_at) FROM users WHERE id IN (SELECT id FROM id_mappings.users));

COMMIT;
`;

  await fs.writeFile(path.join(sqlDir, 'rollback.sql'), rollbackScript, 'utf8');

  console.log('  ✓ Generated SQL import scripts');
}

// Generate CSV files for bulk import
async function generateCSV(collection, outputDir) {
  const dataPath = path.join(outputDir, `${collection}.json`);
  const csvPath = path.join(outputDir, `${collection}.csv`);

  try {
    const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    if (data.length === 0) return;

    // Get all unique keys
    const allKeys = new Set();
    data.forEach((doc) => Object.keys(doc).forEach((key) => allKeys.add(key)));

    // Order keys consistently
    const keys = Array.from(allKeys).sort();

    // Generate CSV
    let csv = keys.map((key) => `"${key}"`).join(',') + '\n';

    data.forEach((doc) => {
      const row = keys.map((key) => {
        const value = doc[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
        return value;
      });
      csv += row.join(',') + '\n';
    });

    await fs.writeFile(csvPath, csv, 'utf8');
  } catch (error) {
    console.error(`Error generating CSV for ${collection}:`, error.message);
  }
}

// Get PostgreSQL table name
function getPostgreSQLTableName(collection) {
  const mapping = {
    users: 'users',
    bankAccounts: 'bank_accounts',
    transactions: 'transactions',
    receipts: 'receipts',
    budgets: 'budgets',
    budgetTracking: 'budget_tracking',
    financialInsights: 'financial_insights',
  };
  return mapping[collection] || collection;
}

// Main function
async function main() {
  const exportDir = process.argv[2] || path.join(__dirname, '../firebase-exports');

  console.log('Firebase to PostgreSQL Migration Preparation');
  console.log('==========================================\n');

  try {
    await transformForPostgreSQL(exportDir);
  } catch (error) {
    console.error('\nPreparation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateUUID,
  transformCollection,
  idMappings,
};
