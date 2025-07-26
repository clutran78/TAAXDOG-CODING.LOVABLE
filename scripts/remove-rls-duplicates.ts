#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

/**
 * Script to remove RLS-migrated duplicate files
 * These files were created during a previous migration but are no longer needed
 */

const RLS_DUPLICATE_FILES = [
  // AI endpoints
  'pages/api/ai/budget-prediction-rls-migrated.ts',
  'pages/api/ai/generate-insights-rls-migrated.ts', 
  'pages/api/ai/process-receipt-rls-migrated.ts',
  
  // Auth endpoints
  'pages/api/auth/change-password-rls-migrated.ts',
  'pages/api/auth/profile-rls-migrated.ts',
  'pages/api/auth/sessions-rls-migrated.ts',
  'pages/api/auth/two-factor-rls-migrated.ts',
  
  // Basiq endpoints
  'pages/api/basiq/connections-rls-migrated.ts',
  
  // Budget endpoints
  'pages/api/budgets/[id]/index-rls-migrated.ts',
  'pages/api/budgets/[id]/variance-rls-migrated.ts',
  'pages/api/budgets/index-rls-migrated.ts',
  
  // Insights endpoints
  'pages/api/insights/[id]/dismiss-rls-migrated.ts',
  'pages/api/insights/index-rls-migrated.ts',
  
  // Receipt endpoints
  'pages/api/receipts/[id]/update-rls-migrated.ts',
  'pages/api/receipts/index-rls-migrated.ts',
  'pages/api/receipts/process/[id]-rls-migrated.ts',
  'pages/api/receipts/upload-rls-migrated.ts',
  
  // Stripe endpoints
  'pages/api/stripe/cancel-subscription-rls-migrated.ts',
  'pages/api/stripe/create-checkout-session-rls-migrated.ts',
  'pages/api/stripe/create-subscription-rls-migrated.ts',
  'pages/api/stripe/customer-portal-rls-migrated.ts',
  'pages/api/stripe/invoices-rls-migrated.ts',
  'pages/api/stripe/payment-methods-rls-migrated.ts',
  'pages/api/stripe/tax-invoice-rls-migrated.ts',
  'pages/api/stripe/update-subscription-rls-migrated.ts',
  
  // Service files
  'lib/goals/goal-service-rls.ts',
  'lib/middleware/rls-middleware.ts',
  'lib/services/database/prisma-rls.ts',
  
  // Updated duplicate files
  'pages/api/receipts/index-updated.ts',
  'pages/api/receipts/upload-updated.ts'
];

async function removeDuplicates() {
  logger.info('Starting RLS duplicate removal...');
  
  let removedCount = 0;
  let errorCount = 0;
  
  for (const file of RLS_DUPLICATE_FILES) {
    const filePath = path.join(process.cwd(), file);
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Removed: ${file}`);
        removedCount++;
      } else {
        logger.warn(`File not found: ${file}`);
      }
    } catch (error) {
      logger.error(`Error removing ${file}:`, error);
      errorCount++;
    }
  }
  
  logger.info(`\nSummary:`);
  logger.info(`- Files removed: ${removedCount}`);
  logger.info(`- Files not found: ${RLS_DUPLICATE_FILES.length - removedCount - errorCount}`);
  logger.info(`- Errors: ${errorCount}`);
  
  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run the script
removeDuplicates().catch(error => {
  logger.error('Script failed:', error);
  process.exit(1);
});