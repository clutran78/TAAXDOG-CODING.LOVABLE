import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // First get the basiq user
    const basiqUser = await prisma.basiq_users.findUnique({
      where: { user_id: userId },
    });

    if (!basiqUser) {
      return NextResponse.json([]);
    }

    // Build where clause
    const whereClause: any = {};

    if (accountId) {
      whereClause.bank_account_id = accountId;
    } else {
      // Get all accounts for this user
      const accounts = await prisma.bank_accounts.findMany({
        where: { basiq_user_id: basiqUser.id },
        select: { id: true },
      });
      whereClause.bank_account_id = { in: accounts.map((a) => a.id) };
    }

    // Get transactions
    const transactions = await prisma.bank_transactions.findMany({
      where: whereClause,
      orderBy: { transaction_date: 'desc' },
      take: limit,
      skip: offset,
      include: {
        bank_account: {
          select: {
            institution_name: true,
            account_name: true,
            account_type: true,
          },
        },
      },
    });

    // Get total count for pagination
    const totalCount = await prisma.bank_transactions.count({
      where: whereClause,
    });

    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      accountId: tx.bank_account_id,
      description: tx.description,
      amount: tx.amount.toNumber(),
      date: tx.transaction_date.toISOString(),
      type: tx.amount.toNumber() > 0 ? 'income' : 'expense',
      category: tx.category || 'Uncategorized',
      subcategory: tx.subcategory,
      merchantName: tx.merchant_name,
      isBusinessExpense: tx.is_business_expense,
      taxCategory: tx.tax_category,
      account: {
        institutionName: tx.bank_account.institution_name,
        accountName: tx.bank_account.account_name,
        accountType: tx.bank_account.account_type,
      },
    }));

    return NextResponse.json({
      data: formattedTransactions,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Banking transactions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
