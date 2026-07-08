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
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16,24,40,0.04), 0 6px 20px -4px rgba(16,24,40,0.06)',
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
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(350%)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.15s ease-out',
        'fade-in': 'fade-in  0.2s  ease-out',
        'progress-indeterminate': 'progress-indeterminate 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
