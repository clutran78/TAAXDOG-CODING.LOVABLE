#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBankAccounts() {
  try {
    const columns = await prisma.$queryRaw<
      Array<{
        column_name: string;
        data_type: string;
      }>
    >`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'bank_accounts'
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;

    console.log('bank_accounts columns:');
    columns.forEach((col) => {
      console.log(`  ${col.column_name.padEnd(25)} ${col.data_type}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBankAccounts();
