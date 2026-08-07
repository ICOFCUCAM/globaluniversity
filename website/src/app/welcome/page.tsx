import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import Reveal from '@/components/Reveal';
import Cta from '@/components/Cta';
import { chancellor, chancellorBio, viceChancellor } from '@/content/welcome';
import { site, stats } from '@/content/site';

export const metadata: Metadata = {
  title: "Welcome from the Chancellor",
  description:
    "A welcome to ICOF Global University from the Chancellor, Bishop Bernie L Wade, PhD — Presiding Bishop of the International Circle of Faith.",
  alternates: { canonical: '/welcome' },
  openGraph: {
    title: 'Welcome from the Chancellor · ICOF Global University',
    description:
      'Welcome to ICOF Global University — the Community University. A word from our Chancellor, Bishop Bernie L Wade, PhD.',
    images: [chancellor.image],
  },
};

export default function WelcomePage() {
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: chancellor.name,
    jobTitle: chancellor.role,
    email: `mailto:${chancellor.email}`,
    image: `${site.url}${chancellor.image}`,
    worksFor: {
      '@type': 'CollegeOrUniversity',
      name: site.name,
      url: site.url,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />

      <PageBanner
        title="Welcome to ICOF Global University"
        subtitle="A word from the Chancellor"
        image="/images/wp/g-hall.jpg"
      />

      {/* The address */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
          {/* Portrait column — sticky on desktop so the signature stays with the text */}
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-xl">
                <Image
                  src={chancellor.image}
                  alt={`${chancellor.name}, ${chancellor.role} of ${site.name}`}
                  fill
                  className="object-cover"
                  sizes="(min-width:1024px) 320px, 100vw"
                  priority
                />
              </div>
              <div className="mt-5 border-l-[3px] border-brand-gold pl-4">
                <p className="font-heading text-lg font-bold text-brand-purple">{chancellor.name}</p>
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-gold-ink">
                  {chancellor.role}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">{chancellor.credentials}</p>
                <a
                  href={`mailto:${chancellor.email}`}
                  className="mt-3 inline-block text-sm font-medium text-brand-purple underline underline-offset-4 hover:text-brand-gold-ink"
                >
                  {chancellor.email}
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <Eyebrow>The Chancellor&apos;s Welcome</Eyebrow>
            <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-brand-purple sm:text-[2.6rem]">
              Anointed for study, sent out to serve
            </h2>
            <div className="mt-4 h-[3px] w-16 rounded bg-brand-gold" />

            <div className="mt-8 space-y-6">
              {chancellor.address.map((para, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? 'text-lg leading-relaxed text-brand-ink first-letter:float-left first-letter:mr-3 first-letter:font-heading first-letter:text-6xl first-letter:font-bold first-letter:leading-[0.85] first-letter:text-brand-gold-ink'
                      : 'leading-relaxed text-brand-muted'
                  }
                >
                  {para}
                </p>
              ))}
            </div>

            <div className="mt-10 border-t border-brand-sand pt-6">
              <p className="font-heading text-xl font-bold text-brand-purple">{chancellor.name}</p>
              <p className="text-sm text-brand-muted">
                {chancellor.role}, {site.name}
              </p>
              <p className="mt-1 text-sm text-brand-muted">
                Presiding Bishop, International Circle of Faith
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Numbers band */}
      <section className="bg-brand-purple py-14 text-white">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 text-center md:grid-cols-4">
          {stats.slice(0, 4).map((s) => (
            <div key={s.label}>
              <p className="font-heading text-4xl font-bold text-brand-gold sm:text-5xl">{s.value}</p>
              <p className="mt-2 text-sm font-medium text-white/85">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Biography */}
      <Section className="bg-white">
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="About the Chancellor" align="left">
            Bishop Bernie L Wade, PhD
          </SectionHeading>
          <div className="space-y-5">
            {chancellorBio.map((para, i) => (
              <p key={i} className="leading-relaxed text-brand-muted">
                {para}
              </p>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-brand-sand bg-brand-cream p-8">
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-brand-gold">
                <Image
                  src={viceChancellor.image}
                  alt={`${viceChancellor.name}, ${viceChancellor.role}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-lg font-bold text-brand-purple">{viceChancellor.name}</p>
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-gold-ink">
                  {viceChancellor.role}
                </p>
                <a
                  href={`mailto:${viceChancellor.email}`}
                  className="text-sm text-brand-muted underline underline-offset-4 hover:text-brand-purple"
                >
                  {viceChancellor.email}
                </a>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-brand-muted">{viceChancellor.note}</p>
            <Link
              href="/faculty"
              className="mt-5 inline-block rounded-full border-2 border-brand-purple px-6 py-2.5 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
            >
              Meet the Full Administration
            </Link>
          </div>
        </div>
      </Section>

      {/* Where to go next */}
      <Section>
        <SectionHeading eyebrow="Start Here">Where would you like to begin?</SectionHeading>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Our Programs', b: 'Certificates through doctorates across four faculties.', href: '/programs' },
            { t: 'Admissions', b: 'Requirements, intakes and how the process works.', href: '/admissions' },
            { t: 'Study Online', b: 'Full programs delivered wherever you are in the world.', href: '/online-learning' },
            { t: 'Apply Now', b: 'A free online application, reviewed continuously.', href: '/apply' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 100}>
              <Link
                href={c.href}
                className="flex h-full flex-col rounded-2xl border border-brand-sand bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-brand-gold hover:shadow-xl"
              >
                <h3 className="font-heading text-lg font-bold text-brand-purple">{c.t}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-muted">{c.b}</p>
                <span aria-hidden="true" className="mt-4 font-heading text-sm font-semibold text-brand-gold-ink">
                  →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <Cta />
    </>
  );
}
