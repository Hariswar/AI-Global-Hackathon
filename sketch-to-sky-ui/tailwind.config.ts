import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'sky-gradient': 'linear-gradient(135deg, #f3f4ff 0%, #e0f2ff 35%, #f0f9ff 100%)',
      },
      colors: {
        sky: {
          50: '#f0f9ff',
          100: '#dff3ff',
          200: '#b9e7ff',
          300: '#86d6ff',
          400: '#4bbefb',
          500: '#1aa1e8',
          600: '#0d7ebb',
          700: '#0e6698',
          800: '#125379',
          900: '#134765',
        },
      },
      boxShadow: {
        floating: '0 40px 80px -50px rgba(7, 57, 104, 0.45)',
      },
    },
  },
  plugins: [],
} satisfies Config

