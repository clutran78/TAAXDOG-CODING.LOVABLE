import { AIMessage, AIResponse, AIProviderConfig, AIError } from './types';
import prisma from '../prisma';
import { logger } from '@/lib/logger';

export abstract class BaseAIProvider {
  protected config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  abstract sendMessage(messages: AIMessage[]): Promise<AIResponse>;

  abstract estimateCost(tokensInput: number, tokensOutput: number): number;

  getConfig(): AIProviderConfig {
    return this.config;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const health = await prisma.aIProviderHealth.findUnique({
        where: { provider: this.config.provider },
      });

      if (!health) {
        await prisma.aIProviderHealth.create({
          data: {
            provider: this.config.provider,
            status: 'healthy',
          },
        });
        return true;
      }

      // Circuit breaker pattern
      if (health.circuitOpenUntil && health.circuitOpenUntil > new Date()) {
        return false;
      }

      return health.status === 'healthy';
    } catch (error) {
      logger.error(`Health check failed for ${this.config.provider}:`, error);
      return false;
    }
  }

  async recordSuccess(): Promise<void> {
    try {
      await prisma.aIProviderHealth.upsert({
        where: { provider: this.config.provider },
        update: {
          status: 'healthy',
          consecutiveFailures: 0,
          lastSuccessAt: new Date(),
          circuitOpenUntil: null,
        },
        create: {
          provider: this.config.provider,
          status: 'healthy',
          lastSuccessAt: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Failed to record success for ${this.config.provider}:`, error);
    }
  }

  async recordFailure(error: Error): Promise<void> {
    try {
      const health = await prisma.aIProviderHealth.findUnique({
        where: { provider: this.config.provider },
      });

      const consecutiveFailures = (health?.consecutiveFailures || 0) + 1;
      const shouldOpenCircuit = consecutiveFailures >= 3;

      await prisma.aIProviderHealth.upsert({
        where: { provider: this.config.provider },
        update: {
          status: shouldOpenCircuit ? 'unhealthy' : 'degraded',
          consecutiveFailures,
          lastFailureAt: new Date(),
          circuitOpenUntil: shouldOpenCircuit
            ? new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
            : null,
        },
        create: {
          provider: this.config.provider,
          status: 'unhealthy',
          consecutiveFailures: 1,
          lastFailureAt: new Date(),
        },
      });
    } catch (err) {
      logger.error(`Failed to record failure for ${this.config.provider}:`, err);
    }
  }

  protected createError(message: string, statusCode?: number, retryable = false): AIError {
    const error = new Error(message) as AIError;
    error.provider = this.config.provider;
    error.statusCode = statusCode;
    error.retryable = retryable;
    return error;
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }
}
