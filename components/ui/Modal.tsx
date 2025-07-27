import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  className = '',
  footer,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Size classes with responsive behavior
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      // Store current active element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Add event listener
      document.addEventListener('keydown', handleEscape);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Focus modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';

      // Restore focus to previous element
      if (previousActiveElement.current && isOpen) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal positioning wrapper */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Modal panel */}
        <div
          ref={modalRef}
          className={`
            relative w-full ${sizeClasses[size]} 
            bg-white dark:bg-gray-800 
            rounded-t-xl sm:rounded-xl 
            shadow-xl transform transition-all
            max-h-[90vh] sm:max-h-[85vh] flex flex-col
            ${className}
          `}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 border-b border-gray-200 dark:border-gray-700">
              {title && (
                <h3
                  id="modal-title"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {title}
                </h3>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="ml-auto p-2 -m-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                  aria-label="Close modal"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="px-4 py-4 sm:px-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Portal render
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return null;
};

// Modal action buttons component
interface ModalActionsProps {
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelText?: string;
  confirmText?: string;
  confirmVariant?: 'primary' | 'danger' | 'success';
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const ModalActions: React.FC<ModalActionsProps> = ({
  onCancel,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  confirmVariant = 'primary',
  loading = false,
  className = '',
  children,
}) => {
  const confirmVariantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
  };

  if (children) {
    return <div className={`flex flex-col-reverse sm:flex-row gap-3 ${className}`}>{children}</div>;
  }

  return (
    <div className={`flex flex-col-reverse sm:flex-row gap-3 ${className}`}>
      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full sm:w-auto px-4 py-2 min-h-[44px] text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
        >
          {cancelText}
        </button>
      )}
      {onConfirm && (
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`
            w-full sm:w-auto px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg 
            focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors touch-manipulation
            disabled:opacity-50 disabled:cursor-not-allowed
            ${confirmVariantClasses[confirmVariant]}
          `}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
              Loading...
            </span>
          ) : (
            confirmText
          )}
        </button>
      )}
    </div>
  );
};

// Responsive sheet/drawer variant for mobile
interface SheetProps extends Omit<ModalProps, 'size'> {
  position?: 'bottom' | 'right';
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = 'bottom',
  closeOnOverlayClick = true,
  showCloseButton = true,
  className = '',
  footer,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionClasses = {
    bottom: 'inset-x-0 bottom-0 rounded-t-xl max-h-[90vh]',
    right: 'inset-y-0 right-0 rounded-l-xl w-full max-w-md',
  };

  const sheetContent = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="sheet-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        ref={sheetRef}
        className={`
          fixed ${positionClasses[position]}
          bg-white dark:bg-gray-800 
          shadow-xl transform transition-transform
          flex flex-col
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle for bottom sheet */}
        {position === 'bottom' && (
          <div className="flex justify-center py-2">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 border-b border-gray-200 dark:border-gray-700">
            {title && (
              <h3
                id="sheet-title"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="ml-auto p-2 -m-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                aria-label="Close sheet"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-4 sm:px-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof window !== 'undefined') {
    return createPortal(sheetContent, document.body);
  }

  return null;
};

export default Modal;
