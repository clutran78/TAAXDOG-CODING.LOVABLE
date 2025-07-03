const fs = require('fs').promises;
const path = require('path');

// Validation rules for each collection
const VALIDATION_RULES = {
  users: {
    required: ['email', 'name'],
    unique: ['email'],
    format: {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^\+61\d{9}$/,
      abn: /^\d{11}$/,
      tfn: /^\d{9}$/
    },
    enums: {
      role: ['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT'],
      taxResidency: ['RESIDENT', 'NON_RESIDENT', 'TEMPORARY_RESIDENT']
    }
  },
  
  bankAccounts: {
    required: ['userId', 'accountName', 'bsb', 'accountNumber'],
    format: {
      bsb: /^\d{3}-\d{3}$/,
      accountNumber: /^\d{6,10}$/
    },
    references: {
      userId: 'users'
    }
  },
  
  transactions: {
    required: ['userId', 'bankAccountId', 'amount', 'date', 'description'],
    types: {
      amount: 'number',
      date: 'date',
      gstAmount: 'number'
    },
    enums: {
      taxCategory: [
        'INCOME',
        'BUSINESS_EXPENSE',
        'PERSONAL',
        'INVESTMENT',
        'GST_PAYABLE',
        'GST_RECEIVABLE',
        'UNCATEGORIZED'
      ]
    },
    references: {
      userId: 'users',
      bankAccountId: 'bankAccounts'
    }
  },
  
  receipts: {
    required: ['userId'],
    types: {
      totalAmount: 'number',
      gstAmount: 'number',
      date: 'date',
      aiConfidence: 'number'
    },
    ranges: {
      aiConfidence: { min: 0, max: 1 }
    },
    references: {
      userId: 'users',
      transactionId: 'transactions'
    }
  },
  
  budgets: {
    required: ['userId', 'name', 'monthlyBudget'],
    types: {
      monthlyBudget: 'number',
      targetSavings: 'number',
      monthlyIncome: 'number',
      confidenceScore: 'number'
    },
    ranges: {
      confidenceScore: { min: 0, max: 1 }
    },
    references: {
      userId: 'users'
    }
  },
  
  budgetTracking: {
    required: ['budgetId', 'userId', 'month', 'year'],
    types: {
      predictedAmount: 'number',
      actualAmount: 'number',
      variance: 'number',
      month: 'number',
      year: 'number'
    },
    ranges: {
      month: { min: 1, max: 12 },
      year: { min: 2020, max: 2030 }
    },
    references: {
      userId: 'users',
      budgetId: 'budgets'
    }
  },
  
  financialInsights: {
    required: ['userId', 'insightType'],
    types: {
      confidenceScore: 'number'
    },
    ranges: {
      confidenceScore: { min: 0, max: 1 }
    },
    enums: {
      priority: ['HIGH', 'MEDIUM', 'LOW'],
      insightType: [
        'SPENDING_PATTERN',
        'SAVING_OPPORTUNITY',
        'TAX_OPTIMIZATION',
        'BUDGET_ALERT',
        'INVESTMENT_SUGGESTION'
      ]
    },
    references: {
      userId: 'users'
    }
  }
};

// Validation results
const validationResults = {
  collections: {},
  summary: {
    totalErrors: 0,
    totalWarnings: 0,
    missingReferences: []
  }
};

// Load exported data
async function loadExportedData(exportDir) {
  const data = {};
  const mappings = {};
  
  for (const collection of Object.keys(VALIDATION_RULES)) {
    try {
      const dataPath = path.join(exportDir, `${collection}.json`);
      const mappingPath = path.join(exportDir, 'mappings', `${collection}_mapping.json`);
      
      if (await fileExists(dataPath)) {
        data[collection] = JSON.parse(await fs.readFile(dataPath, 'utf8'));
        console.log(`Loaded ${data[collection].length} documents from ${collection}`);
      }
      
      if (await fileExists(mappingPath)) {
        mappings[collection] = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
      }
    } catch (error) {
      console.error(`Error loading ${collection}:`, error.message);
    }
  }
  
  return { data, mappings };
}

