import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { basiqClient } from '@/lib/basiq/client';
import { basiqDB } from '@/lib/basiq/database';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
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

    switch (req.method) {
      case 'GET':
        const { sync } = req.query;

        if (sync === 'true') {
          // Fetch latest accounts from BASIQ and sync to database
          const basiqAccounts = await basiqClient.getAccounts(basiqUser.basiq_user_id);
          await basiqDB.syncAccounts(session.user.id, basiqAccounts.data);

          // Sync transactions for each account
          for (const account of basiqAccounts.data) {
            try {
              const transactions = await basiqClient.getTransactions({
                accountId: account.id,
                limit: 500, // Get last 500 transactions
              });

              await basiqDB.syncTransactions(account.id, transactions.data);
            } catch (err) {
              logger.error(`Failed to sync transactions for account ${account.id}:`, err);
            }
          }
        }

        // Get accounts from database
        const accounts = await basiqDB.getUserAccounts(session.user.id);

        responseBody = {
          accounts,
          synced: sync === 'true',
        };
        apiResponse.success(res, responseBody);
        break;

      case 'POST':
        // Get specific account details
        const { accountId } = req.body;
        if (!accountId) {
          responseStatus = 400;
          responseBody = { error: 'Account ID is required' };
          return res.status(responseStatus).json(responseBody);
        }

        const account = await basiqClient.getAccount(basiqUser.basiq_user_id, accountId);

        responseBody = { account };
        apiResponse.success(res, responseBody);
        break;

      default:
        responseStatus = 405;
        responseBody = { error: 'Method not allowed' };
        res.status(responseStatus).json(responseBody);
    }
  } catch (err: any) {
    responseStatus = 500;
    error = err.message;
    responseBody = { error: 'Internal server error', message: err.message };
    res.status(responseStatus).json(responseBody);
  } finally {
    // Log API call
    const duration = Date.now() - startTime;
    await basiqDB.logAPICall(
      session.user.id,
      '/api/basiq/accounts',
      req.method || 'GET',
      req.body,
      responseStatus,
      responseBody,
      duration,
      error,
    );
  }
}
