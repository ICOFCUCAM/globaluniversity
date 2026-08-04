import type { Config } from 'tailwindcss';

// Palette recovered from the live site's Elementor "Education" template kit:
// deep purple #422e59, gold #f7dc79, cream #f7f5ed, sand #f7e6b4
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#422e59',
          'purple-dark': '#322244',
          'purple-light': '#57549a',
          gold: '#f7dc79',
          'gold-deep': '#e9c14a',
          cream: '#f7f5ed',
          sand: '#f7e6b4',
          ink: '#2b2b2b',
          muted: '#777777',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Roboto', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
