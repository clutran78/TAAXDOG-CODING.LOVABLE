import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  circle?: boolean;
}

// Base skeleton component with shimmer animation
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = '100%',
  height = '20px',
  rounded = false,
  circle = false,
}) => {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={`
        animate-pulse bg-gray-200
        ${rounded ? 'rounded-md' : ''}
        ${circle ? 'rounded-full' : ''}
        ${className}
      `}
      style={style}
      role="status"
      aria-label="Loading..."
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

// Text skeleton with multiple lines
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 ? '60%' : '100%'}
          rounded
        />
      ))}
    </div>
  );
};

// Card skeleton
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <div className="space-y-3">
        <Skeleton
          height={24}
          width="40%"
          rounded
        />
        <SkeletonText lines={2} />
        <div className="flex justify-between items-center mt-4">
          <Skeleton
            height={20}
            width={100}
            rounded
          />
          <Skeleton
            height={20}
            width={80}
            rounded
          />
        </div>
      </div>
    </div>
  );
};

// Transaction row skeleton
export const SkeletonTransactionRow: React.FC = () => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-200">
      <div className="flex items-center space-x-3 flex-1">
        <Skeleton
          width={40}
          height={40}
          circle
        />
        <div className="flex-1 space-y-2">
          <Skeleton
            height={18}
            width="60%"
            rounded
          />
          <Skeleton
            height={14}
            width="40%"
            rounded
          />
        </div>
      </div>
      <div className="text-right">
        <Skeleton
          height={20}
          width={80}
          rounded
        />
        <Skeleton
          height={14}
          width={60}
          rounded
          className="mt-1"
        />
      </div>
    </div>
  );
};

// Stats card skeleton
export const SkeletonStatsCard: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-center space-y-2">
        <Skeleton
          height={36}
          width={120}
          rounded
          className="mx-auto"
        />
        <Skeleton
          height={16}
          width={100}
          rounded
          className="mx-auto"
        />
      </div>
    </div>
  );
};

// Table skeleton
export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              height={16}
              width="80%"
              rounded
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="border-b border-gray-200 p-4"
          >
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  height={16}
                  width={colIndex === 0 ? '100%' : '60%'}
                  rounded
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Form skeleton
export const SkeletonForm: React.FC<{ fields?: number }> = ({ fields = 4 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton
            height={16}
            width={120}
            rounded
            className="mb-2"
          />
          <Skeleton
            height={40}
            rounded
          />
        </div>
      ))}
      <div className="flex justify-end space-x-2 mt-6">
        <Skeleton
          height={40}
          width={100}
          rounded
        />
        <Skeleton
          height={40}
          width={100}
          rounded
        />
      </div>
    </div>
  );
};

// Bank account skeleton
export const SkeletonBankAccount: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Skeleton
            width={48}
            height={48}
            rounded
          />
          <div className="space-y-2">
            <Skeleton
              height={18}
              width={150}
              rounded
            />
            <Skeleton
              height={14}
              width={100}
              rounded
            />
          </div>
        </div>
        <div className="text-right">
          <Skeleton
            height={24}
            width={100}
            rounded
          />
          <Skeleton
            height={14}
            width={80}
            rounded
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
};

// Budget item skeleton
export const SkeletonBudgetItem: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton
              height={20}
              width={120}
              rounded
            />
            <Skeleton
              height={16}
              width={80}
              rounded
            />
          </div>
          <Skeleton
            height={24}
            width={100}
            rounded
          />
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <Skeleton
            height={8}
            width="60%"
            rounded
            className="rounded-full"
          />
        </div>
        <div className="flex justify-between text-sm">
          <Skeleton
            height={14}
            width={80}
            rounded
          />
          <Skeleton
            height={14}
            width={60}
            rounded
          />
        </div>
      </div>
    </div>
  );
};

// Dashboard grid skeleton
export const SkeletonDashboardGrid: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatsCard key={i} />
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-64" />
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <Skeleton
            height={24}
            width={200}
            rounded
          />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonTransactionRow key={i} />
        ))}
      </div>
    </div>
  );
};

// Loading spinner with overlay
export const LoadingOverlay: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
        <div className="spinner-lg" />
        <p className="text-gray-700">{message}</p>
      </div>
    </div>
  );
};

// Inline loading indicator
export const InlineLoader: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`inline-flex items-center ${className}`}>
      <svg
        className={`animate-spin ${sizeClasses[size]} text-blue-600`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

// Button with loading state
export const LoadingButton: React.FC<{
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}> = ({
  loading = false,
  disabled = false,
  children,
  onClick,
  className = '',
  type = 'button',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`
        relative inline-flex items-center justify-center
        ${loading ? 'cursor-not-allowed opacity-75' : ''}
        ${className}
      `}
    >
      {loading && (
        <InlineLoader
          size="sm"
          className="absolute left-3"
        />
      )}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
    </button>
  );
};

// Progress bar for long operations
export const ProgressBar: React.FC<{
  progress: number;
  message?: string;
  className?: string;
}> = ({ progress, message, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {message && <p className="text-sm text-gray-600">{message}</p>}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="text-xs text-gray-500 text-right">{Math.round(progress)}%</p>
    </div>
  );
};
