import { PrismaClient } from '@prisma/client';
import { calculateSimilarity } from './string-similarity';

const prisma = new PrismaClient();

export interface MatchResult {
  transactionId: string;
  confidence: number;
  matchType: 'EXACT' | 'FUZZY' | 'MANUAL';
  matchedFields: string[];
}

export async function findMatchingTransaction(
  receipt: any,
  userId: string,
  dateRange: number = 7 // days
): Promise<MatchResult | null> {
  try {
    // Get transactions within date range
    const startDate = new Date(receipt.date);
    startDate.setDate(startDate.getDate() - dateRange);
    const endDate = new Date(receipt.date);
    endDate.setDate(endDate.getDate() + dateRange);

    const transactions = await prisma.bank_transactions.findMany({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
        transaction_date: {
          gte: startDate,
          lte: endDate,
        },
        direction: 'debit', // Only match debits/expenses
      },
      orderBy: {
        transaction_date: 'desc',
      },
    });

    let bestMatch: MatchResult | null = null;
    let highestScore = 0;

    for (const transaction of transactions) {
      const match = scoreMatch(receipt, transaction);
      
      if (match.confidence > highestScore) {
        highestScore = match.confidence;
        bestMatch = match;
      }
      
      // If we find an exact match, stop searching
      if (match.matchType === 'EXACT') {
        break;
      }
    }

    // Only return matches above threshold
    if (bestMatch && bestMatch.confidence >= 0.7) {
      return bestMatch;
    }

    return null;
  } catch (error) {
    console.error('Transaction matching error:', error);
    return null;
  }
}

function scoreMatch(receipt: any, transaction: any): MatchResult {
  const matchedFields: string[] = [];
  let totalScore = 0;
  let weights = 0;

  // Amount matching (highest weight)
  const amountDiff = Math.abs(parseFloat(receipt.totalAmount) - Math.abs(parseFloat(transaction.amount)));
  const amountScore = amountDiff < 0.01 ? 1.0 : Math.max(0, 1 - (amountDiff / parseFloat(receipt.totalAmount)));
  totalScore += amountScore * 0.4;
  weights += 0.4;
  if (amountScore > 0.99) matchedFields.push('amount');

  // Date matching
  const receiptDate = new Date(receipt.date);
  const transactionDate = new Date(transaction.transaction_date);
  const daysDiff = Math.abs((receiptDate.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
  const dateScore = daysDiff === 0 ? 1.0 : Math.max(0, 1 - (daysDiff / 7));
  totalScore += dateScore * 0.3;
  weights += 0.3;
  if (dateScore > 0.9) matchedFields.push('date');

  // Merchant name matching
  if (receipt.merchant && transaction.merchant_name) {
    const merchantScore = calculateMerchantSimilarity(receipt.merchant, transaction.merchant_name);
    totalScore += merchantScore * 0.3;
    weights += 0.3;
    if (merchantScore > 0.8) matchedFields.push('merchant');
  } else if (receipt.merchant && transaction.description) {
    // Try matching against transaction description
    const descScore = calculateMerchantSimilarity(receipt.merchant, transaction.description);
    totalScore += descScore * 0.2;
    weights += 0.2;
    if (descScore > 0.8) matchedFields.push('description');
  }

  const confidence = weights > 0 ? totalScore / weights : 0;

  // Determine match type
  let matchType: 'EXACT' | 'FUZZY' | 'MANUAL' = 'MANUAL';
  if (confidence > 0.95 && matchedFields.includes('amount') && matchedFields.includes('date')) {
    matchType = 'EXACT';
  } else if (confidence > 0.7) {
    matchType = 'FUZZY';
  }

  return {
    transactionId: transaction.id,
    confidence,
    matchType,
    matchedFields,
  };
}

function calculateMerchantSimilarity(merchant1: string, merchant2: string): number {
  // Normalize strings
  const norm1 = normalizeMerchantName(merchant1);
  const norm2 = normalizeMerchantName(merchant2);

  // Check for exact match after normalization
  if (norm1 === norm2) return 1.0;

  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;

  // Use string similarity algorithm
  return calculateSimilarity(norm1, norm2);
}

function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\b(pty|ltd|limited|inc|corp|co|company)\b/g, '') // Remove company suffixes
    .trim();
}

export async function autoMatchReceipts(userId: string): Promise<{
  matched: number;
  total: number;
}> {
  try {
    // Get unmatched receipts
    const unmatchedReceipts = await prisma.receipt.findMany({
      where: {
        userId,
        matchedTransactionId: null,
        processingStatus: 'PROCESSED',
      },
    });

    let matched = 0;

    for (const receipt of unmatchedReceipts) {
      const match = await findMatchingTransaction(receipt, userId);
      
      if (match && match.confidence >= 0.8) {
        // Update receipt with match
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: {
            matchedTransactionId: match.transactionId,
            matchConfidence: match.confidence,
            processingStatus: 'MATCHED',
          },
        });

        // Update transaction with receipt info
        await prisma.bank_transactions.update({
          where: { id: match.transactionId },
          data: {
            receipt_id: receipt.id,
            tax_category: receipt.taxCategory,
            gst_amount: receipt.gstAmount,
            is_business_expense: true,
          },
        });

        matched++;
      }
    }

    return {
      matched,
      total: unmatchedReceipts.length,
    };
  } catch (error) {
    console.error('Auto-matching error:', error);
    return { matched: 0, total: 0 };
  } finally {
    await prisma.$disconnect();
  }
}