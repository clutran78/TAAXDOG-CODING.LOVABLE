import { AIService } from '../ai-service';
import { AnthropicProvider } from '../providers/anthropic';
import { OpenRouterProvider } from '../providers/openrouter';
import { GeminiProvider } from '../providers/gemini';
import { getAIConfig } from '../../config';
import { AI_MODELS } from '../config';
import { FinancialInsight, AIInsightType, AIOperationType } from '../types';
import { prisma } from '../../prisma';
import { logger } from '@/lib/logger';

export class FinancialInsightsService {
  private aiService: AIService;
  private anthropic: AnthropicProvider;
  private openrouter: OpenRouterProvider;
  private gemini: GeminiProvider;

  constructor() {
    this.aiService = new AIService();
    const config = getAIConfig();

    // Initialize providers for multi-provider system
    this.anthropic = new AnthropicProvider(
      config.anthropic.apiKey,
      AI_MODELS.CLAUDE_4_SONNET, // Primary for complex analysis
    );

    this.openrouter = new OpenRouterProvider(
      config.openrouter.apiKey,
      AI_MODELS.CLAUDE_3_SONNET, // Secondary via OpenRouter
    );

    this.gemini = new GeminiProvider(
      config.gemini.apiKey,
      AI_MODELS.GEMINI_PRO, // Tertiary for specific tasks
    );
  }

