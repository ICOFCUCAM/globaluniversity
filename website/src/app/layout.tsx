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

const display = Fraunces({ subsets: ['latin'], variable: '--font-display', weight: ['400', '600', '700', '900'] });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });

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
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
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
