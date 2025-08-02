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

    // First get the basiq user
    const basiqUser = await prisma.basiq_users.findUnique({
      where: { user_id: userId },
    });

    if (!basiqUser) {
      return NextResponse.json([]);
    }

    // Get bank accounts for this user
    const bankAccounts = await prisma.bank_accounts.findMany({
      where: { basiq_user_id: basiqUser.id },
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { bank_transactions: true },
        },
        bank_transactions: {
          take: 10,
          orderBy: { transaction_date: 'desc' },
        },
      },
    });

    const formattedAccounts = bankAccounts.map((account) => ({
      id: account.id,
      institutionName: account.institution_name,
      accountName: account.account_name || account.account_holder,
      accountNumber: account.account_number,
      bsb: account.bsb,
      balance: account.balance_current?.toNumber() || 0,
      accountType: account.account_type,
      isActive: account.status === 'active',
      lastSynced: account.last_synced?.toISOString(),
      connectionStatus: account.status,
      transactionCount: account._count.bank_transactions,
      transactions: account.bank_transactions.map((tx) => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount.toNumber(),
        date: tx.transaction_date.toISOString(),
        type: tx.amount.toNumber() > 0 ? 'income' : 'expense',
        category: tx.category,
        merchantName: tx.merchant_name,
      })),
    }));

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error('Banking accounts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST endpoint removed - bank accounts are created via BASIQ integration only
