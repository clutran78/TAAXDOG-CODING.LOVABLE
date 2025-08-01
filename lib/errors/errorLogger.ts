import { logger } from '@/lib/logger';

// Sentry imports - commented out until package is installed
// import { captureException, withScope } from '@sentry/nextjs';

// Mock Sentry functions for now
const captureException = (error: any) => logger.error('Sentry not configured:', error);
const withScope = (callback: any) =>
  callback({
    setLevel: () => {},
    setTag: () => {},
    setContext: () => {},
    setUser: () => {},
  });

export interface ErrorContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
  url?: string;
  component?: string;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorType {
  API = 'api',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

class ErrorLogger {
  private static instance: ErrorLogger;
  private errorQueue: Array<{ error: Error; context: ErrorContext; timestamp: Date }> = [];
  private maxQueueSize = 50;

  private constructor() {
    // Send queued errors every 30 seconds if any exist
    setInterval(() => this.flushErrorQueue(), 30000);
  }

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  logError(
    error: Error | unknown,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    type: ErrorType = ErrorType.UNKNOWN,
    context?: ErrorContext,
  ) {
    const errorObject = error instanceof Error ? error : new Error(String(error));

    // Add to queue for batch processing
    this.addToQueue(errorObject, context);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.error(`[${type.toUpperCase()}] ${severity}:`, { errorObject, context });
    }

    // Send to Sentry if available - disabled for now
    // if (typeof window !== 'undefined' && window.__SENTRY__) {
    //   withScope((scope) => {
    //     scope.setLevel(this.mapSeverityToSentryLevel(severity));
    //     scope.setTag('error.type', type);

    //     if (context) {
    //       scope.setContext('error_context', context);
    //       if (context.userId) scope.setUser({ id: context.userId });
    //       if (context.action) scope.setTag('action', context.action);
    //     }

    //     captureException(errorObject);
    //   });
    // }

    // Send to custom analytics
    this.sendToAnalytics(errorObject, severity, type, context);
  }

  private mapSeverityToSentryLevel(severity: ErrorSeverity): 'error' | 'warning' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.LOW:
        return 'info';
    }
  }

  private addToQueue(error: Error, context?: ErrorContext) {
    this.errorQueue.push({
      error,
      context: context || {},
      timestamp: new Date(),
    });

    // Keep queue size manageable
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  private async flushErrorQueue() {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // Send batch to logging endpoint
      await fetch('/api/logs/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errors: errors.map((e) => ({
            message: e.error.message,
            stack: e.error.stack,
            context: e.context,
            timestamp: e.timestamp,
          })),
        }),
      });
    } catch (err) {
      // Re-add to queue if sending fails
      this.errorQueue.unshift(...errors);
    }
  }

  private sendToAnalytics(
    error: Error,
    severity: ErrorSeverity,
    type: ErrorType,
    context?: ErrorContext,
  ) {
    // Send to analytics service (e.g., Google Analytics, Mixpanel)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: severity === ErrorSeverity.CRITICAL,
        error_type: type,
        ...context,
      });
    }
  }

  getRecentErrors(
    limit: number = 10,
  ): Array<{ error: Error; context: ErrorContext; timestamp: Date }> {
    return this.errorQueue.slice(-limit);
  }

  clearErrorQueue() {
    this.errorQueue = [];
  }
}

export const errorLogger = ErrorLogger.getInstance();

// Utility functions for common error scenarios
export function logApiError(
  error: unknown,
  endpoint: string,
  method: string,
  context?: ErrorContext,
) {
  errorLogger.logError(error, ErrorSeverity.HIGH, ErrorType.API, {
    ...context,
    metadata: {
      ...context?.metadata,
      endpoint,
      method,
    },
  });
}

export function logNetworkError(error: unknown, url: string, context?: ErrorContext) {
  errorLogger.logError(error, ErrorSeverity.MEDIUM, ErrorType.NETWORK, {
    ...context,
    url,
  });
}

export function logAuthError(error: unknown, action: string, context?: ErrorContext) {
  errorLogger.logError(error, ErrorSeverity.HIGH, ErrorType.AUTHENTICATION, {
    ...context,
    action,
  });
}

export function logValidationError(
  error: unknown,
  field: string,
  value: any,
  context?: ErrorContext,
) {
  errorLogger.logError(error, ErrorSeverity.LOW, ErrorType.VALIDATION, {
    ...context,
    metadata: {
      ...context?.metadata,
      field,
      value: typeof value === 'object' ? JSON.stringify(value) : value,
    },
  });
}

// Declare global types for window
declare global {
  interface Window {
    __SENTRY__?: any;
    gtag?: (...args: any[]) => void;
  }
}
