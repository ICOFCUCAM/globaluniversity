import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import Reveal from '@/components/Reveal';
import KineticText from '@/components/KineticText';
import { Aurora, Grain, LightShaft, Seam } from '@/components/Atmosphere';
import { rootsOfFaith } from '@/content/theology';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: `${rootsOfFaith.title} — ${rootsOfFaith.subtitle}`,
  description:
    'A position paper from ICOF Global University examining the historical, cultural and theological case for understanding Jesus within an African context.',
  alternates: { canonical: '/roots-of-faith' },
  openGraph: {
    title: `${rootsOfFaith.title} · ICOF Global University`,
    description: rootsOfFaith.subtitle,
    images: ['/images/wp/fac-theology.jpg'],
  },
};

export default function RootsOfFaithPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: `${rootsOfFaith.title}: ${rootsOfFaith.subtitle}`,
    abstract: rootsOfFaith.intro,
    url: `${site.url}/roots-of-faith`,
    inLanguage: 'en',
    publisher: { '@id': `${site.url}/#organization` },
    about: ['Theology', 'African Christianity', 'Black Theology', 'Biblical Studies'],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <section className="relative isolate overflow-hidden bg-brand-purple-dark py-24 text-white sm:py-28">
        <Image src="/images/wp/fac-theology.jpg" alt="" fill priority quality={70} className="object-cover opacity-20" sizes="100vw" />
        <Aurora tone="dual" intensity={0.5} />
        <LightShaft />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-purple-dark/85 via-brand-purple/55 to-brand-purple-dark/95" />
        <Grain />
        <Seam flip />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold backdrop-blur-sm">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
            Position paper
          </p>
          <h1 className="font-heading text-display-lg font-bold text-transparent [text-wrap:balance] [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_78%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text]">
            {rootsOfFaith.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-heading text-xl text-brand-gold/95 sm:text-2xl">
            {rootsOfFaith.subtitle}
          </p>
          <div className="mx-auto mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-[19px] leading-[1.7] text-brand-ink first-letter:float-left first-letter:mr-3 first-letter:font-heading first-letter:text-6xl first-letter:font-bold first-letter:leading-[0.85] first-letter:text-brand-gold-ink">
            {rootsOfFaith.intro}
          </p>

          {rootsOfFaith.blocks.map((b, bi) => (
            <Reveal key={bi} delay={40}>
              <div className={b.heading ? 'mt-14' : 'mt-10'}>
                {b.heading && (
                  <KineticText
                    as="h2"
                    className="mb-1 font-heading text-display-sm font-bold text-brand-purple [text-wrap:balance]"
                  >
                    {b.heading}
                  </KineticText>
                )}
                {b.heading && <div className="mb-7 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />}
                {b.subheading && (
                  <h3 className="font-heading text-lg font-bold text-brand-purple">{b.subheading}</h3>
                )}
                <ul className="mt-4 space-y-5">
                  {b.points?.map((p) => (
                    <li key={p.label ?? p.text} className="border-l-[3px] border-brand-sand pl-5 transition hover:border-brand-gold">
                      {p.label && (
                        <span className="block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gold-ink">
                          {p.label}
                        </span>
                      )}
                      <p className="mt-1.5 text-[16px] leading-[1.75] text-brand-muted">{p.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}

          <Reveal>
            <div className="mt-16 rounded-2xl border border-brand-sand bg-brand-cream p-8 sm:p-10">
              <h2 className="font-heading text-xl font-bold text-brand-purple">Conclusion</h2>
              <div className="mt-3 h-[3px] w-12 rounded-full bg-brand-gold" />
              <p className="mt-5 text-[17px] leading-[1.75] text-brand-muted">{rootsOfFaith.conclusion}</p>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section className="bg-white">
        <SectionHeading eyebrow="Study This">Where this is taught</SectionHeading>
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {[
            { t: 'M.A. Black Liberation Theology', b: 'The discipline this paper belongs to, offered as a two-year Master of Arts.', href: '/black-liberation-theology' },
            { t: 'Master of Theology', b: 'African and Black Hebrew theology, contextual theology, ecotheology and disability theology.', href: '/master-of-theology' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 90}>
              <Link href={c.href} className="group flex h-full flex-col rounded-2xl border border-brand-sand bg-brand-cream p-7 transition duration-500 hover:border-brand-gold hover:shadow-lift">
                <span aria-hidden="true" className="mb-5 block h-[3px] w-9 origin-left rounded-full bg-brand-gold transition-transform duration-500 group-hover:scale-x-[2]" />
                <h3 className="font-heading text-lg font-bold text-brand-purple [text-wrap:balance]">{c.t}</h3>
                <p className="mt-2.5 flex-1 text-sm leading-relaxed text-brand-muted">{c.b}</p>
                <span className="mt-5 flex items-center gap-1.5 font-heading text-sm font-semibold text-brand-purple">
                  Explore
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>
    </>
  );
}
