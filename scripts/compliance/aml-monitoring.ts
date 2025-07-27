#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { AMLMonitoringService, TransactionData } from '@/lib/services/compliance';

const prisma = new PrismaClient();

/**
 * Automated AML monitoring script
 * Runs periodically to monitor new transactions for suspicious activity
 */
async function runAMLMonitoring() {
  console.log('Starting AML monitoring scan...');

  try {
    // Get unprocessed transactions from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const transactions = await prisma.bank_transactions.findMany({
      where: {
        created_at: {
          gte: oneDayAgo,
        },
        // Check if transaction has been monitored
        NOT: {
          id: {
            in: await prisma.aMLTransactionMonitoring
              .findMany({
                where: {
                  transactionId: { not: null },
                },
                select: { transactionId: true },
              })
              .then((results) => results.map((r) => r.transactionId).filter(Boolean) as string[]),
          },
        },
      },
      include: {
        bank_account: {
          include: {
            basiq_user: true,
          },
        },
      },
    });

    console.log(`Found ${transactions.length} transactions to monitor`);

    let highRiskCount = 0;
    let processedCount = 0;

    for (const transaction of transactions) {
      try {
        const transactionData: TransactionData = {
          userId: transaction.bank_account.basiq_user.user_id,
          amount: transaction.amount.toNumber(),
          currency: transaction.bank_account.currency || 'AUD',
          transactionId: transaction.id,
          transactionDate: transaction.transaction_date,
          merchantName: transaction.merchant_name || undefined,
          category: transaction.category || undefined,
          description: transaction.description || undefined,
        };

        const assessment = await AMLMonitoringService.monitorTransaction(transactionData);

        if (assessment.requiresReview) {
          highRiskCount++;
          console.log(`High-risk transaction detected: ${transaction.id}`);
          console.log(`  Risk score: ${assessment.riskScore}`);
          console.log(`  Risk factors: ${assessment.riskFactors.join(', ')}`);
        }

        processedCount++;
      } catch (error) {
        console.error(`Error monitoring transaction ${transaction.id}:`, error);
      }
    }

    console.log('\nAML Monitoring Summary:');
    console.log(`- Transactions processed: ${processedCount}`);
    console.log(`- High-risk transactions: ${highRiskCount}`);
    console.log(`- Monitoring completion: ${new Date().toISOString()}`);

    // Get pending alerts summary
    const pendingAlerts = await AMLMonitoringService.getPendingAlerts();
    if (pendingAlerts.length > 0) {
      console.log(`\n⚠️  ${pendingAlerts.length} alerts require review`);
    }
  } catch (error) {
    console.error('AML monitoring error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the monitoring
runAMLMonitoring().catch(console.error);
