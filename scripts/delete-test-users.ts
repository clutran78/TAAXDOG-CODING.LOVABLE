#!/usr/bin/env tsx
/**
 * Script to delete test user accounts from the database
 * Use with caution - this will permanently delete user data
 */

import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

async function deleteTestUsers() {
  try {
    console.log('🗑️  Starting user deletion process...\n');

    // First, let's see what users we have
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (users.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    console.log(`Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name}) - Created: ${user.createdAt.toLocaleString()}`);
    });

    console.log('\n⚠️  WARNING: This will delete ALL user data including:');
    console.log('- User accounts');
    console.log('- Tax returns');
    console.log('- Transactions');
    console.log('- Bank connections');
    console.log('- Goals');
    console.log('- Budgets');
    console.log('- And all related data\n');

    // In production, you might want to add a confirmation prompt here
    // For now, we'll proceed with deletion

    console.log('Deleting users and all related data...\n');

    // Delete users one by one to handle cascading deletes properly
    for (const user of users) {
      try {
        // Delete in order of dependencies
        console.log(`Deleting data for ${user.email}...`);

        // Delete AI cache entries (skip if model doesn't have userId)
        try {
          await prisma.aICache.deleteMany({
            where: { 
              cacheKey: {
                contains: user.id,
              },
            },
          });
        } catch (e) {
          // Skip if AICache doesn't exist or doesn't have the expected fields
        }

        // Delete notifications
        await prisma.notification.deleteMany({
          where: { userId: user.id },
        });

        // Delete receipts
        await prisma.receipt.deleteMany({
          where: { userId: user.id },
        });

        // Delete budget tracking
        await prisma.budgetTracking.deleteMany({
          where: {
            budget: {
              userId: user.id,
            },
          },
        });

        // Delete budgets
        await prisma.budget.deleteMany({
          where: { userId: user.id },
        });

        // Delete goal transfers
        await prisma.goalTransfer.deleteMany({
          where: {
            goal: {
              userId: user.id,
            },
          },
        });

        // Delete goals
        await prisma.goal.deleteMany({
          where: { userId: user.id },
        });

        // Delete transactions
        await prisma.transaction.deleteMany({
          where: { userId: user.id },
        });

        // Delete bank accounts
        await prisma.bankAccount.deleteMany({
          where: { userId: user.id },
        });

        // Delete bank connections
        await prisma.bankConnection.deleteMany({
          where: { userId: user.id },
        });

        // Delete tax returns
        await prisma.taxReturn.deleteMany({
          where: { userId: user.id },
        });

        // Delete Stripe customers
        await prisma.stripeCustomer.deleteMany({
          where: { userId: user.id },
        });

        // Delete audit logs
        await prisma.auditLog.deleteMany({
          where: { userId: user.id },
        });

        // Finally, delete the user
        await prisma.user.delete({
          where: { id: user.id },
        });

        console.log(`✅ Successfully deleted ${user.email}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${user.email}:`, error);
      }
    }

    console.log('\n✨ User deletion completed!');

    // Verify deletion
    const remainingUsers = await prisma.user.count();
    console.log(`\nRemaining users in database: ${remainingUsers}`);

  } catch (error) {
    logger.error('Failed to delete users', { error });
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteTestUsers()
  .then(() => {
    console.log('\n👍 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });