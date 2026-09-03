/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Paleta principal: tierra/ámbar caliente
        pan: {
          50:  '#fdf6ee',
          100: '#faebd7',
          200: '#f5d0a8',
          300: '#efb075',
          400: '#e8903f',
          500: '#d96b1e',  // base
          600: '#c0530f',
          700: '#9e3e0a',
          800: '#7e3109',
          900: '#5c230a',
        },
        // Fondo oscuro cálido (color principal de la app)
        bg: {
          base:    '#14100a',
          surface: '#1e1810',
          card:    '#261e14',
          border:  '#3a2e1e',
          hover:   '#2e2418',
        },
        // Para badges de estado
        ok:   '#4caf76',
        warn: '#f0a020',
        bad:  '#e05252',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Touch-friendly: tamaños mayores
        'touch-sm': ['0.9rem', { lineHeight: '1.4' }],
        'touch':    ['1.05rem', { lineHeight: '1.5' }],
        'touch-lg': ['1.2rem', { lineHeight: '1.4' }],
      },
      spacing: {
        'touch': '48px',   // altura mínima de botones táctiles
      },
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.5rem',
      },
    },
  },
  plugins: [],
};
