import { AnthropicProvider } from './providers/anthropic';
import { OpenRouterProvider } from './providers/openrouter';
import { GeminiProvider } from './providers/gemini';
import { BaseAIProvider } from './base-provider';
import { CircuitBreaker } from './circuit-breaker';
import { AIMessage, AIResponse, AIProvider, AIOperationType, AIError } from './types';
import { logger } from '@/lib/logger';
import {
  AI_PROVIDERS,
  AI_FEATURE_PROVIDERS,
  AI_COST_OPTIMIZATION,
  AUSTRALIAN_TAX_CONFIG,
} from './config';
import { prisma } from '../prisma';
import { createHash } from 'crypto';

export class AIService {
  private providers: Map<AIProvider, BaseAIProvider>;
  private circuitBreakers: Map<AIProvider, CircuitBreaker>;
  private primaryProvider: AIProvider = AIProvider.ANTHROPIC;

  constructor() {
    this.providers = new Map();
    this.circuitBreakers = new Map();
    this.initializeProviders();
    this.initializeCircuitBreakers();
  }

  private initializeProviders() {
    // Initialize Anthropic with hierarchy configuration
    const anthropicConfig = AI_PROVIDERS.primary;
    if (anthropicConfig.apiKey) {
      this.providers.set(AIProvider.ANTHROPIC, new AnthropicProvider(anthropicConfig.apiKey));
    }

    // Initialize OpenRouter with hierarchy configuration
    const openRouterConfig = AI_PROVIDERS.secondary;
    if (openRouterConfig.apiKey) {
      this.providers.set(AIProvider.OPENROUTER, new OpenRouterProvider(openRouterConfig.apiKey));
    }

    // Initialize Gemini with hierarchy configuration
    const geminiConfig = AI_PROVIDERS.tertiary;
    if (geminiConfig.apiKey) {
      this.providers.set(AIProvider.GEMINI, new GeminiProvider(geminiConfig.apiKey));
    }
  }

  private initializeCircuitBreakers() {
    const cbConfig = AI_COST_OPTIMIZATION.CIRCUIT_BREAKER;

    Object.values(AIProvider).forEach((provider) => {
      this.circuitBreakers.set(
        provider,
        new CircuitBreaker({
          failureThreshold: cbConfig.failureThreshold,
          recoveryTimeMs: cbConfig.recoveryTimeMs,
          monitoringWindowMs: cbConfig.monitoringWindowMs,
        }),
      );
    });
  }

