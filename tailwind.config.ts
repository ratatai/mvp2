import type { Config } from 'tailwindcss';

/**
 * Brand tokens are taken from the live RATATAI site (ratatai-site/css/style.css)
 * so that the marketplace is visually part of the same brand.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0b',
          alt: '#101114',
        },
        card: {
          DEFAULT: '#15171c',
          hover: '#1b1e25',
        },
        line: {
          DEFAULT: '#262a32',
          strong: '#39404b',
        },
        ink: {
          DEFAULT: '#f2f3f5',
          muted: '#9aa0aa',
          faint: '#6b7280',
        },
        brand: {
          DEFAULT: '#e11d2a',
          dark: '#c4151f',
        },
        success: '#1faa55',
        warning: '#ffc11e',
      },
      boxShadow: {
        card: '0 10px 40px rgba(0, 0, 0, 0.45)',
        brand: '0 8px 24px rgba(225, 29, 42, 0.35)',
      },
      borderRadius: {
        brand: '16px',
        'brand-lg': '22px',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'sans-serif'],
      },
      maxWidth: {
        shell: '1200px',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};

export default config;
