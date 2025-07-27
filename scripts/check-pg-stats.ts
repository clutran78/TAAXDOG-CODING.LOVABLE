#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStats() {
  try {
    // Check what columns are available
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM pg_stat_user_tables LIMIT 1
    `;

    if (result.length > 0) {
      console.log('Available columns in pg_stat_user_tables:');
      console.log(Object.keys(result[0]));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStats();
