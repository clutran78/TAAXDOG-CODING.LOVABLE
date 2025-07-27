#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Master compliance monitoring script
 * Runs all compliance monitoring tasks in sequence
 */
async function runAllComplianceMonitoring() {
  console.log('🚀 Starting comprehensive compliance monitoring...\n');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');

  const scripts = [
    {
      name: 'AML/CTF Monitoring',
      script: 'aml-monitoring.ts',
      icon: '💸',
    },
    {
      name: 'Privacy Act Monitoring',
      script: 'privacy-monitoring.ts',
      icon: '🔐',
    },
    {
      name: 'APRA Compliance Monitoring',
      script: 'apra-monitoring.ts',
      icon: '🏛️',
    },
  ];

  let hasErrors = false;

  for (const { name, script, icon } of scripts) {
    console.log(`\n${icon} Running ${name}...`);
    console.log('-'.repeat(40));

    try {
      const scriptPath = path.join(__dirname, script);
      const { stdout, stderr } = await execAsync(`ts-node ${scriptPath}`);

      if (stdout) {
        console.log(stdout);
      }

      if (stderr) {
        console.error('Warnings:', stderr);
      }

      console.log(`✅ ${name} completed successfully`);
    } catch (error: any) {
      console.error(`❌ ${name} failed:`);
      console.error(error.message);
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
      hasErrors = true;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPLIANCE MONITORING SUMMARY');
  console.log('='.repeat(60));

  if (hasErrors) {
    console.log('⚠️  Some monitoring tasks encountered errors');
    console.log('Please review the output above and take necessary actions');
    process.exit(1);
  } else {
    console.log('✅ All compliance monitoring tasks completed successfully');
    console.log(`Completion time: ${new Date().toISOString()}`);
  }

  // Check if monthly report should be generated
  const today = new Date();
  if (today.getDate() === 1) {
    console.log('\n📅 First day of the month detected');
    console.log('Running monthly compliance report generation...');

    try {
      const reportScript = path.join(__dirname, 'generate-monthly-report.ts');
      const { stdout } = await execAsync(`ts-node ${reportScript}`);
      console.log(stdout);
      console.log('✅ Monthly report generated successfully');
    } catch (error: any) {
      console.error('❌ Monthly report generation failed:', error.message);
    }
  }
}

// Run all monitoring
runAllComplianceMonitoring().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
