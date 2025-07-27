#!/usr/bin/env tsx
/**
 * User Data Migration Scripts
 *
 * Specific migrations for user data transformations
 */

import { PrismaClient } from '@prisma/client';
import { Migration, MigrationContext } from '../migrate-data';
import bcrypt from 'bcryptjs';
import chalk from 'chalk';

const prisma = new PrismaClient();

/**
 * Migration: Normalize user phone numbers to Australian format
 */
export class NormalizePhoneNumbersMigration extends Migration {
  name = 'normalize-phone-numbers';
  description = 'Normalize all phone numbers to Australian E.164 format';
  version = '1.0.0';

  async validate(): Promise<boolean> {
    const invalidPhones = await prisma.user.count({
      where: {
        phone: {
          not: null,
          NOT: {
            OR: [{ startsWith: '+61' }, { equals: '' }],
          },
        },
      },
    });

    this.context.logger.log(
      'info',
      `Found ${invalidPhones} users with non-normalized phone numbers`,
    );
    return true;
  }

  async estimateAffectedRecords(): Promise<number> {
    return prisma.user.count({
      where: {
        phone: {
          not: null,
          NOT: {
            OR: [{ startsWith: '+61' }, { equals: '' }],
          },
        },
      },
    });
  }

  async up(): Promise<void> {
    const users = await prisma.user.findMany({
      where: {
        phone: {
          not: null,
          NOT: {
            OR: [{ startsWith: '+61' }, { equals: '' }],
          },
        },
      },
      select: {
        id: true,
        phone: true,
      },
    });

    await this.processBatch(
      users,
      async (user) => {
        if (!user.phone) return;

        let normalized = user.phone.replace(/\D/g, ''); // Remove non-digits

        // Handle Australian numbers
        if (normalized.startsWith('0')) {
          normalized = '61' + normalized.substring(1);
        } else if (normalized.length === 9) {
          normalized = '61' + normalized;
        }

        // Add + prefix
        if (!normalized.startsWith('+')) {
          normalized = '+' + normalized;
        }

        // Validate format
        if (normalized.match(/^\+61[2-9]\d{8}$/)) {
          if (!this.context.dryRun) {
            await prisma.user.update({
              where: { id: user.id },
              data: { phone: normalized },
            });
          }
          this.context.logger.log(
            'info',
            `Normalized phone for user ${user.id}: ${user.phone} -> ${normalized}`,
          );
        } else {
          this.context.logger.log(
            'warn',
            `Invalid phone number for user ${user.id}: ${user.phone}`,
          );
        }
      },
      'Normalizing phone numbers',
    );
  }

  async down(): Promise<void> {
    // Phone normalization is not reversible
    this.context.logger.log('warn', 'Phone normalization cannot be reversed');
  }
}

/**
 * Migration: Migrate legacy password hashes
 */
export class MigratePasswordHashesMigration extends Migration {
  name = 'migrate-password-hashes';
  description = 'Update legacy MD5 password hashes to bcrypt';
  version = '1.0.0';

  async validate(): Promise<boolean> {
    // Check for legacy hashes (simplified check)
    const legacyHashes = await prisma.user.count({
      where: {
        password: {
          not: null,
          NOT: {
            startsWith: '$2', // bcrypt hashes start with $2
          },
        },
      },
    });

    if (legacyHashes > 0) {
      this.context.logger.log('warn', `Found ${legacyHashes} users with legacy password hashes`);
      return true;
    }

    return false;
  }

  async estimateAffectedRecords(): Promise<number> {
    return prisma.user.count({
      where: {
        password: {
          not: null,
          NOT: {
            startsWith: '$2',
          },
        },
      },
    });
  }

