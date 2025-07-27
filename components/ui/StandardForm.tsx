'use client';

import React, { useState, useCallback, useRef, FormEvent } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox';
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: (value: any) => string | null;
  defaultValue?: any;
}

interface StandardFormProps {
  fields: FormField[];
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  className?: string;
}

interface FormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

// ============================================================================
// COMPONENT
// ============================================================================

const StandardForm: React.FC<StandardFormProps> = ({
  fields,
  onSubmit,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  onCancel,
  className = '',
}) => {
  // ========================================
  // REFS
  // ========================================

  const formRef = useRef<HTMLFormElement>(null);

  // ========================================
  // STATE
  // ========================================

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formState, setFormState] = useState<FormState>(() => {
    const initialValues: Record<string, any> = {};
    const initialErrors: Record<string, string> = {};
    const initialTouched: Record<string, boolean> = {};

    fields.forEach((field) => {
      initialValues[field.name] = field.defaultValue || (field.type === 'checkbox' ? false : '');
      initialErrors[field.name] = '';
      initialTouched[field.name] = false;
    });

    return {
      values: initialValues,
      errors: initialErrors,
      touched: initialTouched,
    };
  });

  // ========================================
  // VALIDATION
  // ========================================

  const validateField = useCallback((field: FormField, value: any): string => {
    // Required validation
    if (field.required) {
      if (field.type === 'checkbox' && !value) {
        return `${field.label} is required`;
      }
      if (field.type !== 'checkbox' && !value) {
        return `${field.label} is required`;
      }
    }

    // Custom validation
    if (field.validation) {
      const error = field.validation(value);
      if (error) return error;
    }

    // Type-specific validation
    switch (field.type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value && !emailRegex.test(value)) {
          return 'Invalid email address';
        }
        break;

      case 'number':
        if (value && isNaN(value)) {
          return 'Must be a number';
        }
        break;
    }

    return '';
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    fields.forEach((field) => {
      const error = validateField(field, formState.values[field.name]);
      if (error) {
        newErrors[field.name] = error;
        isValid = false;
      }
    });

    setFormState((prev) => ({
      ...prev,
      errors: newErrors,
    }));

    return isValid;
  }, [fields, formState.values, validateField]);

  // ========================================
  // EVENT HANDLERS
  // ========================================

  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    setFormState((prev) => ({
      ...prev,
      values: {
        ...prev.values,
        [fieldName]: value,
      },
      errors: {
        ...prev.errors,
        [fieldName]: '', // Clear error on change
      },
    }));

    setSubmitError(null);
  }, []);

  const handleFieldBlur = useCallback(
    (fieldName: string) => {
      const field = fields.find((f) => f.name === fieldName);
      if (!field) return;

      const error = validateField(field, formState.values[fieldName]);

      setFormState((prev) => ({
        ...prev,
        touched: {
          ...prev.touched,
          [fieldName]: true,
        },
        errors: {
          ...prev.errors,
          [fieldName]: error,
        },
      }));
    },
    [fields, formState.values, validateField],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      // Mark all fields as touched
      const allTouched: Record<string, boolean> = {};
      fields.forEach((field) => {
        allTouched[field.name] = true;
      });

      setFormState((prev) => ({
        ...prev,
        touched: allTouched,
      }));

      // Validate form
      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await onSubmit(formState.values);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsSubmitting(false);
      }
    },
    [fields, formState.values, validateForm, onSubmit],
  );

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  // ========================================
  // RENDER HELPERS
  // ========================================

  const renderField = (field: FormField) => {
    const value = formState.values[field.name];
    const error = formState.errors[field.name];
    const touched = formState.touched[field.name];
    const showError = touched && error;

    const commonProps = {
      id: field.name,
      name: field.name,
      disabled: isSubmitting,
      onBlur: () => handleFieldBlur(field.name),
      'aria-invalid': showError,
      'aria-describedby': showError ? `${field.name}-error` : undefined,
    };

    const inputClasses = `
      w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
      ${showError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
      ${isSubmitting ? 'bg-gray-100 cursor-not-allowed' : ''}
    `;

    switch (field.type) {
      case 'select':
        return (
          <select
            {...commonProps}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className={inputClasses}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            {...commonProps}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={inputClasses}
            rows={3}
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center">
            <input
              {...commonProps}
              type="checkbox"
              checked={value}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">{field.label}</span>
          </label>
        );

      default:
        return (
          <input
            {...commonProps}
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={inputClasses}
          />
        );
    }
  };

  const renderError = () => {
    if (!submitError) return null;

    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
        <p className="text-sm">{submitError}</p>
      </div>
    );
  };

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={`space-y-4 ${className}`}
      noValidate
    >
      {renderError()}

      {fields.map((field) => (
        <div key={field.name}>
          {field.type !== 'checkbox' && (
            <label
              htmlFor={field.name}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}

          {renderField(field)}

          {formState.touched[field.name] && formState.errors[field.name] && (
            <p
              id={`${field.name}-error`}
              className="mt-1 text-sm text-red-600"
            >
              {formState.errors[field.name]}
            </p>
          )}
        </div>
      ))}

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`
            px-4 py-2 rounded-md font-medium transition-colors
            ${
              isSubmitting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          {isSubmitting ? 'Submitting...' : submitLabel}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
};

export default StandardForm;
