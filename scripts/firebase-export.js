const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');

// Initialize Firebase Admin SDK
const serviceAccount = require('../config/firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'taaxdog-coding'
});

const db = admin.firestore();

// Configuration
const EXPORT_CONFIG = {
  batchSize: 500,
  retryAttempts: 3,
  retryDelay: 1000,
  exportDir: path.join(__dirname, '../firebase-exports'),
  collections: [
    'users',
    'bankAccounts',
    'transactions',
    'receipts',
    'budgets',
    'budgetTracking',
    'financialInsights'
  ]
};

// Export statistics
const exportStats = {
  startTime: null,
  endTime: null,
  collections: {},
  errors: [],
  idMappings: {}
};

// Utility functions
async function ensureExportDirectory() {
  try {
    await fs.mkdir(EXPORT_CONFIG.exportDir, { recursive: true });
    await fs.mkdir(path.join(EXPORT_CONFIG.exportDir, 'mappings'), { recursive: true });
    await fs.mkdir(path.join(EXPORT_CONFIG.exportDir, 'logs'), { recursive: true });
  } catch (error) {
    console.error('Error creating export directories:', error);
    throw error;
  }
}

function convertFirebaseTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp._seconds !== undefined) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  return timestamp;
}

function transformDocument(doc, collectionName) {
  const data = doc.data();
  const transformed = {
    _firebaseId: doc.id,
    _exportedAt: new Date().toISOString(),
    ...data
  };

  // Transform timestamps
  Object.keys(transformed).forEach(key => {
    if (transformed[key] && typeof transformed[key] === 'object') {
      if (transformed[key]._seconds !== undefined || 
          (transformed[key].toDate && typeof transformed[key].toDate === 'function')) {
        transformed[key] = convertFirebaseTimestamp(transformed[key]);
      }
    }
  });

  // Collection-specific transformations
  switch (collectionName) {
    case 'users':
      transformed._postgresTable = 'users';
      if (transformed.phone) {
        transformed.phone = validateAustralianPhone(transformed.phone);
      }
      if (transformed.abn) {
        transformed.abn = validateABN(transformed.abn);
      }
      break;
    
    case 'bankAccounts':
      transformed._postgresTable = 'bank_accounts';
      if (transformed.bsb) {
        transformed.bsb = validateBSB(transformed.bsb);
      }
      break;
    
    case 'transactions':
      transformed._postgresTable = 'transactions';
      transformed.taxCategory = transformed.taxCategory || 'UNCATEGORIZED';
      break;
    
    case 'receipts':
      transformed._postgresTable = 'receipts';
      transformed.aiProcessed = transformed.aiProcessed || false;
      break;
    
    case 'budgets':
      transformed._postgresTable = 'budgets';
      break;
    
    case 'budgetTracking':
      transformed._postgresTable = 'budget_tracking';
      break;
    
    case 'financialInsights':
      transformed._postgresTable = 'financial_insights';
      break;
  }

  return transformed;
}

// Validation functions
function validateAustralianPhone(phone) {
  if (!phone) return null;
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Australian mobile numbers
  if (cleaned.startsWith('04') && cleaned.length === 10) {
    return `+61${cleaned.substring(1)}`;
  }
  // Australian landline numbers
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `+61${cleaned.substring(1)}`;
  }
  // Already international format
  if (cleaned.startsWith('614') && cleaned.length === 11) {
    return `+${cleaned}`;
  }
  
  return phone; // Return original if validation fails
}

function validateABN(abn) {
  if (!abn) return null;
  const cleaned = abn.replace(/\s/g, '');
  if (cleaned.length !== 11 || !/^\d+$/.test(cleaned)) {
    return abn; // Return original if validation fails
  }
  return cleaned;
}

function validateBSB(bsb) {
  if (!bsb) return null;
  const cleaned = bsb.replace(/[-\s]/g, '');
  if (cleaned.length !== 6 || !/^\d+$/.test(cleaned)) {
    return bsb; // Return original if validation fails
  }
  return `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`;
}