// Check if file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Validate a single document
function validateDocument(doc, collectionName, rules, allData) {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  if (rules.required) {
    for (const field of rules.required) {
      if (!doc[field] && doc[field] !== 0) {
        errors.push({
          type: 'MISSING_REQUIRED',
          field,
          message: `Required field '${field}' is missing`
        });
      }
    }
  }
  
  // Check data types
  if (rules.types) {
    for (const [field, expectedType] of Object.entries(rules.types)) {
      if (doc[field] !== undefined && doc[field] !== null) {
        if (expectedType === 'number' && typeof doc[field] !== 'number') {
          errors.push({
            type: 'INVALID_TYPE',
            field,
            message: `Field '${field}' should be a number, got ${typeof doc[field]}`
          });
        } else if (expectedType === 'date') {
          const date = new Date(doc[field]);
          if (isNaN(date.getTime())) {
            errors.push({
              type: 'INVALID_DATE',
              field,
              message: `Field '${field}' contains invalid date: ${doc[field]}`
            });
          }
        }
      }
    }
  }
  
  // Check formats
  if (rules.format) {
    for (const [field, regex] of Object.entries(rules.format)) {
      if (doc[field] && !regex.test(doc[field])) {
        warnings.push({
          type: 'INVALID_FORMAT',
          field,
          value: doc[field],
          message: `Field '${field}' has invalid format: ${doc[field]}`
        });
      }
    }
  }
  
  // Check enums
  if (rules.enums) {
    for (const [field, validValues] of Object.entries(rules.enums)) {
      if (doc[field] && !validValues.includes(doc[field])) {
        errors.push({
          type: 'INVALID_ENUM',
          field,
          value: doc[field],
          message: `Field '${field}' has invalid value: ${doc[field]}. Valid values: ${validValues.join(', ')}`
        });
      }
    }
  }
  
  // Check ranges
  if (rules.ranges) {
    for (const [field, range] of Object.entries(rules.ranges)) {
      if (doc[field] !== undefined && doc[field] !== null) {
        if (range.min !== undefined && doc[field] < range.min) {
          errors.push({
            type: 'OUT_OF_RANGE',
            field,
            value: doc[field],
            message: `Field '${field}' value ${doc[field]} is below minimum ${range.min}`
          });
        }
        if (range.max !== undefined && doc[field] > range.max) {
          errors.push({
            type: 'OUT_OF_RANGE',
            field,
            value: doc[field],
            message: `Field '${field}' value ${doc[field]} is above maximum ${range.max}`
          });
        }
      }
    }
  }
  
  // Check references
  if (rules.references) {
    for (const [field, targetCollection] of Object.entries(rules.references)) {
      if (doc[field] && allData[targetCollection]) {
        const exists = allData[targetCollection].some(
          targetDoc => targetDoc._firebaseId === doc[field]
        );
        if (!exists) {
          warnings.push({
            type: 'MISSING_REFERENCE',
            field,
            value: doc[field],
            targetCollection,
            message: `Reference '${field}' points to non-existent ${targetCollection} document: ${doc[field]}`
          });
          
          validationResults.summary.missingReferences.push({
            collection: collectionName,
            document: doc._firebaseId,
            field,
            targetCollection,
            targetId: doc[field]
          });
        }
      }
    }
  }
  
  return { errors, warnings };
}

// Validate collection
function validateCollection(collectionName, documents, rules, allData) {
  console.log(`\nValidating ${collectionName}...`);
  
  const collectionResults = {
    documentCount: documents.length,
    validDocuments: 0,
    documentsWithErrors: 0,
    documentsWithWarnings: 0,
    errors: [],
    warnings: [],
    uniqueViolations: []
  };
  
  // Check unique constraints
  if (rules.unique) {
    for (const field of rules.unique) {
      const values = new Map();
      documents.forEach((doc, index) => {
        if (doc[field]) {
          if (values.has(doc[field])) {
            collectionResults.uniqueViolations.push({
              field,
              value: doc[field],
              documents: [values.get(doc[field]), index]
            });
          } else {
            values.set(doc[field], index);
          }
        }
      });
    }
  }
  
  // Validate each document
  documents.forEach((doc, index) => {
    const { errors, warnings } = validateDocument(doc, collectionName, rules, allData);
    
    if (errors.length > 0) {
      collectionResults.documentsWithErrors++;
      collectionResults.errors.push({
        documentId: doc._firebaseId,
        documentIndex: index,
        errors
      });
    } else if (warnings.length === 0) {
      collectionResults.validDocuments++;
    }
    
    if (warnings.length > 0) {
      collectionResults.documentsWithWarnings++;
      collectionResults.warnings.push({
        documentId: doc._firebaseId,
        documentIndex: index,
        warnings
      });
    }
  });
  
  console.log(`  ✓ Valid documents: ${collectionResults.validDocuments}/${documents.length}`);
  if (collectionResults.documentsWithErrors > 0) {
    console.log(`  ✗ Documents with errors: ${collectionResults.documentsWithErrors}`);
  }
  if (collectionResults.documentsWithWarnings > 0) {
    console.log(`  ⚠ Documents with warnings: ${collectionResults.documentsWithWarnings}`);
  }
  if (collectionResults.uniqueViolations.length > 0) {
    console.log(`  ✗ Unique constraint violations: ${collectionResults.uniqueViolations.length}`);
  }
  
  validationResults.summary.totalErrors += collectionResults.errors.length;
  validationResults.summary.totalWarnings += collectionResults.warnings.length;
  
  return collectionResults;
}

// Generate validation report
async function generateValidationReport(exportDir) {
  const reportPath = path.join(exportDir, 'validation_report.json');
  const readmePath = path.join(exportDir, 'VALIDATION_REPORT.md');
  
  await fs.writeFile(reportPath, JSON.stringify(validationResults, null, 2), 'utf8');
  
  // Generate markdown report
  let markdown = `# Firebase Data Validation Report

**Generated:** ${new Date().toISOString()}

## Summary

- **Total Errors:** ${validationResults.summary.totalErrors}
- **Total Warnings:** ${validationResults.summary.totalWarnings}
- **Missing References:** ${validationResults.summary.missingReferences.length}

## Collection Results
`;
  
  for (const [collection, results] of Object.entries(validationResults.collections)) {
    markdown += `
### ${collection}

- **Total Documents:** ${results.documentCount}
- **Valid Documents:** ${results.validDocuments}
- **Documents with Errors:** ${results.documentsWithErrors}
- **Documents with Warnings:** ${results.documentsWithWarnings}
- **Unique Violations:** ${results.uniqueViolations.length}
`;
    
    if (results.errors.length > 0) {
      markdown += '\n#### Sample Errors (first 5):\n';
      results.errors.slice(0, 5).forEach(docError => {
        markdown += `- Document ${docError.documentId}:\n`;
        docError.errors.forEach(err => {
          markdown += `  - ${err.message}\n`;
        });
      });
    }
    
    if (results.uniqueViolations.length > 0) {
      markdown += '\n#### Unique Constraint Violations:\n';
      results.uniqueViolations.forEach(violation => {
        markdown += `- Field '${violation.field}' value '${violation.value}' appears in multiple documents\n`;
      });
    }
  }
  
  if (validationResults.summary.missingReferences.length > 0) {
    markdown += '\n## Missing References\n\n';
    markdown += '| Collection | Document | Field | Target Collection | Target ID |\n';
    markdown += '|------------|----------|-------|-------------------|----------|\n';
    validationResults.summary.missingReferences.slice(0, 20).forEach(ref => {
      markdown += `| ${ref.collection} | ${ref.document} | ${ref.field} | ${ref.targetCollection} | ${ref.targetId} |\n`;
    });
    
    if (validationResults.summary.missingReferences.length > 20) {
      markdown += `\n*... and ${validationResults.summary.missingReferences.length - 20} more missing references*\n`;
    }
  }
  
  markdown += '\n## Recommendations\n\n';
  if (validationResults.summary.totalErrors > 0) {
    markdown += '1. **Fix Critical Errors:** Address all validation errors before importing to PostgreSQL\n';
  }
  if (validationResults.summary.missingReferences.length > 0) {
    markdown += '2. **Resolve References:** Ensure all referenced documents exist or update references\n';
  }
  if (validationResults.summary.totalWarnings > 0) {
    markdown += '3. **Review Warnings:** Check format warnings for data quality issues\n';
  }
  
  await fs.writeFile(readmePath, markdown, 'utf8');
  
  return validationResults;
}

// Main validation function
async function main() {
  const exportDir = process.argv[2] || path.join(__dirname, '../firebase-exports');
  
  console.log('Firebase Data Validation');
  console.log('=======================\n');
  console.log(`Export directory: ${exportDir}\n`);
  
  try {
    // Load exported data
    const { data, mappings } = await loadExportedData(exportDir);
    
    // Validate each collection
    for (const [collectionName, rules] of Object.entries(VALIDATION_RULES)) {
      if (data[collectionName]) {
        validationResults.collections[collectionName] = validateCollection(
          collectionName,
          data[collectionName],
          rules,
          data
        );
      } else {
        console.log(`\nSkipping ${collectionName} - no data found`);
      }
    }
    
    // Generate report
    await generateValidationReport(exportDir);
    
    console.log('\n\nValidation Complete!');
    console.log('===================');
    console.log(`Total errors: ${validationResults.summary.totalErrors}`);
    console.log(`Total warnings: ${validationResults.summary.totalWarnings}`);
    console.log(`Missing references: ${validationResults.summary.missingReferences.length}`);
    console.log(`\nDetailed report: ${path.join(exportDir, 'VALIDATION_REPORT.md')}`);
    
  } catch (error) {
    console.error('\nValidation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateDocument,
  validateCollection,
  VALIDATION_RULES
};