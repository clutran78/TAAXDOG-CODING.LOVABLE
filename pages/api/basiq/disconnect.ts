import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { basiqClient } from '@/lib/basiq/client';
import { basiqDB } from '@/lib/basiq/database';
import { prisma } from '@/lib/prisma';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const startTime = Date.now();
  let responseStatus = 200;
  let responseBody: any = {};
  let error: string | undefined;

  try {
    const { connectionId, removeAllData = false } = req.body;

    if (!connectionId) {
      responseStatus = 400;
      responseBody = { error: 'Connection ID is required' };
      return res.status(responseStatus).json(responseBody);
    }

    // Get BASIQ user
    const basiqUser = await basiqDB.getBasiqUser(session.user.id);
    if (!basiqUser) {
      responseStatus = 404;
      responseBody = { error: 'BASIQ user not found' };
      return res.status(responseStatus).json(responseBody);
    }

    // Verify connection belongs to user
    const connection = await prisma.bank_connections.findFirst({
      where: {
        connection_id: connectionId,
        basiq_user_id: basiqUser.id,
      },
    });

    if (!connection) {
      responseStatus = 404;
      responseBody = { error: 'Connection not found' };
      return res.status(responseStatus).json(responseBody);
    }

    // Delete connection from BASIQ
    try {
      await basiqClient.deleteConnection(basiqUser.basiq_user_id, connectionId);
    } catch (err: any) {
      // If connection is already deleted in BASIQ, continue with local cleanup
      if (!err.message.includes('404')) {
        throw err;
      }
    }

    // Update connection status
    await prisma.bank_connections.update({
      where: { id: connection.id },
      data: {
        status: 'disconnected',
        updated_at: new Date(),
      },
    });

    // Remove related data if requested
    if (removeAllData) {
      // Get all accounts for this connection
      const accounts = await prisma.bank_accounts.findMany({
        where: { connection_id: connection.id },
        select: { id: true },
      });

      const accountIds = accounts.map((acc) => acc.id);

      // Delete transactions
      const deletedTransactions = await prisma.bank_transactions.deleteMany({
        where: { bank_account_id: { in: accountIds } },
      });

      // Delete accounts
      const deletedAccounts = await prisma.bank_accounts.deleteMany({
        where: { connection_id: connection.id },
      });

      // Delete connection
      await prisma.bank_connections.delete({
        where: { id: connection.id },
      });

      responseBody = {
        success: true,
        message: 'Connection and all related data removed successfully',
        deleted: {
          connection: 1,
          accounts: deletedAccounts.count,
          transactions: deletedTransactions.count,
        },
      };
    } else {
      // Just mark accounts as inactive
      await prisma.bank_accounts.updateMany({
        where: { connection_id: connection.id },
        data: {
          status: 'inactive',
          updated_at: new Date(),
        },
      });

      responseBody = {
        success: true,
        message: 'Connection disconnected successfully',
        dataRetained: true,
      };
    }

    apiResponse.success(res, responseBody);
  } catch (err: any) {
    responseStatus = 500;
    error = err.message;
    responseBody = { error: 'Disconnect failed', message: err.message };
    res.status(responseStatus).json(responseBody);
  } finally {
    // Log API call
    const duration = Date.now() - startTime;
    await basiqDB.logAPICall(
      session.user.id,
      '/api/basiq/disconnect',
      req.method || 'POST',
      req.body,
      responseStatus,
      responseBody,
      duration,
      error,
    );
  }
}
