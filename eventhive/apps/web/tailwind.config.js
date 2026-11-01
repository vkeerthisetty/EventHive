/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          dark: '#4338CA',
          light: '#6366F1',
        },
        accent: '#F59E0B',
        success: '#16A34A',
        danger: '#DC2626',
        warning: '#D97706',
        info: '#2563EB',
        cat: {
          technical: '#2563EB',
          cultural: '#D946EF',
          sports: '#16A34A',
          workshop: '#D97706',
          seminar: '#4F46E5',
          hackathon: '#9333EA',
          social: '#EC4899',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
      },
      minHeight: {
        'tap': '44px',
      },
      minWidth: {
        'tap': '44px',
      },
    },
  },
  plugins: [],
};
