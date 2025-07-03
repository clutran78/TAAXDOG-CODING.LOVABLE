import { PrismaClient } from '@prisma/client';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: 'https://openrouter.ai/api/v1',
});

export type InsightType = 
  | 'spending_pattern'
  | 'tax_optimization'
  | 'cash_flow'
  | 'business_expense'
  | 'investment'
  | 'risk_assessment'
  | 'compliance';

export interface FinancialInsightData {
  type: InsightType;
  title: string;
  description: string;
  category?: string;
  content: {
    analysis: string;
    metrics?: Record<string, any>;
    charts?: any[];
  };
  recommendations: Recommendation[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
}

export interface Recommendation {
  action: string;
  impact: string;
  timeframe: string;
  estimatedSavings?: number;
}

export async function generateFinancialInsights(
  userId: string,
  insightTypes?: InsightType[]
): Promise<FinancialInsightData[]> {
  try {
    // Gather comprehensive financial data
    const financialData = await gatherFinancialData(userId);
    
    // Generate insights for each type
    const insights: FinancialInsightData[] = [];
    const types = insightTypes || ['spending_pattern', 'tax_optimization', 'cash_flow'];
    
    for (const type of types) {
      const insight = await generateInsightByType(type, financialData);
      if (insight) {
        insights.push(insight);
      }
    }
    
    // Store insights in database
    await storeInsights(userId, insights);
    
    return insights;
  } catch (error) {
    console.error('Financial insights generation error:', error);
    throw error;
  }
}

async function gatherFinancialData(userId: string): Promise<any> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const [transactions, receipts, budget, taxReturn] = await Promise.all([
    // Get transactions
    prisma.bank_transactions.findMany({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
        transaction_date: {
          gte: sixMonthsAgo,
        },
      },
      orderBy: {
        transaction_date: 'desc',
      },
    }),
    
    // Get receipts
    prisma.receipt.findMany({
      where: {
        userId,
        date: {
          gte: sixMonthsAgo,
        },
      },
    }),
    
    // Get active budget
    prisma.budget.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    }),
    
    // Get latest tax return
    prisma.taxReturn.findFirst({
      where: {
        userId,
      },
      orderBy: {
        year: 'desc',
      },
    }),
  ]);
  
  return {
    transactions,
    receipts,
    budget,
    taxReturn,
    summary: calculateFinancialSummary(transactions),
  };
}

function calculateFinancialSummary(transactions: any[]): any {
  const income = transactions
    .filter(t => t.direction === 'credit')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
  const expenses = transactions
    .filter(t => t.direction === 'debit')
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    
  const categories = transactions.reduce((acc, t) => {
    const category = t.category || 'Other';
    if (!acc[category]) acc[category] = 0;
    acc[category] += Math.abs(parseFloat(t.amount));
    return acc;
  }, {});
  
  return {
    totalIncome: income,
    totalExpenses: expenses,
    netCashFlow: income - expenses,
    categoryBreakdown: categories,
    transactionCount: transactions.length,
  };
}

async function generateInsightByType(
  type: InsightType,
  data: any
): Promise<FinancialInsightData | null> {
  switch (type) {
    case 'spending_pattern':
      return await generateSpendingPatternInsight(data);
    case 'tax_optimization':
      return await generateTaxOptimizationInsight(data);
    case 'cash_flow':
      return await generateCashFlowInsight(data);
    case 'business_expense':
      return await generateBusinessExpenseInsight(data);
    default:
      return null;
  }
}

