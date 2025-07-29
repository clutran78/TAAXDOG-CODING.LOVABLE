import React, { Component, ReactNode, ErrorInfo } from 'react';
import { logger } from '@/lib/logger';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Error types for better error handling
export enum ErrorType {
  CHUNK_LOAD_ERROR = 'ChunkLoadError',
  NETWORK_ERROR = 'NetworkError',
  PERMISSION_ERROR = 'PermissionError',
  DATA_ERROR = 'DataError',
  UNKNOWN_ERROR = 'UnknownError',
}

// Error metadata interface
interface ErrorMetadata {
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId?: string;
  componentStack?: string;
  errorBoundary?: string;
  errorBoundaryProps?: Record<string, any>;
}

// Props interface
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, metadata: ErrorMetadata) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
  showDetails?: boolean;
  context?: string;
}

// State interface
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorType: ErrorType;
  errorCount: number;
  lastErrorTime: number;
}

// Error messages for different error types
const ERROR_MESSAGES: Record<ErrorType, { title: string; message: string; action: string }> = {
  [ErrorType.CHUNK_LOAD_ERROR]: {
    title: 'Loading Error',
    message: 'We had trouble loading some resources. This might be due to a network issue or an outdated version.',
    action: 'Please refresh the page to get the latest version.',
  },
  [ErrorType.NETWORK_ERROR]: {
    title: 'Connection Problem',
    message: 'We\'re having trouble connecting to our servers. Please check your internet connection.',
    action: 'Try refreshing the page or check back in a few moments.',
  },
  [ErrorType.PERMISSION_ERROR]: {
    title: 'Access Denied',
    message: 'You don\'t have permission to view this content.',
    action: 'Please contact support if you believe this is an error.',
  },
  [ErrorType.DATA_ERROR]: {
    title: 'Data Loading Error',
    message: 'We encountered a problem while loading your data.',
    action: 'Try refreshing the page or contact support if the problem persists.',
  },
  [ErrorType.UNKNOWN_ERROR]: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred while loading this page.',
    action: 'Please try refreshing the page or contact support if the problem continues.',
  },
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private originalConsoleError: typeof console.error;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: ErrorType.UNKNOWN_ERROR,
      errorCount: 0,
      lastErrorTime: 0,
    };

    // Store original console.error
    this.originalConsoleError = console.error;
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    // Reset error boundary when resetKeys change
    if (props.resetKeys && props.resetOnPropsChange && state.hasError) {
      return {
        hasError: false,
        error: null,
        errorInfo: null,
        errorType: ErrorType.UNKNOWN_ERROR,
      };
    }
    return null;
  }

  componentDidMount() {
    // Add global error handlers
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    
    // Override console.error to catch errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error = (...args) => {
        this.originalConsoleError(...args);
        // Check if it's a React error
        if (args[0]?.includes?.('Consider adding an error boundary')) {
          logger.warn('React error detected outside error boundary:', args);
        }
      };
    }
  }

  componentWillUnmount() {
    // Clean up
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    
    // Restore console.error
    console.error = this.originalConsoleError;
    
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    logger.error('Unhandled promise rejection:', event.reason);
    
    // Only catch if we're the page-level error boundary
    if (this.props.level === 'page') {
      this.captureError(new Error(event.reason), {
        componentStack: 'Unhandled Promise Rejection',
      } as ErrorInfo);
    }
  };

  private classifyError(error: Error): ErrorType {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Chunk load errors (code splitting issues)
    if (
      errorMessage.includes('loading chunk') ||
      errorMessage.includes('failed to fetch dynamically imported module') ||
      errorName.includes('chunkloaderror')
    ) {
      return ErrorType.CHUNK_LOAD_ERROR;
    }

    // Network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      error.name === 'NetworkError' ||
      errorMessage.includes('failed to fetch')
    ) {
      return ErrorType.NETWORK_ERROR;
    }

    // Permission errors
    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden')
    ) {
      return ErrorType.PERMISSION_ERROR;
    }

    // Data errors
    if (
      errorMessage.includes('data') ||
      errorMessage.includes('json') ||
      errorMessage.includes('parse')
    ) {
      return ErrorType.DATA_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  private captureError(error: Error, errorInfo: ErrorInfo) {
    const errorType = this.classifyError(error);
    const now = Date.now();
    const timeSinceLastError = now - this.state.lastErrorTime;

    // Prevent error spam
    if (timeSinceLastError < 1000 && this.state.error?.message === error.message) {
      return;
    }

    // Create error metadata
    const metadata: ErrorMetadata = {
      timestamp: new Date().toISOString(),
      userAgent: window.navigator.userAgent,
      url: window.location.href,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.context || 'Unknown',
      errorBoundaryProps: {
        level: this.props.level,
        isolate: this.props.isolate,
      },
    };

    // Log error
    logger.error('Error caught by boundary:', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      errorType,
      metadata,
    });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo, metadata);
    }

    // Update state
    this.setState(prevState => ({
      hasError: true,
      error,
      errorInfo,
      errorType,
      errorCount: prevState.errorCount + 1,
      lastErrorTime: now,
    }));

    // Show toast for non-page level errors
    if (this.props.level !== 'page') {
      toast.error('An error occurred. Please try again.');
    }

    // Auto-recovery for certain error types
    if (errorType === ErrorType.CHUNK_LOAD_ERROR && this.state.errorCount < 3) {
      this.resetTimeoutId = setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.captureError(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: ErrorType.UNKNOWN_ERROR,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  private renderErrorUI() {
    const { error, errorType, errorInfo } = this.state;
    const { showDetails = process.env.NODE_ENV === 'development', level = 'component' } = this.props;
    const errorConfig = ERROR_MESSAGES[errorType];

    // Page-level error UI
    if (level === 'page') {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                  <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {errorConfig.title}
                </h2>
                
                <p className="text-sm text-gray-600 mb-6">
                  {errorConfig.message}
                </p>
                
                <p className="text-sm text-gray-500 mb-6">
                  {errorConfig.action}
                </p>

                {errorType === ErrorType.CHUNK_LOAD_ERROR && (
                  <div className="mb-6 p-3 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-800">
                      The page will automatically reload in a few seconds...
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={this.handleReload}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Refresh Page
                  </button>
                  
                  <button
                    onClick={this.handleGoHome}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Go to Dashboard
                  </button>
                </div>

                {showDetails && error && (
                  <details className="mt-6 text-left">
                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                      Error Details (Development Only)
                    </summary>
                    <div className="mt-2 p-3 bg-gray-100 rounded-md overflow-auto">
                      <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                      {errorInfo && (
                        <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">
                          {errorInfo.componentStack}
                        </pre>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Component-level error UI
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">
              {errorConfig.title}
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{errorConfig.message}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={this.handleReset}
                className="text-sm font-medium text-red-800 hover:text-red-700"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return this.renderErrorUI();
    }

    return this.props.children;
  }
}

// Convenience wrapper with hooks support
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

// Hook for imperative error handling
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    throw error; // This will be caught by the nearest error boundary
  };
}

// Async Error Boundary for handling async component errors
export class AsyncErrorBoundary extends ErrorBoundary {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Handle async errors specifically
    if (error.message.includes('Loading chunk') || error.message.includes('Failed to fetch')) {
      // Handle chunk loading errors
      this.setState({
        hasError: true,
        error,
        errorInfo,
        errorType: ErrorType.CHUNK_LOAD_ERROR,
        errorCount: this.state.errorCount + 1,
        lastErrorTime: Date.now(),
      });
    } else {
      super.componentDidCatch(error, errorInfo);
    }
  }
}

export default ErrorBoundary;