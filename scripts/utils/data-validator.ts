/**
 * Data Validation Utilities for Migration Safety
 *
 * Provides comprehensive validation checks to ensure data integrity
 * before, during, and after migrations.
 */

import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import { createHash } from 'crypto';

const prisma = new PrismaClient({
  log: ['error'],
});

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

export interface ValidationError {
  type: string;
  message: string;
  details?: any;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ValidationWarning {
  type: string;
  message: string;
  details?: any;
}

export interface ValidationStats {
  totalRecords: Record<string, number>;
  validRecords: Record<string, number>;
  invalidRecords: Record<string, number>;
  processingTime: number;
}

/**
 * Validate database integrity
 */
export async function validateDatabaseIntegrity(): Promise<boolean> {
  console.log(chalk.blue('\n🔍 Validating database integrity...\n'));

  const validators = [
    validateReferentialIntegrity,
    validateDataConsistency,
    validateBusinessRules,
    validateAustralianCompliance,
    validateEncryptedFields,
  ];

  let allValid = true;

  for (const validator of validators) {
    try {
      const result = await validator();
      if (!result.isValid) {
        allValid = false;
        displayValidationResult(result);
      }
    } catch (error) {
      console.error(chalk.red(`Validation error: ${error}`));
      allValid = false;
    }
  }

  return allValid;
}

/**
 * Validate referential integrity
 */
async function validateReferentialIntegrity(): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const stats: ValidationStats = {
    totalRecords: {},
    validRecords: {},
    invalidRecords: {},
    processingTime: 0,
  };

  console.log(chalk.cyan('Checking referential integrity...'));

  // Check transactions with missing bank accounts
  const orphanedTransactions = await prisma.transaction.count({
    where: {
      bankAccountId: { not: null },
      bankAccount: null,
    },
  });

  if (orphanedTransactions > 0) {
    errors.push({
      type: 'ORPHANED_TRANSACTIONS',
      message: `Found ${orphanedTransactions} transactions with missing bank accounts`,
      severity: 'high',
      details: { count: orphanedTransactions },
    });
  }

  // Check goals with missing users
  const orphanedGoals = await prisma.goal.count({
    where: {
      userId: { not: null },
      user: null,
    },
  });

  if (orphanedGoals > 0) {
    errors.push({
      type: 'ORPHANED_GOALS',
      message: `Found ${orphanedGoals} goals with missing users`,
      severity: 'high',
      details: { count: orphanedGoals },
    });
  }

  // Check receipts with missing users
  const orphanedReceipts = await prisma.receipt.count({
    where: {
      userId: { not: null },
      user: null,
    },
  });

  if (orphanedReceipts > 0) {
    errors.push({
      type: 'ORPHANED_RECEIPTS',
      message: `Found ${orphanedReceipts} receipts with missing users`,
      severity: 'medium',
      details: { count: orphanedReceipts },
    });
  }

  // Check bank accounts with missing users
  const orphanedAccounts = await prisma.bankAccount.count({
    where: {
      userId: { not: null },
      user: null,
    },
  });

  if (orphanedAccounts > 0) {
    errors.push({
      type: 'ORPHANED_BANK_ACCOUNTS',
      message: `Found ${orphanedAccounts} bank accounts with missing users`,
      severity: 'high',
      details: { count: orphanedAccounts },
    });
  }

  stats.processingTime = Date.now() - startTime;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * Validate data consistency
 */
async function validateDataConsistency(): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const stats: ValidationStats = {
    totalRecords: {},
    validRecords: {},
    invalidRecords: {},
    processingTime: 0,
  };

  console.log(chalk.cyan('Checking data consistency...'));

