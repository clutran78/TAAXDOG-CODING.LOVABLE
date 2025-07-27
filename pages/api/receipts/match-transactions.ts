import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';
import {
  autoMatchReceipts,
  findMatchingTransaction,
} from '../../../lib/services/receipts/receipt-transaction-matching';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return apiResponse.unauthorized(res, { error: 'Unauthorized' });
    }

    const { receiptId } = req.body;

    if (receiptId) {
      // Match single receipt
      const match = await findMatchingTransaction(receiptId, session.user.id);

      if (match) {
        apiResponse.success(res, {
          success: true,
          match,
        });
      } else {
        apiResponse.notFound(res, {
          success: false,
          message: 'No matching transaction found',
        });
      }
    } else {
      // Auto-match all unmatched receipts
      const result = await autoMatchReceipts(session.user.id);

      apiResponse.success(res, {
        success: true,
        matched: result.matched,
        total: result.total,
        message: `Matched ${result.matched} out of ${result.total} receipts`,
      });
    }
  } catch (error) {
    logger.error('Receipt matching error:', error);
    apiResponse.internalError(res, { error: 'Failed to match receipts' });
  }
}