async function generateSpendingPatternInsight(data: any): Promise<FinancialInsightData> {
  const prompt = `Analyze the following spending data and identify patterns, anomalies, and optimization opportunities:

Summary: ${JSON.stringify(data.summary, null, 2)}
Categories: ${JSON.stringify(data.summary.categoryBreakdown, null, 2)}

Focus on:
1. Unusual spending patterns
2. Category trends
3. Potential savings opportunities
4. Subscription detection
5. Seasonal patterns

Generate actionable insights for Australian consumers.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });
    
    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    
    return {
      type: 'spending_pattern',
      title: 'Monthly Spending Analysis',
      description: 'AI-powered analysis of your spending patterns',
      category: 'expenses',
      content: {
        analysis: content,
        metrics: {
          avgMonthlySpending: data.summary.totalExpenses / 6,
          topCategories: getTopCategories(data.summary.categoryBreakdown),
        },
      },
      recommendations: extractSpendingRecommendations(content),
      priority: 'MEDIUM',
      confidence: 0.85,
    };
  } catch (error) {
    console.error('Spending pattern insight error:', error);
    throw error;
  }
}

async function generateTaxOptimizationInsight(data: any): Promise<FinancialInsightData> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const prompt = `Analyze this financial data for Australian tax optimization opportunities:

Receipts: ${data.receipts.length} total
Business Expenses: ${data.receipts.filter((r: any) => r.taxCategory?.startsWith('B')).length}
Work Expenses: ${data.receipts.filter((r: any) => r.taxCategory?.startsWith('D')).length}

Provide:
1. Potential tax deductions missed
2. GST credit opportunities
3. Business expense categorization improvements
4. Record-keeping recommendations
5. End of financial year strategies`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    return {
      type: 'tax_optimization',
      title: 'Tax Optimization Opportunities',
      description: 'Maximize your tax deductions and GST credits',
      category: 'tax',
      content: {
        analysis: content,
        metrics: {
          potentialDeductions: calculatePotentialDeductions(data),
          gstCredits: calculateGSTCredits(data.receipts),
        },
      },
      recommendations: extractTaxRecommendations(content),
      priority: 'HIGH',
      confidence: 0.9,
    };
  } catch (error) {
    console.error('Tax optimization insight error:', error);
    throw error;
  }
}

async function generateCashFlowInsight(data: any): Promise<FinancialInsightData> {
  const prompt = {
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    messages: [{
      role: 'user',
      content: `Analyze cash flow patterns:
Income: $${data.summary.totalIncome}
Expenses: $${data.summary.totalExpenses}
Net: $${data.summary.netCashFlow}

Provide cash flow insights and forecasting for the next 3 months.`,
    }],
  };
  
  try {
    const response = await openai.chat.completions.create(prompt as any);
    const content = response.choices[0].message.content || '';
    
    return {
      type: 'cash_flow',
      title: 'Cash Flow Analysis & Forecast',
      description: 'Understanding your money flow',
      category: 'cash_flow',
      content: {
        analysis: content,
        metrics: {
          monthlyNetCashFlow: data.summary.netCashFlow / 6,
          cashFlowTrend: data.summary.netCashFlow > 0 ? 'positive' : 'negative',
        },
      },
      recommendations: [
        {
          action: 'Build emergency fund',
          impact: 'Financial security',
          timeframe: '3-6 months',
          estimatedSavings: data.summary.totalIncome * 0.1,
        },
      ],
      priority: data.summary.netCashFlow < 0 ? 'HIGH' : 'MEDIUM',
      confidence: 0.8,
    };
  } catch (error) {
    console.error('Cash flow insight error:', error);
    throw error;
  }
}

async function generateBusinessExpenseInsight(data: any): Promise<FinancialInsightData> {
  const businessTransactions = data.transactions.filter((t: any) => t.is_business_expense);
  const businessReceipts = data.receipts.filter((r: any) => r.taxCategory?.startsWith('B'));
  
  const analysis = `Business Expense Analysis:
- Total business transactions: ${businessTransactions.length}
- Business receipts collected: ${businessReceipts.length}
- Potential missing receipts: ${Math.max(0, businessTransactions.length - businessReceipts.length)}`;
  
  return {
    type: 'business_expense',
    title: 'Business Expense Tracking',
    description: 'Optimize your business expense claims',
    category: 'business',
    content: {
      analysis,
      metrics: {
        totalBusinessExpenses: businessTransactions.reduce((sum: number, t: any) => 
          sum + Math.abs(parseFloat(t.amount)), 0),
        receiptCoverage: businessReceipts.length / Math.max(1, businessTransactions.length),
      },
    },
    recommendations: [
      {
        action: 'Upload missing business receipts',
        impact: 'Maximize tax deductions',
        timeframe: 'Before June 30',
      },
      {
        action: 'Review expense categorization',
        impact: 'Ensure ATO compliance',
        timeframe: 'Monthly',
      },
    ],
    priority: 'HIGH',
    confidence: 0.85,
  };
}

function getTopCategories(categoryBreakdown: Record<string, number>): any[] {
  return Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }));
}

function calculatePotentialDeductions(data: any): number {
  // Estimate based on receipts and typical deduction rates
  const workExpenses = data.receipts
    .filter((r: any) => r.taxCategory?.startsWith('D'))
    .reduce((sum: number, r: any) => sum + parseFloat(r.totalAmount), 0);
    
  const businessExpenses = data.receipts
    .filter((r: any) => r.taxCategory?.startsWith('B'))
    .reduce((sum: number, r: any) => sum + parseFloat(r.totalAmount), 0);
    
  return workExpenses + businessExpenses;
}

function calculateGSTCredits(receipts: any[]): number {
  return receipts
    .filter(r => r.gstAmount && r.taxCategory?.startsWith('B'))
    .reduce((sum, r) => sum + parseFloat(r.gstAmount), 0);
}

function extractSpendingRecommendations(content: string): Recommendation[] {
  const recommendations: Recommendation[] = [];
  
  // Basic pattern matching for recommendations
  if (content.includes('subscription')) {
    recommendations.push({
      action: 'Review and cancel unused subscriptions',
      impact: 'Reduce monthly expenses',
      timeframe: 'This week',
      estimatedSavings: 50,
    });
  }
  
  if (content.includes('dining') || content.includes('food')) {
    recommendations.push({
      action: 'Set dining out budget limit',
      impact: 'Control discretionary spending',
      timeframe: 'Next month',
      estimatedSavings: 200,
    });
  }
  
  return recommendations;
}

function extractTaxRecommendations(content: string): Recommendation[] {
  return [
    {
      action: 'Organize receipts by tax category',
      impact: 'Maximize deductions',
      timeframe: 'Before tax time',
    },
    {
      action: 'Track work-from-home expenses',
      impact: 'Claim home office deductions',
      timeframe: 'Ongoing',
    },
    {
      action: 'Document business kilometers',
      impact: 'Claim vehicle expenses',
      timeframe: 'Weekly',
    },
  ];
}

async function storeInsights(userId: string, insights: FinancialInsightData[]): Promise<void> {
  for (const insight of insights) {
    await prisma.financialInsight.create({
      data: {
        userId,
        insightType: insight.type,
        category: insight.category,
        title: insight.title,
        description: insight.description,
        content: insight.content,
        recommendations: insight.recommendations,
        priority: insight.priority,
        confidenceScore: insight.confidence,
        provider: 'multi-ai',
        model: 'claude-gemini-llama',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
  }
  
  await prisma.$disconnect();
}

export async function getActiveInsights(userId: string): Promise<any[]> {
  try {
    const insights = await prisma.financialInsight.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    return insights;
  } catch (error) {
    console.error('Get insights error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}