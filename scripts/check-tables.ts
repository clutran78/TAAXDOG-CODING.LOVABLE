#!/usr/bin/env ts-node

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function checkTables() {
  try {
    console.log('Checking database tables...\n');

    // Query to get all table names
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    console.log('Tables found in database:');
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.tablename}`);
    });

    // Check for specific tables we need
    const requiredTables = ['User', 'Transaction', 'Goal', 'Receipt', 'BankingConnection'];
    const existingTables = tables.map(t => t.tablename);
    
    console.log('\nRequired tables check:');
    requiredTables.forEach(table => {
      const exists = existingTables.includes(table);
      console.log(`  ${table}: ${exists ? '✓' : '✗'}`);
    });

    // Get row counts for existing tables
    console.log('\nRow counts:');
    for (const table of existingTables) {
      try {
        const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM "${table}"`
        );
        console.log(`  ${table}: ${count[0].count} rows`);
      } catch (error) {
        // Skip if table doesn't exist or error
      }
    }

  } catch (error) {
    console.error('Error checking tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();