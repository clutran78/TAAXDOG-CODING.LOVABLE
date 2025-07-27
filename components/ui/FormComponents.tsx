import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';

// Form Field Error Component
interface FieldErrorProps {
  error?: string | string[];
  className?: string;
}

export const FieldError: React.FC<FieldErrorProps> = ({ error, className = '' }) => {
  if (!error) return null;

  const errors = Array.isArray(error) ? error : [error];

  return (
    <div
      className={`mt-1 ${className}`}
      role="alert"
      aria-live="polite"
    >
      {errors.map((err, index) => (
        <p
          key={index}
          className="text-sm text-red-600 flex items-center"
        >
          <svg
            className="w-4 h-4 mr-1 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          {err}
        </p>
      ))}
    </div>
  );
};

// Form Input Component with Validation
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | string[];
  touched?: boolean;
  hint?: string;
  required?: boolean;
  showPasswordToggle?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  touched = false,
  hint,
  required = false,
  showPasswordToggle = false,
  className = '',
  type = 'text',
  onBlur,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasError = touched && error;
  const inputType = type === 'password' && showPassword ? 'text' : type;

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <div className={className}>
      <label
        htmlFor={props.id || props.name}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && (
          <span
            className="text-red-500 ml-1"
            aria-label="required"
          >
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type={inputType}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={[
            hasError && `${props.id || props.name}-error`,
            hint && `${props.id || props.name}-hint`,
          ]
            .filter(Boolean)
            .join(' ')}
          className={`
            w-full px-3 py-2 min-h-[44px] border rounded-lg focus:outline-none focus:ring-2 transition-colors touch-manipulation
            ${
              hasError
                ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                : isFocused
                  ? 'border-blue-500 focus:ring-blue-200'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
            }
            ${type === 'password' && showPasswordToggle ? 'pr-12' : ''}
          `}
          {...props}
        />

        {type === 'password' && showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded touch-manipulation"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
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
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              </svg>
            ) : (
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
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        )}
      </div>

      {hint && !hasError && (
        <p
          id={`${props.id || props.name}-hint`}
          className="mt-1 text-sm text-gray-500"
        >
          {hint}
        </p>
      )}

      {hasError && (
        <div
          id={`${props.id || props.name}-error`}
          className="animate-slideDown"
        >
          <FieldError error={error} />
        </div>
      )}
    </div>
  );
};

// Form Select Component
interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | string[];
  touched?: boolean;
  hint?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  error,
  touched = false,
  hint,
  required = false,
  options,
  className = '',
  ...props
}) => {
  const hasError = touched && error;

  return (
    <div className={className}>
      <label
        htmlFor={props.id || props.name}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && (
          <span
            className="text-red-500 ml-1"
            aria-label="required"
          >
            *
          </span>
        )}
      </label>

      <select
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={[
          hasError && `${props.id || props.name}-error`,
          hint && `${props.id || props.name}-hint`,
        ]
          .filter(Boolean)
          .join(' ')}
        className={`
          w-full px-3 py-2 min-h-[44px] border rounded-lg focus:outline-none focus:ring-2 transition-colors touch-manipulation
          ${
            hasError
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
          }
        `}
        {...props}
      >
        {props.placeholder && (
          <option
            value=""
            disabled
          >
            {props.placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      {hint && !hasError && (
        <p
          id={`${props.id || props.name}-hint`}
          className="mt-1 text-sm text-gray-500"
        >
          {hint}
        </p>
      )}

      {hasError && (
        <div
          id={`${props.id || props.name}-error`}
          className="animate-slideDown"
        >
          <FieldError error={error} />
        </div>
      )}
    </div>
  );
};

// Form Checkbox Component
interface FormCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string | React.ReactNode;
  error?: string | string[];
  touched?: boolean;
  hint?: string;
}

export const FormCheckbox: React.FC<FormCheckboxProps> = ({
  label,
  error,
  touched = false,
  hint,
  className = '',
  ...props
}) => {
  const hasError = touched && error;

  return (
    <div className={className}>
      <label className="flex items-start cursor-pointer touch-manipulation min-h-[44px] py-2">
        <input
          type="checkbox"
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={[
            hasError && `${props.id || props.name}-error`,
            hint && `${props.id || props.name}-hint`,
          ]
            .filter(Boolean)
            .join(' ')}
          className={`
            mt-0.5 h-5 w-5 rounded focus:outline-none focus:ring-2 transition-colors cursor-pointer
            ${hasError ? 'text-red-600 focus:ring-red-200' : 'text-blue-600 focus:ring-blue-200'}
          `}
          {...props}
        />
        <span className="ml-3 text-sm text-gray-700 select-none">{label}</span>
      </label>

      {hint && !hasError && (
        <p
          id={`${props.id || props.name}-hint`}
          className="mt-1 ml-6 text-sm text-gray-500"
        >
          {hint}
        </p>
      )}

      {hasError && (
        <div
          id={`${props.id || props.name}-error`}
          className="ml-6"
        >
          <FieldError error={error} />
        </div>
      )}
    </div>
  );
};

// Form Textarea Component
interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | string[];
  touched?: boolean;
  hint?: string;
  required?: boolean;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  error,
  touched = false,
  hint,
  required = false,
  className = '',
  ...props
}) => {
  const hasError = touched && error;

  return (
    <div className={className}>
      <label
        htmlFor={props.id || props.name}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && (
          <span
            className="text-red-500 ml-1"
            aria-label="required"
          >
            *
          </span>
        )}
      </label>

      <textarea
        aria-invalid={hasError ? 'true' : 'false'}
        aria-describedby={[
          hasError && `${props.id || props.name}-error`,
          hint && `${props.id || props.name}-hint`,
        ]
          .filter(Boolean)
          .join(' ')}
        className={`
          w-full px-3 py-2 min-h-[80px] border rounded-lg focus:outline-none focus:ring-2 transition-colors resize-y touch-manipulation
          ${
            hasError
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
          }
        `}
        {...props}
      />

      {hint && !hasError && (
        <p
          id={`${props.id || props.name}-hint`}
          className="mt-1 text-sm text-gray-500"
        >
          {hint}
        </p>
      )}

      {hasError && (
        <div
          id={`${props.id || props.name}-error`}
          className="animate-slideDown"
        >
          <FieldError error={error} />
        </div>
      )}
    </div>
  );
};

