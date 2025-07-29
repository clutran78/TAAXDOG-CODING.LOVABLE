/** @type {import('tailwindcss').Config} */
module.exports = {
  // Next.js 15 optimized content paths with faster glob patterns
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    // Exclude test files and stories from production build
    '!./pages/**/*.test.{js,ts,jsx,tsx}',
    '!./components/**/*.test.{js,ts,jsx,tsx}',
    '!./components/**/*.stories.{js,ts,jsx,tsx}',
  ],
  // Use 'class' strategy for dark mode (Next.js 15 compatible)
  darkMode: 'class',
  theme: {
    extend: {
      // Finance-specific color system with CSS variables for better performance
      colors: {
        // Base gray scale using CSS custom properties for theme switching
        gray: {
          50: 'rgb(var(--color-gray-50, 249 250 251) / <alpha-value>)',
          100: 'rgb(var(--color-gray-100, 243 244 246) / <alpha-value>)',
          200: 'rgb(var(--color-gray-200, 229 231 235) / <alpha-value>)',
          300: 'rgb(var(--color-gray-300, 209 213 219) / <alpha-value>)',
          400: 'rgb(var(--color-gray-400, 156 163 175) / <alpha-value>)',
          500: 'rgb(var(--color-gray-500, 107 114 128) / <alpha-value>)',
          600: 'rgb(var(--color-gray-600, 75 85 99) / <alpha-value>)',
          700: 'rgb(var(--color-gray-700, 55 65 81) / <alpha-value>)',
          800: 'rgb(var(--color-gray-800, 31 41 55) / <alpha-value>)',
          900: 'rgb(var(--color-gray-900, 17 24 39) / <alpha-value>)',
        },
        // Primary brand colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          DEFAULT: '#3b82f6',
        },
        // Semantic colors for financial states
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          DEFAULT: '#22c55e',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          DEFAULT: '#ef4444',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          DEFAULT: '#f59e0b',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          DEFAULT: '#0ea5e9',
        },
        // Finance-specific colors for money display
        money: {
          positive: '#22c55e',
          negative: '#ef4444',
          neutral: '#6b7280',
        },
        // Tax-specific colors (Australian tax categories)
        tax: {
          income: '#3b82f6',
          deduction: '#22c55e',
          gst: '#a855f7',
          payg: '#f59e0b',
          super: '#06b6d4',
        },
        // Background colors for better contrast
        background: {
          DEFAULT: '#ffffff',
          secondary: '#f9fafb',
          tertiary: '#f3f4f6',
        },
        // Dark mode optimized colors
        dark: {
          DEFAULT: '#0f172a',
          secondary: '#1e293b',
          tertiary: '#334155',
          border: '#475569',
        },
      },
      // Optimized font stack for performance
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
        // Finance-specific number font for better readability
        number: [
          '"Roboto Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Monaco',
          'monospace',
        ],
      },
      // Extended font sizes for finance displays
      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '0.75rem' }],
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        // Finance-specific sizes
        'amount-sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.025em' }],
        'amount': ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '0.025em' }],
        'amount-lg': ['1.5rem', { lineHeight: '1.75rem', letterSpacing: '0.025em' }],
        'amount-xl': ['2rem', { lineHeight: '2.25rem', letterSpacing: '0.025em' }],
      },
      // Custom spacing for finance layouts
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '120': '30rem',
        '128': '32rem',
        '144': '36rem',
      },
      // Smooth animations for better UX
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-in',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-left': 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      // Optimized background images
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-shine': 'linear-gradient(110deg, transparent 40%, rgba(255, 255, 255, 0.1) 50%, transparent 60%)',
      },
      // Enhanced shadows for depth
      boxShadow: {
        'sm-up': '0 -1px 2px 0 rgb(0 0 0 / 0.05)',
        'md-up': '0 -4px 6px -1px rgb(0 0 0 / 0.1), 0 -2px 4px -2px rgb(0 0 0 / 0.1)',
        'inner-lg': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.06)',
        'glow': '0 0 20px -5px var(--tw-shadow-color)',
        'glow-lg': '0 0 40px -10px var(--tw-shadow-color)',
        // Finance card shadows
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      // Extended border radius
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      // Finance-specific min/max values
      minHeight: {
        'screen-nav': 'calc(100vh - 4rem)',
        'screen-footer': 'calc(100vh - 8rem)',
      },
      maxWidth: {
        'xxs': '16rem',
        'screen-2xl': '1440px',
        'screen-3xl': '1600px',
      },
      // Extended z-index for complex layouts
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
        '999': '999',
      },
      // Smooth transitions
      transitionDuration: {
        '0': '0ms',
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
        '1000': '1000ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-expo': 'cubic-bezier(0.7, 0, 0.84, 0)',
        'in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
      },
      // Finance-specific aspect ratios
      aspectRatio: {
        'card': '16 / 10',
        'invoice': '8.5 / 11',
        'receipt': '3 / 4',
      },
      // Responsive grid templates
      gridTemplateColumns: {
        'dashboard': 'repeat(auto-fit, minmax(280px, 1fr))',
        'cards': 'repeat(auto-fill, minmax(320px, 1fr))',
        'transactions': 'repeat(auto-fill, minmax(400px, 1fr))',
      },
      // Finance-specific widths
      width: {
        'receipt': '80mm',
        'invoice': '210mm',
      },
      // Screen breakpoints optimized for finance dashboards
      screens: {
        'xs': '475px',
        '3xl': '1920px',
        '4xl': '2560px',
      },
    },
  },
  // Optimized plugin configuration
  plugins: [
    // Forms plugin with class strategy for better control
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
    // Typography for rich text content
    require('@tailwindcss/typography'),
    // Container queries for responsive components
    require('@tailwindcss/container-queries'),
    // Custom finance utilities plugin
    function ({ addUtilities, addComponents, theme }) {
      // Finance-specific utilities
      const financeUtilities = {
        // Text balance for better readability
        '.text-balance': {
          'text-wrap': 'balance',
        },
        // Scrollbar utilities
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': `${theme('colors.gray.400')} transparent`,
        },
        '.scrollbar-none': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        // Gradient text effect
        '.gradient-text': {
          'background-image': 'linear-gradient(to right, var(--tw-gradient-stops))',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          'color': 'transparent',
        },
        // Money display utilities
        '.amount-positive': {
          color: theme('colors.money.positive'),
          fontWeight: theme('fontWeight.semibold'),
          fontFamily: theme('fontFamily.number').join(', '),
        },
        '.amount-negative': {
          color: theme('colors.money.negative'),
          fontWeight: theme('fontWeight.semibold'),
          fontFamily: theme('fontFamily.number').join(', '),
          '&::before': {
            content: '"-"',
          },
        },
        '.amount-neutral': {
          color: theme('colors.money.neutral'),
          fontWeight: theme('fontWeight.medium'),
          fontFamily: theme('fontFamily.number').join(', '),
        },
        // Currency formatting
        '.currency-aud::before': {
          content: '"$"',
          marginRight: '0.125rem',
        },
        '.currency-aud::after': {
          content: '" AUD"',
          marginLeft: '0.25rem',
          fontSize: '0.875em',
          opacity: '0.7',
        },
        // Tax category badges
        '.tax-income': {
          backgroundColor: theme('colors.tax.income') + '20',
          color: theme('colors.tax.income'),
          borderColor: theme('colors.tax.income') + '50',
        },
        '.tax-deduction': {
          backgroundColor: theme('colors.tax.deduction') + '20',
          color: theme('colors.tax.deduction'),
          borderColor: theme('colors.tax.deduction') + '50',
        },
        '.tax-gst': {
          backgroundColor: theme('colors.tax.gst') + '20',
          color: theme('colors.tax.gst'),
          borderColor: theme('colors.tax.gst') + '50',
        },
        // Print utilities
        '.print-exact': {
          '-webkit-print-color-adjust': 'exact',
          'print-color-adjust': 'exact',
        },
        // Loading skeleton
        '.skeleton': {
          backgroundColor: theme('colors.gray.200'),
          backgroundImage: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent)',
          backgroundSize: '200% 100%',
          backgroundRepeat: 'no-repeat',
          animation: 'skeleton-loading 1.5s infinite ease-in-out',
        },
        // Safe area utilities for mobile
        '.safe-top': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.safe-bottom': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.safe-left': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.safe-right': {
          paddingRight: 'env(safe-area-inset-right)',
        },
      };
      
      // Finance-specific components
      const financeComponents = {
        // Receipt paper style
        '.receipt-paper': {
          backgroundColor: '#fafaf9',
          backgroundImage: 'repeating-linear-gradient(0deg, #f0f0f0, #f0f0f0 1px, transparent 1px, transparent 20px)',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          padding: theme('spacing.6'),
          fontFamily: theme('fontFamily.mono').join(', '),
        },
        // Dashboard card
        '.dashboard-card': {
          backgroundColor: theme('colors.white'),
          borderRadius: theme('borderRadius.xl'),
          boxShadow: theme('boxShadow.card'),
          padding: theme('spacing.6'),
          transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            boxShadow: theme('boxShadow.card-hover'),
            transform: 'translateY(-2px)',
          },
          '.dark &': {
            backgroundColor: theme('colors.dark.secondary'),
            borderColor: theme('colors.dark.border'),
          },
        },
        // Status indicator
        '.status-indicator': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme('spacing.2'),
          fontSize: theme('fontSize.sm')[0],
          fontWeight: theme('fontWeight.medium'),
          padding: `${theme('spacing.1')} ${theme('spacing.3')}`,
          borderRadius: theme('borderRadius.full'),
          '&::before': {
            content: '""',
            display: 'block',
            width: theme('spacing.2'),
            height: theme('spacing.2'),
            borderRadius: theme('borderRadius.full'),
            backgroundColor: 'currentColor',
          },
        },
      };
      
      // Add keyframes for skeleton loading
      addUtilities({
        '@keyframes skeleton-loading': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        ...financeUtilities,
      }, ['responsive', 'hover', 'focus', 'dark']);
      
      addComponents(financeComponents);
    },
  ],
  // Next.js 15 specific optimizations
  future: {
    hoverOnlyWhenSupported: true,
  },
  // Disable preflight for better performance (we control our base styles)
  corePlugins: {
    preflight: true, // Keep enabled for consistent styling
  },
  // Enable experimental features for better performance
  experimental: {
    optimizeUniversalDefaults: true,
  },
};