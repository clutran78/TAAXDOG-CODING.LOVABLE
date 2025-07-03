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

  const startTime = Date.now();
  let responseStatus = 200;
  let responseBody: any = {};
  let error: string | undefined;

  try {
    switch (req.method) {
      case 'GET':
        const { accountId, fromDate, toDate, summary } = req.query;

        if (summary === 'true') {
          // Get transaction summary for all accounts
          const transactionSummary = await basiqDB.getTransactionSummary(
            session.user.id,
            fromDate ? new Date(fromDate as string) : undefined,
            toDate ? new Date(toDate as string) : undefined
          );

          responseBody = { summary: transactionSummary };
          res.status(200).json(responseBody);
          break;
        }

        if (!accountId || typeof accountId !== 'string') {
          responseStatus = 400;
          responseBody = { error: 'Account ID is required' };
          return res.status(responseStatus).json(responseBody);
        }

        // Get transactions from BASIQ
        const transactions = await basiqClient.getTransactions({
          accountId,
          fromDate: fromDate as string,
          toDate: toDate as string,
          limit: 100,
        });

        // Sync to database
        await basiqDB.syncTransactions(accountId, transactions.data);

        // Add tax categorization to response
        const categorizedTransactions = transactions.data.map(transaction => {
          const { taxCategory, isBusinessExpense, gstApplicable } = 
            basiqClient.categorizeTransaction(transaction);
          
          return {
            ...transaction,
            taxCategory,
            isBusinessExpense,
            gstApplicable,
            gstAmount: gstApplicable ? basiqClient.calculateGST(Math.abs(transaction.amount)) : 0,
          };
        });

        responseBody = { 
          transactions: categorizedTransactions,
          count: categorizedTransactions.length,
        };
        res.status(200).json(responseBody);
        break;

      case 'PUT':
        // Update transaction categorization
        const { transactionId, taxCategory, isBusinessExpense, notes, receiptId } = req.body;

        if (!transactionId) {
          responseStatus = 400;
          responseBody = { error: 'Transaction ID is required' };
          return res.status(responseStatus).json(responseBody);
        }

        // Update in database
        const updateData: any = {};
        if (taxCategory !== undefined) updateData.tax_category = taxCategory;
        if (isBusinessExpense !== undefined) updateData.is_business_expense = isBusinessExpense;
        if (notes !== undefined) updateData.notes = notes;
        if (receiptId !== undefined) updateData.receipt_id = receiptId;

        // Recalculate GST if business expense status changed
        if (isBusinessExpense !== undefined) {
          const transaction = await prisma.bank_transactions.findUnique({
            where: { basiq_transaction_id: transactionId },
          });
          
          if (transaction) {
            updateData.gst_amount = isBusinessExpense 
              ? basiqClient.calculateGST(Math.abs(transaction.amount))
              : 0;
          }
        }

        await prisma.bank_transactions.update({
          where: { basiq_transaction_id: transactionId },
          data: updateData,
        });

        responseBody = { message: 'Transaction updated successfully' };
        res.status(200).json(responseBody);
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
      '/api/basiq/transactions',
      req.method || 'GET',
      req.body,
      responseStatus,
      responseBody,
      duration,
      error
    );
  }
}