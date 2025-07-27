import { logger } from '@/lib/logger';

// BASIQ Error Handling Utilities

export enum BasiqErrorCode {
  // Authentication errors
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  INSTITUTION_UNAVAILABLE = 'INSTITUTION_UNAVAILABLE',
  MFA_REQUIRED = 'MFA_REQUIRED',

  // Data errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Business logic errors
  CONSENT_EXPIRED = 'CONSENT_EXPIRED',
  CONSENT_REVOKED = 'CONSENT_REVOKED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
}

export class BasiqAPIError extends Error {
  code: BasiqErrorCode;
  statusCode: number;
  correlationId?: string;
  details?: any;
  retryable: boolean;
  retryAfter?: number;

  constructor(
    message: string,
    code: BasiqErrorCode,
    statusCode: number,
    options?: {
      correlationId?: string;
      details?: any;
      retryable?: boolean;
      retryAfter?: number;
    },
  ) {
    super(message);
    this.name = 'BasiqAPIError';
    this.code = code;
    this.statusCode = statusCode;
    this.correlationId = options?.correlationId;
    this.details = options?.details;
    this.retryable = options?.retryable ?? this.isRetryable();
    this.retryAfter = options?.retryAfter;
  }

  private isRetryable(): boolean {
    // Determine if error is retryable based on code
    const retryableCodes = [
      BasiqErrorCode.CONNECTION_TIMEOUT,
      BasiqErrorCode.RATE_LIMIT_EXCEEDED,
      BasiqErrorCode.SERVICE_UNAVAILABLE,
      BasiqErrorCode.INSTITUTION_UNAVAILABLE,
    ];

    return retryableCodes.includes(this.code) || this.statusCode >= 500;
  }
}

// Parse BASIQ error response
export function parseBasiqError(response: any, statusCode: number): BasiqAPIError {
  let code = BasiqErrorCode.INTERNAL_ERROR;
  let message = 'An unexpected error occurred';
  let correlationId: string | undefined;
  let retryAfter: number | undefined;

  if (response) {
    // Extract error details from BASIQ response
    if (response.error) {
      message = response.error.detail || response.error.title || response.error;
      correlationId = response.error.correlationId;

      // Map BASIQ error types to our error codes
      switch (response.error.type) {
        case 'invalid-credentials':
          code = BasiqErrorCode.INVALID_CREDENTIALS;
          break;
        case 'invalid-request':
          code = BasiqErrorCode.INVALID_REQUEST;
          break;
        case 'resource-not-found':
          code = BasiqErrorCode.RESOURCE_NOT_FOUND;
          break;
        case 'duplicate-resource':
          code = BasiqErrorCode.DUPLICATE_RESOURCE;
          break;
        case 'rate-limit-exceeded':
          code = BasiqErrorCode.RATE_LIMIT_EXCEEDED;
          retryAfter = parseInt(response.headers?.['retry-after'] || '60');
          break;
        case 'consent-expired':
          code = BasiqErrorCode.CONSENT_EXPIRED;
          break;
        case 'consent-revoked':
          code = BasiqErrorCode.CONSENT_REVOKED;
          break;
        case 'insufficient-permissions':
          code = BasiqErrorCode.INSUFFICIENT_PERMISSIONS;
          break;
      }
    }

    // Handle specific status codes
    switch (statusCode) {
      case 401:
        code = code === BasiqErrorCode.INTERNAL_ERROR ? BasiqErrorCode.AUTH_FAILED : code;
        break;
      case 403:
        code =
          code === BasiqErrorCode.INTERNAL_ERROR ? BasiqErrorCode.INSUFFICIENT_PERMISSIONS : code;
        break;
      case 404:
        code = BasiqErrorCode.RESOURCE_NOT_FOUND;
        break;
      case 429:
        code = BasiqErrorCode.RATE_LIMIT_EXCEEDED;
        break;
      case 503:
        code = BasiqErrorCode.SERVICE_UNAVAILABLE;
        break;
    }
  }

  return new BasiqAPIError(message, code, statusCode, {
    correlationId,
    details: response,
    retryAfter,
  });
}

// Retry strategy with exponential backoff
export class RetryStrategy {
  private maxAttempts: number;
  private initialDelay: number;
  private maxDelay: number;
  private backoffFactor: number;

  constructor(options?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
  }) {
    this.maxAttempts = options?.maxAttempts ?? 3;
    this.initialDelay = options?.initialDelay ?? 1000;
    this.maxDelay = options?.maxDelay ?? 30000;
    this.backoffFactor = options?.backoffFactor ?? 2;
  }

  async execute<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        if (error instanceof BasiqAPIError && !error.retryable) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === this.maxAttempts) {
          throw error;
        }

        // Calculate delay
        let delay = this.calculateDelay(attempt);

        // Use retry-after header if available
        if (error instanceof BasiqAPIError && error.retryAfter) {
          delay = error.retryAfter * 1000;
        }

        // Call retry callback
        if (onRetry) {
          onRetry(attempt, error);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Retry failed');
  }

  private calculateDelay(attempt: number): number {
    const delay = this.initialDelay * Math.pow(this.backoffFactor, attempt - 1);
    return Math.min(delay, this.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Circuit breaker for handling repeated failures
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime: Date | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new BasiqAPIError(
          'Circuit breaker is open',
          BasiqErrorCode.SERVICE_UNAVAILABLE,
          503,
          { retryable: true },
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailTime !== null && Date.now() - this.lastFailTime.getTime() >= this.timeout;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailTime = new Date();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): { state: string; failures: number; lastFailTime: Date | null } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime,
    };
  }
}

// Error recovery strategies
export const ErrorRecovery = {
  // Handle authentication errors
  async handleAuthError(error: BasiqAPIError): Promise<void> {
    if (error.code === BasiqErrorCode.TOKEN_EXPIRED) {
      // Token will be refreshed automatically on next request
      logger.info('Token expired, will refresh on next request');
    } else if (error.code === BasiqErrorCode.INVALID_CREDENTIALS) {
      // Log security event
      logger.error('Invalid BASIQ credentials');
      throw error;
    }
  },

  // Handle connection errors
  async handleConnectionError(error: BasiqAPIError, connectionId: string): Promise<void> {
    if (error.code === BasiqErrorCode.MFA_REQUIRED) {
      // Handle MFA flow
      logger.info('MFA required for connection:', connectionId);
      // Implementation depends on BASIQ MFA flow
    } else if (error.code === BasiqErrorCode.INSTITUTION_UNAVAILABLE) {
      // Mark institution as temporarily unavailable
      logger.warn('Institution temporarily unavailable');
    }
  },

  // Handle rate limiting
  async handleRateLimit(error: BasiqAPIError): Promise<void> {
    const retryAfter = error.retryAfter || 60;
    logger.warn(`Rate limited. Retry after ${retryAfter} seconds`);
    // Could implement queue or notification system here
  },
};
