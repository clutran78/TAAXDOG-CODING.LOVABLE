#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function checkColumns() {
  try {
    console.log('Checking table columns...\n');

    // Get column information for key tables
    const tables = ['bank_transactions', 'goals', 'receipts', 'users', 'bank_connections'];
    
    for (const table of tables) {
      console.log(`\n📋 Table: ${table}`);
      console.log('─'.repeat(50));
      
      const columns = await prisma.$queryRaw<Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>>`
        SELECT 
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_name = ${table}
          AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;
      
      columns.forEach(col => {
        console.log(`  ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? '(nullable)' : ''}`);
      });
    }

  } catch (error) {
    console.error('Error checking columns:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();