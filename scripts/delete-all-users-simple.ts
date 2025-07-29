#!/usr/bin/env tsx
/**
 * Simple script to delete all users from the database
 * Relies on CASCADE delete to handle related data
 */

import prisma from '../lib/prisma';

async function deleteAllUsers() {
  try {
    console.log('🗑️  Deleting all users...\n');

    // Count users before deletion
    const userCount = await prisma.user.count();
    console.log(`Found ${userCount} users to delete.`);

    if (userCount === 0) {
      console.log('No users to delete.');
      return;
    }

    // Delete all users - CASCADE will handle related data
    const result = await prisma.user.deleteMany({});
    
    console.log(`\n✅ Deleted ${result.count} users successfully!`);

    // Verify deletion
    const remainingUsers = await prisma.user.count();
    console.log(`Remaining users: ${remainingUsers}`);

  } catch (error) {
    console.error('❌ Error deleting users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deleteAllUsers()
  .then(() => {
    console.log('\n👍 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });