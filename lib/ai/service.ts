import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../prisma';
import { logger } from '@/lib/logger';
import {
  AIProvider,
  AIOperationType,
  getProviderConfig,
  getModelForOperation,
  getProviderFromModel,
  calculateTokenCost,
  SYSTEM_PROMPTS,
} from './config';

// Base AI service interface
interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
}

// Rate limiter
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  async checkLimit(provider: AIProvider): Promise<boolean> {
    const config = getProviderConfig(provider);
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    const key = provider;
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= config.rateLimit.requestsPerMinute) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }
}

export class AIService {
  private anthropic: Anthropic | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private rateLimiter = new RateLimiter();

  constructor() {
    // Only initialize on server side
    if (typeof window === 'undefined') {
      this.initializeProviders();
    }
  }

  private initializeProviders() {
    try {
      // Initialize Anthropic
      const anthropicConfig = getProviderConfig(AIProvider.ANTHROPIC);
      this.anthropic = new Anthropic({
        apiKey: anthropicConfig.apiKey,
        // Explicitly set to false to prevent browser detection issues
        dangerouslyAllowBrowser: false,
      });

      // Initialize Gemini
      const geminiConfig = getProviderConfig(AIProvider.GEMINI);
      this.gemini = new GoogleGenerativeAI(geminiConfig.apiKey);
    } catch (error) {
      logger.error('Failed to initialize AI providers:', error);
    }
  }