  async up(): Promise<void> {
    const users = await prisma.user.findMany({
      where: {
        password: {
          not: null,
          NOT: {
            startsWith: '$2',
          },
        },
      },
      select: {
        id: true,
        email: true,
        password: true,
      },
    });

    // Store old hashes for rollback
    const oldHashes: Record<string, string> = {};

    await this.processBatch(
      users,
      async (user) => {
        if (!user.password) return;

        // Store old hash
        oldHashes[user.id] = user.password;

        // For security, we can't convert MD5 to bcrypt directly
        // Instead, we'll force password reset
        const tempPassword = `RESET_REQUIRED_${Date.now()}`;
        const newHash = await bcrypt.hash(tempPassword, 10);

        if (!this.context.dryRun) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              password: newHash,
              // Set password reset token
              passwordResetToken: await bcrypt.hash(user.id + Date.now(), 10),
              passwordResetExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
          });

          // Log for follow-up email
          this.context.logger.log('info', `Password reset required for user ${user.email}`);
        }
      },
      'Migrating password hashes',
    );

    // Store rollback data
    this.context.tracker.storeRollbackData(this.name, oldHashes);

    this.context.logger.log(
      'warn',
      'Users with legacy passwords will need to reset their passwords',
    );
  }

  async down(): Promise<void> {
    // This migration should not be rolled back for security reasons
    throw new Error('Password hash migration cannot be rolled back for security reasons');
  }
}

/**
 * Migration: Populate missing user metadata
 */
export class PopulateUserMetadataMigration extends Migration {
  name = 'populate-user-metadata';
  description = 'Populate missing user metadata fields with defaults';
  version = '1.0.0';

  async validate(): Promise<boolean> {
    const missingMetadata = await prisma.user.count({
      where: {
        OR: [{ createdAt: null }, { updatedAt: null }, { role: null }],
      },
    });

    return missingMetadata > 0;
  }

  async estimateAffectedRecords(): Promise<number> {
    return prisma.user.count({
      where: {
        OR: [{ createdAt: null }, { updatedAt: null }, { role: null }],
      },
    });
  }

  async up(): Promise<void> {
    const users = await prisma.user.findMany({
      where: {
        OR: [{ createdAt: null }, { updatedAt: null }, { role: null }],
      },
    });

    await this.processBatch(
      users,
      async (user) => {
        const updates: any = {};
        const now = new Date();

        if (!user.createdAt) {
          updates.createdAt = now;
        }

        if (!user.updatedAt) {
          updates.updatedAt = now;
        }

        if (!user.role) {
          updates.role = 'USER';
        }

        if (Object.keys(updates).length > 0 && !this.context.dryRun) {
          await prisma.user.update({
            where: { id: user.id },
            data: updates,
          });
        }
      },
      'Populating user metadata',
    );
  }

  async down(): Promise<void> {
    // Metadata population is not reversible
    this.context.logger.log('warn', 'Metadata population cannot be reversed');
  }
}

/**
 * Migration: Merge duplicate user accounts
 */
export class MergeDuplicateUsersMigration extends Migration {
  name = 'merge-duplicate-users';
  description = 'Merge duplicate user accounts based on email';
  version = '1.0.0';

  private duplicates: Map<string, string[]> = new Map();

