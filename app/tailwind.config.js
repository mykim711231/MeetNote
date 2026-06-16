/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--rgb-bg) / <alpha-value>)',
        surface: 'rgb(var(--rgb-surface) / <alpha-value>)',
        fg: 'rgb(var(--rgb-text) / <alpha-value>)',
        muted: 'rgb(var(--rgb-text-muted) / <alpha-value>)',
        primary: 'rgb(var(--rgb-primary) / <alpha-value>)',
        accent: 'rgb(var(--rgb-accent) / <alpha-value>)',
        divider: 'rgb(var(--rgb-divider) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
