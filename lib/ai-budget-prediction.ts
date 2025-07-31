import { PrismaClient } from '@prisma/client';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface BudgetPrediction {
  monthlySpending: number;
  categoryBreakdown: CategoryPrediction[];
  savingsPotential: number;
  confidence: number;
  seasonalFactors: SeasonalFactor[];
  recommendations: string[];
}

export interface CategoryPrediction {
  category: string;
  predictedAmount: number;
  historicalAverage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  confidence: number;
}

export interface SeasonalFactor {
  month: string;
  factor: number;
  description: string;
}

export async function generateBudgetPredictions(
  userId: string,
  analysisPeriod: number = 6, // months
): Promise<BudgetPrediction> {
  try {
    // Fetch historical transaction data
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - analysisPeriod);

    const transactions = await prisma.bank_transactions.findMany({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
        transaction_date: {
          gte: startDate,
        },
      },
      orderBy: {
        transaction_date: 'desc',
      },
    });

    // Group transactions by category and month
    const categoryData = groupTransactionsByCategory(transactions);
    const monthlyData = groupTransactionsByMonth(transactions);

    // Prepare data for AI analysis
    const analysisData = {
      transactions: transactions.map((t) => ({
        amount: t.amount,
        category: t.category,
        date: t.transaction_date,
        isBusinessExpense: t.is_business_expense,
      })),
      categoryTotals: categoryData,
      monthlyTotals: monthlyData,
      analysisPeriod,
    };

    // Use Claude for advanced prediction
    const prediction = await generateClaudePrediction(analysisData);

    // Validate and enhance with Gemini
    const enhancedPrediction = await enhanceWithGemini(prediction, analysisData);

    return enhancedPrediction;
  } catch (error) {
    logger.error('Budget prediction error:', error);
    throw error;
  }
}

async function generateClaudePrediction(data: any): Promise<BudgetPrediction> {
  const prompt = `Analyze the following transaction data and generate budget predictions for the next 3 months. Consider Australian tax year (July 1 - June 30) and seasonal patterns.

Transaction Data:
${JSON.stringify(data, null, 2)}

Generate a JSON response with:
1. Monthly spending prediction
2. Category breakdown with predictions
3. Savings potential
4. Seasonal factors
5. Recommendations for budget optimization

Focus on Australian financial patterns and tax deductions.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    logger.error('Claude prediction error:', error);
    // Fallback to statistical prediction
    return generateStatisticalPrediction(data);
  }
}

async function enhanceWithGemini(
  prediction: BudgetPrediction,
  data: any,
): Promise<BudgetPrediction> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Review and enhance this budget prediction with Australian tax optimization insights:
${JSON.stringify(prediction, null, 2)}

Transaction history:
${JSON.stringify(data.categoryTotals, null, 2)}

Provide:
1. Tax deduction opportunities
2. GST optimization strategies
3. Business expense categorization recommendations
4. Seasonal spending insights for Australia`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract recommendations
    const recommendations = extractRecommendations(text);

    return {
      ...prediction,
      recommendations: [...prediction.recommendations, ...recommendations],
    };
  } catch (error) {
    logger.error('Gemini enhancement error:', error);
    return prediction;
  }
}

function generateStatisticalPrediction(data: any): BudgetPrediction {
  const { categoryTotals, monthlyTotals } = data;

  // Calculate averages and trends
  const monthlyAverage = calculateAverage(Object.values(monthlyTotals));
  const categoryPredictions = Object.entries(categoryTotals).map(
    ([category, amounts]: [string, any]) => {
      const avg = calculateAverage(amounts);
      const trend = calculateTrend(amounts);

      return {
        category,
        predictedAmount: avg * (1 + trend * 0.1),
        historicalAverage: avg,
        trend: (trend > 0.05 ? 'increasing' : trend < -0.05 ? 'decreasing' : 'stable') as
          | 'increasing'
          | 'stable'
          | 'decreasing',
        confidence: 0.7,
      };
    },
  );

  return {
    monthlySpending: monthlyAverage,
    categoryBreakdown: categoryPredictions,
    savingsPotential: monthlyAverage * 0.1, // 10% savings target
    confidence: 0.7,
    seasonalFactors: generateSeasonalFactors(),
    recommendations: [
      'Consider reviewing recurring subscriptions',
      'Look for tax deductible expenses',
      'Set up automatic savings transfers',
    ],
  };
}

