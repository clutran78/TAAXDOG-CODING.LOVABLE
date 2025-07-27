import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorLogger, ErrorSeverity, ErrorType } from '@/lib/errors/errorLogger';
import { ErrorWithDetails } from '@/components/ui/ErrorComponents';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorCount: 0, // Reset count on new error
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with context
    errorLogger.logError(error, ErrorSeverity.HIGH, ErrorType.SYSTEM, {
      component: errorInfo.componentStack,
      metadata: {
        errorBoundary: this.constructor.name,
        props: this.props,
      },
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
      errorCount: this.state.errorCount + 1,
    });

    // Auto-reset after 5 errors to prevent infinite loops
    if (this.state.errorCount >= 5) {
      logger.error('ErrorBoundary: Too many errors, forcing reset');
      this.scheduleReset(5000);
    }
  }

  public componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset on prop changes if enabled
    if (hasError && prevProps.children !== this.props.children && resetOnPropsChange) {
      this.resetErrorBoundary();
    }

    // Reset when resetKeys change
    if (resetKeys && prevProps.resetKeys !== resetKeys) {
      let hasResetKeyChanged = false;
      for (let i = 0; i < resetKeys.length; i++) {
        if (!this.previousResetKeys[i] || this.previousResetKeys[i] !== resetKeys[i]) {
          hasResetKeyChanged = true;
          break;
        }
      }

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
        this.previousResetKeys = resetKeys;
      }
    }
  }

  private scheduleReset = (delay: number) => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.resetErrorBoundary();
    }, delay);
  };

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    });
  };

  private handleReset = () => {
    this.resetErrorBoundary();

    // If isolated, just reset state. Otherwise, reload the page
    if (!this.props.isolate) {
      window.location.reload();
    }
  };

  private getErrorDetails = (): string => {
    const { error, errorInfo } = this.state;
    if (!error) return '';

    let details = error.toString();

    if (error.stack) {
      details += '\n\nStack trace:\n' + error.stack;
    }

    if (errorInfo && errorInfo.componentStack) {
      details += '\n\nComponent stack:\n' + errorInfo.componentStack;
    }

    return details;
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use isolated error display for component-level boundaries
      if (this.props.isolate) {
        return (
          <div className="p-4">
            <ErrorWithDetails
              title="Component Error"
              message="This component encountered an error and cannot be displayed."
              details={this.getErrorDetails()}
              onRetry={this.handleReset}
              showDetails={process.env.NODE_ENV === 'development'}
              className="max-w-lg mx-auto"
            />
          </div>
        );
      }

      // Full page error display
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <ErrorWithDetails
            title="Something went wrong"
            message="We're sorry for the inconvenience. Our team has been notified and is working on a fix."
            details={this.getErrorDetails()}
            onRetry={this.handleReset}
            onGoBack={() => window.history.back()}
            showDetails={process.env.NODE_ENV === 'development'}
            className="max-w-md w-full"
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const resetError = () => setError(null);

  const captureError = (error: Error, context?: Record<string, unknown>) => {
    errorLogger.logError(error, ErrorSeverity.MEDIUM, ErrorType.UNKNOWN, { metadata: context });
    setError(error);
  };

  return { resetError, captureError };
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>,
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Async error boundary for handling async errors
export function AsyncErrorBoundary({
  children,
  fallback,
  onError,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}) {
  return (
    <ErrorBoundary
      fallback={fallback}
      onError={onError}
      isolate
      resetOnPropsChange
    >
      {children}
    </ErrorBoundary>
  );
}
