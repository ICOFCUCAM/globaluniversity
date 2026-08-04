import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import { site } from '@/content/site';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  manifest: '/manifest.json',
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
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollegeOrUniversity',
  name: site.name,
  alternateName: site.shortName,
  url: site.url,
  logo: `${site.url}/images/site-icon.png`,
  email: site.email,
  telephone: site.phone,
  slogan: site.tagline,
  foundingDate: '2007',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Opposite Bulu Blind Junction',
    addressLocality: 'Buea',
    addressCountry: 'CM',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header />
        <main>{children}</main>
        <Footer />
        <WhatsAppButton />
        <Analytics />
      </body>
    </html>
  );
}
