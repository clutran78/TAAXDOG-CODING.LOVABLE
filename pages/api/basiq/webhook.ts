import { NextApiRequest, NextApiResponse } from 'next';
import { basiqDB } from '@/lib/basiq/database';
import { basiqClient } from '@/lib/basiq/client';
import { BASIQ_CONFIG } from '@/lib/basiq/config';
import { BasiqWebhookEvent } from '@/lib/basiq/types';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string): boolean {
  // BASIQ uses HMAC-SHA256 for webhook signatures
  const expectedSignature = crypto
    .createHmac('sha256', BASIQ_CONFIG.API_KEY)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    // Verify webhook signature
    const signature = req.headers['x-basiq-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      logger.error('Invalid webhook signature');
      return apiResponse.unauthorized(res, { error: 'Invalid signature' });
    }

    const webhookEvent: BasiqWebhookEvent = req.body;

    // Store webhook event
    const webhookRecord = await basiqDB.createWebhookRecord(webhookEvent);

    try {
      // Process webhook based on event type
      switch (webhookEvent.type) {
        case BASIQ_CONFIG.WEBHOOK_EVENTS.CONNECTION_CREATED:
        case BASIQ_CONFIG.WEBHOOK_EVENTS.CONNECTION_UPDATED:
          await handleConnectionEvent(webhookEvent);
          break;

        case BASIQ_CONFIG.WEBHOOK_EVENTS.ACCOUNT_CREATED:
        case BASIQ_CONFIG.WEBHOOK_EVENTS.ACCOUNT_UPDATED:
          await handleAccountEvent(webhookEvent);
          break;

        case BASIQ_CONFIG.WEBHOOK_EVENTS.TRANSACTIONS_CREATED:
        case BASIQ_CONFIG.WEBHOOK_EVENTS.TRANSACTIONS_UPDATED:
          await handleTransactionEvent(webhookEvent);
          break;

        case BASIQ_CONFIG.WEBHOOK_EVENTS.JOB_COMPLETED:
        case BASIQ_CONFIG.WEBHOOK_EVENTS.JOB_FAILED:
          await handleJobEvent(webhookEvent);
          break;

        default:
          logger.info(`Unhandled webhook event type: ${webhookEvent.type}`);
      }

      // Mark webhook as processed
      await basiqDB.updateWebhookStatus(webhookRecord.id, 'processed');

      apiResponse.success(res, { message: 'Webhook processed successfully' });
    } catch (error: any) {
      // Mark webhook as failed
      await basiqDB.updateWebhookStatus(webhookRecord.id, 'failed', error.message);

      logger.error('Webhook processing error:', error);
      apiResponse.internalError(res, { error: 'Failed to process webhook' });
    }
  } catch (error: any) {
    logger.error('Webhook handler error:', error);
    apiResponse.internalError(res, { error: 'Internal server error' });
  }
}

async function handleConnectionEvent(event: BasiqWebhookEvent) {
  const connectionId = event.data.id;

  // Extract user ID from the connection URL
  const matches = event.data.links?.self.match(/users\/([^\/]+)\/connections/);
  if (!matches) {
    throw new Error('Could not extract user ID from connection URL');
  }
  const userId = matches[1];

  // Get connection details from BASIQ
  const connection = await basiqClient.getConnection(userId, connectionId);

  // Update connection status in database
  await basiqDB.updateConnectionStatus(connectionId, connection.status);

  // If connection is successful, fetch and sync accounts
  if (connection.status === 'success') {
    const accounts = await basiqClient.getAccounts(userId);

    // Find the user in our database by BASIQ user ID
    const basiqUser = await prisma.basiq_users.findUnique({
      where: { basiq_user_id: userId },
    });

    if (basiqUser && basiqUser.user_id) {
      await basiqDB.syncAccounts(basiqUser.user_id, accounts.data);
    }
  }
}

async function handleAccountEvent(event: BasiqWebhookEvent) {
  const accountId = event.data.id;

  // Extract user ID from the account URL
  const matches = event.data.links?.self.match(/users\/([^\/]+)\/accounts/);
  if (!matches) {
    throw new Error('Could not extract user ID from account URL');
  }
  const userId = matches[1];

  // Get account details from BASIQ
  const account = await basiqClient.getAccount(userId, accountId);

  // Find the user in our database
  const basiqUser = await prisma.basiq_users.findUnique({
    where: { basiq_user_id: userId },
  });

  if (basiqUser && basiqUser.user_id) {
    // Sync single account
    await basiqDB.syncAccounts(basiqUser.user_id, [account]);

    // Fetch recent transactions for the account
    const transactions = await basiqClient.getTransactions({
      accountId: account.id,
      limit: 100,
    });

    await basiqDB.syncTransactions(account.id, transactions.data);
  }
}

async function handleTransactionEvent(event: BasiqWebhookEvent) {
  // For transaction events, we need to identify the account
  // and fetch the latest transactions
  const transactionId = event.data.id;

  // Extract account ID from the transaction URL
  const matches = event.data.links?.self.match(/accounts\/([^\/]+)\/transactions/);
  if (!matches) {
    throw new Error('Could not extract account ID from transaction URL');
  }
  const accountId = matches[1];

  // Get the account from our database
  const account = await prisma.bank_accounts.findUnique({
    where: { basiq_account_id: accountId },
  });

  if (account) {
    // Fetch recent transactions
    const transactions = await basiqClient.getTransactions({
      accountId: accountId,
      limit: 50, // Get last 50 transactions
    });

    await basiqDB.syncTransactions(accountId, transactions.data);
  }
}

async function handleJobEvent(event: BasiqWebhookEvent) {
  const jobId = event.data.id;

  // Get job details
  const job = await basiqClient.getJob(jobId);

  logger.info(`Job ${jobId} ${job.status}:`, job);

  // If job failed, we might want to notify the user
  if (job.status === 'failed' && job.error) {
    // Log the error for monitoring
    logger.error(`Job ${jobId} failed:`, job.error);

    // TODO: Implement user notification system
    // For now, we just log the error
  }
}

// Disable body parsing to access raw body for signature verification
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
