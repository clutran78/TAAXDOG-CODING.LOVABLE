import { AIService } from '../ai-service';
import { AnthropicProvider } from '../providers/anthropic';
import { AIMessage, ATO_TAX_CATEGORIES } from '../types';
import { getAIConfig } from '../../config';
import { AI_MODELS, SYSTEM_PROMPTS, AI_PROVIDERS, AUSTRALIAN_TAX_CONFIG, AIOperationType } from '../config';
import { prisma } from '../../prisma';

export class TaxConsultationService {
  private aiService: AIService;
  private anthropic: AnthropicProvider;

  constructor() {
    this.aiService = new AIService();
    const anthropicConfig = AI_PROVIDERS.primary;
    // Use Claude 4 Sonnet as primary provider for tax consultation
    this.anthropic = new AnthropicProvider(
      anthropicConfig.apiKey,
      AI_MODELS.CLAUDE_4_SONNET
    );
  }

  async consultTaxQuery(
    userId: string,
    query: string,
    context?: {
      taxYear?: string;
      userProfile?: any;
      previousReturns?: any[];
    }
  ): Promise<{
    answer: string;
    references: string[];
    disclaimer: string;
  }> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
      {
        role: 'user',
        content: this.formatUserQuery(query, context),
      },
    ];

    // Use Anthropic Claude 4 Sonnet directly for tax consultation
    const response = await this.anthropic.sendMessage(messages);
    
    // Track usage
    await this.trackUsage({
      userId,
      operationType: AIOperationType.TAX_ANALYSIS,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed.total,
      cost: response.cost,
      responseTimeMs: response.responseTimeMs,
      success: true,
    });

    // Parse the response to extract references and ensure compliance
    const parsed = this.parseConsultationResponse(response.content);

    return {
      answer: parsed.answer,
      references: parsed.references,
      disclaimer: this.getDisclaimer(),
    };
  }

  async analyzeDeductions(
    userId: string,
    expenses: Array<{
      description: string;
      amount: number;
      date: Date;
      category?: string;
    }>
  ): Promise<{
    eligibleDeductions: Array<{
      expense: any;
      category: string;
      deductible: boolean;
      percentage: number;
      reason: string;
      atoReference: string;
    }>;
    totalDeductible: number;
    recommendations: string[];
  }> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: this.getDeductionAnalysisPrompt(),
      },
      {
        role: 'user',
        content: JSON.stringify({ expenses }),
      },
    ];

    // Use Anthropic for deduction analysis
    const response = await this.anthropic.sendMessage(messages);
    
    // Track usage
    await this.trackUsage({
      userId,
      operationType: AIOperationType.EXPENSE_CATEGORIZATION,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed.total,
      cost: response.cost,
      responseTimeMs: response.responseTimeMs,
      success: true,
    });

    const analysis = JSON.parse(response.content);
    
    // Validate and enhance with ATO categories
    const eligibleDeductions = analysis.deductions.map((deduction: any) => ({
      ...deduction,
      category: this.mapToATOCategory(deduction.suggestedCategory),
    }));

    return {
      eligibleDeductions,
      totalDeductible: eligibleDeductions
        .filter((d: any) => d.deductible)
        .reduce((sum: number, d: any) => sum + (d.expense.amount * d.percentage / 100), 0),
      recommendations: analysis.recommendations || [],
    };
  }

  async generateTaxStrategy(
    userId: string,
    financialData: {
      income: number;
      expenses: Record<string, number>;
      assets?: any[];
      previousReturns?: any[];
    }
  ): Promise<{
    strategies: Array<{
      title: string;
      description: string;
      potentialSavings: number;
      implementation: string[];
      risks: string[];
      deadline?: Date;
    }>;
    summary: string;
  }> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: this.getTaxStrategyPrompt(),
      },
      {
        role: 'user',
        content: JSON.stringify(financialData),
      },
    ];

    // Use Anthropic for tax strategy generation
    const response = await this.anthropic.sendMessage(messages);
    
    // Track usage
    await this.trackUsage({
      userId,
      operationType: AIOperationType.TAX_OPTIMIZATION,
      provider: response.provider,
      model: response.model,
      tokensUsed: response.tokensUsed.total,
      cost: response.cost,
      responseTimeMs: response.responseTimeMs,
      success: true,
    });

    const strategy = JSON.parse(response.content);

    // Store as insight
    await prisma.aIInsight.create({
      data: {
        userId,
        insightType: 'tax_optimization',
        category: 'strategy',
        content: strategy,
        provider: response.provider,
        model: response.model,
        confidenceScore: 0.85,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      },
    });

    return strategy;
  }

  private getSystemPrompt(): string {
    const currentTaxYearStart = AUSTRALIAN_TAX_CONFIG.TAX_YEAR_START;
    const currentTaxYearEnd = AUSTRALIAN_TAX_CONFIG.TAX_YEAR_END;
    const gstRate = (AUSTRALIAN_TAX_CONFIG.GST_RATE * 100).toFixed(0);
    
    return `You are an expert Australian tax consultant AI assistant specializing in ATO compliance and tax optimization.

IMPORTANT GUIDELINES:
1. Always provide accurate information based on current Australian tax law
2. Reference specific ATO rulings, legislation, or guidance where applicable
3. Use clear, professional language suitable for taxpayers
4. Include relevant disclaimers about seeking professional advice
5. Focus on Australian tax residents unless specified otherwise
6. Always use Australian currency (AUD) and dates in Australian format

AUSTRALIAN TAX SYSTEM SPECIFICS:
- Tax Year: ${currentTaxYearStart} to ${currentTaxYearEnd}
- GST Rate: ${gstRate}%
- Currency: ${AUSTRALIAN_TAX_CONFIG.CURRENCY}
- Business Expense Categories: ${AUSTRALIAN_TAX_CONFIG.BUSINESS_EXPENSE_CATEGORIES.join(', ')}

KEY KNOWLEDGE AREAS:
- Individual income tax rates and thresholds
- Work-related deductions (D1-D5, D10)
- Capital gains tax
- Rental property income and deductions
- Small business tax concessions
- Superannuation contributions and tax
- Medicare levy and surcharge
- Tax offsets and rebates
- GST implications at ${gstRate}%
- Record keeping requirements

DEDUCTION LIMITS TO CONSIDER:
- Home Office Shortcut Method: $${AUSTRALIAN_TAX_CONFIG.DEDUCTION_LIMITS.HOME_OFFICE_SHORTCUT}/hour
- Meal & Entertainment: ${(AUSTRALIAN_TAX_CONFIG.DEDUCTION_LIMITS.MEAL_ENTERTAINMENT * 100)}% deductible
- Travel Allowance: $${AUSTRALIAN_TAX_CONFIG.DEDUCTION_LIMITS.TRAVEL_ALLOWANCE} threshold

When answering:
1. Start with a direct answer to the question
2. Provide relevant ATO references or rulings
3. Explain any calculations using Australian rates and limits
4. Mention record-keeping requirements per ATO guidelines
5. Suggest related considerations for tax optimization`;
  }

  private getDeductionAnalysisPrompt(): string {
    return `Analyze the provided expenses for Australian tax deductibility.

For each expense, determine:
1. ATO deduction category (D1-D5, D10, or other)
2. Deductibility percentage (0-100%)
3. Specific reason for decision
4. Relevant ATO reference or ruling

Use these ATO categories:
${Object.entries(ATO_TAX_CATEGORIES).map(([code, cat]) => 
  `${code}: ${cat.name} - ${cat.description}`
).join('\n')}

Provide response as JSON with structure:
{
  "deductions": [{
    "expense": {original expense object},
    "suggestedCategory": "category code",
    "deductible": boolean,
    "percentage": number,
    "reason": "explanation",
    "atoReference": "specific ATO reference"
  }],
  "recommendations": ["list of recommendations"]
}`;
  }

  private getTaxStrategyPrompt(): string {
    return `Generate tax optimization strategies for an Australian taxpayer based on their financial data.

Consider:
1. Legal tax minimization opportunities
2. Timing of income and deductions
3. Superannuation strategies
4. Investment structure optimization
5. Small business concessions (if applicable)
6. Family tax benefits
7. Negative gearing opportunities

Provide response as JSON with structure:
{
  "strategies": [{
    "title": "strategy name",
    "description": "detailed explanation",
    "potentialSavings": estimated annual savings in AUD,
    "implementation": ["step 1", "step 2"],
    "risks": ["potential risks"],
    "deadline": "ISO date if time-sensitive"
  }],
  "summary": "executive summary of recommendations"
}

Ensure all strategies are:
- Legally compliant with Australian tax law
- Practical and implementable
- Include realistic savings estimates
- Highlight any risks or considerations`;
  }

  private formatUserQuery(query: string, context?: any): string {
    let formatted = query;

    if (context) {
      formatted += '\n\nAdditional Context:';
      if (context.taxYear) {
        formatted += `\nTax Year: ${context.taxYear}`;
      }
      if (context.userProfile) {
        formatted += `\nUser Profile: ${JSON.stringify(context.userProfile)}`;
      }
    }

    return formatted;
  }

  private parseConsultationResponse(content: string): {
    answer: string;
    references: string[];
  } {
    // Extract ATO references from the response
    const referencePattern = /(?:ATO|TR|TD|ID|CR|PS LA|MT|QC)\s*\d{4}\/\d+|(?:ATO|TR|TD|ID|CR|PS LA|MT|QC)\s*\d{4}-\d+/gi;
    const references = content.match(referencePattern) || [];

    return {
      answer: content,
      references: [...new Set(references)], // Remove duplicates
    };
  }

  private mapToATOCategory(suggestedCategory: string): string {
    const categoryMap: Record<string, string> = {
      'car': 'D1',
      'vehicle': 'D1',
      'travel': 'D2',
      'accommodation': 'D2',
      'clothing': 'D3',
      'uniform': 'D3',
      'education': 'D4',
      'course': 'D4',
      'training': 'D4',
      'tools': 'D5',
      'equipment': 'D5',
      'membership': 'D5',
      'tax': 'D10',
      'accounting': 'D10',
    };

    const lowerCategory = suggestedCategory.toLowerCase();
    for (const [keyword, code] of Object.entries(categoryMap)) {
      if (lowerCategory.includes(keyword)) {
        return code;
      }
    }

    return 'D5'; // Default to other work-related
  }

  private getDisclaimer(): string {
    return `This information is general in nature and based on current Australian tax law. 
It does not constitute professional tax advice. Individual circumstances vary, and you should 
consult a registered tax agent or the ATO for advice specific to your situation. 
Tax laws and interpretations can change.`;
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
      // Only track usage if we have a valid userId
      if (!data.userId) {
        return;
      }

      await prisma.aIUsageTracking.create({
        data: {
          userId: data.userId,
          operationType: data.operationType,
          provider: data.provider,
          model: data.model,
          tokensInput: 0,
          tokensOutput: data.tokensUsed,
          costUsd: data.cost,
          responseTimeMs: data.responseTimeMs,
          success: data.success,
          errorMessage: data.error || undefined,
        },
      });
    } catch (error) {
      console.error('Usage tracking error:', error);
    }
  }
}

// Export singleton instance
export const taxConsultant = new TaxConsultationService();