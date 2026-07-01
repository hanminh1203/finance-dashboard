/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          DEFAULT: '#0B0B0D',
          surface: '#151517',
          raised: '#1C1C1F',
          border: '#2A2A2E',
        },
        accent: {
          DEFAULT: '#2563EB',
          hover: '#3B75F0',
          muted: '#1E3A6E',
        },
        income: '#22C55E',
        expense: '#F43F5E',
        neutral: '#A1A1AA',
        text: {
          primary: '#F4F4F5',
          secondary: '#A1A1AA',
          muted: '#71717A',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -8px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
