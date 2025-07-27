/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

// Keyboard navigation keys
export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

// Screen reader only text utility
export const srOnly = 'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0';

// Focus visible styles
export const focusRing = 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';

// Generate unique IDs for ARIA relationships
export const generateId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).substr(2, 9)}`;

// Announce to screen readers
export const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = srOnly;
  announcement.textContent = message;

  document.body.appendChild(announcement);
  setTimeout(() => document.body.removeChild(announcement), 1000);
};

// Trap focus within an element
export const trapFocus = (element: HTMLElement) => {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])',
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== KEYS.TAB) return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);
  return () => element.removeEventListener('keydown', handleKeyDown);
};

// Handle escape key to close modals/dropdowns
export const handleEscapeKey = (callback: () => void) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === KEYS.ESCAPE) {
      callback();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
};

// ARIA live region hook for React
export const useAriaLive = () => {
  const announcePolite = (message: string) => announce(message, 'polite');
  const announceAssertive = (message: string) => announce(message, 'assertive');

  return { announcePolite, announceAssertive };
};

import * as React from 'react';

// Keyboard navigation hook
export const useKeyboardNavigation = (
  items: any[],
  onSelect: (item: any, index: number) => void,
  options?: {
    horizontal?: boolean;
    wrap?: boolean;
    onEscape?: () => void;
  },
) => {
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const { horizontal = false, wrap = true, onEscape } = options || {};
      const lastIndex = items.length - 1;

      switch (e.key) {
        case KEYS.ARROW_DOWN:
        case horizontal ? KEYS.ARROW_RIGHT : null:
          e.preventDefault();
          setFocusedIndex((prev) => {
            if (prev === lastIndex) return wrap ? 0 : prev;
            return prev + 1;
          });
          break;

        case KEYS.ARROW_UP:
        case horizontal ? KEYS.ARROW_LEFT : null:
          e.preventDefault();
          setFocusedIndex((prev) => {
            if (prev <= 0) return wrap ? lastIndex : 0;
            return prev - 1;
          });
          break;

        case KEYS.HOME:
          e.preventDefault();
          setFocusedIndex(0);
          break;

        case KEYS.END:
          e.preventDefault();
          setFocusedIndex(lastIndex);
          break;

        case KEYS.ENTER:
        case KEYS.SPACE:
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex <= lastIndex) {
            onSelect(items[focusedIndex], focusedIndex);
          }
          break;

        case KEYS.ESCAPE:
          if (onEscape) {
            e.preventDefault();
            onEscape();
          }
          break;
      }
    },
    [items, focusedIndex, onSelect, options],
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    resetFocus: () => setFocusedIndex(-1),
  };
};

// Color contrast checker
export const hasGoodContrast = (foreground: string, background: string): boolean => {
  // Simple implementation - in production, use a proper color contrast library
  // This is a placeholder that always returns true
  return true;
};

// Focus management utilities
export const focusFirstElement = (container: HTMLElement) => {
  const focusable = container.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  focusable?.focus();
};

export const restoreFocus = (element: HTMLElement | null) => {
  if (element && element.focus) {
    element.focus();
  }
};

// ARIA attributes helper
export const ariaProps = {
  button: (
    label: string,
    options?: { pressed?: boolean; expanded?: boolean; controls?: string },
  ) => ({
    'aria-label': label,
    'aria-pressed': options?.pressed,
    'aria-expanded': options?.expanded,
    'aria-controls': options?.controls,
  }),

  input: (
    label: string,
    options?: { required?: boolean; invalid?: boolean; describedBy?: string },
  ) => ({
    'aria-label': label,
    'aria-required': options?.required,
    'aria-invalid': options?.invalid,
    'aria-describedby': options?.describedBy,
  }),

  region: (label: string, options?: { live?: 'polite' | 'assertive'; atomic?: boolean }) => ({
    'aria-label': label,
    'aria-live': options?.live,
    'aria-atomic': options?.atomic,
  }),

  modal: (label: string, options?: { describedBy?: string }) => ({
    role: 'dialog',
    'aria-modal': true,
    'aria-label': label,
    'aria-describedby': options?.describedBy,
  }),
};

// React hook for managing focus
export const useFocusManagement = (isOpen: boolean, containerRef: React.RefObject<HTMLElement>) => {
  const previousFocus = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      if (containerRef.current) {
        focusFirstElement(containerRef.current);
      }
    } else if (previousFocus.current) {
      restoreFocus(previousFocus.current);
      previousFocus.current = null;
    }
  }, [isOpen, containerRef]);

  return { previousFocus };
};
