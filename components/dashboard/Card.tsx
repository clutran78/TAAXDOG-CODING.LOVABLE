import React from 'react';

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
}

export interface Goal {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  progress: number;
  dueDate: string;
  status: 'active' | 'completed' | 'paused';
}

export interface Metric {
  label: string;
  value: number | string;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: 'positive' | 'negative' | 'neutral';
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
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  size?: 'sm' | 'md' | 'lg';
}

// Loading skeleton component
const CardSkeleton: React.FC<{ lines?: number; size?: string }> = ({ lines = 3, size = 'md' }) => {
  const heightClass = size === 'sm' ? 'h-3' : size === 'lg' ? 'h-5' : 'h-4';

  return (
    <div className="animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`${heightClass} bg-gray-200 rounded mb-2 last:mb-0`}
          style={{ width: `${100 - i * 15}%` }}
        />
      ))}
    </div>
  );
};

// Error component
const CardError: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="text-center py-4">
    <div className="text-red-500 mb-2">
      <svg
        className="w-12 h-12 mx-auto"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
    <p className="text-sm text-gray-600 mb-3">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        Try Again
      </button>
    )}
  </div>
);

// Format currency helper
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

// Balance card content
const BalanceContent: React.FC<{ data: FinancialBalance }> = ({ data }) => (
  <div>
    <div className="text-2xl font-bold text-gray-900">
      {formatCurrency(data.amount, data.currency)}
    </div>
    {data.percentageChange !== undefined && (
      <div
        className={`text-sm mt-1 flex items-center ${
          data.trend === 'up'
            ? 'text-green-600'
            : data.trend === 'down'
              ? 'text-red-600'
              : 'text-gray-600'
        }`}
      >
        {data.trend === 'up' && <span className="mr-1">↑</span>}
        {data.trend === 'down' && <span className="mr-1">↓</span>}
        {formatPercentage(data.percentageChange)}
      </div>
    )}
    {data.lastUpdated && (
      <div className="text-xs text-gray-500 mt-2">
        Updated: {new Date(data.lastUpdated).toLocaleDateString('en-AU')}
      </div>
    )}
  </div>
);

// Transaction card content
const TransactionContent: React.FC<{ data: Transaction }> = ({ data }) => (
  <div className="flex items-center justify-between">
    <div className="flex-1">
      <div className="text-sm font-medium text-gray-900">{data.description}</div>
      <div className="text-xs text-gray-500">
        {data.merchant || data.category} • {new Date(data.date).toLocaleDateString('en-AU')}
      </div>
    </div>
    <div
      className={`text-lg font-semibold ${
        data.type === 'income' ? 'text-green-600' : 'text-red-600'
      }`}
    >
      {data.type === 'income' ? '+' : '-'}
      {formatCurrency(Math.abs(data.amount))}
    </div>
  </div>
);

// Goal card content
const GoalContent: React.FC<{ data: Goal }> = ({ data }) => (
  <div>
    <div className="flex justify-between items-start mb-2">
      <h4 className="font-medium text-gray-900">{data.name}</h4>
      <span
        className={`text-xs px-2 py-1 rounded-full ${
          data.status === 'completed'
            ? 'bg-green-100 text-green-800'
            : data.status === 'active'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
        }`}
      >
        {data.status}
      </span>
    </div>
    <div className="mb-3">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>
          {formatCurrency(data.currentAmount)} of {formatCurrency(data.targetAmount)}
        </span>
        <span>{data.progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            data.progress >= 100 ? 'bg-green-600' : 'bg-blue-600'
          }`}
          style={{ width: `${Math.min(data.progress, 100)}%` }}
        />
      </div>
    </div>
    <div className="text-xs text-gray-500">
      Due: {new Date(data.dueDate).toLocaleDateString('en-AU')}
    </div>
  </div>
);

// Metric card content
const MetricContent: React.FC<{ data: Metric }> = ({ data }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-600">{data.label}</p>
      <p className="text-2xl font-bold text-gray-900">{data.value}</p>
      {data.subValue && (
        <p
          className={`text-sm ${
            data.trend === 'positive'
              ? 'text-green-600'
              : data.trend === 'negative'
                ? 'text-red-600'
                : 'text-gray-600'
          }`}
        >
          {data.subValue}
        </p>
      )}
    </div>
    {data.icon && <div className="text-3xl text-gray-400">{data.icon}</div>}
  </div>
);

export function Card({
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
}: CardProps) {
  // Variant styles
  const variantStyles = {
    default: 'bg-white shadow',
    elevated: 'bg-white shadow-lg',
    outlined: 'bg-white border-2 border-gray-200',
    filled: 'bg-gray-50 border border-gray-200',
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

  return (
    <div className={`rounded-lg ${variantStyles[variant]} ${className}`}>
      {(title || subtitle || showRefresh || showActions) && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              {title && <h3 className="text-lg font-medium text-gray-900">{title}</h3>}
              {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
            </div>
            <div className="flex items-center space-x-2">
              {showRefresh && onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={cardData?.loading}
                >
                  <svg
                    className={`w-4 h-4 ${cardData?.loading ? 'animate-spin' : ''}`}
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
                  onClick={() => onAction('menu')}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
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
      <div className={paddingStyles[size]}>{renderCardContent()}</div>
      {footer && (
        <div className="px-6 py-3 bg-gray-50 rounded-b-lg border-t border-gray-200">{footer}</div>
      )}
    </div>
  );
}

export function CardContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

// Export utility components
export { CardSkeleton, CardError };

// Export helper functions
export { formatCurrency, formatPercentage };

export default Card;