  // Main method to process AI requests
  async processRequest({
    operation,
    prompt,
    userId,
    context = {},
    model,
  }: {
    operation: AIOperationType;
    prompt: string;
    userId: string;
    context?: Record<string, any>;
    model?: string;
  }): Promise<AIResponse> {
    // Select model if not specified
    const selectedModel = model || getModelForOperation(operation);
    const provider = getProviderFromModel(selectedModel);

    // Check rate limit
    const canProceed = await this.rateLimiter.checkLimit(provider);
    if (!canProceed) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Track start time
    const startTime = Date.now();

    try {
      let response: AIResponse;

      switch (provider) {
        case AIProvider.ANTHROPIC:
          response = await this.callAnthropic(selectedModel, operation, prompt, context);
          break;
        case AIProvider.OPENROUTER:
          response = await this.callOpenRouter(selectedModel, operation, prompt, context);
          break;
        case AIProvider.GEMINI:
          response = await this.callGemini(selectedModel, operation, prompt, context);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Track usage
      await this.trackUsage({
        userId,
        provider,
        model: selectedModel,
        operation,
        tokensInput: response.tokensUsed.input,
        tokensOutput: response.tokensUsed.output,
        cost: response.cost,
        responseTime: Date.now() - startTime,
        success: true,
      });

      // Cache response if applicable
      await this.cacheResponse(operation, prompt, response);

      return response;
    } catch (error) {
      // Track failed attempt
      await this.trackUsage({
        userId,
        provider,
        model: selectedModel,
        operation,
        tokensInput: 0,
        tokensOutput: 0,
        cost: 0,
        responseTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  // Anthropic API call
  private async callAnthropic(
    model: string,
    operation: AIOperationType,
    prompt: string,
    context: Record<string, any>,
  ): Promise<AIResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const systemPrompt = this.getSystemPrompt(operation);

    const message = await this.anthropic.messages.create({
      model,
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';

    const tokensUsed = {
      input: message.usage?.input_tokens || 0,
      output: message.usage?.output_tokens || 0,
      total: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
    };

    return {
      content,
      model,
      provider: AIProvider.ANTHROPIC,
      tokensUsed,
      cost: calculateTokenCost(model as any, tokensUsed.input, tokensUsed.output),
    };
  }

  // OpenRouter API call
  private async callOpenRouter(
    model: string,
    operation: AIOperationType,
    prompt: string,
    context: Record<string, any>,
  ): Promise<AIResponse> {
    const config = getProviderConfig(AIProvider.OPENROUTER);
    const systemPrompt = this.getSystemPrompt(operation);

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://taxreturnpro.com.au',
        'X-Title': 'TaxReturnPro AI Assistant',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    const tokensUsed = {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    };

    return {
      content,
      model,
      provider: AIProvider.OPENROUTER,
      tokensUsed,
      cost: calculateTokenCost(model as any, tokensUsed.input, tokensUsed.output),
    };
  }

  // Gemini API call
  private async callGemini(
    model: string,
    operation: AIOperationType,
    prompt: string,
    context: Record<string, any>,
  ): Promise<AIResponse> {
    if (!this.gemini) {
      throw new Error('Gemini client not initialized');
    }

    const systemPrompt = this.getSystemPrompt(operation);
    const geminiModel = this.gemini.getGenerativeModel({ model });

    const fullPrompt = `${systemPrompt}\n\n${prompt}`;
    const result = await geminiModel.generateContent(fullPrompt);
    const response = await result.response;
    const content = response.text();

    // Estimate tokens (Gemini doesn't provide exact counts)
    const tokensUsed = {
      input: Math.ceil(fullPrompt.length / 4),
      output: Math.ceil(content.length / 4),
      total: Math.ceil((fullPrompt.length + content.length) / 4),
    };

    return {
      content,
      model,
      provider: AIProvider.GEMINI,
      tokensUsed,
      cost: calculateTokenCost(model as any, tokensUsed.input, tokensUsed.output),
    };
  }

  // Get system prompt for operation
  private getSystemPrompt(operation: AIOperationType): string {
    switch (operation) {
      case AIOperationType.TAX_ANALYSIS:
      case AIOperationType.TAX_OPTIMIZATION:
      case AIOperationType.COMPLIANCE_CHECK:
        return SYSTEM_PROMPTS.TAX_ASSISTANT;
      case AIOperationType.RECEIPT_SCANNING:
      case AIOperationType.DOCUMENT_EXTRACTION:
        return SYSTEM_PROMPTS.RECEIPT_ANALYZER;
      case AIOperationType.FINANCIAL_ADVICE:
      case AIOperationType.BUDGET_PREDICTION:
        return SYSTEM_PROMPTS.FINANCIAL_ADVISOR;
      default:
        return SYSTEM_PROMPTS.TAX_ASSISTANT;
    }
  }

  // Track AI usage
  private async trackUsage(data: {
    userId: string;
    provider: string;
    model: string;
    operation: string;
    tokensInput: number;
    tokensOutput: number;
    cost: number;
    responseTime: number;
    success: boolean;
    error?: string;
  }) {
    try {
      await prisma.aIUsageTracking.create({
        data: {
          userId: data.userId,
          provider: data.provider,
          model: data.model,
          operationType: data.operation,
          tokensInput: data.tokensInput,
          tokensOutput: data.tokensOutput,
          costUsd: data.cost,
          responseTimeMs: data.responseTime,
          success: data.success,
          errorMessage: data.error,
        },
      });
    } catch (error) {
      logger.error('Failed to track AI usage:', error);
    }
  }

  // Cache AI responses
  private async cacheResponse(operation: AIOperationType, prompt: string, response: AIResponse) {
    try {
      const cacheKey = `${operation}:${Buffer.from(prompt).toString('base64').substring(0, 100)}`;
      const inputHash = Buffer.from(prompt).toString('base64');

      await prisma.aICache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          operationType: operation,
          inputHash,
          response: response as any,
          provider: response.provider,
          model: response.model,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
        update: {
          response: response as any,
          hitCount: { increment: 1 },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      logger.error('Failed to cache AI response:', error);
    }
  }

  // Get cached response if available
  async getCachedResponse(operation: AIOperationType, prompt: string): Promise<AIResponse | null> {
    try {
      const cacheKey = `${operation}:${Buffer.from(prompt).toString('base64').substring(0, 100)}`;

      const cached = await prisma.aICache.findUnique({
        where: { cacheKey },
      });

      if (cached && cached.expiresAt > new Date()) {
        await prisma.aICache.update({
          where: { id: cached.id },
          data: { hitCount: { increment: 1 } },
        });

        return cached.response as any;
      }
    } catch (error) {
      logger.error('Failed to get cached response:', error);
    }

    return null;
  }

  // Generate financial insights
  async generateFinancialInsights(userId: string): Promise<void> {
    // Get user's recent transactions
    const recentTransactions = await prisma.bank_transactions.findMany({
      where: {
        bank_account: {
          basiq_user: {
            user_id: userId,
          },
        },
      },
      orderBy: { transaction_date: 'desc' },
      take: 100,
    });

    if (recentTransactions.length === 0) {
      return;
    }

    // Prepare context
    const transactionSummary = recentTransactions
      .map(
        (t) => `${t.transaction_date.toISOString().split('T')[0]}: ${t.description} - $${t.amount}`,
      )
      .join('\n');

    const prompt = `Analyze these recent transactions and provide financial insights:
${transactionSummary}

Provide:
1. Spending patterns and trends
2. Potential tax deductions
3. Budget recommendations
4. Savings opportunities`;

    const response = await this.processRequest({
      operation: AIOperationType.FINANCIAL_ADVICE,
      prompt,
      userId,
    });

    // Save insights
    await prisma.financialInsight.create({
      data: {
        userId,
        insightType: 'monthly_analysis',
        category: 'general',
        content: {
          analysis: response.content,
          transactionCount: recentTransactions.length,
        },
        confidenceScore: 0.85,
        sourceDataIds: recentTransactions.map((t) => t.id),
        provider: response.provider,
        model: response.model,
        title: 'Monthly Financial Analysis',
        description: 'AI-generated insights based on your recent transactions',
        priority: 'MEDIUM',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
  }
}

// Export singleton instance
export const aiService = new AIService();
