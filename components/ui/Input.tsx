import React, { useState, forwardRef } from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string | boolean;
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      size = 'md',
      leftIcon,
      rightIcon,
      onRightIconClick,
      fullWidth = true,
      className = '',
      id,
      required,
      ...props
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-2.5 text-base',
    };

    const iconSizeStyles = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;

    const inputId = id || props.name;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className={`text-gray-400 ${iconSizeStyles[size]}`}>{leftIcon}</span>
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={`
              block w-full rounded-lg border shadow-sm
              transition-all duration-200
              ${sizeStyles[size]}
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${
                hasError
                  ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:text-red-400'
                  : isFocused
                    ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50 dark:border-blue-400 dark:ring-blue-400'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 dark:border-gray-600 dark:focus:border-blue-400 dark:focus:ring-blue-400'
              }
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-75 dark:disabled:bg-gray-900
            `}
            required={required}
            aria-invalid={hasError}
            aria-describedby={
              [errorMessage && `${inputId}-error`, hint && `${inputId}-hint`]
                .filter(Boolean)
                .join(' ') || undefined
            }
            {...props}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {onRightIconClick ? (
                <button
                  type="button"
                  onClick={onRightIconClick}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                >
                  <span className={iconSizeStyles[size]}>{rightIcon}</span>
                </button>
              ) : (
                <span className={`text-gray-400 pointer-events-none ${iconSizeStyles[size]}`}>
                  {rightIcon}
                </span>
              )}
            </div>
          )}
        </div>

        {errorMessage && (
          <p
            className="mt-1 text-sm text-red-600 dark:text-red-400"
            id={`${inputId}-error`}
          >
            {errorMessage}
          </p>
        )}

        {hint && !hasError && (
          <p
            className="mt-1 text-sm text-gray-500 dark:text-gray-400"
            id={`${inputId}-hint`}
          >
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

// Textarea component using similar styling
export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string;
  error?: string | boolean;
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, error, hint, size = 'md', fullWidth = true, className = '', id, required, ...props },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-2.5 text-base',
    };

    const hasError = Boolean(error);
    const errorMessage = typeof error === 'string' ? error : undefined;
    const inputId = id || props.name;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            block w-full rounded-lg border shadow-sm
            transition-all duration-200 resize-none
            ${sizeStyles[size]}
            ${
              hasError
                ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:text-red-400'
                : isFocused
                  ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50 dark:border-blue-400 dark:ring-blue-400'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 dark:border-gray-600 dark:focus:border-blue-400 dark:focus:ring-blue-400'
            }
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-75 dark:disabled:bg-gray-900
          `}
          required={required}
          aria-invalid={hasError}
          aria-describedby={
            [errorMessage && `${inputId}-error`, hint && `${inputId}-hint`]
              .filter(Boolean)
              .join(' ') || undefined
          }
          {...props}
        />

        {errorMessage && (
          <p
            className="mt-1 text-sm text-red-600 dark:text-red-400"
            id={`${inputId}-error`}
          >
            {errorMessage}
          </p>
        )}

        {hint && !hasError && (
          <p
            className="mt-1 text-sm text-gray-500 dark:text-gray-400"
            id={`${inputId}-hint`}
          >
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

export default Input;
