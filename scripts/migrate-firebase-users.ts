import admin from 'firebase-admin';
import { PrismaClient } from "@prisma/client";
import { hashPassword } from '../lib/auth/auth-utils';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize Prisma
const prisma = new PrismaClient();

// Firebase Admin configuration
const initializeFirebase = () => {
  try {
    // Check if Firebase service account is configured
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!serviceAccountPath) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH not configured in .env');
    }

    const serviceAccount = require(serviceAccountPath);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    
    return admin;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
};

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

async function migrateUsers() {
  console.log('🚀 Starting Firebase to PostgreSQL user migration...\n');
  
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    // Initialize Firebase Admin
    console.log('📱 Initializing Firebase Admin SDK...');
    const firebaseAdmin = initializeFirebase();
    console.log('✅ Firebase Admin initialized\n');

    // Get all users from Firebase
    console.log('🔍 Fetching users from Firebase...');
    const listUsersResult = await firebaseAdmin.auth().listUsers();
    const firebaseUsers = listUsersResult.users;
    stats.total = firebaseUsers.length;
    console.log(`✅ Found ${stats.total} users in Firebase\n`);

    // Migrate each user
    console.log('🔄 Starting migration...\n');
    
    for (const firebaseUser of firebaseUsers) {
      try {
        console.log(`Processing: ${firebaseUser.email || firebaseUser.uid}`);
        
        // Skip if no email
        if (!firebaseUser.email) {
          console.log(`⚠️  Skipped: No email for user ${firebaseUser.uid}`);
          stats.skipped++;
          continue;
        }

        // Check if user already exists in PostgreSQL
        const existingUser = await prisma.user.findUnique({
          where: { email: firebaseUser.email.toLowerCase() }
        });

        if (existingUser) {
          console.log(`⏭️  Skipped: ${firebaseUser.email} already exists in PostgreSQL`);
          stats.skipped++;
          continue;
        }

        // Create user in PostgreSQL
        const userData: any = {
          email: firebaseUser.email.toLowerCase(),
          emailVerified: firebaseUser.emailVerified ? new Date() : null,
          name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          image: firebaseUser.photoURL || null,
          phone: firebaseUser.phoneNumber || null,
        };

        // Handle password - Firebase doesn't expose password hashes
        // Users will need to reset their passwords
        userData.password = await hashPassword(generateTemporaryPassword());
        userData.passwordResetToken = generateResetToken();
        userData.passwordResetExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Additional metadata
        if (firebaseUser.metadata) {
          userData.createdAt = new Date(firebaseUser.metadata.creationTime);
          if (firebaseUser.metadata.lastSignInTime) {
            userData.lastLoginAt = new Date(firebaseUser.metadata.lastSignInTime);
          }
        }

        // Create user
        const newUser = await prisma.user.create({
          data: userData,
          select: {
            id: true,
            email: true,
            name: true
          }
        });

        // Log successful migration
        await prisma.auditLog.create({
          data: {
            event: 'REGISTER' as const,
            userId: newUser.id,
            ipAddress: '0.0.0.0',
            userAgent: 'Migration Script',
            success: true,
            metadata: {
              source: 'firebase_migration',
              originalUid: firebaseUser.uid
            }
          }
        });

        console.log(`✅ Migrated: ${newUser.email}`);
        stats.migrated++;

        // Get custom claims if any
        if (firebaseUser.customClaims) {
          console.log(`   Custom claims: ${JSON.stringify(firebaseUser.customClaims)}`);
        }

      } catch (error: any) {
        console.error(`❌ Failed: ${firebaseUser.email} - ${error.message}`);
        stats.failed++;
        stats.errors.push({
          email: firebaseUser.email || firebaseUser.uid,
          error: error.message
        });
      }
    }

    // Print summary
    console.log('\n📊 Migration Summary:');
    console.log('===================');
    console.log(`Total users:    ${stats.total}`);
    console.log(`Migrated:       ${stats.migrated} ✅`);
    console.log(`Skipped:        ${stats.skipped} ⏭️`);
    console.log(`Failed:         ${stats.failed} ❌`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(err => {
        console.log(`   ${err.email}: ${err.error}`);
      });
    }

    // Write migration report
    const report = {
      timestamp: new Date().toISOString(),
      stats,
      completedAt: new Date().toISOString()
    };

    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, event, ip_address, user_agent, metadata, success, created_at)
      VALUES (
        gen_random_uuid(),
        'MIGRATION_COMPLETED',
        '0.0.0.0',
        'Migration Script',
        ${JSON.stringify(report)}::jsonb,
        true,
        NOW()
      )
    `;

    console.log('\n✅ Migration completed successfully!');
    console.log('📧 Users will need to reset their passwords via email.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper functions
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateResetToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Run migration if called directly
if (require.main === module) {
  migrateUsers()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export { migrateUsers };