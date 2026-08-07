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
          /**
           * Gold that can carry TEXT on a light ground.
           *
           * brand-gold (#f7dc79) and brand-gold-deep (#e9c14a) are both LIGHT
           * colours — luminance 0.73 and 0.58. They are correct as ink on the
           * purple bands and as fills and rules anywhere, and they are
           * unreadable as small text on cream or white: measured against cream
           * they come in at 1.24:1 and 1.58:1, where WCAG AA asks 4.5 for
           * anything under 18.66px bold.
           *
           * This is the same hue taken down to where it can be read: 5.47:1 on
           * cream, 5.97:1 on white, 4.81:1 on sand — margin on all three, so a
           * later background change does not silently break it.
           *
           * Use brand-gold on dark grounds and brand-gold-ink on light ones.
           */
          'gold-ink': '#7d5f11',
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
      // ONE EASING VOCABULARY.
      //
      // The homepage used ease-out, the default cubic-bezier, and three
      // hand-written curves, chosen independently in eight components. Motion
      // that does not share a curve reads as several interfaces stacked on one
      // page — the eye cannot name the inconsistency but it registers it, and
      // what it registers is "assembled" rather than "designed".
      //
      // `exit` is faster than `enter` on purpose: a thing arriving deserves the
      // reader's attention, a thing leaving is finished with and holding it on
      // screen only delays what comes next.
      transitionTimingFunction: {
        enter: 'cubic-bezier(0.22, 1, 0.36, 1)',
        exit: 'cubic-bezier(0.4, 0, 1, 1)',
        settle: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        // Results entering the programme finder. Small distance, short
        // duration: a card that flies in is a card the reader waits for.
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
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
        'marquee-rev': {
          from: { transform: 'translateX(-50%)' },
          to: { transform: 'translateX(0)' },
        },
        'aurora-a': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(12%, 8%, 0) scale(1.18)' },
          '66%': { transform: 'translate3d(-6%, 14%, 0) scale(0.94)' },
        },
        'aurora-b': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1.05)' },
          '40%': { transform: 'translate3d(-14%, 12%, 0) scale(0.9)' },
          '75%': { transform: 'translate3d(8%, -10%, 0) scale(1.22)' },
        },
        'aurora-c': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(0.96)' },
          '50%': { transform: 'translate3d(10%, -14%, 0) scale(1.2)' },
        },
        'crest': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'orbit': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'ring-in': {
          from: { transform: 'rotate(-120deg)', opacity: '0' },
          to: { transform: 'rotate(0deg)', opacity: '1' },
        },
        'shaft': {
          '0%,100%': { opacity: '0.55', transform: 'rotate(14deg) translateY(0)' },
          '50%': { opacity: '1', transform: 'rotate(14deg) translateY(-3%)' },
        },
        'sheen': {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '60%,100%': { transform: 'translateX(220%) skewX(-18deg)' },
        },
      },
      animation: {
        rise: 'rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'ken-burns': 'ken-burns 12s ease-out forwards',
        'marquee': 'marquee var(--dur,38s) linear infinite',
        'marquee-rev': 'marquee-rev var(--dur,38s) linear infinite',
        'sheen': 'sheen 2.4s ease-in-out infinite',
        'aurora-a': 'aurora-a 26s ease-in-out infinite',
        'aurora-b': 'aurora-b 32s ease-in-out infinite',
        'aurora-c': 'aurora-c 38s ease-in-out infinite',
        'shaft': 'shaft 14s ease-in-out infinite',
        'orbit': 'orbit 18s linear infinite',
        'crest': 'crest 60s linear infinite',
        'ring-in': 'ring-in 1.1s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [animate, typography],
};

export default config;
