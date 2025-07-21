import { PrismaClient } from "@prisma/client";
import { sendPasswordResetEmail } from '../lib/email';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

async function sendPasswordResetToMigratedUsers() {
  console.log('📧 Starting password reset email campaign for migrated users...\n');
  
  const stats: EmailStats = {
    total: 0,
    sent: 0,
    failed: 0,
    errors: []
  };

  try {
    // Find all users with password reset tokens (migrated users)
    console.log('🔍 Finding migrated users with reset tokens...');
    const migratedUsers = await prisma.user.findMany({
      where: {
        passwordResetToken: {
          not: null
        },
        passwordResetExpires: {
          gt: new Date() // Token not expired
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        passwordResetToken: true
      }
    });

    stats.total = migratedUsers.length;
    console.log(`✅ Found ${stats.total} migrated users\n`);

    if (stats.total === 0) {
      console.log('No migrated users found with valid reset tokens.');
      return;
    }

    // Send emails with rate limiting
    console.log('📨 Sending password reset emails...\n');
    
    for (const user of migratedUsers) {
      try {
        console.log(`Sending to: ${user.email}`);
        
        // Send the email
        await sendPasswordResetEmail(
          user.email,
          user.name,
          user.passwordResetToken!
        );
        
        // Log successful email
        await prisma.auditLog.create({
          data: {
            event: 'PASSWORD_RESET_REQUEST' as const,
            userId: user.id,
            ipAddress: '0.0.0.0',
            userAgent: 'Migration Email Script',
            success: true,
            metadata: {
              source: 'migration_campaign',
              emailSent: true
            }
          }
        });

        console.log(`✅ Sent: ${user.email}`);
        stats.sent++;

        // Rate limiting - wait 1 second between emails
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`❌ Failed: ${user.email} - ${error.message}`);
        stats.failed++;
        stats.errors.push({
          email: user.email,
          error: error.message
        });
      }
    }

    // Print summary
    console.log('\n📊 Email Campaign Summary:');
    console.log('========================');
    console.log(`Total users:    ${stats.total}`);
    console.log(`Emails sent:    ${stats.sent} ✅`);
    console.log(`Failed:         ${stats.failed} ❌`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(err => {
        console.log(`   ${err.email}: ${err.error}`);
      });
    }

    console.log('\n✅ Email campaign completed!');

  } catch (error) {
    console.error('❌ Email campaign failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  sendPasswordResetToMigratedUsers()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { sendPasswordResetToMigratedUsers };