import React from 'react';
import Link from 'next/link';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  href?: string;
  external?: boolean;
  children: React.ReactNode;
}

const variantStyles = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700',
  secondary:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:active:bg-gray-600',
  success:
    'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 focus:ring-green-500 dark:bg-green-500 dark:hover:bg-green-600 dark:active:bg-green-700',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600 dark:active:bg-red-700',
  warning:
    'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 focus:ring-amber-500 dark:bg-amber-500 dark:hover:bg-amber-600 dark:active:bg-amber-700',
  ghost:
    'text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700',
  link: 'text-blue-600 hover:text-blue-700 active:text-blue-800 hover:underline focus:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300 dark:active:text-blue-200',
};

const sizeStyles = {
  xs: 'px-2.5 py-1.5 text-xs min-h-[32px]',
  sm: 'px-3 py-2 text-sm min-h-[36px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
  lg: 'px-4 py-2 text-base min-h-[44px]',
  xl: 'px-6 py-3 text-base min-h-[52px]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leftIcon,
      rightIcon,
      href,
      external = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center font-medium rounded-lg
      transition-all duration-200 transform
      hover:scale-[1.02] active:scale-[0.98]
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
      touch-manipulation select-none
      ${variant === 'link' ? '' : 'shadow-sm hover:shadow-md'}
      ${loading ? 'cursor-wait' : ''}
    `;

    const combinedClassName = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${fullWidth ? 'w-full' : ''}
      ${className}
    `.trim();

    const content = (
      <>
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
        )}
        {!loading && leftIcon && <span className="mr-2 -ml-1 flex items-center">{leftIcon}</span>}
        <span className="truncate">{children}</span>
        {!loading && rightIcon && <span className="ml-2 -mr-1 flex items-center">{rightIcon}</span>}
      </>
    );

    if (href) {
      if (external) {
        return (
          <a
            href={href}
            className={combinedClassName}
            target="_blank"
            rel="noopener noreferrer"
          >
            {content}
          </a>
        );
      }
      return (
        <Link
          href={href}
          className={combinedClassName}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        className={combinedClassName}
        disabled={disabled || loading}
        {...props}
      >
        {content}
      </button>
    );
  },
);

Button.displayName = 'Button';

// Convenience components
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { 'aria-label': string }
>(({ size = 'md', className = '', ...props }, ref) => {
  const iconSizeStyles = {
    xs: 'p-1 min-w-[32px] min-h-[32px]',
    sm: 'p-1.5 min-w-[36px] min-h-[36px]',
    md: 'p-2 min-w-[40px] min-h-[40px]',
    lg: 'p-2.5 min-w-[44px] min-h-[44px]',
    xl: 'p-3 min-w-[52px] min-h-[52px]',
  };

  return (
    <Button
      ref={ref}
      size={size}
      className={`${iconSizeStyles[size]} ${className}`}
      {...props}
    />
  );
});

IconButton.displayName = 'IconButton';

export default Button;
