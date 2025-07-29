import React, { forwardRef, useState } from 'react';
import { clsx } from 'clsx';

// Type definitions for various financial data types
export interface FinancialBalance {
  amount: number;
  currency?: string;
  trend?: 'up' | 'down' | 'stable';
  percentageChange?: number;
  lastUpdated?: string;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  date: string;
  category?: string;
  type: 'income' | 'expense';
  merchant?: string;
  pending?: boolean;
}

export interface Goal {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  progress: number;
  dueDate: string;
  status: 'active' | 'completed' | 'paused';
  category?: string;
}

export interface Metric {
  label: string;
  value: number | string;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: 'positive' | 'negative' | 'neutral';
  trendValue?: number;
}

// Card data types
export type CardDataType = 'balance' | 'transaction' | 'goal' | 'metric' | 'custom';

export interface CardData {
  type: CardDataType;
  data?: FinancialBalance | Transaction | Goal | Metric | any;
  loading?: boolean;
  error?: string | null;
}

interface CardProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  padding?: boolean;
  footer?: React.ReactNode;

  // Dynamic data props
  cardData?: CardData;
  onRefresh?: () => void;
  onAction?: (action: string, data?: any) => void;

  // Display options
  showRefresh?: boolean;
  showActions?: boolean;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  
  // Interaction
  onClick?: () => void;
  hoverable?: boolean;
  disabled?: boolean;
  
  // Accessibility
  role?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  tabIndex?: number;
}

// Loading skeleton component with enhanced animations
const CardSkeleton: React.FC<{ lines?: number; size?: string }> = ({ lines = 3, size = 'md' }) => {
  const heightClass = size === 'sm' ? 'h-3' : size === 'lg' ? 'h-5' : 'h-4';

  return (
    <div className="animate-pulse" role="status" aria-label="Loading content">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            heightClass,
            'bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200',
            'rounded-md mb-2 last:mb-0',
            'animate-shimmer bg-[length:200%_100%]'
          )}
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
};

// Enhanced error component with better accessibility
const CardError: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="text-center py-6" role="alert" aria-live="polite">
    <div className="text-red-500 mb-3">
      <svg
        className="w-12 h-12 mx-auto"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className={clsx(
          'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
          'text-white bg-blue-600 hover:bg-blue-700',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
          'transform hover:scale-105 active:scale-95'
        )}
        aria-label="Retry loading"
      >
        Try Again
      </button>
    )}
  </div>
);

// Format currency helper with enhanced formatting
const formatCurrency = (amount: number, currency: string = 'AUD') => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format percentage helper
const formatPercentage = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

