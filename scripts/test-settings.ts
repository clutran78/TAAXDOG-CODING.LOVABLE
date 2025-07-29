#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSettingsSchema() {
  console.log('🔍 Testing Settings Schema...\n');

  try {
    // Check if new fields exist in schema
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        postcode: true,
        abn: true,
        businessName: true,
        taxFileNumber: true,
        preferences: true,
        passwordChangedAt: true,
        twoFactorEnabled: true,
      },
    });

    console.log('✅ Schema fields verified:');
    console.log('- address field exists');
    console.log('- city field exists');
    console.log('- state field exists');
    console.log('- postcode field exists');
    console.log('- businessName field exists');
    console.log('- preferences field exists');
    console.log('- passwordChangedAt field exists');
    console.log('- All settings-related fields are available\n');

    if (user) {
      console.log('📊 Sample user data:');
      console.log(`- Email: ${user.email}`);
      console.log(`- Name: ${user.name || 'Not set'}`);
      console.log(`- Phone: ${user.phone || 'Not set'}`);
      console.log(`- Address: ${user.address || 'Not set'}`);
      console.log(`- Business Name: ${user.businessName || 'Not set'}`);
      console.log(`- ABN: ${user.abn || 'Not set'}`);
      console.log(`- 2FA Enabled: ${user.twoFactorEnabled}`);
    }

    console.log('\n✅ All settings schema tests passed!');
  } catch (error) {
    console.error('❌ Error testing settings schema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testSettingsSchema();