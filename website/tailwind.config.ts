import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import typography from '@tailwindcss/typography';

// Palette recovered from the live site's Elementor "Education" template kit:
// deep purple #422e59, gold #f7dc79, cream #f7f5ed, sand #f7e6b4
// The hsl(var(--...)) tokens power the integrated student portal (/portal),
// whose components use the shadcn/ui design system.
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
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
          ink: '#241a30',
          muted: '#5f5a68',
          50: '#f6f4fa',
          100: '#ece7f4',
          200: '#d5cbe6',
          300: '#b3a2cf',
          800: '#37264a',
          950: '#1d1428',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      // Fluid display scale — headlines resolve between the mobile and desktop
      // bounds without breakpoint jumps, so the home page reads as one system.
      fontSize: {
        'display-sm': ['clamp(1.75rem, 1.25rem + 2vw, 2.35rem)', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        'display': ['clamp(1.9rem, 1.25rem + 2.8vw, 3.1rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(2.25rem, 1.4rem + 3.8vw, 4.25rem)', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'display-xl': ['clamp(2.35rem, 1.1rem + 5.6vw, 5.25rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        'lift': '0 1px 2px rgba(36,26,48,0.04), 0 12px 32px -12px rgba(66,46,89,0.20)',
        'lift-lg': '0 2px 4px rgba(36,26,48,0.05), 0 28px 60px -20px rgba(66,46,89,0.32)',
        'gold': '0 10px 30px -10px rgba(233,193,74,0.55)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        heading: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'ken-burns': {
          '0%': { transform: 'scale(1.06) translate3d(0,0,0)' },
          '100%': { transform: 'scale(1.16) translate3d(-1.2%, -1.2%, 0)' },
        },
        'marquee': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'sheen': {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '60%,100%': { transform: 'translateX(220%) skewX(-18deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'ken-burns': 'ken-burns 12s ease-out forwards',
        'marquee': 'marquee 38s linear infinite',
        'sheen': 'sheen 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [animate, typography],
};

export default config;
