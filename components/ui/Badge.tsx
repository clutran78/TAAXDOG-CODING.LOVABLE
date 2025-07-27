import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'secondary';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
  icon?: React.ReactNode;
  onRemove?: () => void;
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/20 dark:text-sky-300',
  secondary: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const sizeStyles = {
  xs: 'px-2 py-0.5 text-xs',
  sm: 'px-2.5 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-sm',
};

const roundedStyles = {
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  rounded = 'full',
  className = '',
  icon,
  onRemove,
}) => {
  return (
    <span
      className={`
        inline-flex items-center font-medium
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${roundedStyles[rounded]}
        ${className}
      `}
    >
      {icon && <span className="mr-1 -ml-0.5">{icon}</span>}
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 -mr-0.5 inline-flex items-center justify-center rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none"
          type="button"
          aria-label="Remove"
        >
          <svg
            className="h-3 w-3"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </span>
  );
};

// Status badge with dot indicator
export interface StatusBadgeProps extends Omit<BadgeProps, 'icon'> {
  status?: 'online' | 'offline' | 'busy' | 'away';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'online',
  children,
  ...props
}) => {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-amber-500',
  };

  const statusIcon = (
    <span className="relative flex h-2 w-2">
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusColors[status]} opacity-75`}
      ></span>
      <span className={`relative inline-flex rounded-full h-2 w-2 ${statusColors[status]}`}></span>
    </span>
  );

  return (
    <Badge
      icon={statusIcon}
      {...props}
    >
      {children}
    </Badge>
  );
};

// Count badge
export interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: BadgeProps['variant'];
  size?: BadgeProps['size'];
  className?: string;
}

export const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  max = 99,
  variant = 'primary',
  size = 'sm',
  className = '',
}) => {
  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <Badge
      variant={variant}
      size={size}
      rounded="full"
      className={`min-w-[1.25rem] text-center ${className}`}
    >
      {displayCount}
    </Badge>
  );
};

export default Badge;
