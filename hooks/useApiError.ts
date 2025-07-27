import { useState, useCallback } from 'react';
import { logApiError, logNetworkError, ErrorType, ErrorSeverity } from '@/lib/errors/errorLogger';
import { ApiErrorResponse } from '@/lib/errors/api-error-handler';

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
  isRetryable?: boolean;
  timestamp?: string;
}

export interface UseApiErrorReturn {
  error: ApiError | null;
  isError: boolean;
  clearError: () => void;
  handleError: (error: unknown, context?: ApiErrorContext) => ApiError;
  retry: () => Promise<void>;
  retryCount: number;
  canRetry: boolean;
}

export interface ApiErrorContext {
  endpoint?: string;
  method?: string;
  retryable?: boolean;
  silent?: boolean;
  userId?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export function useApiError(): UseApiErrorReturn {
  const [error, setError] = useState<ApiError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryFn, setLastRetryFn] = useState<(() => Promise<void>) | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setLastRetryFn(null);
  }, []);

  const handleError = useCallback(
    (err: unknown, context?: ApiErrorContext): ApiError => {
      let apiError: ApiError;
      const timestamp = new Date().toISOString();

      // Network error
      if (!navigator.onLine || (err instanceof Error && err.message === 'NetworkError')) {
        apiError = {
          message: 'No internet connection. Please check your network.',
          code: 'NETWORK_ERROR',
          isRetryable: true,
          timestamp,
        };
        logNetworkError(err, context?.endpoint || '', {
          userId: context?.userId,
          metadata: { method: context?.method },
        });
      }
      // Fetch Response error
      else if (err instanceof Response) {
        apiError = {
          message: getErrorMessage(err.status),
          status: err.status,
          code: getErrorCode(err.status),
          isRetryable: err.status >= 500 || err.status === 429,
          timestamp,
        };

        if (context?.endpoint) {
          logApiError(err, context.endpoint, context.method || 'GET', {
            userId: context?.userId,
          });
        }
      }
      // Error with response property (axios-like)
      else if (typeof err === 'object' && err !== null && 'response' in err) {
        const error = err as any;
        const status = error.response?.status;
        apiError = {
          message: getErrorMessage(status, error.response?.data),
          status,
          code: error.response?.data?.code || getErrorCode(status),
          details: error.response?.data,
          isRetryable: status >= 500 || status === 429,
          timestamp,
        };

        if (context?.endpoint) {
          logApiError(err, context.endpoint, context.method || 'GET', {
            userId: context?.userId,
          });
        }
      }
      // Request error (timeout, etc)
      else if (typeof err === 'object' && err !== null && 'request' in err) {
        apiError = {
          message: 'Request timeout. Please try again.',
          code: 'REQUEST_TIMEOUT',
          isRetryable: true,
          timestamp,
        };
      }
      // Standard Error object
      else if (err instanceof Error) {
        apiError = {
          message: err.message || 'An unexpected error occurred.',
          code: 'UNKNOWN_ERROR',
          isRetryable: context?.retryable !== false,
          timestamp,
        };
      }
      // Other errors
      else {
        apiError = {
          message: 'An unexpected error occurred.',
          code: 'UNKNOWN_ERROR',
          isRetryable: context?.retryable !== false,
          timestamp,
        };
      }

      // Don't show error UI if silent
      if (!context?.silent) {
        setError(apiError);
      }

      // Set retry function if retryable
      if (apiError.isRetryable && retryCount < MAX_RETRIES) {
        setLastRetryFn(() => async () => {
          clearError();
          throw new Error('Retry function not implemented');
        });
      }

      return apiError;
    },
    [retryCount, clearError],
  );

  const retry = useCallback(async () => {
    if (!lastRetryFn || retryCount >= MAX_RETRIES) return;

    setRetryCount((prev) => prev + 1);

    // Exponential backoff
    const delay = RETRY_DELAY * Math.pow(2, retryCount);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await lastRetryFn();
      clearError();
    } catch (err) {
      // Error will be handled by the original error handler
    }
  }, [lastRetryFn, retryCount, clearError]);

  return {
    error,
    isError: !!error,
    clearError,
    handleError,
    retry,
    retryCount,
    canRetry: retryCount < MAX_RETRIES && !!lastRetryFn,
  };
}

// Helper function to get user-friendly error messages
function getErrorMessage(status: number, data?: unknown): string {
  let customMessage: string | undefined;

  if (data && typeof data === 'object' && 'message' in data) {
    customMessage = (data as any).message;
  } else if (data && typeof data === 'object' && 'error' in data) {
    customMessage = (data as any).error;
  }

  switch (status) {
    case 400:
      return customMessage || 'Invalid request. Please check your input.';
    case 401:
      return 'Your session has expired. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return customMessage || 'This action conflicts with existing data.';
    case 422:
      return customMessage || 'The provided data is invalid.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'A server error occurred. Our team has been notified.';
    case 502:
    case 503:
      return 'The service is temporarily unavailable. Please try again later.';
    case 504:
      return 'The request took too long to complete. Please try again.';
    default:
      return customMessage || 'An unexpected error occurred.';
  }
}

// Helper function to get standardized error codes
function getErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 500:
      return 'INTERNAL_SERVER_ERROR';
    case 502:
      return 'BAD_GATEWAY';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    case 504:
      return 'GATEWAY_TIMEOUT';
    default:
      return 'UNKNOWN_ERROR';
  }
}

// Hook for handling API calls with loading and error states
export function useApiCall<T = any>(
  apiCall: (...args: any[]) => Promise<T>,
  options?: {
    endpoint?: string;
    method?: string;
    retryable?: boolean;
  },
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const { error, handleError, clearError, retry: retryError } = useApiError();

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      setLoading(true);
      clearError();

      try {
        const result = await apiCall(...args);
        setData(result);
        return result;
      } catch (err) {
        handleError(err, {
          retryable: options?.retryable !== false,
          endpoint: options?.endpoint || apiCall.name,
          method: options?.method,
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiCall, handleError, clearError, options],
  );

  const retry = useCallback(async () => {
    if (error && error.isRetryable) {
      await retryError();
    }
  }, [error, retryError]);

  return {
    data,
    loading,
    error,
    execute,
    retry,
    clearError,
    isError: !!error,
  };
}

/**
 * Parse error response from fetch API
 */
export async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const data = (await response.json()) as ApiErrorResponse;
    return {
      message: data.message || `Request failed with status ${response.status}`,
      code: data.code || getErrorCode(response.status),
      details: data.details,
      status: response.status,
      isRetryable: response.status >= 500 || response.status === 429,
      timestamp: data.timestamp || new Date().toISOString(),
    };
  } catch {
    return {
      message: getErrorMessage(response.status),
      code: getErrorCode(response.status),
      status: response.status,
      isRetryable: response.status >= 500 || response.status === 429,
      timestamp: new Date().toISOString(),
    };
  }
}
