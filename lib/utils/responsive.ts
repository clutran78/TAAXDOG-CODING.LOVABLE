/**
 * Responsive design utilities
 */

// Breakpoint values (matching Tailwind)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Touch target minimum size (WCAG AA standard)
export const TOUCH_TARGET_SIZE = 44;

// Font size minimums for readability
export const MIN_FONT_SIZES = {
  mobile: {
    body: 16,
    small: 14,
    heading: 20,
  },
  desktop: {
    body: 16,
    small: 14,
    heading: 24,
  },
} as const;

// Safe area padding for mobile devices
export const SAFE_AREA_PADDING = {
  top: 'env(safe-area-inset-top)',
  right: 'env(safe-area-inset-right)',
  bottom: 'env(safe-area-inset-bottom)',
  left: 'env(safe-area-inset-left)',
};

// Viewport utilities
export const isSmallScreen = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < BREAKPOINTS.md;
};

export const isMediumScreen = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= BREAKPOINTS.md && window.innerWidth < BREAKPOINTS.lg;
};

export const isLargeScreen = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= BREAKPOINTS.lg;
};

export const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Responsive table helper
export const getTableLayout = () => {
  if (isSmallScreen()) return 'stacked';
  if (isMediumScreen()) return 'compact';
  return 'full';
};

// Responsive grid columns
export const getGridColumns = (base: number = 12) => {
  if (isSmallScreen()) return 1;
  if (isMediumScreen()) return Math.floor(base / 2);
  return base;
};

// Touch-friendly classes
export const TOUCH_CLASSES = {
  button: 'min-h-[44px] min-w-[44px] touch-manipulation',
  link: 'inline-flex items-center min-h-[44px] touch-manipulation',
  input: 'min-h-[44px] touch-manipulation',
  clickable: 'cursor-pointer touch-manipulation active:scale-95 transition-transform',
};

// Responsive padding classes
export const RESPONSIVE_PADDING = {
  page: 'px-4 sm:px-6 lg:px-8',
  section: 'py-6 sm:py-8 lg:py-12',
  card: 'p-4 sm:p-6',
  compact: 'p-3 sm:p-4',
};

// Responsive text classes
export const RESPONSIVE_TEXT = {
  // Headings
  h1: 'text-2xl sm:text-3xl lg:text-4xl font-bold',
  h2: 'text-xl sm:text-2xl lg:text-3xl font-semibold',
  h3: 'text-lg sm:text-xl lg:text-2xl font-semibold',
  h4: 'text-base sm:text-lg lg:text-xl font-medium',

  // Body text
  body: 'text-base', // 16px minimum for readability
  small: 'text-sm sm:text-sm', // 14px minimum on mobile
  xs: 'text-xs sm:text-xs', // Use sparingly

  // Special
  lead: 'text-lg sm:text-xl',
  caption: 'text-sm text-gray-600 dark:text-gray-400',
};

// Responsive spacing classes
export const RESPONSIVE_SPACING = {
  gap: {
    xs: 'gap-2 sm:gap-3',
    sm: 'gap-3 sm:gap-4',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
    xl: 'gap-8 sm:gap-12',
  },
  margin: {
    section: 'mb-6 sm:mb-8 lg:mb-12',
    element: 'mb-4 sm:mb-6',
    compact: 'mb-2 sm:mb-3',
  },
};

// Container width classes
export const CONTAINER_CLASSES = {
  narrow: 'max-w-4xl mx-auto',
  default: 'max-w-6xl mx-auto',
  wide: 'max-w-7xl mx-auto',
  full: 'w-full',
};

// Hide/show utilities
export const VISIBILITY = {
  mobile: {
    hide: 'hidden sm:block',
    show: 'block sm:hidden',
  },
  tablet: {
    hide: 'hidden md:block',
    show: 'block md:hidden',
  },
  desktop: {
    hide: 'hidden lg:block',
    show: 'block lg:hidden',
  },
};

// Responsive table utilities
export const RESPONSIVE_TABLE = {
  wrapper: 'overflow-x-auto -mx-4 sm:mx-0',
  table: 'min-w-full divide-y divide-gray-200 dark:divide-gray-700',
  mobileCard: 'block sm:hidden space-y-4',
  desktopTable: 'hidden sm:block',
};

// Media query hooks helper
export const useMediaQuery = (query: string): boolean => {
  if (typeof window === 'undefined') return false;

  const [matches, setMatches] = React.useState(() => window.matchMedia(query).matches);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
};

// Responsive hook
export const useResponsive = () => {
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.sm - 1}px)`);
  const isTablet = useMediaQuery(
    `(min-width: ${BREAKPOINTS.sm}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  );
  const isDesktop = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice: isTouchDevice(),
    breakpoint: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
  };
};

// Import React for hooks
import React from 'react';