// Password Strength Indicator
interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password,
  showRequirements = true,
}) => {
  const requirements = [
    { test: (p: string) => p.length >= 8, text: 'At least 8 characters' },
    { test: (p: string) => /[A-Z]/.test(p), text: 'One uppercase letter' },
    { test: (p: string) => /[a-z]/.test(p), text: 'One lowercase letter' },
    { test: (p: string) => /[0-9]/.test(p), text: 'One number' },
    { test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p), text: 'One special character' },
  ];

  const passedRequirements = requirements.filter((req) => req.test(password)).length;
  const strength = passedRequirements / requirements.length;

  const getStrengthColor = () => {
    if (strength < 0.4) return 'bg-red-500';
    if (strength < 0.6) return 'bg-orange-500';
    if (strength < 0.8) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (strength < 0.4) return 'Weak';
    if (strength < 0.6) return 'Fair';
    if (strength < 0.8) return 'Good';
    return 'Strong';
  };

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">Password strength:</span>
        <span
          className={`text-xs font-medium ${strength === 1 ? 'text-green-600' : 'text-gray-600'}`}
        >
          {getStrengthText()}
        </span>
      </div>

      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getStrengthColor()}`}
          style={{ width: `${strength * 100}%` }}
        />
      </div>

      {showRequirements && (
        <ul
          className="mt-2 space-y-1"
          role="list"
          aria-label="Password requirements"
        >
          {requirements.map((req, index) => (
            <li
              key={index}
              className={`text-xs flex items-center ${
                req.test(password) ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              {req.test(password) ? (
                <svg
                  className="w-3 h-3 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3 h-3 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {req.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Form validation hook
export function useFormValidation<T>(schema: z.ZodSchema<T>, initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (name: string, value: any) => {
    try {
      const fieldSchema = (schema as any).shape[name];
      if (fieldSchema) {
        fieldSchema.parse(value);
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({
          ...prev,
          [name]: error.errors.map((e) => e.message),
        }));
      }
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setValues((prev) => ({ ...prev, [name]: newValue }));

    // Real-time validation for touched fields
    if (touched[name]) {
      validateField(name, newValue);
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const validateForm = (): boolean => {
    try {
      schema.parse(values);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!formattedErrors[path]) {
            formattedErrors[path] = [];
          }
          formattedErrors[path].push(err.message);
        });
        setErrors(formattedErrors);

        // Mark all fields as touched
        const allTouched: Record<string, boolean> = {};
        Object.keys(values as any).forEach((key) => {
          allTouched[key] = true;
        });
        setTouched(allTouched);
      }
      return false;
    }
  };

  const handleSubmit = (onSubmit: (values: T) => void | Promise<void>) => {
    return async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    };
  };

  const getFieldProps = (name: keyof T) => ({
    name: name as string,
    value: values[name] as any,
    onChange: handleChange,
    onBlur: handleBlur,
    error: errors[name as string],
    touched: touched[name as string],
  });

  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    validateForm,
    getFieldProps,
    resetForm,
    setFieldValue: (name: keyof T, value: any) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      if (touched[name as string]) {
        validateField(name as string, value);
      }
    },
    setFieldTouched: (name: keyof T, isTouched = true) => {
      setTouched((prev) => ({ ...prev, [name]: isTouched }));
    },
  };
}

// Form Success/Error Messages
interface FormMessageProps {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  onClose?: () => void;
  className?: string;
}

export const FormMessage: React.FC<FormMessageProps> = ({
  type,
  message,
  onClose,
  className = '',
}) => {
  const configs = {
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      icon: (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      icon: (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      icon: (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      icon: (
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };

  const config = configs[type];

  return (
    <div
      className={`${config.bgColor} ${config.borderColor} ${config.textColor} border rounded-lg p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">{config.icon}</div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`ml-3 p-2 -m-2 ${config.textColor} hover:opacity-75 hover:bg-black hover:bg-opacity-5 rounded touch-manipulation`}
            aria-label="Close message"
          >
            <svg
              className="w-5 h-5"
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
      </div>
    </div>
  );
};
