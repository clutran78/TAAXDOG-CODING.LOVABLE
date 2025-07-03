import { AIProvider } from './config';
import { prisma } from '../prisma';

export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider: AIProvider,
    public retryable: boolean = false,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // milliseconds
  halfOpenRequests: number;
}

export class CircuitBreaker {
  private static configs: Record<AIProvider, CircuitBreakerConfig> = {
    [AIProvider.ANTHROPIC]: {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenRequests: 3,
    },
    [AIProvider.OPENROUTER]: {
      failureThreshold: 5,
      resetTimeout: 60000,
      halfOpenRequests: 3,
    },
    [AIProvider.GEMINI]: {
      failureThreshold: 5,
      resetTimeout: 60000,
      halfOpenRequests: 3,
    },
  };

  private static states = new Map<AIProvider, 'closed' | 'open' | 'half-open'>();
  private static failures = new Map<AIProvider, number>();
  private static lastFailureTime = new Map<AIProvider, number>();
  private static halfOpenAttempts = new Map<AIProvider, number>();

  /**
   * Check if circuit is open for a provider
   */
  static async isOpen(provider: AIProvider): Promise<boolean> {
    const state = this.states.get(provider) || 'closed';
    
    if (state === 'closed') {
      return false;
    }

    if (state === 'open') {
      const config = this.configs[provider];
      const lastFailure = this.lastFailureTime.get(provider) || 0;
      const timeSinceFailure = Date.now() - lastFailure;

      // Check if we should transition to half-open
      if (timeSinceFailure > config.resetTimeout) {
        this.states.set(provider, 'half-open');
        this.halfOpenAttempts.set(provider, 0);
        
        // Update database
        await this.updateProviderHealth(provider, 'half-open');
        
        return false; // Allow request in half-open state
      }

      return true; // Circuit is still open
    }

    // Half-open state
    const attempts = this.halfOpenAttempts.get(provider) || 0;
    const config = this.configs[provider];
    
    return attempts >= config.halfOpenRequests;
  }

  /**
   * Record success
   */
  static async recordSuccess(provider: AIProvider): Promise<void> {
    const state = this.states.get(provider) || 'closed';
    
    if (state === 'half-open') {
      const attempts = (this.halfOpenAttempts.get(provider) || 0) + 1;
      this.halfOpenAttempts.set(provider, attempts);
      
      const config = this.configs[provider];
      if (attempts >= config.halfOpenRequests) {
        // Transition to closed
        this.states.set(provider, 'closed');
        this.failures.set(provider, 0);
        this.halfOpenAttempts.set(provider, 0);
        
        await this.updateProviderHealth(provider, 'healthy');
      }
    } else if (state === 'closed') {
      // Reset failure count on success
      this.failures.set(provider, 0);
    }
  }

  /**
   * Record failure
   */
  static async recordFailure(provider: AIProvider, error: Error): Promise<void> {
    const failures = (this.failures.get(provider) || 0) + 1;
    this.failures.set(provider, failures);
    this.lastFailureTime.set(provider, Date.now());

    const config = this.configs[provider];
    const currentState = this.states.get(provider) || 'closed';

    if (currentState === 'half-open') {
      // Any failure in half-open state reopens the circuit
      this.states.set(provider, 'open');
      this.halfOpenAttempts.set(provider, 0);
      await this.updateProviderHealth(provider, 'unhealthy', error.message);
    } else if (failures >= config.failureThreshold) {
      // Open the circuit
      this.states.set(provider, 'open');
      await this.updateProviderHealth(provider, 'unhealthy', error.message);
    }
  }

