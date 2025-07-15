#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.production' });

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function checkAndFixSchema() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Check if emailVerified column exists
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'emailVerified'
    `;

    if (Array.isArray(result) && result.length === 0) {
      console.log('❌ Column "emailVerified" is missing from users table');
      console.log('📝 Adding missing column...\n');

      // Add the missing column
      await prisma.$executeRaw`
        ALTER TABLE users 
        ADD COLUMN "emailVerified" TIMESTAMP(3)
      `;

      console.log('✅ Column "emailVerified" added successfully!\n');
    } else {
      console.log('✅ Column "emailVerified" already exists\n');
    }

    // Check for other potentially missing columns
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;

    console.log('📋 Current columns in users table:');
    if (Array.isArray(columns)) {
      columns.forEach((col: any) => {
        console.log(`   - ${col.column_name}`);
      });
    }

    // Test the connection
    console.log('\n🧪 Testing database connection...');
    const userCount = await prisma.user.count();
    console.log(`✅ Database connected successfully! Found ${userCount} users.\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkAndFixSchema();