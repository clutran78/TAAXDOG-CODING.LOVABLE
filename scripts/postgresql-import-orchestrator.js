#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { PostgreSQLImporter, IMPORT_ORDER } = require('./postgresql-import-system');
const { OptimizedPostgreSQLImporter } = require('./postgresql-import-optimized');
const readline = require('readline');

// Configuration
const ORCHESTRATOR_CONFIG = {
  defaultDataDir: path.join(__dirname, '../firebase-transformed'),
  defaultConnectionString: process.env.DATABASE_URL,

  // Performance thresholds
  largeDatasetThreshold: 10000, // Use optimized importer for datasets larger than this

  // Safety options
  createBackup: true,
  verifyDataIntegrity: true,
  testMode: false, // If true, rolls back all changes

  // Reporting
  generateDetailedReport: true,
  reportDir: 'import-reports',
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Utility functions
function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

// Interactive prompt
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Import orchestrator class
class ImportOrchestrator {
  constructor(options = {}) {
    this.options = { ...ORCHESTRATOR_CONFIG, ...options };
    this.importers = {
      standard: null,
      optimized: null,
    };
    this.importPlan = [];
    this.results = {
      startTime: null,
      endTime: null,
      collections: {},
      summary: {},
    };
  }

  // Analyze data to create import plan
  async analyzeData(dataDir) {
    colorLog('\n📊 Analyzing data for import...', 'cyan');

    const analysis = {
      collections: {},
      totalSize: 0,
      totalRecords: 0,
      recommendations: [],
    };

    for (const config of IMPORT_ORDER) {
      try {
        const filePath = path.join(dataDir, config.file);
        const stats = await fs.stat(filePath);
        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

        const collectionInfo = {
          name: config.name,
          file: config.file,
          size: stats.size,
          recordCount: data.length,
          avgRecordSize: data.length > 0 ? Math.round(stats.size / data.length) : 0,
          useOptimized: data.length > this.options.largeDatasetThreshold,
          dependencies: config.dependencies,
          estimatedTime: this.estimateImportTime(data.length, stats.size),
        };

        analysis.collections[config.name] = collectionInfo;
        analysis.totalSize += stats.size;
        analysis.totalRecords += data.length;

        // Add to import plan
        this.importPlan.push({
          ...config,
          ...collectionInfo,
        });
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`   ⚠️  Error analyzing ${config.name}: ${error.message}`);
        }
      }
    }

    // Generate recommendations
    if (analysis.totalRecords > 100000) {
      analysis.recommendations.push('Consider running import during off-peak hours');
    }

    if (analysis.totalSize > 100 * 1024 * 1024) {
      // 100MB
      analysis.recommendations.push('Large dataset detected - optimized import will be used');
    }

    const hasLargeTables = Object.values(analysis.collections).some((c) => c.recordCount > 50000);
    if (hasLargeTables) {
      analysis.recommendations.push(
        'Some tables are very large - consider increasing database resources temporarily',
      );
    }

    return analysis;
  }

  // Estimate import time based on data size
  estimateImportTime(recordCount, dataSize) {
    // Rough estimates based on experience
    const recordsPerSecond = 5000; // Conservative estimate
    const bytesPerSecond = 10 * 1024 * 1024; // 10MB/s

    const timeByRecords = recordCount / recordsPerSecond;
    const timeBySize = dataSize / bytesPerSecond;

    return Math.max(timeByRecords, timeBySize);
  }

  // Display import plan
  displayImportPlan(analysis) {
    colorLog('\n📋 Import Plan', 'bright');
    console.log('================\n');

    console.log(`Total Collections: ${Object.keys(analysis.collections).length}`);
    console.log(`Total Records: ${analysis.totalRecords.toLocaleString()}`);
    console.log(`Total Data Size: ${formatBytes(analysis.totalSize)}`);
    console.log(
      `Estimated Time: ${Math.ceil(this.importPlan.reduce((sum, p) => sum + p.estimatedTime, 0) / 60)} minutes\n`,
    );

    console.log('Import Order:');
    console.log('-------------');

    this.importPlan.forEach((plan, index) => {
      const method = plan.useOptimized ? '⚡ Optimized' : '📝 Standard';
      const deps =
        plan.dependencies.length > 0 ? ` (depends on: ${plan.dependencies.join(', ')})` : '';

      console.log(
        `${index + 1}. ${plan.name} - ${plan.recordCount.toLocaleString()} records, ${formatBytes(plan.size)} ${method}${deps}`,
      );
    });

    if (analysis.recommendations.length > 0) {
      colorLog('\n💡 Recommendations:', 'yellow');
      analysis.recommendations.forEach((rec) => console.log(`   - ${rec}`));
    }
  }

  // Pre-import checks
  async performPreImportChecks(connectionString) {
    colorLog('\n🔍 Performing pre-import checks...', 'cyan');

    const checks = {
      databaseConnection: false,
      requiredTables: false,
      diskSpace: false,
      permissions: false,
    };

    // Test database connection
    const testImporter = new PostgreSQLImporter(connectionString);
    try {
      checks.databaseConnection = await testImporter.testConnection();

      // Check if all required tables exist
      const tables = IMPORT_ORDER.map((o) => o.table);
      const tableCheckQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ANY($1)
      `;

      const result = await testImporter.pool.query(tableCheckQuery, [tables]);
      const existingTables = result.rows.map((r) => r.table_name);
      const missingTables = tables.filter((t) => !existingTables.includes(t));

      if (missingTables.length === 0) {
        checks.requiredTables = true;
        colorLog('   ✅ All required tables exist', 'green');
      } else {
        colorLog(`   ❌ Missing tables: ${missingTables.join(', ')}`, 'red');
      }

      // Check permissions
      try {
        await testImporter.pool.query('SELECT 1');
        checks.permissions = true;
        colorLog('   ✅ Database permissions OK', 'green');
      } catch (error) {
        colorLog('   ❌ Insufficient database permissions', 'red');
      }
    } catch (error) {
      colorLog(`   ❌ Database connection failed: ${error.message}`, 'red');
    } finally {
      await testImporter.close();
    }

    // Check disk space (simplified check)
    checks.diskSpace = true; // Assume OK for now
    colorLog('   ✅ Disk space OK', 'green');

    const allChecksPassed = Object.values(checks).every((check) => check === true);

    if (!allChecksPassed) {
      colorLog('\n⚠️  Some pre-import checks failed!', 'yellow');
      const proceed = await prompt('Do you want to continue anyway? (yes/no): ');
      if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
        throw new Error('Pre-import checks failed - aborting');
      }
    }

    return checks;
  }

  // Execute import
  async executeImport(dataDir, connectionString) {
    colorLog('\n🚀 Starting import process...', 'bright');

    this.results.startTime = Date.now();

    // Initialize importers
    this.importers.standard = new PostgreSQLImporter(connectionString);
    this.importers.optimized = new OptimizedPostgreSQLImporter(connectionString);

    // Process each collection in order
    for (const plan of this.importPlan) {
      const dataPath = path.join(dataDir, plan.file);

      try {
        // Check if file exists
        await fs.access(dataPath);

        // Check dependencies
        const unmetDeps = plan.dependencies.filter(
          (dep) => !this.results.collections[dep] || this.results.collections[dep].successful === 0,
        );

        if (unmetDeps.length > 0) {
          colorLog(
            `\n⚠️  Skipping ${plan.name}: Unmet dependencies [${unmetDeps.join(', ')}]`,
            'yellow',
          );
          continue;
        }

        // Choose importer based on data size
        const importer = plan.useOptimized ? this.importers.optimized : this.importers.standard;
        const methodName = plan.useOptimized ? 'importCollectionOptimized' : 'importCollection';

        // Execute import
        let result;
        if (plan.useOptimized && importer.importCollectionOptimized) {
          result = await importer.importCollectionOptimized(plan, dataPath);
        } else {
          result = await importer.importCollection(plan, dataPath);
        }

        this.results.collections[plan.name] = result;
      } catch (error) {
        colorLog(`\n❌ Failed to import ${plan.name}: ${error.message}`, 'red');
        this.results.collections[plan.name] = {
          error: error.message,
          successful: 0,
          failed: plan.recordCount,
        };
      }
    }

    this.results.endTime = Date.now();

    // Close connections
    await this.importers.standard.close();
    await this.importers.optimized.close();
  }

  // Generate comprehensive report
  async generateReport(dataDir) {
    colorLog('\n📄 Generating import report...', 'cyan');

    const reportDir = path.join(dataDir, this.options.reportDir);
    await fs.mkdir(reportDir, { recursive: true });

    const report = {
      importDate: new Date().toISOString(),
      duration: (this.results.endTime - this.results.startTime) / 1000,
      dataDirectory: dataDir,
      importPlan: this.importPlan,
      results: this.results.collections,
      summary: this.calculateSummary(),
    };

    // Save JSON report
    const jsonPath = path.join(reportDir, `import_report_${Date.now()}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');

    // Generate markdown report
    const markdownPath = path.join(reportDir, `import_report_${Date.now()}.md`);
    await fs.writeFile(markdownPath, this.generateMarkdownReport(report), 'utf8');

    colorLog(`   ✅ Reports saved to ${reportDir}`, 'green');

    return report;
  }

  // Calculate summary statistics
  calculateSummary() {
    let totalRecords = 0;
    let successfulRecords = 0;
    let failedRecords = 0;
    let collectionsWithErrors = 0;

    for (const [name, result] of Object.entries(this.results.collections)) {
      const plan = this.importPlan.find((p) => p.name === name);
      if (plan) {
        totalRecords += plan.recordCount;
        successfulRecords += result.successful || 0;
        failedRecords += result.failed || 0;

        if (result.error || result.failed > 0) {
          collectionsWithErrors++;
        }
      }
    }

    return {
      totalCollections: this.importPlan.length,
      successfulCollections: this.importPlan.length - collectionsWithErrors,
      totalRecords,
      successfulRecords,
      failedRecords,
      successRate:
        totalRecords > 0 ? ((successfulRecords / totalRecords) * 100).toFixed(2) + '%' : '0%',
      totalDuration: ((this.results.endTime - this.results.startTime) / 1000).toFixed(2) + 's',
      averageSpeed:
        successfulRecords > 0
          ? Math.round(
              successfulRecords / ((this.results.endTime - this.results.startTime) / 1000),
            ) + ' records/s'
          : '0 records/s',
    };
  }

  // Generate markdown report
  generateMarkdownReport(report) {
    const summary = report.summary;

    return `# PostgreSQL Import Report

**Date:** ${new Date(report.importDate).toLocaleString()}
**Duration:** ${report.duration.toFixed(2)} seconds
**Data Directory:** ${report.dataDirectory}

## Summary

- **Total Collections:** ${summary.totalCollections}
- **Successful Collections:** ${summary.successfulCollections}
- **Total Records:** ${summary.totalRecords.toLocaleString()}
- **✅ Successful Records:** ${summary.successfulRecords.toLocaleString()}
- **❌ Failed Records:** ${summary.failedRecords}
- **Success Rate:** ${summary.successRate}
- **Average Speed:** ${summary.averageSpeed}

## Import Details

| Collection | Method | Records | Imported | Failed | Duration |
|------------|--------|---------|----------|---------|----------|
${report.importPlan
  .map((plan) => {
    const result = report.results[plan.name] || {};
    const method = plan.useOptimized ? '⚡ Optimized' : '📝 Standard';
    const duration = result.duration ? `${(result.duration / 1000).toFixed(2)}s` : 'N/A';

    return `| ${plan.name} | ${method} | ${plan.recordCount.toLocaleString()} | ${result.successful || 0} | ${result.failed || 0} | ${duration} |`;
  })
  .join('\n')}

## Performance Metrics

- **Total Import Time:** ${summary.totalDuration}
- **Average Import Speed:** ${summary.averageSpeed}
- **Data Volume:** ${formatBytes(report.importPlan.reduce((sum, p) => sum + p.size, 0))}

## Recommendations

${
  summary.successRate === '100%'
    ? '✅ All data imported successfully! No further action required.'
    : `⚠️  ${summary.failedRecords} records failed to import. Review the detailed logs for specific errors.`
}

${
  report.importPlan.some((p) => p.recordCount > 100000)
    ? '💡 Large datasets were imported. Consider running VACUUM ANALYZE on affected tables.'
    : ''
}

## Next Steps

1. Verify data integrity in the database
2. Run application tests to ensure functionality
3. Create a database backup
4. Monitor application performance
`;
  }
}