  async generateCashFlowInsights(
    userId: string,
    transactions: Array<{
      date: Date;
      amount: number;
      type: 'income' | 'expense';
      category?: string;
      description?: string;
    }>,
    period: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
  ): Promise<FinancialInsight[]> {
    const prompt = `Analyze this cash flow data and provide actionable insights for an Australian individual/business:

Period: ${period}
Transactions: ${JSON.stringify(transactions)}

Generate insights focusing on:
1. Cash flow patterns and trends
2. Seasonal variations
3. Expense optimization opportunities
4. Income stability assessment
5. Working capital recommendations
6. Tax planning implications

Provide response as JSON array of insights:
[{
  "type": "cash_flow",
  "title": "insight title",
  "description": "detailed explanation",
  "impact": "financial impact description",
  "recommendations": ["action 1", "action 2"],
  "dataPoints": {
    "metric1": value,
    "metric2": value
  },
  "priority": "high|medium|low"
}]`;

    // Use Anthropic for complex cash flow analysis
    const response = await this.anthropic.sendMessage([
      {
        role: 'system',
        content: 'You are a financial analyst expert in Australian personal and business finance.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Track usage
    await this.trackUsage({
      userId,
      operationType: AIOperationType.FINANCIAL_INSIGHTS,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed.total,
      cost: response.cost,
      responseTimeMs: response.responseTimeMs,
      success: true,
    });

    const insights = JSON.parse(response.content);

    // Store insights
    const storedInsights: FinancialInsight[] = [];

    for (const insight of insights) {
      const financialInsight: FinancialInsight = {
        type: AIInsightType.CASH_FLOW,
        title: insight.title,
        description: insight.description,
        impact: insight.impact,
        recommendations: insight.recommendations,
        confidence: 0.85,
        dataPoints: insight.dataPoints,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      await prisma.aIInsight.create({
        data: {
          userId,
          insightType: AIInsightType.CASH_FLOW,
          category: 'financial',
          content: financialInsight as any,
          confidenceScore: financialInsight.confidence,
          provider: response.provider,
          model: response.model,
          expiresAt: financialInsight.expiresAt,
        },
      });

      storedInsights.push(financialInsight);
    }

    return storedInsights;
  }

  async analyzeExpensePatterns(
    userId: string,
    expenses: Array<{
      date: Date;
      amount: number;
      category: string;
      merchant?: string;
      isRecurring?: boolean;
    }>,
  ): Promise<FinancialInsight[]> {
    const prompt = `Analyze expense patterns and identify optimization opportunities:

Expenses: ${JSON.stringify(expenses)}

Identify:
1. Unusual spending patterns or anomalies
2. Categories with increasing costs
3. Potential subscription overlap or waste
4. Tax deduction opportunities missed
5. Budget optimization suggestions
6. Comparative analysis to Australian averages

For each insight, consider tax implications and ATO compliance.

Provide response as JSON array with same structure as before.`;

    // Use Gemini for pattern recognition in expenses
    const response = await this.gemini.sendMessage([
      {
        role: 'system',
        content:
          'You are an expert in personal finance optimization and Australian tax efficiency.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Track usage
    await this.trackUsage({
      userId,
      operationType: AIOperationType.FINANCIAL_INSIGHTS,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed.total,
      cost: response.cost,
      responseTimeMs: response.responseTimeMs,
      success: true,
    });

    const insights = JSON.parse(response.content);
    const storedInsights: FinancialInsight[] = [];

    for (const insight of insights) {
      const expenseInsight: FinancialInsight = {
        type: AIInsightType.EXPENSE_PATTERN,
        title: insight.title,
        description: insight.description,
        impact: insight.impact,
        recommendations: insight.recommendations,
        confidence: insight.confidence || 0.8,
        dataPoints: insight.dataPoints,
      };

      await prisma.aIInsight.create({
        data: {
          userId,
          insightType: AIInsightType.EXPENSE_PATTERN,
          category: 'expense',
          content: expenseInsight as any,
          confidenceScore: expenseInsight.confidence,
          provider: response.provider,
          model: response.model,
        },
      });

      storedInsights.push(expenseInsight);
    }

    return storedInsights;
  }

  async generateBusinessPerformanceInsights(
    userId: string,
    businessData: {
      revenue: Array<{ date: Date; amount: number; source?: string }>;
      expenses: Array<{ date: Date; amount: number; category: string }>;
      inventory?: Array<{ date: Date; value: number }>;
      receivables?: number;
      payables?: number;
    },
  ): Promise<FinancialInsight[]> {
    const prompt = `Analyze business performance data for an Australian small business:

Business Data: ${JSON.stringify(businessData)}

Generate insights on:
1. Revenue growth trends and sustainability
2. Profit margin analysis
3. Working capital efficiency
4. Expense ratio optimization
5. Cash conversion cycle
6. Tax planning opportunities (GST, income tax)
7. Comparison to Australian industry benchmarks

Consider:
- Small business tax concessions
- Instant asset write-off eligibility
- GST implications
- Superannuation obligations

Provide actionable recommendations with estimated financial impact.`;

    // Use OpenRouter for business performance insights
    const response = await this.openrouter.sendMessage([
      {
        role: 'system',
        content: 'You are a business financial advisor specializing in Australian small business.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Track usage
    await this.trackUsage({
      userId,
      operationType: AIOperationType.FINANCIAL_INSIGHTS,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed.total,
      cost: response.cost,
      responseTimeMs: response.responseTimeMs,
      success: true,
    });

    const insights = JSON.parse(response.content);
    return this.storeInsights(userId, insights, AIInsightType.BUSINESS_PERFORMANCE, response);
  }

  async identifyTaxSavingOpportunities(
    userId: string,
    financialProfile: {
      income: number;
      expenses: Record<string, number>;
      assets?: any[];
      liabilities?: any[];
      family?: { spouse?: boolean; dependents?: number };
    },
  ): Promise<FinancialInsight[]> {
    const prompt = `Identify tax saving opportunities for an Australian taxpayer:

Financial Profile: ${JSON.stringify(financialProfile)}

Current Tax Year: ${new Date().getFullYear() - 1}-${new Date().getFullYear()}

Analyze and suggest:
1. Salary sacrifice opportunities (super, car, etc.)
2. Investment structure optimization
3. Deduction maximization strategies
4. Tax offset eligibility
5. Timing strategies for income/expenses
6. Family tax benefit optimization
7. Capital gains tax planning

Ensure all suggestions are ATO compliant and include:
- Estimated tax savings
- Implementation steps
- Deadlines or time sensitivity
- Risk considerations`;

    // Use Anthropic for tax optimization (primary provider)
    const response = await this.anthropic.sendMessage([
      {
        role: 'system',
        content:
          'You are an Australian tax optimization specialist with deep knowledge of ATO regulations.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Track usage
    await this.trackUsage({
      userId,
      operationType: AIOperationType.TAX_CONSULTATION,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed.total,
      cost: response.cost,
      responseTimeMs: response.responseTimeMs,
      success: true,
    });

    const insights = JSON.parse(response.content);
    return this.storeInsights(userId, insights, AIInsightType.TAX_OPTIMIZATION, response);
  }

  async detectComplianceRisks(
    userId: string,
    taxData: {
      income: Record<string, number>;
      deductions: Record<string, number>;
      businessExpenses?: Record<string, number>;
      cryptoTransactions?: any[];
    },
  ): Promise<FinancialInsight[]> {
    const prompt = `Analyze tax data for ATO compliance risks:

Tax Data: ${JSON.stringify(taxData)}

Identify potential issues:
1. Deductions that may trigger ATO scrutiny
2. Missing income declarations
3. Excessive claims vs income level
4. Record keeping gaps
5. Cryptocurrency reporting requirements
6. Business vs personal expense mixing

For each risk:
- Explain the compliance issue
- Provide ATO benchmarks or guidelines
- Suggest remediation steps
- Assess audit risk level`;

    // Use Anthropic for compliance risk detection
    const response = await this.anthropic.sendMessage([
      {
        role: 'system',
        content: 'You are an ATO compliance expert focused on risk mitigation.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Track usage
    await this.trackUsage({
      userId,
      operationType: AIOperationType.TAX_CONSULTATION,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed.total,
      cost: response.cost,
      responseTimeMs: response.responseTimeMs,
      success: true,
    });

    const insights = JSON.parse(response.content);
    return this.storeInsights(userId, insights, AIInsightType.COMPLIANCE_RISK, response);
  }

  private async storeInsights(
    userId: string,
    insights: any[],
    type: AIInsightType,
    aiResponse: any,
  ): Promise<FinancialInsight[]> {
    const storedInsights: FinancialInsight[] = [];

    for (const insight of insights) {
      const financialInsight: FinancialInsight = {
        type,
        title: insight.title,
        description: insight.description,
        impact: insight.impact,
        recommendations: insight.recommendations,
        confidence: insight.confidence || 0.85,
        dataPoints: insight.dataPoints || {},
        expiresAt: insight.expiresAt ? new Date(insight.expiresAt) : undefined,
      };

      await prisma.aIInsight.create({
        data: {
          userId,
          insightType: type,
          category: this.getCategoryForType(type),
          content: financialInsight as any,
          confidenceScore: financialInsight.confidence,
          provider: aiResponse.provider,
          model: aiResponse.model,
          expiresAt: financialInsight.expiresAt,
        },
      });

      storedInsights.push(financialInsight);
    }

    return storedInsights;
  }

  private getCategoryForType(type: AIInsightType): string {
    const categoryMap: Record<AIInsightType, string> = {
      [AIInsightType.TAX_DEDUCTION]: 'tax',
      [AIInsightType.TAX_OPTIMIZATION]: 'tax',
      [AIInsightType.CASH_FLOW]: 'financial',
      [AIInsightType.EXPENSE_PATTERN]: 'expense',
      [AIInsightType.BUSINESS_PERFORMANCE]: 'business',
      [AIInsightType.COMPLIANCE_RISK]: 'compliance',
      [AIInsightType.SAVINGS_OPPORTUNITY]: 'savings',
    };

    return categoryMap[type] || 'general';
  }

  async getActiveInsights(userId: string, types?: AIInsightType[]): Promise<FinancialInsight[]> {
    const where: any = {
      userId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };

    if (types && types.length > 0) {
      where.insightType = { in: types };
    }

    const insights = await prisma.aIInsight.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return insights.map((insight) => insight.content as unknown as FinancialInsight);
  }

  private async trackUsage(data: {
    userId?: string;
    businessId?: string;
    operationType: string;
    provider: string;
    model: string;
    tokensUsed: number;
    cost: number;
    responseTimeMs: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      await prisma.aIUsageTracking.create({
        data: {
          userId: data.userId || '',
          operationType: data.operationType,
          provider: data.provider,
          model: data.model,
          tokensInput: Math.floor((data.tokensUsed || 0) / 2),
          tokensOutput: Math.ceil((data.tokensUsed || 0) / 2),
          costUsd: data.cost,
          responseTimeMs: data.responseTimeMs,
          success: data.success,
        },
      });
    } catch (error) {
      logger.error('Usage tracking error:', error);
    }
  }

  // Circuit breaker for provider failover
  private async executeWithFailover<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await primaryFn();
    } catch (error) {
      logger.error('Primary provider failed, trying fallback:', error);
      return await fallbackFn();
    }
  }
}

// Export singleton instance
export const financialInsightsService = new FinancialInsightsService();
