/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.css',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: {
          50: 'rgb(249 250 251)',
          100: 'rgb(243 244 246)',
          200: 'rgb(229 231 235)',
          300: 'rgb(209 213 219)',
          400: 'rgb(156 163 175)',
          500: 'rgb(107 114 128)',
          600: 'rgb(75 85 99)',
          700: 'rgb(55 65 81)',
          800: 'rgb(31 41 55)',
          900: 'rgb(17 24 39)',
        },
        primary: {
          50: 'rgb(239 246 255)',
          100: 'rgb(219 234 254)',
          200: 'rgb(191 219 254)',
          300: 'rgb(147 197 253)',
          400: 'rgb(96 165 250)',
          500: 'rgb(59 130 246)',
          600: 'rgb(37 99 235)',
          700: 'rgb(29 78 216)',
          800: 'rgb(30 64 175)',
          900: 'rgb(30 58 138)',
        },
        success: {
          50: 'rgb(240 253 244)',
          100: 'rgb(220 252 231)',
          200: 'rgb(187 247 208)',
          300: 'rgb(134 239 172)',
          400: 'rgb(74 222 128)',
          500: 'rgb(34 197 94)',
          600: 'rgb(22 163 74)',
          700: 'rgb(21 128 61)',
          800: 'rgb(22 101 52)',
          900: 'rgb(20 83 45)',
        },
        danger: {
          50: 'rgb(254 242 242)',
          100: 'rgb(254 226 226)',
          200: 'rgb(254 202 202)',
          300: 'rgb(252 165 165)',
          400: 'rgb(248 113 113)',
          500: 'rgb(239 68 68)',
          600: 'rgb(220 38 38)',
          700: 'rgb(185 28 28)',
          800: 'rgb(153 27 27)',
          900: 'rgb(127 29 29)',
        },
        warning: {
          50: 'rgb(255 251 235)',
          100: 'rgb(254 243 199)',
          200: 'rgb(253 230 138)',
          300: 'rgb(252 211 77)',
          400: 'rgb(251 191 36)',
          500: 'rgb(245 158 11)',
          600: 'rgb(217 119 6)',
          700: 'rgb(180 83 9)',
          800: 'rgb(146 64 14)',
          900: 'rgb(120 53 15)',
        },
        info: {
          50: 'rgb(240 249 255)',
          100: 'rgb(224 242 254)',
          200: 'rgb(186 230 253)',
          300: 'rgb(125 211 252)',
          400: 'rgb(56 189 248)',
          500: 'rgb(14 165 233)',
          600: 'rgb(2 132 199)',
          700: 'rgb(3 105 161)',
          800: 'rgb(7 89 133)',
          900: 'rgb(12 74 110)',
        },
        // Finance-specific colors
        money: {
          green: 'rgb(34 197 94)',
          red: 'rgb(239 68 68)',
        },
        // Dark mode specific
        dark: {
          bg: {
            primary: 'rgb(17 24 39)',
            secondary: 'rgb(31 41 55)',
            tertiary: 'rgb(55 65 81)',
          },
          text: {
            primary: 'rgb(243 244 246)',
            secondary: 'rgb(209 213 219)',
            tertiary: 'rgb(156 163 175)',
          },
          border: 'rgb(55 65 81)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['Fira Code', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      fontSize: {
        xxs: '0.625rem',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        120: '30rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideUp: {
          from: { transform: 'translateY(10px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
        slideDown: {
          from: { transform: 'translateY(-10px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'sm-up': '0 -1px 2px 0 rgba(0, 0, 0, 0.05)',
        'inner-lg': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      minHeight: {
        'screen-nav': 'calc(100vh - 4rem)',
      },
      maxWidth: {
        xxs: '16rem',
        'screen-2xl': '1440px',
      },
      zIndex: {
        60: '60',
        70: '70',
        80: '80',
        90: '90',
        100: '100',
      },
      transitionDuration: {
        0: '0ms',
        400: '400ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      // Custom utilities for finance app
      aspectRatio: {
        card: '16 / 9',
        square: '1 / 1',
      },
      gridTemplateColumns: {
        dashboard: 'repeat(auto-fit, minmax(280px, 1fr))',
        cards: 'repeat(auto-fill, minmax(320px, 1fr))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    // Custom plugin for finance-specific utilities
    function ({ addUtilities, theme }) {
      const newUtilities = {
        '.text-balance': {
          'text-wrap': 'balance',
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
        },
        '.scrollbar-none': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.gradient-text': {
          background: 'linear-gradient(to right, var(--tw-gradient-stops))',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          color: 'transparent',
        },
        '.amount-positive': {
          color: theme('colors.success.600'),
          fontWeight: theme('fontWeight.medium'),
        },
        '.amount-negative': {
          color: theme('colors.danger.600'),
          fontWeight: theme('fontWeight.medium'),
        },
        '.dark .amount-positive': {
          color: theme('colors.success.400'),
        },
        '.dark .amount-negative': {
          color: theme('colors.danger.400'),
        },
      };
      addUtilities(newUtilities, ['responsive', 'hover']);
    },
  ],
};
