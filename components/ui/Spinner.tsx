import React from 'react';

export interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'gray' | 'current';
  className?: string;
}

const sizeStyles = {
  xs: 'h-3 w-3 border-2',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
  xl: 'h-12 w-12 border-4',
};

const colorStyles = {
  primary: 'border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400',
  white: 'border-gray-300/30 border-t-white',
  gray: 'border-gray-200 border-t-gray-600 dark:border-gray-700 dark:border-t-gray-400',
  current: 'border-current/20 border-t-current',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
}) => {
  return (
    <div
      className={`
        inline-block animate-spin rounded-full
        ${sizeStyles[size]}
        ${colorStyles[color]}
        ${className}
      `}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

// Loading overlay component
export interface LoadingOverlayProps {
  show: boolean;
  message?: string;
  fullScreen?: boolean;
  blur?: boolean;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  show,
  message = 'Loading...',
  fullScreen = false,
  blur = true,
  className = '',
}) => {
  if (!show) return null;

  return (
    <div
      className={`
        ${fullScreen ? 'fixed' : 'absolute'} 
        inset-0 z-50 flex items-center justify-center
        bg-black/50 
        ${blur ? 'backdrop-blur-sm' : ''}
        ${className}
      `}
    >
      <div className="text-center">
        <Spinner
          size="lg"
          color="white"
        />
        {message && <p className="mt-3 text-white font-medium">{message}</p>}
      </div>
    </div>
  );
};

// Loading button component
export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  spinnerSize?: SpinnerProps['size'];
  children: React.ReactNode;
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      loading = false,
      loadingText = 'Loading...',
      spinnerSize = 'sm',
      disabled,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={className}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center">
            <Spinner
              size={spinnerSize}
              color="current"
              className="mr-2"
            />
            {loadingText}
          </span>
        ) : (
          children
        )}
      </button>
    );
  },
);

LoadingButton.displayName = 'LoadingButton';

// Skeleton loader component
export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  className?: string;
  animation?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  animation = true,
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'circular' ? '40px' : '100%'),
    height: height || (variant === 'circular' ? '40px' : variant === 'text' ? '16px' : '120px'),
  };

  return (
    <div
      className={`
        bg-gray-200 dark:bg-gray-700
        ${animation ? 'animate-pulse' : ''}
        ${variantStyles[variant]}
        ${className}
      `}
      style={style}
    />
  );
};

// Loading dots animation
export const LoadingDots: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="animate-bounce animation-delay-0 h-1 w-1 bg-current rounded-full" />
      <span className="animate-bounce animation-delay-100 h-1 w-1 bg-current rounded-full" />
      <span className="animate-bounce animation-delay-200 h-1 w-1 bg-current rounded-full" />
    </span>
  );
};

export default Spinner;
