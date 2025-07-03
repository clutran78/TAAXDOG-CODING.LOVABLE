import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { basiqClient } from '@/lib/basiq/client';
import { basiqDB } from '@/lib/basiq/database';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  let responseStatus = 200;
  let responseBody: any = {};
  let error: string | undefined;

  try {
    // Get BASIQ user
    const basiqUser = await basiqDB.getBasiqUser(session.user.id);
    if (!basiqUser) {
      responseStatus = 404;
      responseBody = { error: 'BASIQ user not found. Please create a BASIQ user first.' };
      return res.status(responseStatus).json(responseBody);
    }

    const { type = 'all', accountId, fromDate } = req.body;

    // Start sync process
    const syncResults = {
      accounts: { synced: 0, errors: 0 },
      transactions: { synced: 0, errors: 0 },
      connections: { checked: 0, active: 0 },
    };

    // Sync connections
    if (type === 'all' || type === 'connections') {
      const connections = await basiqClient.getConnections(basiqUser.basiq_user_id);
      syncResults.connections.checked = connections.data.length;

      for (const connection of connections.data) {
        if (connection.status === 'success') {
          syncResults.connections.active++;
          await basiqDB.updateConnectionStatus(connection.id, connection.status);
        }
      }
    }

    // Sync accounts
    if (type === 'all' || type === 'accounts') {
      const accounts = await basiqClient.getAccounts(basiqUser.basiq_user_id);
      
      for (const account of accounts.data) {
        try {
          // Get connection from database
          const connection = await prisma.bank_connections.findFirst({
            where: { connection_id: account.connection },
          });

          if (!connection) {
            console.error(`Connection not found for account ${account.id}`);
            syncResults.accounts.errors++;
            continue;
          }

          // Upsert account data
          await prisma.bank_accounts.upsert({
            where: { basiq_account_id: account.id },
            create: {
              basiq_user_id: basiqUser.id,
              connection_id: connection.id,
              basiq_account_id: account.id,
              account_holder: account.accountHolder,
              account_number: account.accountNo,
              bsb: account.bsb,
              institution_name: account.institution,
              account_type: account.accountType,
              account_name: account.accountName,
              balance_available: account.availableBalance || account.balance,
              balance_current: account.balance,
              currency: account.currency || 'AUD',
              status: account.status,
              last_synced: new Date(),
            },
            update: {
              balance_available: account.availableBalance || account.balance,
              balance_current: account.balance,
              status: account.status,
              last_synced: new Date(),
            },
          });
          syncResults.accounts.synced++;
        } catch (err) {
          console.error(`Error syncing account ${account.id}:`, err);
          syncResults.accounts.errors++;
        }
      }
    }

    // Sync transactions
    if (type === 'all' || type === 'transactions') {
      const accounts = accountId 
        ? [await prisma.bank_accounts.findUnique({ where: { basiq_account_id: accountId } })]
        : await prisma.bank_accounts.findMany({ where: { basiq_user_id: basiqUser.id } });

      for (const account of accounts) {
        if (!account) continue;

        try {
          const params = {
            accountId: account.basiq_account_id,
            fromDate: fromDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 90 days
            limit: 500,
          };

          const transactions = await basiqClient.getTransactions(params);

          for (const transaction of transactions.data) {
            try {
              // Categorize transaction for tax purposes
              const categorization = basiqClient.categorizeTransaction(transaction);
              const gstAmount = categorization.gstApplicable 
                ? basiqClient.calculateGST(Math.abs(transaction.amount)) 
                : null;

              await prisma.bank_transactions.upsert({
                where: { basiq_transaction_id: transaction.id },
                create: {
                  bank_account_id: account.id,
                  basiq_transaction_id: transaction.id,
                  description: transaction.description,
                  amount: Math.abs(transaction.amount),
                  transaction_date: new Date(transaction.transactionDate),
                  post_date: transaction.postDate ? new Date(transaction.postDate) : null,
                  balance: transaction.balance,
                  transaction_type: transaction.class,
                  direction: transaction.direction,
                  category: transaction.category || transaction.subClass?.title,
                  subcategory: transaction.subClass?.title,
                  merchant_name: transaction.merchant?.name,
                  status: transaction.status,
                  is_business_expense: categorization.isBusinessExpense,
                  tax_category: categorization.taxCategory,
                  gst_amount: gstAmount,
                },
                update: {
                  description: transaction.description,
                  amount: Math.abs(transaction.amount),
                  balance: transaction.balance,
                  category: transaction.category || transaction.subClass?.title,
                  subcategory: transaction.subClass?.title,
                  merchant_name: transaction.merchant?.name,
                  status: transaction.status,
                  is_business_expense: categorization.isBusinessExpense,
                  tax_category: categorization.taxCategory,
                  gst_amount: gstAmount,
                  updated_at: new Date(),
                },
              });
              syncResults.transactions.synced++;
            } catch (err) {
              console.error(`Error syncing transaction ${transaction.id}:`, err);
              syncResults.transactions.errors++;
            }
          }
        } catch (err) {
          console.error(`Error syncing transactions for account ${account.basiq_account_id}:`, err);
          syncResults.transactions.errors++;
        }
      }
    }

    // Update last sync time
    await prisma.basiq_users.update({
      where: { id: basiqUser.id },
      data: { updated_at: new Date() },
    });

    responseBody = {
      success: true,
      syncResults,
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(responseBody);

  } catch (err: any) {
    responseStatus = 500;
    error = err.message;
    responseBody = { error: 'Sync failed', message: err.message };
    res.status(responseStatus).json(responseBody);
  } finally {
    // Log API call
    const duration = Date.now() - startTime;
    await basiqDB.logAPICall(
      session.user.id,
      '/api/basiq/sync',
      req.method || 'POST',
      req.body,
      responseStatus,
      responseBody,
      duration,
      error
    );
  }
}