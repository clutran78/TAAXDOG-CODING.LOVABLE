import React, { useState } from 'react';
import { InlineLoader } from './SkeletonLoaders';

interface ErrorDisplayProps {
  error: Error | string;
  onRetry?: () => void;
  className?: string;
}

interface ApiErrorProps {
  error: any;
  endpoint?: string;
  onRetry?: () => void;
  className?: string;
}

interface NetworkErrorProps {
  onRetry?: () => void;
  className?: string;
}

interface ErrorWithDetailsProps {
  title: string;
  message: string;
  details?: string;
  onRetry?: () => void;
  onGoBack?: () => void;
  showDetails?: boolean;
  className?: string;
}

// Generic error display
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry, className = '' }) => {
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div
      className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className} animate-slideDown shadow-sm`}
    >
      <div className="flex">
        <div className="flex-shrink-0 animate-pulse">
          <svg
            className="h-5 w-5 text-red-400 dark:text-red-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
          <div className="mt-2 text-sm text-red-700 dark:text-red-400">
            <p>{errorMessage}</p>
          </div>
          {onRetry && (
            <div className="mt-4">
              <button
                onClick={onRetry}
                className="bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded-md text-sm font-medium text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// API-specific error display
export const ApiError: React.FC<ApiErrorProps> = ({ error, endpoint, onRetry, className = '' }) => {
  const getErrorMessage = () => {
    if (error.status === 404) return 'The requested resource was not found.';
    if (error.status === 403) return 'You do not have permission to perform this action.';
    if (error.status === 401) return 'Your session has expired. Please log in again.';
    if (error.status === 500) return 'A server error occurred. Please try again later.';
    if (error.status === 429) return 'Too many requests. Please wait a moment and try again.';

    return error.message || 'An unexpected error occurred.';
  };

  return (
    <ErrorDisplay
      error={getErrorMessage()}
      onRetry={onRetry}
      className={className}
    />
  );
};

// Network error display
export const NetworkError: React.FC<NetworkErrorProps> = ({ onRetry, className = '' }) => {
  return (
    <div
      className={`bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 ${className} animate-slideDown shadow-sm`}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400 dark:text-yellow-500 animate-pulse"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Connection Problem
          </h3>
          <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
            <p>Unable to connect to the server. Please check your internet connection.</p>
          </div>
          {onRetry && (
            <div className="mt-4">
              <button
                onClick={onRetry}
                className="bg-yellow-100 dark:bg-yellow-900/30 px-3 py-2 rounded-md text-sm font-medium text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Detailed error display with collapsible details
export const ErrorWithDetails: React.FC<ErrorWithDetailsProps> = ({
  title,
  message,
  details,
  onRetry,
  onGoBack,
  showDetails = process.env.NODE_ENV === 'development',
  className = '',
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className} animate-fadeInScale`}
    >
      <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full animate-pulse">
        <svg
          className="w-6 h-6 text-red-600 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-center text-gray-900 dark:text-gray-100">
        {title}
      </h1>
      <p className="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">{message}</p>

      {showDetails && details && (
        <div className="mt-4">
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center mx-auto transition-colors"
          >
            <span>{detailsExpanded ? 'Hide' : 'Show'} details</span>
            <svg
              className={`ml-1 w-4 h-4 transform transition-transform ${
                detailsExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {detailsExpanded && (
            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-40 animate-slideDown">
              {details}
            </pre>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Try Again
          </button>
        )}
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-md transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
};

// Retry wrapper component
interface RetryWrapperProps {
  onRetry: () => Promise<void>;
  maxRetries?: number;
  retryDelay?: number;
  children: (retrying: boolean, retryCount: number) => React.ReactNode;
}

export const RetryWrapper: React.FC<RetryWrapperProps> = ({
  onRetry,
  maxRetries = 3,
  retryDelay = 1000,
  children,
}) => {
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = async () => {
    if (retryCount >= maxRetries) return;

    setRetrying(true);
    setRetryCount((prev) => prev + 1);

    // Add exponential backoff
    const delay = retryDelay * Math.pow(2, retryCount);
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await onRetry();
    } catch (error) {
      // Error will be handled by parent
    } finally {
      setRetrying(false);
    }
  };

  return <>{children(retrying, retryCount)}</>;
};

// Empty state component for no data scenarios
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
  className = '',
}) => {
  return (
    <div className={`text-center py-12 ${className} animate-fadeIn`}>
      {icon || (
        <svg
          className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 animate-fadeInScale"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      )}
      <h3
        className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100 animate-slideUp"
        style={{ animationDelay: '100ms' }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-sm text-gray-500 dark:text-gray-400 animate-slideUp"
        style={{ animationDelay: '200ms' }}
      >
        {message}
      </p>
      {action && (
        <div
          className="mt-6 animate-slideUp"
          style={{ animationDelay: '300ms' }}
        >
          <button
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
};

// Loading error boundary for async components
interface AsyncBoundaryProps {
  loading: boolean;
  error: Error | null;
  onRetry?: () => void;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  children: React.ReactNode;
}

export const AsyncBoundary: React.FC<AsyncBoundaryProps> = ({
  loading,
  error,
  onRetry,
  loadingComponent,
  errorComponent,
  children,
}) => {
  if (loading) {
    return (
      <>
        {loadingComponent || (
          <InlineLoader
            size="lg"
            className="mx-auto my-8"
          />
        )}
      </>
    );
  }

  if (error) {
    return (
      <>
        {errorComponent || (
          <ErrorDisplay
            error={error}
            onRetry={onRetry}
            className="my-8"
          />
        )}
      </>
    );
  }

  return <>{children}</>;
};