  async validate(): Promise<boolean> {
    // Find duplicate emails
    const duplicateEmails = await prisma.$queryRaw<{ email: string; count: bigint }[]>`
      SELECT LOWER(email) as email, COUNT(*) as count
      FROM users
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `;

    for (const dup of duplicateEmails) {
      const users = await prisma.user.findMany({
        where: {
          email: {
            equals: dup.email,
            mode: 'insensitive',
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (users.length > 1) {
        this.duplicates.set(
          dup.email.toLowerCase(),
          users.map((u) => u.id),
        );
      }
    }

    this.context.logger.log('info', `Found ${this.duplicates.size} duplicate email addresses`);
    return this.duplicates.size > 0;
  }

  async estimateAffectedRecords(): Promise<number> {
    let total = 0;
    for (const [, ids] of this.duplicates) {
      total += ids.length - 1; // All but the primary account
    }
    return total;
  }

  async up(): Promise<void> {
    for (const [email, userIds] of this.duplicates) {
      const [primaryId, ...duplicateIds] = userIds;

      this.context.logger.log(
        'info',
        `Merging ${duplicateIds.length} duplicates into primary account ${primaryId} for ${email}`,
      );

      // Get all data from duplicate accounts
      const duplicateData = await Promise.all(
        duplicateIds.map((id) =>
          prisma.user.findUnique({
            where: { id },
            include: {
              transactions: true,
              goals: true,
              bankAccounts: true,
              subscriptions: true,
            },
          }),
        ),
      );

      if (!this.context.dryRun) {
        // Merge data into primary account
        for (const dupUser of duplicateData) {
          if (!dupUser) continue;

          // Transfer transactions
          if (dupUser.transactions.length > 0) {
            await prisma.transaction.updateMany({
              where: { userId: dupUser.id },
              data: { userId: primaryId },
            });
          }

          // Transfer goals
          if (dupUser.goals.length > 0) {
            await prisma.goal.updateMany({
              where: { userId: dupUser.id },
              data: { userId: primaryId },
            });
          }

          // Transfer bank accounts
          if (dupUser.bankAccounts.length > 0) {
            await prisma.bankAccount.updateMany({
              where: { userId: dupUser.id },
              data: { userId: primaryId },
            });
          }

          // Handle subscriptions (keep the most recent active one)
          if (dupUser.subscriptions.length > 0) {
            const activeSubscription = dupUser.subscriptions.find((s) => s.status === 'active');
            if (activeSubscription) {
              // Cancel duplicate subscription in primary account if exists
              await prisma.subscription.updateMany({
                where: {
                  userId: primaryId,
                  status: 'active',
                },
                data: {
                  status: 'cancelled',
                  cancelledAt: new Date(),
                },
              });

              // Transfer the active subscription
              await prisma.subscription.update({
                where: { id: activeSubscription.id },
                data: { userId: primaryId },
              });
            }
          }

          // Soft delete the duplicate account
          await prisma.user.update({
            where: { id: dupUser.id },
            data: {
              email: `MERGED_${dupUser.id}_${dupUser.email}`,
              deletedAt: new Date(),
            },
          });
        }
      }
    }

    // Store merge data for potential rollback
    this.context.tracker.storeRollbackData(this.name, Object.fromEntries(this.duplicates));
  }

  async down(): Promise<void> {
    this.context.logger.log('warn', 'User merge cannot be automatically rolled back');
    this.context.logger.log('info', 'Manual intervention required to unmerge accounts');
  }
}

/**
 * Migration: Set default tax residency
 */
export class SetDefaultTaxResidencyMigration extends Migration {
  name = 'set-default-tax-residency';
  description = 'Set default tax residency for Australian users';
  version = '1.0.0';

  async validate(): Promise<boolean> {
    const missingResidency = await prisma.user.count({
      where: {
        taxResidency: null,
      },
    });

    return missingResidency > 0;
  }

  async estimateAffectedRecords(): Promise<number> {
    return prisma.user.count({
      where: {
        taxResidency: null,
      },
    });
  }

  async up(): Promise<void> {
    if (!this.context.dryRun) {
      await prisma.user.updateMany({
        where: {
          taxResidency: null,
        },
        data: {
          taxResidency: 'RESIDENT', // Default to Australian resident
        },
      });
    }

    this.context.logger.log(
      'info',
      'Set default tax residency to RESIDENT for all users without residency status',
    );
  }

  async down(): Promise<void> {
    if (!this.context.dryRun) {
      await prisma.user.updateMany({
        where: {
          taxResidency: 'RESIDENT',
          // Only revert if it was set by this migration (check audit logs)
        },
        data: {
          taxResidency: null,
        },
      });
    }
  }
}

// Export all user migrations
export const USER_MIGRATIONS = {
  'normalize-phones': NormalizePhoneNumbersMigration,
  'migrate-passwords': MigratePasswordHashesMigration,
  'populate-metadata': PopulateUserMetadataMigration,
  'merge-duplicates': MergeDuplicateUsersMigration,
  'set-tax-residency': SetDefaultTaxResidencyMigration,
};

// CLI if run directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--list') {
    console.log(chalk.bold('\nAvailable User Migrations:\n'));
    Object.entries(USER_MIGRATIONS).forEach(([key, MigrationClass]) => {
      const temp = new MigrationClass({} as any);
      console.log(chalk.cyan(`  ${key}`) + ` - ${temp.description}`);
    });
    console.log('\n');
    process.exit(0);
  }

  // Run specific migration
  const migrationName = args[0];
  const MigrationClass = USER_MIGRATIONS[migrationName as keyof typeof USER_MIGRATIONS];

  if (!MigrationClass) {
    console.error(chalk.red(`Unknown migration: ${migrationName}`));
    process.exit(1);
  }

  // Import and run using the main migration runner
  import('../migrate-data').then(({ default: runMigration }) => {
    process.argv = [process.argv[0], process.argv[1], '--type', migrationName, ...args.slice(1)];
    require('../migrate-data');
  });
}