function groupTransactionsByCategory(transactions: any[]): Record<string, number[]> {
  const grouped: Record<string, number[]> = {};

  transactions.forEach((t) => {
    const category = t.category || 'Other';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(Math.abs(parseFloat(t.amount)));
  });

  return grouped;
}

function groupTransactionsByMonth(transactions: any[]): Record<string, number> {
  const grouped: Record<string, number> = {};

  transactions.forEach((t) => {
    const monthKey = `${t.transaction_date.getFullYear()}-${t.transaction_date.getMonth() + 1}`;
    if (!grouped[monthKey]) grouped[monthKey] = 0;
    grouped[monthKey] += Math.abs(parseFloat(t.amount));
  });

  return grouped;
}

function calculateAverage(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function calculateTrend(numbers: number[]): number {
  if (numbers.length < 2) return 0;

  const firstHalf = numbers.slice(0, Math.floor(numbers.length / 2));
  const secondHalf = numbers.slice(Math.floor(numbers.length / 2));

  const firstAvg = calculateAverage(firstHalf);
  const secondAvg = calculateAverage(secondHalf);

  return (secondAvg - firstAvg) / firstAvg;
}

function generateSeasonalFactors(): SeasonalFactor[] {
  return [
    { month: 'December', factor: 1.3, description: 'Christmas shopping and holidays' },
    { month: 'January', factor: 1.1, description: 'Back to school expenses' },
    { month: 'June', factor: 1.2, description: 'End of financial year sales' },
    { month: 'July', factor: 0.9, description: 'New financial year budgeting' },
  ];
}

function extractRecommendations(text: string): string[] {
  const recommendations: string[] = [];

  // Extract tax-related recommendations
  if (text.includes('deduction')) {
    recommendations.push('Track work-related expenses for tax deductions');
  }

  if (text.includes('GST')) {
    recommendations.push('Ensure GST receipts are collected for business expenses');
  }

  // Add more pattern matching as needed
  return recommendations;
}

export async function createBudget(
  userId: string,
  data: {
    name: string;
    monthlyBudget: number;
    targetSavings?: number;
    monthlyIncome?: number;
    categoryLimits?: Record<string, number>;
  },
): Promise<any> {
  try {
    // Generate predictions
    const predictions = await generateBudgetPredictions(userId);

    // Create budget record
    const budget = await prisma.budget.create({
      data: {
        userId,
        name: data.name,
        monthlyBudget: data.monthlyBudget,
        targetSavings: data.targetSavings || data.monthlyBudget * 0.1,
        monthlyIncome: data.monthlyIncome,
        predictions: predictions as any,
        categoryLimits: data.categoryLimits || {},
        confidenceScore: predictions.confidence,
        aiProvider: 'anthropic',
        aiModel: 'claude-3-sonnet',
        analysisPeriod: '6_months',
        predictionPeriod: '3_months',
        status: 'ACTIVE',
      },
    });

    // Create initial tracking records
    await createInitialTracking(budget.id, userId, predictions);

    return budget;
  } catch (error) {
    logger.error('Create budget error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function createInitialTracking(
  budgetId: string,
  userId: string,
  predictions: BudgetPrediction,
): Promise<void> {
  const currentDate = new Date();

  // Create tracking for next 3 months
  for (let i = 0; i < 3; i++) {
    const trackingDate = new Date(currentDate);
    trackingDate.setMonth(trackingDate.getMonth() + i);

    for (const category of predictions.categoryBreakdown) {
      await prisma.budgetTracking.create({
        data: {
          budgetId,
          userId,
          month: trackingDate.getMonth() + 1,
          year: trackingDate.getFullYear(),
          predictedAmount: category.predictedAmount,
          category: category.category,
        },
      });
    }
  }
}
