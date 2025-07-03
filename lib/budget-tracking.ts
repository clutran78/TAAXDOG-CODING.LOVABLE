import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface VarianceAnalysis {
  budgetId: string;
  month: number;
  year: number;
  categories: CategoryVariance[];
  totalPredicted: number;
  totalActual: number;
  totalVariance: number;
  variancePercent: number;
  insights: string[];
}

export interface CategoryVariance {
  category: string;
  predicted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: 'over' | 'under' | 'on_track';
}

export async function updateBudgetTracking(
  userId: string,
  month: number,
  year: number
): Promise<void> {
  try {
    // Get active budget
    const budget = await prisma.budget.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    if (!budget) {
      console.log('No active budget found for user:', userId);
      return;
    }

    // Get actual spending from transactions
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

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
        direction: 'debit',
      },
    });

    // Group by category
    const categoryActuals = transactions.reduce((acc, t) => {
      const category = t.category || 'Other';
      if (!acc[category]) acc[category] = 0;
      acc[category] += Math.abs(parseFloat(t.amount.toString()));
      return acc;
    }, {} as Record<string, number>);

    // Update tracking records
    for (const [category, actualAmount] of Object.entries(categoryActuals)) {
      const tracking = await prisma.budgetTracking.findFirst({
        where: {
          budgetId: budget.id,
          month,
          year,
          category,
        },
      });

      if (tracking) {
        // Update existing tracking
        await prisma.budgetTracking.update({
          where: { id: tracking.id },
          data: {
            actualAmount,
            variance: actualAmount - parseFloat(tracking.predictedAmount.toString()),
          },
        });
      } else {
        // Create new tracking if category wasn't predicted
        await prisma.budgetTracking.create({
          data: {
            budgetId: budget.id,
            userId,
            month,
            year,
            category,
            predictedAmount: 0,
            actualAmount,
            variance: actualAmount,
          },
        });
      }
    }
  } catch (error) {
    console.error('Update budget tracking error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export async function getVarianceAnalysis(
  budgetId: string,
  month: number,
  year: number
): Promise<VarianceAnalysis> {
  try {
    const tracking = await prisma.budgetTracking.findMany({
      where: {
        budgetId,
        month,
        year,
      },
    });

    const categories: CategoryVariance[] = tracking.map(t => {
      const predicted = parseFloat(t.predictedAmount.toString());
      const actual = parseFloat(t.actualAmount?.toString() || '0');
      const variance = actual - predicted;
      const variancePercent = predicted > 0 ? (variance / predicted) * 100 : 0;

      return {
        category: t.category || 'Other',
        predicted,
        actual,
        variance,
        variancePercent,
        status: variancePercent > 10 ? 'over' : variancePercent < -10 ? 'under' : 'on_track',
      };
    });

    const totalPredicted = categories.reduce((sum, c) => sum + c.predicted, 0);
    const totalActual = categories.reduce((sum, c) => sum + c.actual, 0);
    const totalVariance = totalActual - totalPredicted;
    const variancePercent = totalPredicted > 0 ? (totalVariance / totalPredicted) * 100 : 0;

    const insights = generateVarianceInsights(categories, variancePercent);

    return {
      budgetId,
      month,
      year,
      categories,
      totalPredicted,
      totalActual,
      totalVariance,
      variancePercent,
      insights,
    };
  } catch (error) {
    console.error('Get variance analysis error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function generateVarianceInsights(
  categories: CategoryVariance[],
  totalVariancePercent: number
): string[] {
  const insights: string[] = [];

  // Overall budget performance
  if (totalVariancePercent > 10) {
    insights.push(`You're ${Math.abs(totalVariancePercent).toFixed(0)}% over budget this month. Consider reviewing your spending.`);
  } else if (totalVariancePercent < -10) {
    insights.push(`Great job! You're ${Math.abs(totalVariancePercent).toFixed(0)}% under budget this month.`);
  } else {
    insights.push('You\'re on track with your budget this month.');
  }

  // Category-specific insights
  const overBudgetCategories = categories
    .filter(c => c.status === 'over')
    .sort((a, b) => b.variance - a.variance);

  if (overBudgetCategories.length > 0) {
    const topCategory = overBudgetCategories[0];
    insights.push(
      `${topCategory.category} spending is ${Math.abs(topCategory.variancePercent).toFixed(0)}% over budget ` +
      `($${topCategory.variance.toFixed(2)} over).`
    );
  }

  // Savings opportunity
  const underBudgetCategories = categories.filter(c => c.status === 'under');
  if (underBudgetCategories.length > 0) {
    const totalSavings = underBudgetCategories.reduce((sum, c) => sum + Math.abs(c.variance), 0);
    insights.push(`You have $${totalSavings.toFixed(2)} in potential savings from under-budget categories.`);
  }

  return insights;
}

export async function generateBudgetReport(
  userId: string,
  startMonth: number,
  startYear: number,
  endMonth: number,
  endYear: number
): Promise<any> {
  try {
    const budget = await prisma.budget.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: {
        budgetTracking: {
          where: {
            OR: [
              {
                year: startYear,
                month: { gte: startMonth },
              },
              {
                year: { gt: startYear, lt: endYear },
              },
              {
                year: endYear,
                month: { lte: endMonth },
              },
            ],
          },
          orderBy: [
            { year: 'asc' },
            { month: 'asc' },
          ],
        },
      },
    });

    if (!budget) {
      throw new Error('No active budget found');
    }

    // Group tracking by month
    const monthlyData = budget.budgetTracking.reduce((acc, t) => {
      const key = `${t.year}-${t.month}`;
      if (!acc[key]) {
        acc[key] = {
          month: t.month,
          year: t.year,
          predicted: 0,
          actual: 0,
          categories: [],
        };
      }
      
      acc[key].predicted += parseFloat(t.predictedAmount.toString());
      acc[key].actual += parseFloat(t.actualAmount?.toString() || '0');
      acc[key].categories.push({
        category: t.category,
        predicted: parseFloat(t.predictedAmount.toString()),
        actual: parseFloat(t.actualAmount?.toString() || '0'),
      });
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate summary statistics
    const months = Object.values(monthlyData);
    const totalPredicted = months.reduce((sum, m) => sum + m.predicted, 0);
    const totalActual = months.reduce((sum, m) => sum + m.actual, 0);
    const avgMonthlyPredicted = totalPredicted / months.length;
    const avgMonthlyActual = totalActual / months.length;

    return {
      budget: {
        id: budget.id,
        name: budget.name,
        monthlyBudget: budget.monthlyBudget,
        targetSavings: budget.targetSavings,
      },
      period: {
        start: `${startYear}-${startMonth}`,
        end: `${endYear}-${endMonth}`,
        months: months.length,
      },
      summary: {
        totalPredicted,
        totalActual,
        totalVariance: totalActual - totalPredicted,
        avgMonthlyPredicted,
        avgMonthlyActual,
        avgMonthlyVariance: avgMonthlyActual - avgMonthlyPredicted,
      },
      monthlyData: Object.values(monthlyData),
    };
  } catch (error) {
    console.error('Generate budget report error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}