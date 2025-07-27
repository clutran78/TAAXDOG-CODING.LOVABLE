import { prisma } from '../lib/prisma';

async function main() {
  const action = process.argv[2];
  const email = process.argv[3];

  if (!action) {
    console.log(`
Usage: npm run manage-accounts [action] [email]

Actions:
  list              - List all user accounts
  find [email]      - Find a specific user
  delete [email]    - Delete a specific user
  reset [email]     - Reset password for a user

Examples:
  npm run manage-accounts list
  npm run manage-accounts find user@example.com
  npm run manage-accounts delete test@example.com
`);
    return;
  }

  try {
    switch (action) {
      case 'list':
        const users = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            emailVerified: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        console.log('\n📋 User Accounts:\n');
        console.table(
          users.map((u) => ({
            ...u,
            emailVerified: u.emailVerified ? '✅' : '❌',
            createdAt: u.createdAt.toLocaleDateString(),
          })),
        );
        console.log(`\nTotal users: ${users.length}`);
        break;

      case 'find':
        if (!email) {
          console.error('❌ Email required for find action');
          return;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            accounts: true,
            sessions: {
              select: {
                expires: true,
              },
            },
          },
        });

        if (!user) {
          console.log(`❌ User not found: ${email}`);
          return;
        }

        console.log('\n👤 User Details:');
        console.log({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          hasPassword: !!user.password,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          accounts: user.accounts.length,
          activeSessions: user.sessions.filter((s) => s.expires > new Date()).length,
        });
        break;

      case 'delete':
        if (!email) {
          console.error('❌ Email required for delete action');
          return;
        }

        const userToDelete = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!userToDelete) {
          console.log(`❌ User not found: ${email}`);
          return;
        }

        // Confirm deletion
        console.log(`\n⚠️  About to delete user: ${userToDelete.email} (${userToDelete.name})`);
        console.log('This will also delete all related data (sessions, accounts, etc.)');
        console.log('\nType "DELETE" to confirm:');

        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        readline.question('', async (answer) => {
          if (answer === 'DELETE') {
            await prisma.user.delete({
              where: { id: userToDelete.id },
            });
            console.log(`✅ User ${email} deleted successfully`);
          } else {
            console.log('❌ Deletion cancelled');
          }
          readline.close();
          process.exit(0);
        });
        return;

      case 'reset':
        if (!email) {
          console.error('❌ Email required for reset action');
          return;
        }

        const userToReset = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!userToReset) {
          console.log(`❌ User not found: ${email}`);
          return;
        }

        // Generate a password reset token
        const { createPasswordResetToken } = await import('../lib/auth');
        const token = await createPasswordResetToken(userToReset.email);

        const baseUrl = process.env.NEXTAUTH_URL || 'https://dev.taxreturnpro.com.au';
        const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

        console.log(`\n✅ Password reset token generated for ${email}`);
        console.log(`\n🔗 Reset URL: ${resetUrl}`);
        console.log('\nThis link expires in 1 hour.');
        break;

      default:
        console.error(`❌ Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
