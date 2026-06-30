/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.css',
  ],
  theme: {
    extend: {
      colors: {
        base: 'rgb(var(--c-base)     / <alpha-value>)',
        surface: 'rgb(var(--c-surface)  / <alpha-value>)',
        elevated: 'rgb(var(--c-elevated) / <alpha-value>)',
        border: 'rgb(var(--c-border)   / <alpha-value>)',
        primary: 'rgb(var(--c-primary)  / <alpha-value>)',
        secondary: 'rgb(var(--c-secondary)/ <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--c-accent)       / <alpha-value>)',
          dim: 'rgb(var(--c-accent)       / 0.12)',
          hover: 'rgb(var(--c-accent-hover) / <alpha-value>)',
        },
        success: 'rgb(var(--c-success) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        danger: {
          DEFAULT: 'rgb(var(--c-danger) / <alpha-value>)',
          dim: 'rgb(var(--c-danger) / 0.12)',
        },
        solar: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 8px 0 rgba(0,0,0,0.06), 0 0 1px 0 rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgb(var(--c-accent) / 0.3)',
        glow: '0 0 20px rgb(var(--c-accent) / 0.25)',
      },
      keyframes: {
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.15s ease-out',
        'fade-in': 'fade-in  0.2s  ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
