#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Pipeline configuration
const PIPELINE_CONFIG = {
  baseDir: path.join(__dirname, '..'),
  exportDir: 'firebase-exports',
  transformedDir: 'firebase-transformed',
  steps: [
    { name: 'export', script: 'firebase-export.js', required: true },
    { name: 'validate', script: 'firebase-data-validator.js', required: false },
    { name: 'transform', script: 'firebase-to-postgresql-transformer.js', required: true },
    { name: 'import', script: 'postgresql-import.js', required: true },
  ],
};

// Pipeline state
const pipelineState = {
  startTime: null,
  endTime: null,
  steps: {},
  errors: [],
  warnings: [],
};

// Utility functions
function logStep(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix =
    {
      info: '📌',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    }[type] || '📌';

  console.log(`\n${prefix} [${timestamp}] ${message}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 ${title}`);
  console.log('='.repeat(60));
}

// Check prerequisites
async function checkPrerequisites() {
  logSection('Checking Prerequisites');

  const checks = {
    nodeVersion: false,
    firebaseConfig: false,
    dependencies: false,
    database: false,
  };

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion >= 14) {
    checks.nodeVersion = true;
    logStep(`Node.js version: ${nodeVersion}`, 'success');
  } else {
    logStep(`Node.js version ${nodeVersion} is too old. Required: v14+`, 'error');
  }

  // Check Firebase configuration
  try {
    await fs.access(path.join(PIPELINE_CONFIG.baseDir, 'config/firebase-adminsdk.json'));
    checks.firebaseConfig = true;
    logStep('Firebase configuration found', 'success');
  } catch {
    logStep('Firebase configuration not found at config/firebase-adminsdk.json', 'error');
  }

  // Check dependencies
  const requiredPackages = ['firebase-admin', 'pg', 'uuid', 'date-fns'];
  const missingPackages = [];

  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
    } catch {
      missingPackages.push(pkg);
    }
  }

  if (missingPackages.length === 0) {
    checks.dependencies = true;
    logStep('All required dependencies installed', 'success');
  } else {
    logStep(`Missing dependencies: ${missingPackages.join(', ')}`, 'error');
    logStep('Run: npm install firebase-admin pg uuid date-fns', 'info');
  }

  // Check database connection
  if (process.env.DATABASE_URL) {
    checks.database = true;
    logStep('Database URL configured', 'success');
  } else {
    logStep('DATABASE_URL environment variable not set', 'warning');
    logStep('Using default: postgresql://genesis@localhost:5432/taaxdog_development', 'info');
  }

  const allChecks = Object.values(checks).every((check) => check);

  if (!allChecks) {
    throw new Error('Prerequisites not met. Please fix the issues above.');
  }

  return checks;
}

// Run a pipeline step
async function runStep(step, args = []) {
  const stepStart = Date.now();
  logStep(`Running ${step.name}...`, 'info');

  try {
    const scriptPath = path.join(__dirname, step.script);
    const command = `node ${scriptPath} ${args.join(' ')}`;

    execSync(command, {
      stdio: 'inherit',
      cwd: PIPELINE_CONFIG.baseDir,
    });

    const duration = Date.now() - stepStart;
    pipelineState.steps[step.name] = {
      status: 'success',
      duration,
      timestamp: new Date().toISOString(),
    };

    logStep(`${step.name} completed in ${(duration / 1000).toFixed(2)}s`, 'success');
    return true;
  } catch (error) {
    const duration = Date.now() - stepStart;
    pipelineState.steps[step.name] = {
      status: 'failed',
      duration,
      error: error.message,
      timestamp: new Date().toISOString(),
    };

    if (step.required) {
      throw new Error(`Step '${step.name}' failed: ${error.message}`);
    } else {
      logStep(`${step.name} failed (non-critical): ${error.message}`, 'warning');
      pipelineState.warnings.push({
        step: step.name,
        error: error.message,
      });
      return false;
    }
  }
}

// Create pipeline summary
async function createPipelineSummary() {
  const summaryPath = path.join(
    PIPELINE_CONFIG.baseDir,
    PIPELINE_CONFIG.transformedDir,
    'pipeline_summary.json',
  );
  const readmePath = path.join(
    PIPELINE_CONFIG.baseDir,
    PIPELINE_CONFIG.transformedDir,
    'PIPELINE_SUMMARY.md',
  );

  pipelineState.endTime = Date.now();
  const totalDuration = pipelineState.endTime - pipelineState.startTime;

  const summary = {
    ...pipelineState,
    totalDuration,
    completedAt: new Date().toISOString(),
    success: pipelineState.errors.length === 0,
  };

  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  // Generate markdown summary
  let markdown = `# Firebase to PostgreSQL Migration Pipeline Summary

**Completed:** ${new Date().toISOString()}
**Total Duration:** ${(totalDuration / 1000).toFixed(2)} seconds
**Status:** ${summary.success ? '✅ Success' : '❌ Failed'}

## Pipeline Steps

| Step | Status | Duration | Details |
|------|--------|----------|---------|
`;

  for (const [stepName, stepData] of Object.entries(pipelineState.steps)) {
    const status = stepData.status === 'success' ? '✅' : '❌';
    const duration = `${(stepData.duration / 1000).toFixed(2)}s`;
    const details = stepData.error || 'Completed successfully';
    markdown += `| ${stepName} | ${status} | ${duration} | ${details} |\n`;
  }

  if (pipelineState.warnings.length > 0) {
    markdown += '\n## Warnings\n\n';
    pipelineState.warnings.forEach((warning) => {
      markdown += `- **${warning.step}:** ${warning.error}\n`;
    });
  }

  if (pipelineState.errors.length > 0) {
    markdown += '\n## Errors\n\n';
    pipelineState.errors.forEach((error) => {
      markdown += `- ${error}\n`;
    });
  }

  markdown += `
## Output Directories

- **Firebase Exports:** \`${PIPELINE_CONFIG.exportDir}/\`
- **Transformed Data:** \`${PIPELINE_CONFIG.transformedDir}/\`

## Next Steps

1. Review the transformation and import reports
2. Verify data integrity in PostgreSQL
3. Test application functionality with migrated data
4. Back up the migrated database

## Important Files

- **Export Summary:** \`${PIPELINE_CONFIG.exportDir}/export_summary.json\`
- **Validation Report:** \`${PIPELINE_CONFIG.exportDir}/VALIDATION_REPORT.md\`
- **Transformation Report:** \`${PIPELINE_CONFIG.transformedDir}/transformation_report.json\`
- **Import Report:** \`${PIPELINE_CONFIG.transformedDir}/IMPORT_REPORT.md\`
- **ID Mappings:** \`${PIPELINE_CONFIG.transformedDir}/id_mappings.json\`
`;

  await fs.writeFile(readmePath, markdown, 'utf8');

  return summary;
}

