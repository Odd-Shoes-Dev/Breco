/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Breco Safaris brand colors - Navy theme
        breco: {
          navy: '#1e3a5f',
          'navy-light': '#2a4a73',
          'navy-dark': '#152a45',
          'navy-darker': '#0d1e33',
          gold: '#d4a853',
          'gold-light': '#e4c078',
          'gold-dark': '#b8923f',
          teal: '#0d9488',
          'teal-light': '#14b8a6',
          'teal-dark': '#0a7068',
          safari: '#8b7355',
          'safari-light': '#a6896b',
          'safari-dark': '#6f5a42',
          gradient: {
            start: '#1e3a5f',
            mid: '#2a4a73',
            end: '#152a45',
          },
        },
        // Semantic colors (navy-based)
        primary: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#1e3a5f',
          600: '#1a3352',
          700: '#152a45',
          800: '#102238',
          900: '#0d1e33',
        },
        accent: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'breco-gradient': 'linear-gradient(135deg, #1e3a5f 0%, #2a4a73 50%, #152a45 100%)',
        'breco-gradient-reverse': 'linear-gradient(135deg, #152a45 0%, #2a4a73 50%, #1e3a5f 100%)',
        'breco-gold-gradient': 'linear-gradient(135deg, #d4a853 0%, #e4c078 50%, #b8923f 100%)',
      },
    },
  },
  plugins: [],
}