  // Check goal progress consistency
  const goals = await prisma.goal.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      currentAmount: true,
      targetAmount: true,
    },
  });

  let inconsistentGoals = 0;
  for (const goal of goals) {
    if (goal.currentAmount > goal.targetAmount) {
      inconsistentGoals++;
    }
  }

  if (inconsistentGoals > 0) {
    warnings.push({
      type: 'GOAL_PROGRESS_EXCEEDED',
      message: `Found ${inconsistentGoals} goals where current amount exceeds target`,
      details: { count: inconsistentGoals },
    });
  }

  // Check transaction amounts
  const invalidTransactions = await prisma.transaction.count({
    where: {
      OR: [{ amount: 0 }, { amount: null }],
    },
  });

  if (invalidTransactions > 0) {
    errors.push({
      type: 'INVALID_TRANSACTION_AMOUNTS',
      message: `Found ${invalidTransactions} transactions with invalid amounts`,
      severity: 'medium',
      details: { count: invalidTransactions },
    });
  }

  // Check bank account balances
  const negativeBalances = await prisma.bankAccount.count({
    where: {
      balance: { lt: 0 },
      accountType: { notIn: ['CREDIT_CARD', 'LOAN'] },
    },
  });

  if (negativeBalances > 0) {
    warnings.push({
      type: 'NEGATIVE_BALANCES',
      message: `Found ${negativeBalances} non-credit accounts with negative balances`,
      details: { count: negativeBalances },
    });
  }

  stats.processingTime = Date.now() - startTime;

  return {
    isValid: errors.filter((e) => e.severity === 'critical').length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * Validate business rules
 */
async function validateBusinessRules(): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const stats: ValidationStats = {
    totalRecords: {},
    validRecords: {},
    invalidRecords: {},
    processingTime: 0,
  };

  console.log(chalk.cyan('Checking business rules...'));

  // Check subscription validity
  const invalidSubscriptions = await prisma.subscription.count({
    where: {
      currentPeriodEnd: { lt: new Date() },
      status: 'active',
    },
  });

  if (invalidSubscriptions > 0) {
    errors.push({
      type: 'EXPIRED_ACTIVE_SUBSCRIPTIONS',
      message: `Found ${invalidSubscriptions} expired subscriptions marked as active`,
      severity: 'high',
      details: { count: invalidSubscriptions },
    });
  }

  // Check user roles
  const invalidRoles = await prisma.user.count({
    where: {
      role: { notIn: ['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT'] },
    },
  });

  if (invalidRoles > 0) {
    errors.push({
      type: 'INVALID_USER_ROLES',
      message: `Found ${invalidRoles} users with invalid roles`,
      severity: 'critical',
      details: { count: invalidRoles },
    });
  }

  // Check email verification
  const unverifiedOldUsers = await prisma.user.count({
    where: {
      emailVerified: null,
      createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days
    },
  });

  if (unverifiedOldUsers > 0) {
    warnings.push({
      type: 'UNVERIFIED_OLD_USERS',
      message: `Found ${unverifiedOldUsers} users created over 30 days ago without email verification`,
      details: { count: unverifiedOldUsers },
    });
  }

  stats.processingTime = Date.now() - startTime;

  return {
    isValid: errors.filter((e) => e.severity === 'critical' || e.severity === 'high').length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * Validate Australian compliance requirements
 */
async function validateAustralianCompliance(): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const stats: ValidationStats = {
    totalRecords: {},
    validRecords: {},
    invalidRecords: {},
    processingTime: 0,
  };

  console.log(chalk.cyan('Checking Australian compliance...'));

  // Validate ABN format (11 digits)
  const invalidABNs = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count 
    FROM users 
    WHERE abn IS NOT NULL 
    AND NOT abn ~ '^[0-9]{11}$'
  `;

  if (Number(invalidABNs[0].count) > 0) {
    errors.push({
      type: 'INVALID_ABN_FORMAT',
      message: `Found ${invalidABNs[0].count} users with invalid ABN format`,
      severity: 'medium',
      details: { count: Number(invalidABNs[0].count) },
    });
  }

  // Check GST amounts
  const invalidGST = await prisma.transaction.count({
    where: {
      gstAmount: { not: null },
      amount: { not: null },
      OR: [{ gstAmount: { gt: prisma.transaction.fields.amount } }, { gstAmount: { lt: 0 } }],
    },
  });

  if (invalidGST > 0) {
    errors.push({
      type: 'INVALID_GST_AMOUNTS',
      message: `Found ${invalidGST} transactions with invalid GST amounts`,
      severity: 'high',
      details: { count: invalidGST },
    });
  }

  // Check tax categories
  const validTaxCategories = [
    'D1',
    'D2',
    'D3',
    'D4',
    'D5',
    'D6',
    'D7',
    'D8',
    'D9',
    'D10',
    'D11',
    'D12',
    'D13',
    'D14',
    'D15',
    'P8',
    'PERSONAL',
  ];

  const invalidTaxCategories = await prisma.transaction.count({
    where: {
      taxCategory: { not: null },
      taxCategory: { notIn: validTaxCategories },
    },
  });

  if (invalidTaxCategories > 0) {
    errors.push({
      type: 'INVALID_TAX_CATEGORIES',
      message: `Found ${invalidTaxCategories} transactions with invalid tax categories`,
      severity: 'medium',
      details: { count: invalidTaxCategories },
    });
  }

  stats.processingTime = Date.now() - startTime;

  return {
    isValid: errors.filter((e) => e.severity === 'critical' || e.severity === 'high').length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * Validate encrypted fields
 */
async function validateEncryptedFields(): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const stats: ValidationStats = {
    totalRecords: {},
    validRecords: {},
    invalidRecords: {},
    processingTime: 0,
  };

  console.log(chalk.cyan('Checking encrypted fields...'));

  // Check for unencrypted sensitive data
  const unencryptedTFNs = await prisma.user.count({
    where: {
      tfn: { not: null },
      tfn: { not: { startsWith: 'encrypted:' } },
    },
  });

  if (unencryptedTFNs > 0) {
    errors.push({
      type: 'UNENCRYPTED_TFN',
      message: `Found ${unencryptedTFNs} users with unencrypted TFN data`,
      severity: 'critical',
      details: { count: unencryptedTFNs },
    });
  }

  // Check bank account encryption
  const unencryptedAccounts = await prisma.bankAccount.count({
    where: {
      OR: [
        {
          accountNumber: { not: null },
          accountNumber: { not: { startsWith: 'encrypted:' } },
        },
        {
          bsb: { not: null },
          bsb: { not: { startsWith: 'encrypted:' } },
        },
      ],
    },
  });

  if (unencryptedAccounts > 0) {
    errors.push({
      type: 'UNENCRYPTED_BANK_DETAILS',
      message: `Found ${unencryptedAccounts} bank accounts with unencrypted details`,
      severity: 'critical',
      details: { count: unencryptedAccounts },
    });
  }

  stats.processingTime = Date.now() - startTime;

  return {
    isValid: errors.filter((e) => e.severity === 'critical').length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * Display validation results
 */
function displayValidationResult(result: ValidationResult): void {
  if (result.errors.length > 0) {
    console.log(chalk.red('\n❌ Validation Errors:'));
    result.errors.forEach((error) => {
      const severityColor = {
        critical: chalk.red,
        high: chalk.magenta,
        medium: chalk.yellow,
        low: chalk.blue,
      };
      console.log(
        `  ${severityColor[error.severity](`[${error.severity.toUpperCase()}]`)} ${error.message}`,
      );
      if (error.details) {
        console.log(chalk.gray(`    Details: ${JSON.stringify(error.details)}`));
      }
    });
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warnings:'));
    result.warnings.forEach((warning) => {
      console.log(`  ${warning.message}`);
      if (warning.details) {
        console.log(chalk.gray(`    Details: ${JSON.stringify(warning.details)}`));
      }
    });
  }

  console.log(chalk.gray(`\n⏱️  Processing time: ${result.stats.processingTime}ms\n`));
}

/**
 * Generate data integrity checksum
 */
export async function generateDataChecksum(tables?: string[]): Promise<Record<string, string>> {
  const checksums: Record<string, string> = {};

  const tablesToCheck = tables || [
    'users',
    'transactions',
    'goals',
    'bank_accounts',
    'subscriptions',
  ];

  for (const table of tablesToCheck) {
    try {
      const count = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM ${table}`,
      );

      const checksum = createHash('sha256').update(`${table}:${count[0].count}`).digest('hex');

      checksums[table] = checksum;
    } catch (error) {
      console.warn(`Failed to generate checksum for ${table}:`, error);
    }
  }

  return checksums;
}

