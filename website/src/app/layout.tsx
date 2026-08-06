import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import PageChrome from '@/components/PageChrome';
import SiteChrome, { SiteMain } from '@/components/SiteChrome';
import { site } from '@/content/site';

// ---------------------------------------------------------------------------
// THE TWO FACES.
//
// display: 'swap' on both. The default, 'auto', lets a browser hide text for up
// to three seconds while a font loads — on a slow connection in Buea that is a
// blank headline on the most important screen of the site. Swap shows the
// fallback immediately and repaints when the real face arrives. The repaint is
// a visible shift, which is the price, and it is a far smaller price than
// nothing at all.
//
// THE WEIGHTS ARE PINNED to the four actually used. Fraunces ships nine, and
// every unrequested weight is a subset the visitor downloads and never sees.
//
// A NOTE ON THE OPTICAL SIZE AXIS. Fraunces carries one, and it is the reason
// to prefer a variable serif: the same family drawn with fine hairlines for a
// 72px headline and sturdier strokes for 15px body text, rather than one
// drawing doing both jobs badly. next/font will not expose axes and pinned
// weights at the same time — `axes` requires the full variable face — so this
// is a real choice between two goods.
//
// Pinned weights win. The whole variable face is roughly four times the
// download of four static subsets, and this university's readers are on
// Cameroonian mobile connections. Optical sizing is a refinement a typographer
// notices; a headline that has not arrived is something everybody notices.
// ---------------------------------------------------------------------------
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600', '700', '900'],
  display: 'swap',
});
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  manifest: '/manifest.json',
  alternates: { canonical: '/', languages: { en: '/', fr: '/fr' } },
  icons: { icon: '/images/site-icon.png', apple: '/images/site-icon.png' },
  openGraph: {
    title: site.name,
    description: site.description,
    url: site.url,
    siteName: site.name,
    type: 'website',
    images: ['/images/home-hero.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.name,
    description: site.description,
    images: ['/images/home-hero.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: '#422e59',
};

// schema.org structured data so search engines show the university as an
// organization with address, contacts and logo.
// The canonical organization node for the whole site. Every page emits this;
// page-level graphs reference it by @id rather than redeclaring the university.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollegeOrUniversity',
  '@id': `${site.url}/#organization`,
  name: site.name,
  alternateName: site.shortName,
  url: site.url,
  logo: `${site.url}/images/site-icon.png`,
  email: site.email,
  telephone: site.phone,
  slogan: site.tagline,
  foundingDate: '2007',
  description: site.description,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Opposite Bulu Blind Junction',
    addressLocality: 'Buea',
    addressCountry: 'CM',
  },
  areaServed: ['CM', 'NG', 'Worldwide'],
  member: { '@type': 'Organization', name: 'International Circle of Faith' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        {/* THE THEME, APPLIED BEFORE ANYTHING PAINTS.
            This runs synchronously in <head>, ahead of the first paint and
            ahead of React. Setting the class on mount instead would show a
            visitor with dark mode enabled one frame of full-brightness white —
            the flash of wrong theme — which at night is genuinely unpleasant
            and is the commonest way a dark mode is got wrong.

            It is inlined rather than imported because a separate file is a
            second request, and a request that has to complete before the first
            paint is the definition of render-blocking.

            Wrapped in try/catch: localStorage throws in Safari private mode,
            and a theme preference must never be able to blank the page. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=localStorage.getItem('iguc-theme')||'system';var d=c==='dark'||(c==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}`,
          }}
        />
      </head>
      <body>
        {/* SKIP LINK — the first focusable thing in the document.
            This site has a two-row masthead with a utility bar, a wordmark, six
            top-level menus and four buttons: about twenty tab stops before a
            keyboard user reaches a single word of the page they asked for, on
            every navigation. It is visually hidden until focused, which is the
            whole trick — it costs a sighted mouse user nothing and saves a
            keyboard user twenty keystrokes per page. */}
        <a
          href="#main"
          className="sr-only rounded-br-xl bg-brand-purple px-6 py-4 font-heading text-sm font-bold text-white focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-[100] focus:outline-none focus:ring-4 focus:ring-brand-gold"
        >
          Skip to main content
        </a>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Suppressed on /portal, which owns the whole viewport. See
            src/components/SiteChrome.tsx. */}
        <SiteChrome><Header /></SiteChrome>
        <SiteMain>{children}</SiteMain>
        <SiteChrome>
          <Footer />
          <WhatsAppButton />
          <PageChrome />
        </SiteChrome>
        <Analytics />
      </body>
    </html>
  );
}
