import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unifiedMonitoredPrisma as prisma } from '@/lib/db/unifiedMonitoredPrisma';
import { z } from 'zod';

// Get expense categories for a user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get unique categories from bank transactions
    const categories = await prisma.bank_transactions.findMany({
      where: {
        bank_account: {
          basiq_user: {
            user_id: session.user.id,
          },
        },
        direction: 'debit',
        category: {
          not: null,
        },
      },
      select: {
        category: true,
        subcategory: true,
      },
      distinct: ['category'],
    });

    // Transform to match expected format
    const formattedCategories = categories
      .filter((cat) => cat.category)
      .map((cat) => ({
        id: cat.category,
        name: cat.category,
        subcategories: cat.subcategory ? [cat.subcategory] : [],
      }));

    return NextResponse.json({ categories: formattedCategories });
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
