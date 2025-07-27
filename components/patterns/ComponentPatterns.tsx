/**
 * Standard React Component Patterns for TAAXDOG
 *
 * This file defines the standard patterns that all React components should follow
 * for consistency across the codebase.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// 1. COMPONENT STRUCTURE PATTERN
// ============================================================================

/**
 * Standard functional component with TypeScript
 *
 * Key patterns:
 * - Props interface defined above component
 * - Props destructured in function parameters
 * - Hooks declared at the top in consistent order
 * - Event handlers prefixed with 'handle'
 * - Memoized values and callbacks where appropriate
 * - Clear separation of concerns
 */

interface StandardComponentProps {
  // Required props first
  id: string;
  title: string;

  // Optional props after required
  description?: string;
  initialValue?: number;

  // Callback props (always prefixed with 'on')
  onSave?: (value: number) => void;
  onCancel?: () => void;

  // Children and render props last
  children?: React.ReactNode;
}

export const StandardComponent: React.FC<StandardComponentProps> = ({
  id,
  title,
  description,
  initialValue = 0,
  onSave,
  onCancel,
  children,
}) => {
  // ========================================
  // STATE (grouped by related functionality)
  // ========================================

  // Form state
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ========================================
  // REFS (if needed)
  // ========================================

  // const inputRef = useRef<HTMLInputElement>(null);

  // ========================================
  // COMPUTED VALUES (memoized)
  // ========================================

  const isValid = useMemo(() => {
    return value > 0 && value < 100;
  }, [value]);

  const displayValue = useMemo(() => {
    return `$${value.toFixed(2)}`;
  }, [value]);

  // ========================================
  // EFFECTS (grouped by functionality)
  // ========================================

  // Data fetching effect
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Simulated API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!cancelled) {
          // Update state only if component is still mounted
          setValue(42);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      cancelled = true;
    };
  }, [id]); // Dependencies clearly listed

  // ========================================
  // EVENT HANDLERS (prefixed with 'handle')
  // ========================================

  const handleValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value) || 0;
    setValue(newValue);
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isValid) {
        setError('Value must be between 0 and 100');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        // Simulated API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        onSave?.(value);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isValid, value, onSave],
  );

  const handleCancel = useCallback(() => {
    setValue(initialValue);
    setError(null);
    onCancel?.();
  }, [initialValue, onCancel]);

  // ========================================
  // RENDER HELPERS (if complex logic needed)
  // ========================================

  const renderError = () => {
    if (!error) return null;

    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mt-2">
        <p className="text-sm">{error}</p>
      </div>
    );
  };

  // ========================================
  // MAIN RENDER
  // ========================================

  // Early returns for loading/error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>

      {description && <p className="text-gray-600 mb-6">{description}</p>}

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor={`${id}-input`}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Value
          </label>
          <input
            id={`${id}-input`}
            type="number"
            value={value}
            onChange={handleValueChange}
            disabled={isSubmitting}
            className={`
              w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
              ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
              ${isSubmitting ? 'bg-gray-100 cursor-not-allowed' : ''}
            `}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          {error && (
            <p
              id={`${id}-error`}
              className="mt-1 text-sm text-red-600"
            >
              {error}
            </p>
          )}
        </div>

        <div className="text-lg font-medium text-gray-700">Display Value: {displayValue}</div>

        {renderError()}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${
                isSubmitting || !isValid
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </form>

      {children && <div className="mt-6 pt-6 border-t border-gray-200">{children}</div>}
    </div>
  );
};

// ============================================================================
// 2. LOADING STATE PATTERN
// ============================================================================

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingProps> = ({ size = 'medium', message }) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div
        className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}
      />
      {message && <p className="mt-4 text-gray-600 text-sm">{message}</p>}
    </div>
  );
};

// ============================================================================
// 3. ERROR HANDLING PATTERN
// ============================================================================

interface ErrorDisplayProps {
  error: Error | string | null;
  onRetry?: () => void;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onRetry, className = '' }) => {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-md p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
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
          <h3 className="text-sm font-medium text-red-800">Error</h3>
          <p className="mt-1 text-sm text-red-700">{errorMessage}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. EMPTY STATE PATTERN
// ============================================================================

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="text-center py-12">
      {icon && <div className="mx-auto w-12 h-12 text-gray-400 mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// 5. LIST COMPONENT PATTERN
// ============================================================================

interface ListItem {
  id: string;
  name: string;
  value: number;
}

interface ListComponentProps {
  items: ListItem[];
  onItemClick?: (item: ListItem) => void;
  onItemDelete?: (id: string) => void;
}

export const ListComponent: React.FC<ListComponentProps> = ({
  items,
  onItemClick,
  onItemDelete,
}) => {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingIds((prev) => new Set(prev).add(id));

      try {
        await onItemDelete?.(id);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [onItemDelete],
  );

  if (items.length === 0) {
    return (
      <EmptyState
        title="No items found"
        description="Get started by creating your first item"
      />
    );
  }

  return (
    <ul className="divide-y divide-gray-200">
      {items.map((item) => {
        const isDeleting = deletingIds.has(item.id);

        return (
          <li
            key={item.id}
            className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
              isDeleting ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => onItemClick?.(item)}
                disabled={isDeleting}
                className="flex-1 text-left"
              >
                <div className="text-sm font-medium text-gray-900">{item.name}</div>
                <div className="text-sm text-gray-500">Value: ${item.value.toFixed(2)}</div>
              </button>

              {onItemDelete && (
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={isDeleting}
                  className="ml-4 text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