// Enhanced Balance card content with animations
const BalanceContent: React.FC<{ data: FinancialBalance }> = ({ data }) => (
  <div className="relative">
    <div className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums animate-fadeIn">
      {formatCurrency(data.amount, data.currency)}
    </div>
    {data.percentageChange !== undefined && (
      <div
        className={clsx(
          'text-sm mt-2 flex items-center font-medium',
          'transition-colors duration-200',
          {
            'text-green-600 dark:text-green-400': data.trend === 'up',
            'text-red-600 dark:text-red-400': data.trend === 'down',
            'text-gray-600 dark:text-gray-400': data.trend === 'stable',
          }
        )}
      >
        {data.trend === 'up' && (
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {data.trend === 'down' && (
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        <span className="tabular-nums">{formatPercentage(data.percentageChange)}</span>
      </div>
    )}
    {data.lastUpdated && (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 flex items-center">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        Updated: {new Date(data.lastUpdated).toLocaleDateString('en-AU')}
      </div>
    )}
  </div>
);

// Enhanced Transaction card content with hover effects
const TransactionContent: React.FC<{ data: Transaction }> = ({ data }) => (
  <div className="flex items-center justify-between group cursor-pointer p-2 -m-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200">
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
        {data.description}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
        <span className="truncate">{data.merchant || data.category}</span>
        <span className="mx-2">•</span>
        <span>{new Date(data.date).toLocaleDateString('en-AU')}</span>
        {data.pending && (
          <>
            <span className="mx-2">•</span>
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">Pending</span>
          </>
        )}
      </div>
    </div>
    <div
      className={clsx(
        'text-lg font-semibold tabular-nums ml-4',
        'transition-transform duration-200 group-hover:scale-105',
        {
          'text-green-600 dark:text-green-400': data.type === 'income',
          'text-red-600 dark:text-red-400': data.type === 'expense',
        }
      )}
    >
      {data.type === 'income' ? '+' : '-'}
      {formatCurrency(Math.abs(data.amount))}
    </div>
  </div>
);

// Enhanced Goal card content with better visual indicators
const GoalContent: React.FC<{ data: Goal }> = ({ data }) => {
  const isOverdue = new Date(data.dueDate) < new Date() && data.status !== 'completed';
  const daysLeft = Math.ceil((new Date(data.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-start">
        <h4 className="font-medium text-gray-900 dark:text-white flex-1 mr-2">{data.name}</h4>
        <span
          className={clsx(
            'text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center',
            'transition-all duration-200',
            {
              'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': data.status === 'completed',
              'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400': data.status === 'active',
              'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400': data.status === 'paused',
            }
          )}
        >
          {data.status === 'completed' && (
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {data.status}
        </span>
      </div>
      
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">
            {formatCurrency(data.currentAmount)} of {formatCurrency(data.targetAmount)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white tabular-nums">
            {data.progress}%
          </span>
        </div>
        
        <div className="relative">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500 ease-out',
                'bg-gradient-to-r',
                {
                  'from-green-500 to-green-600': data.progress >= 100,
                  'from-blue-500 to-blue-600': data.progress < 100 && !isOverdue,
                  'from-yellow-500 to-orange-600': isOverdue,
                }
              )}
              style={{ width: `${Math.min(data.progress, 100)}%` }}
              role="progressbar"
              aria-valuenow={data.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className={clsx(
          'flex items-center',
          isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'
        )}>
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z" clipRule="evenodd" />
          </svg>
          {isOverdue ? 'Overdue' : `${daysLeft} days left`}
        </span>
        {data.category && (
          <span className="text-gray-500 dark:text-gray-400">{data.category}</span>
        )}
      </div>
    </div>
  );
};

// Enhanced Metric card content with animations
const MetricContent: React.FC<{ data: Metric }> = ({ data }) => (
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
        {data.label}
      </p>
      <p className="text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white tabular-nums animate-fadeIn">
        {data.value}
      </p>
      {data.subValue && (
        <div
          className={clsx(
            'text-sm font-medium mt-2 flex items-center',
            {
              'text-green-600 dark:text-green-400': data.trend === 'positive',
              'text-red-600 dark:text-red-400': data.trend === 'negative',
              'text-gray-600 dark:text-gray-400': data.trend === 'neutral',
            }
          )}
        >
          {data.trend === 'positive' && (
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {data.trend === 'negative' && (
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          <span>{data.subValue}</span>
          {data.trendValue !== undefined && (
            <span className="ml-1 tabular-nums">({formatPercentage(data.trendValue)})</span>
          )}
        </div>
      )}
    </div>
    {data.icon && (
      <div className="text-4xl text-gray-300 dark:text-gray-600 ml-4 opacity-50">
        {data.icon}
      </div>
    )}
  </div>
);

// Main Card component with enhanced styling and accessibility
export const Card = forwardRef<HTMLDivElement, CardProps>(({
  title,
  subtitle,
  children,
  className = '',
  padding = true,
  footer,
  cardData,
  onRefresh,
  onAction,
  showRefresh = false,
  showActions = false,
  variant = 'default',
  size = 'md',
  onClick,
  hoverable = false,
  disabled = false,
  role,
  ariaLabel,
  ariaDescribedBy,
  tabIndex,
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Enhanced variant styles with gradients
  const variantStyles = {
    default: 'bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-900/10',
    elevated: 'bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/20',
    outlined: 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700',
    filled: 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
    gradient: 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-md',
  };

  // Size-based padding
  const paddingStyles = {
    sm: padding ? 'p-4' : '',
    md: padding ? 'p-6' : '',
    lg: padding ? 'p-8' : '',
  };

  // Render card content based on data type
  const renderCardContent = () => {
    if (!cardData) return children;

    if (cardData.loading) {
      return (
        <CardSkeleton
          lines={3}
          size={size}
        />
      );
    }

    if (cardData.error) {
      return (
        <CardError
          message={cardData.error}
          onRetry={onRefresh}
        />
      );
    }

    if (!cardData.data) return children;

    switch (cardData.type) {
      case 'balance':
        return <BalanceContent data={cardData.data as FinancialBalance} />;
      case 'transaction':
        return <TransactionContent data={cardData.data as Transaction} />;
      case 'goal':
        return <GoalContent data={cardData.data as Goal} />;
      case 'metric':
        return <MetricContent data={cardData.data as Metric} />;
      case 'custom':
      default:
        return children;
    }
  };

  const isClickable = onClick || hoverable;

  return (
    <div
      ref={ref}
      className={clsx(
        'rounded-xl transition-all duration-300',
        variantStyles[variant],
        {
          'hover:shadow-xl hover:-translate-y-0.5': hoverable && !disabled,
          'cursor-pointer': isClickable && !disabled,
          'opacity-50 cursor-not-allowed': disabled,
          'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900': isPressed && !disabled,
        },
        className
      )}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      role={role || (isClickable ? 'button' : undefined)}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : tabIndex ?? (isClickable ? 0 : undefined)}
    >
      {(title || subtitle || showRefresh || showActions) && (
        <div className={clsx(
          'px-6 py-4 border-b transition-colors duration-200',
          'border-gray-200 dark:border-gray-700',
          {
            'bg-gray-50/50 dark:bg-gray-800/50': isHovered && hoverable,
          }
        )}>
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              {title && (
                <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2 ml-4">
              {showRefresh && onRefresh && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                  className={clsx(
                    'p-2 rounded-md transition-all duration-200',
                    'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                  disabled={cardData?.loading || disabled}
                  aria-label="Refresh data"
                >
                  <svg
                    className={clsx('w-5 h-5', {
                      'animate-spin': cardData?.loading,
                    })}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              )}
              {showActions && onAction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction('menu');
                  }}
                  className={clsx(
                    'p-2 rounded-md transition-all duration-200',
                    'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800'
                  )}
                  disabled={disabled}
                  aria-label="More actions"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className={clsx(paddingStyles[size], 'relative')}>
        {renderCardContent()}
      </div>
      {footer && (
        <div className={clsx(
          'px-6 py-3 rounded-b-xl border-t transition-colors duration-200',
          'bg-gray-50 dark:bg-gray-900/50',
          'border-gray-200 dark:border-gray-700'
        )}>
          {footer}
        </div>
      )}
    </div>
  );
});

Card.displayName = 'Card';

export function CardContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={clsx('relative', className)}>{children}</div>;
}

// Export utility components
export { CardSkeleton, CardError };

// Export helper functions
export { formatCurrency, formatPercentage };

export default Card;