  async sendMessage(
    messages: AIMessage[],
    userId: string,
    operationType: AIOperationType,
    sessionId?: string,
    useCache = true,
  ): Promise<AIResponse> {
    // Check cache first
    if (useCache) {
      const cachedResponse = await this.checkCache(messages, operationType);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    // Try providers in hierarchy order with circuit breaker protection
    const providerOrder = this.getProviderOrder(operationType);
    let lastError: Error | undefined;

    for (const providerName of providerOrder) {
      const provider = this.providers.get(providerName);
      const circuitBreaker = this.circuitBreakers.get(providerName);

      if (!provider || !circuitBreaker) continue;

      // Skip if circuit breaker is open
      if (circuitBreaker.isOpen()) {
        logger.warn(`Circuit breaker is open for provider: ${providerName}`);
        continue;
      }

      try {
        const response = await circuitBreaker.execute(async () => {
          // Check provider health
          const isHealthy = await provider.checkHealth();
          if (!isHealthy) {
            throw new Error(`Provider ${providerName} is not healthy`);
          }

          return await provider.sendMessage(messages);
        });

        // Track usage
        await this.trackUsage(
          userId,
          providerName,
          provider.getConfig().model,
          operationType,
          response.tokensUsed.input,
          response.tokensUsed.output,
          response.cost,
          response.responseTimeMs,
          true,
        );

        // Save to cache
        if (useCache) {
          await this.saveToCache(messages, operationType, response);
        }

        // Save conversation if sessionId provided
        if (sessionId) {
          await this.saveConversation(
            userId,
            sessionId,
            providerName,
            provider.getConfig().model,
            messages,
            response,
          );
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        // Track failed usage
        await this.trackUsage(
          userId,
          providerName,
          provider.getConfig().model,
          operationType,
          0,
          0,
          0,
          0,
          false,
          error instanceof Error ? error.message : 'Unknown error',
        );

        // If not retryable, throw immediately
        if ('retryable' in error && !error.retryable) {
          throw error;
        }

        logger.warn(`Provider ${providerName} failed:`, error.message);
      }
    }

    throw lastError || new Error('All AI providers failed');
  }

  async processImage(imageData: string, prompt: string, userId: string): Promise<AIResponse> {
    const geminiProvider = this.providers.get(AIProvider.GEMINI) as GeminiProvider;

    if (!geminiProvider) {
      throw new Error('Gemini provider not available for image processing');
    }

    const response = await geminiProvider.processImage(imageData, prompt);

    // Track usage
    await this.trackUsage(
      userId,
      AIProvider.GEMINI,
      'gemini-pro-vision',
      AIOperationType.RECEIPT_PROCESSING,
      response.tokensUsed.input,
      response.tokensUsed.output,
      response.cost,
      response.responseTimeMs,
      true,
    );

    return response;
  }

  private getProviderOrder(operationType: AIOperationType): AIProvider[] {
    // Use AI_FEATURE_PROVIDERS mapping for intelligent routing
    const featureMapping = {
      [AIOperationType.TAX_CONSULTATION]: AI_FEATURE_PROVIDERS.TAX_CONSULTATION,
      [AIOperationType.RECEIPT_PROCESSING]: AI_FEATURE_PROVIDERS.RECEIPT_PROCESSING,
      [AIOperationType.DOCUMENT_ANALYSIS]: AI_FEATURE_PROVIDERS.RECEIPT_PROCESSING,
      [AIOperationType.FINANCIAL_INSIGHTS]: AI_FEATURE_PROVIDERS.FINANCIAL_INSIGHTS,
      [AIOperationType.REPORT_COMMENTARY]: AI_FEATURE_PROVIDERS.REPORT_COMMENTARY,
      [AIOperationType.CHAT_RESPONSE]: AI_FEATURE_PROVIDERS.FINANCIAL_INSIGHTS,
    };

    const preferredProvider = featureMapping[operationType] as AIProvider;

    // Return hierarchy based on preferred provider
    switch (preferredProvider) {
      case AIProvider.GEMINI:
        return [AIProvider.GEMINI, AIProvider.ANTHROPIC, AIProvider.OPENROUTER];
      case AIProvider.OPENROUTER:
        return [AIProvider.OPENROUTER, AIProvider.ANTHROPIC, AIProvider.GEMINI];
      case AIProvider.ANTHROPIC:
      default:
        return [AIProvider.ANTHROPIC, AIProvider.OPENROUTER, AIProvider.GEMINI];
    }
  }

  private async checkCache(
    messages: AIMessage[],
    operationType: AIOperationType,
  ): Promise<AIResponse | null> {
    const cacheKey = this.generateCacheKey(messages, operationType);

    try {
      const cached = await prisma.aICache.findUnique({
        where: { cacheKey },
      });

      if (cached && cached.expiresAt > new Date()) {
        // Update hit count
        await prisma.aICache.update({
          where: { id: cached.id },
          data: { hitCount: { increment: 1 } },
        });

        return {
          content: (cached.response as any).content,
          provider: cached.provider as AIProvider,
          model: cached.model,
          tokensUsed: (cached.response as any).tokensUsed,
          cost: 0, // No cost for cached response
          responseTimeMs: 0,
        };
      }
    } catch (error) {
      logger.error('Cache check failed:', error);
    }

    return null;
  }

  private async saveToCache(
    messages: AIMessage[],
    operationType: AIOperationType,
    response: AIResponse,
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(messages, operationType);
    const inputHash = this.generateHash(JSON.stringify(messages));

    // Cache for different durations based on operation type
    const cacheDuration = {
      [AIOperationType.TAX_CONSULTATION]: 24 * 60 * 60 * 1000, // 24 hours
      [AIOperationType.RECEIPT_PROCESSING]: 7 * 24 * 60 * 60 * 1000, // 7 days
      [AIOperationType.FINANCIAL_INSIGHTS]: 60 * 60 * 1000, // 1 hour
      [AIOperationType.REPORT_COMMENTARY]: 60 * 60 * 1000, // 1 hour
      [AIOperationType.DOCUMENT_ANALYSIS]: 24 * 60 * 60 * 1000, // 24 hours
      [AIOperationType.CHAT_RESPONSE]: 30 * 60 * 1000, // 30 minutes
    };

    const expiresAt = new Date(Date.now() + (cacheDuration[operationType] || 60 * 60 * 1000));

    try {
      await prisma.aICache.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          operationType,
          inputHash,
          response: response as any,
          provider: response.provider,
          model: response.model,
          expiresAt,
        },
        update: {
          response: response as any,
          provider: response.provider,
          model: response.model,
          expiresAt,
          hitCount: 0,
        },
      });
    } catch (error) {
      logger.error('Failed to save to cache:', error);
    }
  }

  private generateCacheKey(messages: AIMessage[], operationType: AIOperationType): string {
    const content = JSON.stringify({ messages, operationType });
    return this.generateHash(content);
  }

  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private async trackUsage(
    userId: string,
    provider: AIProvider,
    model: string,
    operationType: AIOperationType,
    tokensInput: number,
    tokensOutput: number,
    costUsd: number,
    responseTimeMs: number,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await prisma.aIUsageTracking.create({
        data: {
          userId,
          provider,
          model,
          operationType,
          tokensInput,
          tokensOutput,
          costUsd,
          responseTimeMs,
          success,
          errorMessage,
        },
      });
    } catch (error) {
      logger.error('Failed to track usage:', error);
    }
  }

  private async saveConversation(
    userId: string,
    sessionId: string,
    provider: AIProvider,
    model: string,
    messages: AIMessage[],
    response: AIResponse,
  ): Promise<void> {
    try {
      await prisma.aIConversation.create({
        data: {
          userId,
          sessionId,
          provider,
          model,
          messages: messages as any,
          tokensUsed: response.tokensUsed.total,
          costUsd: response.cost,
        },
      });
    } catch (error) {
      logger.error('Failed to save conversation:', error);
    }
  }

  async getUserUsageStats(
    userId: string,
    days = 30,
  ): Promise<{
    totalCost: number;
    totalTokens: number;
    byProvider: Record<string, { cost: number; tokens: number; requests: number }>;
    byOperation: Record<string, { cost: number; tokens: number; requests: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usage = await prisma.aIUsageTracking.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
        success: true,
      },
    });

    const stats = {
      totalCost: 0,
      totalTokens: 0,
      byProvider: {} as Record<string, { cost: number; tokens: number; requests: number }>,
      byOperation: {} as Record<string, { cost: number; tokens: number; requests: number }>,
    };

    for (const record of usage) {
      const tokens = record.tokensInput + record.tokensOutput;
      const cost = Number(record.costUsd);

      stats.totalCost += cost;
      stats.totalTokens += tokens;

      // By provider
      if (!stats.byProvider[record.provider]) {
        stats.byProvider[record.provider] = { cost: 0, tokens: 0, requests: 0 };
      }
      stats.byProvider[record.provider].cost += cost;
      stats.byProvider[record.provider].tokens += tokens;
      stats.byProvider[record.provider].requests += 1;

      // By operation
      if (!stats.byOperation[record.operationType]) {
        stats.byOperation[record.operationType] = { cost: 0, tokens: 0, requests: 0 };
      }
      stats.byOperation[record.operationType].cost += cost;
      stats.byOperation[record.operationType].tokens += tokens;
      stats.byOperation[record.operationType].requests += 1;
    }

    return stats;
  }
}
