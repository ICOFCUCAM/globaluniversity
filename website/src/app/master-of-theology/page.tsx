import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import Reveal from '@/components/Reveal';
import KineticText from '@/components/KineticText';
import Magnetic from '@/components/Magnetic';
import { Aurora, Grain, LightShaft, Seam } from '@/components/Atmosphere';
import { SpotlightGroup, SpotlightCard } from '@/components/Spotlight';
import { blackHebrewsCourse, masterOfTheology as mth, theologyPortfolio } from '@/content/theology';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Master of Theology (M.Th.)',
  description:
    'An advanced theological degree emphasising African and Black Hebrew theology, contextual theology, ecotheology, feminist and queer theologies, and disability theology.',
  alternates: { canonical: '/master-of-theology' },
  openGraph: {
    title: 'Master of Theology · ICOF Global University',
    description: mth.overview,
    images: ['/images/wp/fac-theology.jpg'],
  },
};

export default function MasterOfTheologyPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        name: mth.award,
        description: mth.overview,
        url: `${site.url}/master-of-theology`,
        educationalLevel: 'Master',
        inLanguage: 'en',
        provider: { '@id': `${site.url}/#organization` },
        hasCourseInstance: mth.semesters.flatMap((s) =>
          s.courses.map((c) => ({ '@type': 'CourseInstance', name: c.title, courseMode: 'blended' })),
        ),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
          { '@type': 'ListItem', position: 2, name: 'Academics', item: `${site.url}/programs` },
          { '@type': 'ListItem', position: 3, name: mth.award, item: `${site.url}/master-of-theology` },
        ],
      },
    ],
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
            Postgraduate · 2 years
          </p>
          <h1 className="font-heading text-display-lg font-bold text-transparent [text-wrap:balance] [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_78%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text]">
            Master of Theology
          </h1>
          <div className="mx-auto mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
          <p className="mx-auto mt-8 max-w-3xl text-lg leading-relaxed text-white/85">{mth.overview}</p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Magnetic strength={9}>
              <Link href="/apply" className="block rounded-full bg-brand-gold px-8 py-3.5 font-heading text-[15px] font-semibold text-brand-purple shadow-gold transition hover:bg-brand-gold-deep">
                Apply Now
              </Link>
            </Magnetic>
            <Magnetic strength={9}>
              <Link href="#admission" className="block rounded-full border-2 border-white/40 px-8 py-3.5 font-heading text-[15px] font-semibold text-white backdrop-blur-sm transition hover:border-brand-gold hover:text-brand-gold">
                Admission Requirements
              </Link>
            </Magnetic>
          </div>
        </div>
      </section>

      {/* Objectives */}
      <Section chapter="Objectives">
        <SectionHeading eyebrow="Programme Objectives">What the degree sets out to do</SectionHeading>
        <SpotlightGroup className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mth.objectives.map((o, i) => (
            <Reveal key={o.label} delay={i * 80}>
              <SpotlightCard className="h-full overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream p-7 transition duration-500 hover:shadow-lift" tone="light">
                <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-5 font-heading text-[5.5rem] font-bold leading-none text-brand-gold/15">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="relative">
                  <span aria-hidden="true" className="block h-[3px] w-9 rounded-full bg-brand-gold-deep" />
                  <h3 className="mt-4 font-heading text-lg font-bold leading-snug text-brand-purple [text-wrap:balance]">{o.label}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-brand-muted">{o.text}</p>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </SpotlightGroup>
      </Section>

      {/* Structure */}
      <Section className="bg-white" chapter="Structure">
        <SectionHeading eyebrow="Programme Structure">Two years, twelve courses, a thesis</SectionHeading>
        <p className="mx-auto -mt-5 mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">{mth.structureNote}</p>

        <div className="mx-auto max-w-4xl space-y-8">
          {mth.semesters.map((s, si) => (
            <Reveal key={`${s.year}-${s.label}`} delay={si * 60}>
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold-ink">{s.year}</span>
                  <h3 className="font-heading text-xl font-bold text-brand-purple">{s.label}</h3>
                </div>
                <div className="mt-4 divide-y divide-brand-sand overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream">
                  {s.courses.map((c) => (
                    <details key={c.n} className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-4 transition hover:bg-white">
                        <span className="w-7 shrink-0 font-heading text-sm font-bold tabular text-brand-gold-deep">{c.n}</span>
                        <span className="flex-1 font-heading text-[15px] font-semibold text-brand-purple">{c.title}</span>
                        <span aria-hidden="true" className="relative h-4 w-4 shrink-0 text-brand-gold-deep transition duration-300 group-open:rotate-180">
                          <span className="absolute left-1/2 top-1/2 h-[1.5px] w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
                          <span className="absolute left-1/2 top-1/2 h-2.5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition duration-300 group-open:scale-y-0" />
                        </span>
                      </summary>
                      <ul className="space-y-2 px-6 pb-5 pl-[4.25rem]">
                        {c.topics.map((t) => (
                          <li key={t} className="text-sm leading-relaxed text-brand-muted">{t}</li>
                        ))}
                      </ul>
                    </details>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-brand-sand bg-brand-cream p-8">
          <h3 className="font-heading text-xl font-bold text-brand-purple">Thesis project</h3>
          <div className="mt-3 h-[3px] w-12 rounded-full bg-brand-gold" />
          <ul className="mt-5 space-y-2.5">
            {mth.thesis.map((t) => (
              <li key={t} className="text-[15px] leading-relaxed text-brand-muted">{t}</li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Featured course */}
      <section className="relative overflow-hidden bg-brand-purple py-20 text-white sm:py-24" data-chapter="Featured Course">
        <Aurora tone="purple" intensity={0.4} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          <Reveal>
            <Eyebrow light>Featured Course</Eyebrow>
            <KineticText className="font-heading text-display font-bold text-white [text-wrap:balance]">
              {blackHebrewsCourse.title}
            </KineticText>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            <p className="mt-7 max-w-3xl text-[17px] leading-[1.75] text-white/85">{blackHebrewsCourse.description}</p>
          </Reveal>

          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <Reveal delay={100}>
              <h3 className="font-heading text-lg font-bold text-brand-gold">Twelve weeks</h3>
              <div className="mt-4 space-y-5">
                {blackHebrewsCourse.parts.map((p) => (
                  <div key={p.part}>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold/70">{p.part}</p>
                    <ul className="mt-2 space-y-1.5">
                      {p.weeks.map((w) => (
                        <li key={w.week} className="text-sm text-white/80">
                          <span className="font-semibold text-white">{w.week}</span> · {w.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={180}>
              <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-7 backdrop-blur">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold">Course objectives</p>
                <ul className="mt-3 space-y-2.5">
                  {blackHebrewsCourse.objectives.map((o) => (
                    <li key={o} className="text-[13px] leading-relaxed text-white/80">{o}</li>
                  ))}
                </ul>
                <p className="mt-7 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold">Assessment</p>
                <ul className="mt-3 space-y-2">
                  {blackHebrewsCourse.assessment.map((a) => (
                    <li key={a} className="text-[13px] text-white/80">{a}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <p className="mt-10 max-w-3xl border-l-[3px] border-brand-gold pl-5 text-sm italic leading-relaxed text-white/75">
              {blackHebrewsCourse.note}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Admission */}
      <Section id="admission" chapter="Admission">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow>Admission Requirements</Eyebrow>
            <h2 className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">How to join the programme</h2>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            <ul className="mt-7 space-y-3">
              {mth.admission.map((a) => (
                <li key={a} className="flex items-start gap-3 text-[15px] leading-relaxed text-brand-muted">
                  <span aria-hidden="true" className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-purple">
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                  </span>
                  {a}
                </li>
              ))}
            </ul>
            <Link href="/apply" className="mt-8 inline-block rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white transition hover:bg-brand-purple-dark">
              Begin an Application
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-2xl border border-brand-sand bg-brand-cream p-8">
              <h3 className="font-heading text-lg font-bold text-brand-purple">In summary</h3>
              <div className="mt-3 h-[3px] w-12 rounded-full bg-brand-gold" />
              <p className="mt-5 text-[15px] leading-relaxed text-brand-muted">{mth.conclusion}</p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Portfolio */}
      <Section className="bg-white" chapter="Theology at IGUC">
        <SectionHeading eyebrow="Theology at IGUC">The wider portfolio</SectionHeading>
        <div className="mx-auto max-w-3xl">
          {theologyPortfolio.map((p, i) => (
            <p key={i} className="mt-5 text-[16px] leading-[1.75] text-brand-muted">{p}</p>
          ))}
        </div>
        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-3">
          {[
            ['Bachelor of Theology', '/degrees/bachelors-degrees'],
            ['Diploma in Theology', '/degrees/diploma-dip'],
            ['M.A. Black Liberation Theology', '/black-liberation-theology'],
            ['Roots of Faith', '/roots-of-faith'],
          ].map(([l, h]) => (
            <Link key={h} href={h} className="rounded-full border-2 border-brand-purple px-6 py-2.5 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
              {l}
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
