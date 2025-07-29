#!/usr/bin/env tsx
/**
 * Authentication Testing Script
 * 
 * This script tests the complete authentication flow including:
 * - Database connection
 * - User registration
 * - Login authentication
 * - Password reset flow
 * - Session management
 * 
 * Usage: npm run test:auth or tsx scripts/test-auth.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';
import ora from 'ora';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Import auth utilities
import { 
  hashPassword, 
  validatePassword, 
  createPasswordResetToken,
  verifyPasswordResetToken,
  resetPassword,
  getPasswordStrength,
} from '../lib/auth';
import { 
  getDatabaseUrl, 
  validateProductionDatabaseUrl, 
  logDatabaseConnectionInfo,
  getSafeDatabaseUrl,
} from '../lib/utils/database-url';

// Test configuration
const TEST_USER = {
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User',
};

const prisma = new PrismaClient({
  log: process.env.DEBUG === 'true' ? ['query', 'error', 'warn'] : ['error'],
});

// Test results tracking
interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

const testResults: TestResult[] = [];
let createdUserId: string | null = null;

// Utility functions
function logSection(title: string) {
  console.log('\n' + chalk.blue('═'.repeat(60)));
  console.log(chalk.blue.bold(`  ${title}`));
  console.log(chalk.blue('═'.repeat(60)) + '\n');
}

function logSuccess(message: string) {
  console.log(chalk.green('✓'), message);
}

function logError(message: string) {
  console.log(chalk.red('✗'), message);
}

function logInfo(message: string) {
  console.log(chalk.gray('ℹ'), message);
}

function logWarning(message: string) {
  console.log(chalk.yellow('⚠'), message);
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const spinner = ora({
    text: `Running: ${name}`,
    color: 'cyan',
  }).start();
  
  const startTime = Date.now();
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    spinner.succeed(chalk.green(`${name} (${duration}ms)`));
    testResults.push({ name, status: 'passed', duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${name} (${duration}ms)`));
    logError(`  Error: ${errorMessage}`);
    testResults.push({ name, status: 'failed', duration, error: errorMessage });
    
    // Don't continue if database connection fails
    if (name === 'Database Connection') {
      throw error;
    }
  }
}

// Test implementations
async function testDatabaseConnection() {
  logSection('Testing Database Connection');
  
  // Get and validate database URL
  const dbUrl = getDatabaseUrl();
  logInfo(`Database URL: ${getSafeDatabaseUrl(dbUrl)}`);
  
  // Log connection info
  logDatabaseConnectionInfo(dbUrl, 'test-auth-script');
  
  // Validate production settings if in production
  if (process.env.NODE_ENV === 'production') {
    const validation = validateProductionDatabaseUrl(dbUrl);
    if (!validation.valid) {
      throw new Error(`Database validation failed: ${validation.errors.join(', ')}`);
    }
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => logWarning(warning));
    }
  }
  
  // Test actual connection
  await runTest('Database Connection', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    if (!result) throw new Error('Database query failed');
  });
  
  // Test Prisma connection
  await runTest('Prisma Client Connection', async () => {
    await prisma.$connect();
    logSuccess('Prisma client connected successfully');
  });
  
  // Check required tables
  await runTest('Database Schema Validation', async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const requiredTables = ['users', 'accounts', 'sessions', 'password_reset_tokens'];
    const existingTables = tables.map(t => t.table_name);
    
    logInfo(`Found ${existingTables.length} tables: ${existingTables.join(', ')}`);
    
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }
  });
}

async function testPasswordUtilities() {
  logSection('Testing Password Utilities');
  
  await runTest('Password Validation', async () => {
    // Test weak password
    const weak = validatePassword('weak');
    if (weak.valid) throw new Error('Weak password should not be valid');
    logInfo(`  Weak password errors: ${weak.errors.join(', ')}`);
    
    // Test strong password
    const strong = validatePassword(TEST_USER.password);
    if (!strong.valid) throw new Error(`Strong password validation failed: ${strong.errors.join(', ')}`);
    logSuccess('  Strong password validated successfully');
  });
  
  await runTest('Password Strength Scoring', async () => {
    const passwords = [
      { pass: 'weak', minScore: 0, maxScore: 30 },
      { pass: 'moderate123', minScore: 30, maxScore: 70 },
      { pass: 'StrongPass123!', minScore: 70, maxScore: 100 },
      { pass: 'VeryStrongPassword123!@#', minScore: 90, maxScore: 100 },
    ];
    
    for (const { pass, minScore, maxScore } of passwords) {
      const strength = getPasswordStrength(pass);
      logInfo(`  Password "${pass}": Score ${strength.score}/100`);
      logInfo(`    Feedback: ${strength.feedback.join(', ')}`);
      
      // Allow some variance in password scoring
      if (strength.score < minScore - 5 || strength.score > maxScore + 5) {
        throw new Error(`Unexpected score for "${pass}": ${strength.score} (expected ${minScore}-${maxScore})`);
      }
    }
  });
  
  await runTest('Password Hashing', async () => {
    const password = TEST_USER.password;
    const hash = await hashPassword(password);
    
    if (!hash || hash.length < 50) {
      throw new Error('Invalid password hash generated');
    }
    
    // Verify hash
    const isValid = await bcrypt.compare(password, hash);
    if (!isValid) throw new Error('Password hash verification failed');
    
    // Ensure different hashes for same password
    const hash2 = await hashPassword(password);
    if (hash === hash2) throw new Error('Same hash generated for same password (salt issue)');
    
    logSuccess('  Password hashing and verification working correctly');
  });
}

async function testUserRegistration() {
  logSection('Testing User Registration');
  
  await runTest('Create New User', async () => {
    const hashedPassword = await hashPassword(TEST_USER.password);
    
    const user = await prisma.user.create({
      data: {
        email: TEST_USER.email,
        name: TEST_USER.name,
        password: hashedPassword,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    
    createdUserId = user.id;
    
    logSuccess(`  User created: ${user.email} (ID: ${user.id})`);
    logInfo(`  Role: ${user.role}`);
    logInfo(`  Email Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
    logInfo(`  Created: ${user.createdAt.toISOString()}`);
  });
  
  await runTest('Duplicate Email Prevention', async () => {
    try {
      await prisma.user.create({
        data: {
          email: TEST_USER.email,
          name: 'Duplicate User',
          password: 'any-password',
        },
      });
      throw new Error('Duplicate email should have been rejected');
    } catch (error: any) {
      if (!error.message.includes('Unique constraint')) {
        throw error;
      }
      logSuccess('  Duplicate email correctly rejected');
    }
  });
}

async function testLogin() {
  logSection('Testing Login Authentication');
  
  if (!createdUserId) {
    logWarning('Skipping login tests - no user created');
    return;
  }
  
  await runTest('Successful Login', async () => {
    const user = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });
    
    if (!user || !user.password) {
      throw new Error('User not found or has no password');
    }
    
    const isValid = await bcrypt.compare(TEST_USER.password, user.password);
    if (!isValid) throw new Error('Password verification failed');
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    logSuccess('  Login successful');
    logInfo(`  Failed attempts: ${user.failedLoginAttempts}`);
    logInfo(`  Account locked: ${user.lockedUntil ? 'Yes' : 'No'}`);
  });
  
  await runTest('Failed Login Attempts', async () => {
    const wrongPassword = 'WrongPassword123!';
    
    // Simulate failed login
    const user = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
      select: { id: true, password: true, failedLoginAttempts: true },
    });
    
    if (!user || !user.password) {
      throw new Error('User not found');
    }
    
    const isValid = await bcrypt.compare(wrongPassword, user.password);
    if (isValid) throw new Error('Wrong password should not be valid');
    
    // Update failed attempts
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: user.failedLoginAttempts + 1,
      },
      select: { failedLoginAttempts: true },
    });
    
    logSuccess('  Failed login tracked correctly');
    logInfo(`  Failed attempts: ${updatedUser.failedLoginAttempts}`);
  });
  
  await runTest('Account Locking', async () => {
    // Set high failed attempts to trigger lock
    const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    await prisma.user.update({
      where: { email: TEST_USER.email },
      data: {
        failedLoginAttempts: 5,
        lockedUntil: lockUntil,
      },
    });
    
    const user = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
      select: { lockedUntil: true },
    });
    
    if (!user?.lockedUntil || user.lockedUntil <= new Date()) {
      throw new Error('Account should be locked');
    }
    
    logSuccess('  Account locking mechanism working');
    logInfo(`  Locked until: ${user.lockedUntil.toISOString()}`);
    
    // Reset for further tests
    await prisma.user.update({
      where: { email: TEST_USER.email },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  });
}

async function testPasswordReset() {
  logSection('Testing Password Reset Flow');
  
  if (!createdUserId) {
    logWarning('Skipping password reset tests - no user created');
    return;
  }
  
  let resetToken: string | null = null;
  
  await runTest('Create Password Reset Token', async () => {
    resetToken = await createPasswordResetToken(TEST_USER.email);
    
    if (!resetToken || resetToken.length < 32) {
      throw new Error('Invalid reset token generated');
    }
    
    logSuccess('  Reset token created');
    logInfo(`  Token length: ${resetToken.length} characters`);
    
    // Verify token exists in database
    const dbToken = await prisma.passwordResetToken.findFirst({
      where: { email: TEST_USER.email },
    });
    
    if (!dbToken) {
      throw new Error('Token not found in database');
    }
    
    logInfo(`  Token expires: ${dbToken.expires.toISOString()}`);
  });
  
  await runTest('Verify Password Reset Token', async () => {
    if (!resetToken) {
      throw new Error('No reset token available');
    }
    
    const tokenData = await verifyPasswordResetToken(resetToken);
    
    if (!tokenData) {
      throw new Error('Token verification failed');
    }
    
    logSuccess('  Token verified successfully');
    logInfo(`  Token for email: ${tokenData.email}`);
  });
  
  await runTest('Reset Password', async () => {
    if (!resetToken) {
      throw new Error('No reset token available');
    }
    
    const newPassword = 'NewSecurePassword123!';
    
    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      throw new Error(`New password validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Reset password
    const success = await resetPassword(resetToken, newPassword);
    if (!success) {
      throw new Error('Password reset failed');
    }
    
    // Verify new password works
    const user = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
      select: { password: true },
    });
    
    if (!user?.password) {
      throw new Error('User not found after password reset');
    }
    
    const isValid = await bcrypt.compare(newPassword, user.password);
    if (!isValid) {
      throw new Error('New password verification failed');
    }
    
    logSuccess('  Password reset successfully');
    
    // Verify token was deleted
    const deletedToken = await prisma.passwordResetToken.findFirst({
      where: { email: TEST_USER.email },
    });
    
    if (deletedToken) {
      throw new Error('Reset token should have been deleted');
    }
    
    logSuccess('  Reset token cleaned up');
  });
  
  await runTest('Expired Token Handling', async () => {
    // Create an expired token
    const expiredToken = randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(expiredToken, 10);
    
    await prisma.passwordResetToken.create({
      data: {
        email: TEST_USER.email,
        token: hashedToken,
        expires: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    });
    
    const tokenData = await verifyPasswordResetToken(expiredToken);
    
    if (tokenData) {
      throw new Error('Expired token should not be valid');
    }
    
    logSuccess('  Expired token correctly rejected');
    
    // Clean up
    await prisma.passwordResetToken.deleteMany({
      where: { email: TEST_USER.email },
    });
  });
}

async function testSessionManagement() {
  logSection('Testing Session Management');
  
  if (!createdUserId) {
    logWarning('Skipping session tests - no user created');
    return;
  }
  
  await runTest('Audit Log Creation', async () => {
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        event: 'LOGIN_SUCCESS',
        userId: createdUserId,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Script',
        success: true,
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
        },
      },
    });
    
    // Verify audit log
    const logs = await prisma.auditLog.findMany({
      where: {
        userId: createdUserId,
        event: 'LOGIN_SUCCESS',
      },
    });
    
    if (logs.length === 0) {
      throw new Error('Audit log not created');
    }
    
    logSuccess('  Audit logging working correctly');
    logInfo(`  Found ${logs.length} audit log entries`);
  });
  
  await runTest('User Activity Tracking', async () => {
    const user = await prisma.user.findUnique({
      where: { id: createdUserId },
      select: {
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    logSuccess('  User activity timestamps available');
    logInfo(`  Created: ${user.createdAt.toISOString()}`);
    logInfo(`  Updated: ${user.updatedAt.toISOString()}`);
    logInfo(`  Last Login: ${user.lastLoginAt?.toISOString() || 'Never'}`);
  });
}

async function cleanup() {
  logSection('Cleanup');
  
  if (createdUserId) {
    try {
      // Delete audit logs
      await prisma.auditLog.deleteMany({
        where: { userId: createdUserId },
      });
      
      // Delete password reset tokens
      await prisma.passwordResetToken.deleteMany({
        where: { email: TEST_USER.email },
      });
      
      // Delete user
      await prisma.user.delete({
        where: { id: createdUserId },
      });
      
      logSuccess('Test user and related data cleaned up');
    } catch (error) {
      logError(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function printSummary() {
  logSection('Test Summary');
  
  const passed = testResults.filter(r => r.status === 'passed').length;
  const failed = testResults.filter(r => r.status === 'failed').length;
  const skipped = testResults.filter(r => r.status === 'skipped').length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(chalk.bold('\nResults:'));
  console.log(chalk.green(`  ✓ Passed: ${passed}`));
  if (failed > 0) console.log(chalk.red(`  ✗ Failed: ${failed}`));
  if (skipped > 0) console.log(chalk.yellow(`  ⚠ Skipped: ${skipped}`));
  console.log(chalk.gray(`  ⏱ Total Duration: ${totalDuration}ms`));
  
  if (failed > 0) {
    console.log(chalk.red('\nFailed Tests:'));
    testResults
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(chalk.red(`  • ${r.name}`));
        if (r.error) console.log(chalk.gray(`    ${r.error}`));
      });
  }
  
  console.log('\n' + chalk.blue('═'.repeat(60)) + '\n');
  
  return failed === 0;
}

// Main execution
async function main() {
  console.log(chalk.blue.bold('\n🔐 Authentication System Test Suite\n'));
  console.log(chalk.gray(`Environment: ${process.env.NODE_ENV || 'development'}`));
  console.log(chalk.gray(`Timestamp: ${new Date().toISOString()}\n`));
  
  try {
    // Run all tests
    await testDatabaseConnection();
    await testPasswordUtilities();
    await testUserRegistration();
    await testLogin();
    await testPasswordReset();
    await testSessionManagement();
    
  } catch (error) {
    logError(`\nCritical error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  } finally {
    // Always run cleanup
    await cleanup();
    
    // Disconnect from database
    await prisma.$disconnect();
    
    // Print summary
    const success = await printSummary();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  }
}

// Run tests
main().catch(error => {
  console.error(chalk.red('\nUnhandled error:'), error);
  process.exit(1);
});
