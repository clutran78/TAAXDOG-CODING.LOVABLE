import React from 'react';
import { responsivePadding } from '@/lib/utils/responsive';

interface BaseCardProps {
  children: React.ReactNode;
  className?: string;
}

interface CardProps extends BaseCardProps {
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  padding?: boolean;
  hover?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', variant = 'default', padding = false, hover = false }, ref) => {
    const variantStyles = {
      default: 'bg-white shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700',
      elevated: 'bg-white shadow-lg dark:bg-gray-800',
      outlined: 'bg-white border-2 border-gray-200 dark:bg-gray-800 dark:border-gray-700',
      filled: 'bg-gray-50 border border-gray-200 dark:bg-gray-900 dark:border-gray-700',
    };

    const hoverStyles = hover
      ? 'transition-shadow duration-200 hover:shadow-md dark:hover:shadow-lg'
      : '';

    return (
      <div
        ref={ref}
        className={`
          rounded-lg 
          ${variantStyles[variant]} 
          ${hoverStyles}
          ${padding ? responsivePadding.card : ''}
          ${className}
        `}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, BaseCardProps>(
  ({ children, className = '' }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-gray-700 ${className}`}
      >
        {children}
      </div>
    );
  },
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends BaseCardProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className = '', as: Component = 'h3' }, ref) => {
    return (
      <Component
        ref={ref}
        className={`text-lg font-semibold text-gray-900 dark:text-gray-100 ${className}`}
      >
        {children}
      </Component>
    );
  },
);

CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, BaseCardProps>(
  ({ children, className = '' }, ref) => {
    return (
      <p
        ref={ref}
        className={`mt-1 text-sm text-gray-500 dark:text-gray-400 ${className}`}
      >
        {children}
      </p>
    );
  },
);

CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, BaseCardProps>(
  ({ children, className = '' }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-4 py-3 sm:px-6 sm:py-4 ${className}`}
      >
        {children}
      </div>
    );
  },
);

CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, BaseCardProps>(
  ({ children, className = '' }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-4 py-3 sm:px-6 sm:py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 rounded-b-lg ${className}`}
      >
        {children}
      </div>
    );
  },
);

CardFooter.displayName = 'CardFooter';

// Compact card variant for lists
interface CompactCardProps extends BaseCardProps {
  onClick?: () => void;
  selected?: boolean;
}

export const CompactCard = React.forwardRef<HTMLDivElement, CompactCardProps>(
  ({ children, className = '', onClick, selected = false }, ref) => {
    const interactive = onClick
      ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 touch-manipulation active:scale-[0.98] transition-transform'
      : '';
    const selectedStyles = selected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : '';

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={`
          p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-lg
          transition-all duration-200
          ${interactive}
          ${selectedStyles}
          ${className}
        `}
      >
        {children}
      </div>
    );
  },
);

CompactCard.displayName = 'CompactCard';