/**
 * Validate specific user data
 */
export async function validateUserData(userId: string): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const stats: ValidationStats = {
    totalRecords: {},
    validRecords: {},
    invalidRecords: {},
    processingTime: 0,
  };

  // Get user with all relations
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      transactions: true,
      goals: true,
      bankAccounts: true,
      subscriptions: true,
    },
  });

  if (!user) {
    errors.push({
      type: 'USER_NOT_FOUND',
      message: `User ${userId} not found`,
      severity: 'critical',
    });
    return { isValid: false, errors, warnings, stats };
  }

  // Validate user data
  if (!user.email || !user.email.includes('@')) {
    errors.push({
      type: 'INVALID_EMAIL',
      message: 'User has invalid email address',
      severity: 'high',
    });
  }

  // Check transactions
  const invalidTransactions = user.transactions.filter((t) => !t.amount || t.amount === 0);
  if (invalidTransactions.length > 0) {
    errors.push({
      type: 'INVALID_USER_TRANSACTIONS',
      message: `User has ${invalidTransactions.length} invalid transactions`,
      severity: 'medium',
      details: { transactionIds: invalidTransactions.map((t) => t.id) },
    });
  }

  // Check goals
  const invalidGoals = user.goals.filter((g) => g.currentAmount > g.targetAmount);
  if (invalidGoals.length > 0) {
    warnings.push({
      type: 'GOAL_EXCEEDED',
      message: `User has ${invalidGoals.length} goals where current exceeds target`,
      details: { goalIds: invalidGoals.map((g) => g.id) },
    });
  }

  stats.processingTime = Date.now() - startTime;
  stats.totalRecords = {
    transactions: user.transactions.length,
    goals: user.goals.length,
    bankAccounts: user.bankAccounts.length,
  };

  return {
    isValid: errors.filter((e) => e.severity === 'critical' || e.severity === 'high').length === 0,
    errors,
    warnings,
    stats,
  };
}

// Export for use in migrations
export default {
  validateDatabaseIntegrity,
  validateReferentialIntegrity,
  validateDataConsistency,
  validateBusinessRules,
  validateAustralianCompliance,
  validateEncryptedFields,
  generateDataChecksum,
  validateUserData,
};