// Interactive mode
async function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  console.log('\n🔄 Firebase to PostgreSQL Migration Pipeline');
  console.log('This will migrate all data from Firebase to PostgreSQL.\n');

  const confirm = await question('Do you want to continue? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('\nMigration cancelled.');
    rl.close();
    process.exit(0);
  }

  const runValidation = await question('\nRun data validation? (recommended) (yes/no): ');
  const skipValidation =
    runValidation.toLowerCase() === 'no' || runValidation.toLowerCase() === 'n';

  const dbUrl = await question('\nDatabase URL (press Enter for default): ');
  if (dbUrl.trim()) {
    process.env.DATABASE_URL = dbUrl.trim();
  }

  rl.close();

  return { skipValidation };
}

// Main pipeline function
async function runPipeline(options = {}) {
  logSection('Firebase to PostgreSQL Migration Pipeline');

  pipelineState.startTime = Date.now();

  try {
    // Check prerequisites
    await checkPrerequisites();

    // Create directories
    await fs.mkdir(path.join(PIPELINE_CONFIG.baseDir, PIPELINE_CONFIG.exportDir), {
      recursive: true,
    });
    await fs.mkdir(path.join(PIPELINE_CONFIG.baseDir, PIPELINE_CONFIG.transformedDir), {
      recursive: true,
    });

    // Step 1: Export from Firebase
    logSection('Step 1: Export from Firebase');
    await runStep(PIPELINE_CONFIG.steps[0]);

    // Step 2: Validate exported data (optional)
    if (!options.skipValidation) {
      logSection('Step 2: Validate Exported Data');
      await runStep(PIPELINE_CONFIG.steps[1], [
        path.join(PIPELINE_CONFIG.baseDir, PIPELINE_CONFIG.exportDir),
      ]);
    } else {
      logStep('Skipping validation step', 'warning');
    }

    // Step 3: Transform data
    logSection('Step 3: Transform Data for PostgreSQL');
    await runStep(PIPELINE_CONFIG.steps[2], [
      path.join(PIPELINE_CONFIG.baseDir, PIPELINE_CONFIG.exportDir),
      path.join(PIPELINE_CONFIG.baseDir, PIPELINE_CONFIG.transformedDir),
    ]);

    // Step 4: Import to PostgreSQL
    logSection('Step 4: Import to PostgreSQL');
    await runStep(PIPELINE_CONFIG.steps[3], [
      path.join(PIPELINE_CONFIG.baseDir, PIPELINE_CONFIG.transformedDir),
    ]);

    // Create summary
    logSection('Creating Pipeline Summary');
    const summary = await createPipelineSummary();

    // Final report
    logSection('Migration Complete! 🎉');
    console.log(`\nTotal Duration: ${(summary.totalDuration / 1000).toFixed(2)} seconds`);
    console.log(`Summary saved to: ${PIPELINE_CONFIG.transformedDir}/PIPELINE_SUMMARY.md`);

    if (summary.warnings.length > 0) {
      console.log(`\n⚠️  ${summary.warnings.length} warnings occurred during migration`);
    }

    console.log('\nNext steps:');
    console.log('1. Review the pipeline summary and reports');
    console.log('2. Verify data in PostgreSQL database');
    console.log('3. Test application functionality');
    console.log('4. Create a database backup');
  } catch (error) {
    pipelineState.errors.push(error.message);
    logStep(`Pipeline failed: ${error.message}`, 'error');

    // Create summary even on failure
    try {
      await createPipelineSummary();
    } catch (summaryError) {
      console.error('Failed to create summary:', summaryError.message);
    }

    throw error;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  const options = {
    interactive: !args.includes('--no-interactive'),
    skipValidation: args.includes('--skip-validation'),
  };

  try {
    if (options.interactive) {
      const interactiveOptions = await runInteractive();
      Object.assign(options, interactiveOptions);
    }

    await runPipeline(options);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runPipeline,
  checkPrerequisites,
};
