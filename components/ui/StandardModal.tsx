'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface StandardModalProps {
  // Required props
  isOpen: boolean;
  title: string;

  // Optional props
  size?: 'small' | 'medium' | 'large';
  showCloseButton?: boolean;
  preventOutsideClick?: boolean;
  className?: string;

  // Callbacks
  onClose: () => void;
  onAfterOpen?: () => void;
  onAfterClose?: () => void;

  // Content
  children: React.ReactNode;
  footer?: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

const StandardModal: React.FC<StandardModalProps> = ({
  isOpen,
  title,
  size = 'medium',
  showCloseButton = true,
  preventOutsideClick = false,
  className = '',
  onClose,
  onAfterOpen,
  onAfterClose,
  children,
  footer,
}) => {
  // ========================================
  // REFS
  // ========================================

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ========================================
  // COMPUTED VALUES
  // ========================================

  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-lg',
    large: 'max-w-2xl',
  };

  // ========================================
  // EFFECTS
  // ========================================

  // Handle focus management
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the modal
      if (modalRef.current) {
        modalRef.current.focus();
      }

      // Call after open callback
      onAfterOpen?.();

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Restore focus to the previous element
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus();
      }

      // Restore body scroll
      document.body.style.overflow = '';

      // Call after close callback
      onAfterClose?.();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, onAfterOpen, onAfterClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // ========================================
  // EVENT HANDLERS
  // ========================================

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!preventOutsideClick && event.target === event.currentTarget) {
        onClose();
      }
    },
    [preventOutsideClick, onClose],
  );

  const handleCloseClick = useCallback(() => {
    onClose();
  }, [onClose]);

  // ========================================
  // RENDER HELPERS
  // ========================================

  const renderCloseButton = () => {
    if (!showCloseButton) return null;

    return (
      <button
        type="button"
        onClick={handleCloseClick}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-lg p-1"
        aria-label="Close modal"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    );
  };

  const renderHeader = () => (
    <div className="bg-white px-6 py-4 border-b border-gray-200">
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {renderCloseButton()}
    </div>
  );

  const renderBody = () => (
    <div className="bg-white px-6 py-4 overflow-y-auto max-h-[60vh]">{children}</div>
  );

  const renderFooter = () => {
    if (!footer) return null;

    return <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">{footer}</div>;
  };

  // ========================================
  // MAIN RENDER
  // ========================================

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0"
        onClick={handleBackdropClick}
      >
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
        />

        {/* Modal panel */}
        <div
          ref={modalRef}
          tabIndex={-1}
          className={`
            inline-block align-bottom bg-white rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle w-full
            ${sizeClasses[size]}
            ${className}
          `}
        >
          {renderHeader()}
          {renderBody()}
          {renderFooter()}
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document root
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return null;
};

export default StandardModal;
