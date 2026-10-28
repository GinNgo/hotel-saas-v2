/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        indochine: {
          50: '#f0fdf9',
          100: '#ccfbf1',
          200: '#99f6e4',
          500: '#14b8a6',
          700: '#0f766e',
          800: '#0f3d35',
          900: '#0D2E28',
          950: '#061b17',
          DEFAULT: '#0D2E28',
        },
        terracotta: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          500: '#f97316',
          600: '#ea580c',
          700: '#C05621',
          800: '#9a3412',
          DEFAULT: '#C05621',
        },
        linen: {
          50: '#fdfcfb',
          100: '#FBF9F5',
          200: '#F4EFE6',
          300: '#e8dfd3',
          DEFAULT: '#FBF9F5',
        },
        'warm-slate': {
          700: '#374151',
          800: '#2D3748',
          900: '#1a202c',
          DEFAULT: '#2D3748',
        },
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          DEFAULT: '#059669',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          DEFAULT: '#64748b',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          DEFAULT: '#d97706',
        }
      },
      boxShadow: {
        'luxury': '0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        'floating': '0 25px 50px -12px rgba(15, 23, 42, 0.15)',
        'card-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
      }
    },
  },
  plugins: [],
}