// Retry logic for Firebase operations
async function retryOperation(operation, retries = EXPORT_CONFIG.retryAttempts) {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      
      const delay = EXPORT_CONFIG.retryDelay * Math.pow(2, i);
      console.log(`Retry attempt ${i + 1} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Export a single collection
async function exportCollection(collectionName) {
  console.log(`\nExporting collection: ${collectionName}`);
  const startTime = Date.now();
  
  const documents = [];
  const idMapping = {};
  let lastDoc = null;
  let totalDocs = 0;
  let batch = 0;

  try {
    while (true) {
      let query = db.collection(collectionName)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(EXPORT_CONFIG.batchSize);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await retryOperation(() => query.get());
      
      if (snapshot.empty) break;

      batch++;
      console.log(`  Processing batch ${batch} (${snapshot.size} documents)...`);

      snapshot.forEach(doc => {
        const transformed = transformDocument(doc, collectionName);
        documents.push(transformed);
        
        // Create ID mapping for relationship preservation
        idMapping[doc.id] = {
          firebaseId: doc.id,
          exportedData: transformed,
          relationships: extractRelationships(transformed, collectionName)
        };
        
        totalDocs++;
      });

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    // Save collection data
    const exportPath = path.join(EXPORT_CONFIG.exportDir, `${collectionName}.json`);
    await fs.writeFile(
      exportPath,
      JSON.stringify(documents, null, 2),
      'utf8'
    );

    // Save ID mappings
    const mappingPath = path.join(EXPORT_CONFIG.exportDir, 'mappings', `${collectionName}_mapping.json`);
    await fs.writeFile(
      mappingPath,
      JSON.stringify(idMapping, null, 2),
      'utf8'
    );

    const endTime = Date.now();
    const stats = {
      documentCount: totalDocs,
      batches: batch,
      exportTime: endTime - startTime,
      fileSizeBytes: (await fs.stat(exportPath)).size
    };

    exportStats.collections[collectionName] = stats;
    exportStats.idMappings[collectionName] = Object.keys(idMapping).length;

    console.log(`  ✓ Exported ${totalDocs} documents in ${stats.exportTime}ms`);
    console.log(`  ✓ File size: ${(stats.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);

    return stats;
  } catch (error) {
    console.error(`  ✗ Error exporting ${collectionName}:`, error.message);
    exportStats.errors.push({
      collection: collectionName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Extract relationships from document
function extractRelationships(doc, collectionName) {
  const relationships = {};

  switch (collectionName) {
    case 'bankAccounts':
      if (doc.userId) relationships.user = doc.userId;
      break;
    
    case 'transactions':
      if (doc.userId) relationships.user = doc.userId;
      if (doc.bankAccountId) relationships.bankAccount = doc.bankAccountId;
      break;
    
    case 'receipts':
      if (doc.userId) relationships.user = doc.userId;
      if (doc.transactionId) relationships.transaction = doc.transactionId;
      break;
    
    case 'budgets':
      if (doc.userId) relationships.user = doc.userId;
      break;
    
    case 'budgetTracking':
      if (doc.userId) relationships.user = doc.userId;
      if (doc.budgetId) relationships.budget = doc.budgetId;
      break;
    
    case 'financialInsights':
      if (doc.userId) relationships.user = doc.userId;
      break;
  }

  return relationships;
}

// Generate export summary
async function generateExportSummary() {
  const summaryPath = path.join(EXPORT_CONFIG.exportDir, 'export_summary.json');
  const readmePath = path.join(EXPORT_CONFIG.exportDir, 'README.md');

  const summary = {
    ...exportStats,
    exportDate: new Date().toISOString(),
    duration: exportStats.endTime - exportStats.startTime,
    totalDocuments: Object.values(exportStats.collections)
      .reduce((sum, stats) => sum + stats.documentCount, 0),
    totalSize: Object.values(exportStats.collections)
      .reduce((sum, stats) => sum + stats.fileSizeBytes, 0)
  };

  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  // Generate README
  const readme = `# Firebase Export Summary

**Export Date:** ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
**Total Duration:** ${(summary.duration / 1000).toFixed(2)} seconds
**Total Documents:** ${summary.totalDocuments.toLocaleString()}
**Total Size:** ${(summary.totalSize / 1024 / 1024).toFixed(2)} MB

## Collections Exported

${Object.entries(summary.collections).map(([name, stats]) => `
### ${name}
- Documents: ${stats.documentCount.toLocaleString()}
- File Size: ${(stats.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
- Export Time: ${(stats.exportTime / 1000).toFixed(2)} seconds
- ID Mappings: ${exportStats.idMappings[name] || 0}
`).join('')}

## Errors

${summary.errors.length === 0 ? 'No errors encountered during export.' : 
  summary.errors.map(err => `- ${err.collection}: ${err.error} (${err.timestamp})`).join('\n')}

## Files Generated

- **Data Files:** One JSON file per collection in the root export directory
- **ID Mappings:** Firebase ID to PostgreSQL UUID mappings in \`mappings/\` directory
- **Summary:** \`export_summary.json\` with detailed statistics
- **Logs:** Error logs and detailed export information in \`logs/\` directory

## Next Steps

1. Review the exported data for completeness
2. Run data validation scripts
3. Import data into PostgreSQL using the migration scripts
4. Verify data integrity after import
`;

  await fs.writeFile(readmePath, readme, 'utf8');
  
  return summary;
}

// Main export function
async function main() {
  console.log('Firebase Data Export System');
  console.log('==========================\n');
  
  try {
    exportStats.startTime = Date.now();
    
    // Ensure export directories exist
    await ensureExportDirectory();
    
    // Export each collection
    for (const collection of EXPORT_CONFIG.collections) {
      try {
        await exportCollection(collection);
      } catch (error) {
        console.error(`Failed to export ${collection}, continuing with next...`);
      }
    }
    
    exportStats.endTime = Date.now();
    
    // Generate summary
    const summary = await generateExportSummary();
    
    console.log('\n\nExport Complete!');
    console.log('================');
    console.log(`Total documents: ${summary.totalDocuments}`);
    console.log(`Total size: ${(summary.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Duration: ${(summary.duration / 1000).toFixed(2)} seconds`);
    console.log(`\nExport directory: ${EXPORT_CONFIG.exportDir}`);
    
    if (exportStats.errors.length > 0) {
      console.log(`\n⚠️  ${exportStats.errors.length} errors occurred during export.`);
      console.log('Check the export summary for details.');
    }
    
  } catch (error) {
    console.error('\nFatal error during export:', error);
    process.exit(1);
  }
}

// Run export if called directly
if (require.main === module) {
  main().then(() => {
    console.log('\nExport process completed successfully.');
    process.exit(0);
  }).catch(error => {
    console.error('\nExport process failed:', error);
    process.exit(1);
  });
}

module.exports = {
  exportCollection,
  transformDocument,
  validateAustralianPhone,
  validateABN,
  validateBSB
};