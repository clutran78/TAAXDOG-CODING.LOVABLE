#!/usr/bin/env ts-node

import { PrismaClient, DataRequestStatus } from '@prisma/client';
import { PrivacyComplianceService } from '@/lib/services/compliance';
import { addDays, differenceInDays } from 'date-fns';

const prisma = new PrismaClient();

/**
 * Automated privacy compliance monitoring
 * Checks for expiring consents, overdue data requests, and compliance issues
 */
async function runPrivacyMonitoring() {
  console.log('Starting privacy compliance monitoring...');

  try {
    // 1. Check for expiring consents
    const sevenDaysFromNow = addDays(new Date(), 7);
    const expiringConsents = await prisma.privacyConsent.findMany({
      where: {
        consentStatus: 'GRANTED',
        expiryDate: {
          lte: sevenDaysFromNow,
          gte: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (expiringConsents.length > 0) {
      console.log(`\n⚠️  ${expiringConsents.length} consents expiring within 7 days:`);
      expiringConsents.forEach((consent) => {
        const daysUntilExpiry = differenceInDays(consent.expiryDate!, new Date());
        console.log(
          `  - User: ${consent.user.email} | Type: ${consent.consentType} | Expires in: ${daysUntilExpiry} days`,
        );
      });
    }

    // 2. Expire old consents
    const expiredCount = await PrivacyComplianceService.expireOldConsents();
    if (expiredCount > 0) {
      console.log(`\n✓ Expired ${expiredCount} old consents`);
    }

    // 3. Check for overdue data requests
    const overdueRequests = await prisma.dataAccessRequest.findMany({
      where: {
        requestStatus: {
          in: [DataRequestStatus.PENDING, DataRequestStatus.VERIFIED, DataRequestStatus.PROCESSING],
        },
        dueDate: {
          lt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (overdueRequests.length > 0) {
      console.log(`\n🚨 ${overdueRequests.length} OVERDUE data requests:`);
      overdueRequests.forEach((request) => {
        const daysOverdue = differenceInDays(new Date(), request.dueDate);
        console.log(
          `  - Request: ${request.id} | Type: ${request.requestType} | User: ${request.user.email} | Overdue by: ${daysOverdue} days`,
        );
      });
    }

    // 4. Check requests approaching deadline
    const threeDaysFromNow = addDays(new Date(), 3);
    const approachingDeadline = await prisma.dataAccessRequest.findMany({
      where: {
        requestStatus: {
          in: [DataRequestStatus.PENDING, DataRequestStatus.VERIFIED],
        },
        dueDate: {
          gte: new Date(),
          lte: threeDaysFromNow,
        },
      },
    });

    if (approachingDeadline.length > 0) {
      console.log(`\n⏰ ${approachingDeadline.length} data requests approaching deadline (3 days)`);
    }

    // 5. Clean up expired data exports
    const sevenDaysAgo = addDays(new Date(), -7);
    const expiredExports = await prisma.dataAccessRequest.count({
      where: {
        requestStatus: DataRequestStatus.COMPLETED,
        responseExpiryDate: {
          lt: new Date(),
        },
      },
    });

    if (expiredExports > 0) {
      console.log(`\n🗑️  ${expiredExports} data exports have expired and should be cleaned up`);
    }

    // 6. Compliance summary
    const totalUsers = await prisma.user.count();
    const usersWithConsent = await prisma.privacyConsent.findMany({
      where: {
        consentStatus: 'GRANTED',
        consentType: 'PRIVACY_POLICY',
        expiryDate: {
          gt: new Date(),
        },
      },
      distinct: ['userId'],
    });

    const consentRate = ((usersWithConsent.length / totalUsers) * 100).toFixed(2);

    console.log('\n📊 Privacy Compliance Summary:');
    console.log(`- Total users: ${totalUsers}`);
    console.log(`- Users with valid privacy consent: ${usersWithConsent.length} (${consentRate}%)`);
    console.log(`- Monitoring completion: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Privacy monitoring error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the monitoring
runPrivacyMonitoring().catch(console.error);
