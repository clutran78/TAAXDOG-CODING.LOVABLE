import { PrismaClient } from "@prisma/client";
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function checkMigrationStatus() {
  console.log('📊 Checking Migration Status...\n');

  try {
    // Get total users
    const totalUsers = await prisma.user.count();
    console.log(`Total users in PostgreSQL: ${totalUsers}`);

    // Get users by email verification status
    const verifiedUsers = await prisma.user.count({
      where: { emailVerified: { not: null } }
    });
    const unverifiedUsers = totalUsers - verifiedUsers;
    console.log(`Email verified: ${verifiedUsers}`);
    console.log(`Email unverified: ${unverifiedUsers}`);

    // Get users with password reset tokens
    const usersWithResetTokens = await prisma.user.count({
      where: {
        passwordResetToken: { not: null },
        passwordResetExpires: { gt: new Date() }
      }
    });
    console.log(`\nUsers with valid reset tokens: ${usersWithResetTokens}`);

    // Get recent signups vs migrations
    const migrationLogs = await prisma.auditLog.count({
      where: {
        event: 'REGISTER',
        metadata: {
          path: ['source'],
          equals: 'firebase_migration'
        }
      }
    });
    console.log(`\nUsers migrated from Firebase: ${migrationLogs}`);

    // Get login activity
    const recentLogins = await prisma.auditLog.count({
      where: {
        event: 'LOGIN_SUCCESS',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    });
    console.log(`\nSuccessful logins (last 7 days): ${recentLogins}`);

    // Get users by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true
    });
    console.log('\nUsers by role:');
    usersByRole.forEach(role => {
      console.log(`  ${role.role}: ${role._count}`);
    });

    // Get sample of recent users
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        email: true,
        name: true,
        createdAt: true,
        emailVerified: true,
        passwordResetToken: true
      }
    });
    
    console.log('\nRecent users:');
    console.log('=============');
    recentUsers.forEach(user => {
      console.log(`${user.email}:`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log(`  Verified: ${user.emailVerified ? 'Yes' : 'No'}`);
      console.log(`  Has reset token: ${user.passwordResetToken ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Check for any migration errors
    const migrationErrors = await prisma.auditLog.findMany({
      where: {
        userAgent: 'Migration Script',
        success: false
      },
      take: 10
    });

    if (migrationErrors.length > 0) {
      console.log('⚠️  Migration errors found:');
      migrationErrors.forEach(error => {
        console.log(`  ${error.createdAt}: ${JSON.stringify(error.metadata)}`);
      });
    }

  } catch (error) {
    console.error('Error checking migration status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  checkMigrationStatus()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { checkMigrationStatus };