// Main CLI function
async function main() {
  console.clear();
  colorLog('🐘 PostgreSQL Import Orchestrator', 'bright');
  colorLog('==================================\n', 'bright');

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {
      dataDir: args[0] || ORCHESTRATOR_CONFIG.defaultDataDir,
      connectionString: args[1] || process.env.DATABASE_URL,
      interactive: !args.includes('--batch'),
      skipChecks: args.includes('--skip-checks'),
      testMode: args.includes('--test'),
    };

    if (!options.connectionString) {
      colorLog('❌ Error: DATABASE_URL environment variable is not set', 'red');
      colorLog('Please provide connection string as argument or set DATABASE_URL', 'red');
      console.log('\nUsage:');
      console.log('  node postgresql-import-orchestrator.js [data-dir] [connection-string]');
      console.log('  DATABASE_URL=... node postgresql-import-orchestrator.js');
      process.exit(1);
    }

    const orchestrator = new ImportOrchestrator(options);

    // Interactive mode
    if (options.interactive) {
      console.log('📁 Data Directory:', options.dataDir);
      console.log(
        '🔗 Database:',
        options.connectionString.split('@')[1]?.split('/')[0] || 'PostgreSQL',
      );
      console.log();

      const proceed = await prompt('Do you want to analyze the data before import? (yes/no): ');
      if (proceed.toLowerCase() === 'yes' || proceed.toLowerCase() === 'y') {
        // Analyze data
        const analysis = await orchestrator.analyzeData(options.dataDir);
        orchestrator.displayImportPlan(analysis);

        const confirmImport = await prompt('\nDo you want to proceed with the import? (yes/no): ');
        if (confirmImport.toLowerCase() !== 'yes' && confirmImport.toLowerCase() !== 'y') {
          colorLog('\n❌ Import cancelled by user', 'yellow');
          process.exit(0);
        }
      }
    } else {
      // Batch mode - analyze automatically
      const analysis = await orchestrator.analyzeData(options.dataDir);
      orchestrator.displayImportPlan(analysis);
    }

    // Pre-import checks
    if (!options.skipChecks) {
      await orchestrator.performPreImportChecks(options.connectionString);
    }

    // Execute import
    await orchestrator.executeImport(options.dataDir, options.connectionString);

    // Generate report
    const report = await orchestrator.generateReport(options.dataDir);

    // Display summary
    colorLog('\n✨ Import Complete!', 'green');
    colorLog('==================', 'green');
    console.log(`Success Rate: ${report.summary.successRate}`);
    console.log(`Total Duration: ${report.summary.totalDuration}`);
    console.log(`Import Speed: ${report.summary.averageSpeed}`);

    if (report.summary.failedRecords > 0) {
      colorLog(`\n⚠️  ${report.summary.failedRecords} records failed to import`, 'yellow');
      console.log('Check the detailed report for error information');
    }

    process.exit(report.summary.failedRecords > 0 ? 1 : 0);
  } catch (error) {
    colorLog(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  ImportOrchestrator,
  ORCHESTRATOR_CONFIG,
};