  /**
   * Update provider health in database
   */
  private static async updateProviderHealth(
    provider: AIProvider,
    status: 'healthy' | 'unhealthy' | 'half-open',
    errorMessage?: string
  ): Promise<void> {
    try {
      const circuitOpenUntil = status === 'unhealthy'
        ? new Date(Date.now() + this.configs[provider].resetTimeout)
        : null;

      await prisma.aIProviderHealth.upsert({
        where: { provider },
        update: {
          status,
          lastFailureAt: status === 'unhealthy' ? new Date() : undefined,
          lastSuccessAt: status === 'healthy' ? new Date() : undefined,
          consecutiveFailures: this.failures.get(provider) || 0,
          circuitOpenUntil,
          updatedAt: new Date(),
        },
        create: {
          provider,
          status,
          consecutiveFailures: this.failures.get(provider) || 0,
          circuitOpenUntil,
          lastFailureAt: status === 'unhealthy' ? new Date() : undefined,
          lastSuccessAt: status === 'healthy' ? new Date() : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to update provider health:', error);
    }
  }

  /**
   * Get current circuit state
   */
  static getState(provider: AIProvider): 'closed' | 'open' | 'half-open' {
    return this.states.get(provider) || 'closed';
  }

  /**
   * Initialize circuit breaker from database
   */
  static async initialize(): Promise<void> {
    try {
      const healthRecords = await prisma.aIProviderHealth.findMany();
      
      healthRecords.forEach(record => {
        const provider = record.provider as AIProvider;
        
        if (record.status === 'unhealthy' && record.circuitOpenUntil) {
          if (record.circuitOpenUntil > new Date()) {
            this.states.set(provider, 'open');
            this.failures.set(provider, record.consecutiveFailures);
            this.lastFailureTime.set(provider, record.lastFailureAt?.getTime() || Date.now());
          } else {
            // Circuit should be half-open
            this.states.set(provider, 'half-open');
            this.halfOpenAttempts.set(provider, 0);
          }
        }
      });
    } catch (error) {
      console.error('Failed to initialize circuit breaker:', error);
    }
  }
}

/**
 * Error handling utilities
 */
export class AIErrorHandler {
  /**
   * Handle provider-specific errors
   */
  static handleProviderError(
    provider: AIProvider,
    error: any
  ): AIError {
    switch (provider) {
      case AIProvider.ANTHROPIC:
        return this.handleAnthropicError(error);
      case AIProvider.OPENROUTER:
        return this.handleOpenRouterError(error);
      case AIProvider.GEMINI:
        return this.handleGeminiError(error);
      default:
        return new AIError(
          'Unknown provider error',
          'UNKNOWN_PROVIDER',
          provider,
          false
        );
    }
  }

  /**
   * Handle Anthropic-specific errors
   */
  private static handleAnthropicError(error: any): AIError {
    const message = error.message || 'Unknown Anthropic error';
    
    // Rate limit error
    if (error.status === 429 || message.includes('rate limit')) {
      return new AIError(
        'Rate limit exceeded',
        'RATE_LIMIT',
        AIProvider.ANTHROPIC,
        true,
        429
      );
    }

    // Authentication error
    if (error.status === 401) {
      return new AIError(
        'Invalid API key',
        'AUTH_ERROR',
        AIProvider.ANTHROPIC,
        false,
        401
      );
    }

    // Server error
    if (error.status >= 500) {
      return new AIError(
        'Anthropic server error',
        'SERVER_ERROR',
        AIProvider.ANTHROPIC,
        true,
        error.status
      );
    }

    // Invalid request
    if (error.status === 400) {
      return new AIError(
        `Invalid request: ${message}`,
        'INVALID_REQUEST',
        AIProvider.ANTHROPIC,
        false,
        400
      );
    }

    return new AIError(
      message,
      'UNKNOWN_ERROR',
      AIProvider.ANTHROPIC,
      false,
      error.status
    );
  }

  /**
   * Handle OpenRouter-specific errors
   */
  private static handleOpenRouterError(error: any): AIError {
    const message = error.message || 'Unknown OpenRouter error';
    
    if (error.status === 429) {
      return new AIError(
        'OpenRouter rate limit exceeded',
        'RATE_LIMIT',
        AIProvider.OPENROUTER,
        true,
        429
      );
    }

    if (error.status === 401) {
      return new AIError(
        'Invalid OpenRouter API key',
        'AUTH_ERROR',
        AIProvider.OPENROUTER,
        false,
        401
      );
    }

    if (error.status >= 500) {
      return new AIError(
        'OpenRouter server error',
        'SERVER_ERROR',
        AIProvider.OPENROUTER,
        true,
        error.status
      );
    }

    return new AIError(
      message,
      'UNKNOWN_ERROR',
      AIProvider.OPENROUTER,
      false,
      error.status
    );
  }

  /**
   * Handle Gemini-specific errors
   */
  private static handleGeminiError(error: any): AIError {
    const message = error.message || 'Unknown Gemini error';
    
    if (message.includes('quota') || error.status === 429) {
      return new AIError(
        'Gemini quota exceeded',
        'QUOTA_EXCEEDED',
        AIProvider.GEMINI,
        true,
        429
      );
    }

    if (error.status === 401) {
      return new AIError(
        'Invalid Gemini API key',
        'AUTH_ERROR',
        AIProvider.GEMINI,
        false,
        401
      );
    }

    if (error.status >= 500) {
      return new AIError(
        'Gemini server error',
        'SERVER_ERROR',
        AIProvider.GEMINI,
        true,
        error.status
      );
    }

    return new AIError(
      message,
      'UNKNOWN_ERROR',
      AIProvider.GEMINI,
      false,
      error.status
    );
  }

  /**
   * Implement exponential backoff with jitter
   */
  static calculateBackoff(
    attempt: number,
    baseDelay: number = 1000,
    maxDelay: number = 60000
  ): number {
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = Math.random() * exponentialDelay * 0.1; // 10% jitter
    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Retry with exponential backoff
   */
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    isRetryable: (error: any) => boolean = () => true
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (!isRetryable(error) || attempt === maxRetries - 1) {
          throw error;
        }

        const delay = this.calculateBackoff(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// Initialize circuit breaker on module load
CircuitBreaker.initialize();