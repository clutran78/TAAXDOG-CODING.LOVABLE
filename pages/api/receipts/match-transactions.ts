import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { autoMatchReceipts, findMatchingTransaction } from '../../../lib/receipt-transaction-matching';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { receiptId } = req.body;

    if (receiptId) {
      // Match single receipt
      const match = await findMatchingTransaction(receiptId, session.user.id);
      
      if (match) {
        res.status(200).json({
          success: true,
          match,
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'No matching transaction found',
        });
      }
    } else {
      // Auto-match all unmatched receipts
      const result = await autoMatchReceipts(session.user.id);
      
      res.status(200).json({
        success: true,
        matched: result.matched,
        total: result.total,
        message: `Matched ${result.matched} out of ${result.total} receipts`,
      });
    }

  } catch (error) {
    console.error('Receipt matching error:', error);
    res.status(500).json({ error: 'Failed to match receipts' });
  }
}