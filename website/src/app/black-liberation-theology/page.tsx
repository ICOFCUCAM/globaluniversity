import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import Reveal from '@/components/Reveal';
import KineticText from '@/components/KineticText';
import Magnetic from '@/components/Magnetic';
import { Aurora, Grain, LightShaft, Seam } from '@/components/Atmosphere';
import { SpotlightGroup, SpotlightCard } from '@/components/Spotlight';
import {
  bltAudience,
  bltCommitment,
  bltCurriculum,
  bltDisciplines,
  bltElectives,
  bltIntro,
  bltOutcomes,
  bltPillars,
  bltPracticals,
  bltProgramme,
  bltPullQuote,
  bltSections,
} from '@/content/blackLiberationTheology';
import { site } from '@/content/site';

const TITLE = 'Black Liberation Theology';
const SUBTITLE = 'A Foundation for Human Liberation';

export const metadata: Metadata = {
  title: `${TITLE} — ${SUBTITLE}`,
  description:
    'ICOF Global University is pioneering Black Liberation Theology as an academic discipline — a theology for the liberation of all humanity, integrating biblical revelation, history, archaeology, anthropology, culture and social justice.',
  alternates: { canonical: '/black-liberation-theology' },
  openGraph: {
    title: `${TITLE} · ICOF Global University`,
    description:
      'A theology for the liberation of all humanity. Study for a Master’s degree in Black Liberation Theology at ICOF Global University.',
    images: ['/images/wp/fac-theology.jpg'],
  },
};

export default function BlackLiberationTheologyPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        name: `Master’s Degree in ${TITLE}`,
        description:
          'A Master’s degree pioneering Black Liberation Theology as an academic discipline, integrating biblical revelation, history, archaeology, anthropology, culture and social justice.',
        url: `${site.url}/black-liberation-theology`,
        educationalLevel: 'Master',
        inLanguage: 'en',
        provider: { '@id': `${site.url}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
          { '@type': 'ListItem', position: 2, name: 'Academics', item: `${site.url}/programs` },
          { '@type': 'ListItem', position: 3, name: TITLE, item: `${site.url}/black-liberation-theology` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      {/* Statement hero — this page argues a position, so it opens like an
          essay rather than like a course listing. */}
      <section className="relative isolate overflow-hidden bg-brand-purple-dark py-24 text-white sm:py-32">
        <Image
          src="/images/wp/fac-theology.jpg"
          alt=""
          fill
          priority
          quality={70}
          className="object-cover opacity-25"
          sizes="100vw"
        />
        <Aurora tone="dual" intensity={0.55} />
        <LightShaft />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-purple-dark/85 via-brand-purple/55 to-brand-purple-dark/95" />
        <Grain />
        <Seam flip />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold backdrop-blur-sm">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
            A new academic discipline
          </p>
          <h1 className="font-heading text-display-lg font-bold text-transparent [text-wrap:balance] [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_78%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text]">
            {TITLE}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-heading text-xl text-brand-gold/95 sm:text-2xl">
            {SUBTITLE}
          </p>
          <div className="mx-auto mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
          <p className="mx-auto mt-8 max-w-3xl text-lg leading-relaxed text-white/85">{bltIntro}</p>

          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Magnetic strength={9}>
              <Link
                href="/apply"
                className="block rounded-full bg-brand-gold px-8 py-3.5 font-heading text-[15px] font-semibold text-brand-purple shadow-gold transition hover:bg-brand-gold-deep"
              >
                Apply for the Master’s
              </Link>
            </Magnetic>
            <Magnetic strength={9}>
              <Link
                href="#programme"
                className="block rounded-full border-2 border-white/40 px-8 py-3.5 font-heading text-[15px] font-semibold text-white backdrop-blur-sm transition hover:border-brand-gold hover:text-brand-gold"
              >
                About the Programme
              </Link>
            </Magnetic>
          </div>
        </div>
      </section>

      {/* The argument, set as a numbered essay */}
      <Section>
        <div className="mx-auto max-w-3xl">
          {bltSections.map((s, i) => (
            <Reveal key={s.heading} delay={i * 60}>
              <article className="border-t border-brand-sand py-10 first:border-t-0 first:pt-0">
                <div className="flex items-baseline gap-4">
                  <span
                    aria-hidden="true"
                    className="font-heading text-sm font-bold tabular text-brand-gold-ink"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <KineticText
                    as="h2"
                    className="font-heading text-display-sm font-bold text-brand-purple [text-wrap:balance]"
                  >
                    {s.heading}
                  </KineticText>
                </div>
                {s.paragraphs.map((p, pi) => (
                  <p key={pi} className="mt-5 text-[17px] leading-[1.75] text-brand-muted">
                    {p}
                  </p>
                ))}
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Pull quote — the thesis of the whole page, given its own band */}
      <section className="relative overflow-hidden bg-brand-purple py-20 text-white sm:py-24">
        <Aurora tone="gold" intensity={0.4} fields={2} />
        <Grain opacity={0.045} />
        <Seam />
        <Seam flip />
        <blockquote className="relative mx-auto max-w-4xl px-6 text-center sm:px-8">
          <span
            aria-hidden="true"
            className="block font-heading text-6xl leading-none text-brand-gold/35"
          >
            &ldquo;
          </span>
          <p className="mt-2 font-heading text-display-sm font-bold leading-snug text-white [text-wrap:balance] sm:text-display">
            {bltPullQuote}
          </p>
        </blockquote>
      </section>

      {/* What the discipline draws together, and whom it equips */}
      <Section className="bg-white">
        <SectionHeading eyebrow="A Holistic Vision">A discipline that refuses to be narrow</SectionHeading>
        <p className="mx-auto -mt-5 mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">
          Rather than approaching Africa solely through political, ideological or colonial frameworks,
          the programme integrates six fields of enquiry that are usually kept apart.
        </p>

        <SpotlightGroup className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bltDisciplines.map((d, i) => (
            <Reveal key={d} delay={i * 70}>
              <SpotlightCard
                className="flex h-full items-center gap-4 overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream p-6 transition duration-500 hover:shadow-lift"
                tone="light"
              >
                <span
                  aria-hidden="true"
                  className="font-heading text-2xl font-bold tabular text-brand-gold-ink/50"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-heading text-lg font-bold text-brand-purple">{d}</span>
              </SpotlightCard>
            </Reveal>
          ))}
        </SpotlightGroup>
      </Section>

      {/* The university's commitment and the invitation */}
      <section id="programme" data-chapter="Programme" className="relative overflow-hidden bg-brand-purple-dark py-20 text-white sm:py-24">
        <Aurora tone="purple" intensity={0.45} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
          <Reveal>
            <Eyebrow light>The University’s Commitment</Eyebrow>
            <KineticText className="font-heading text-display font-bold text-white [text-wrap:balance]">
              Pioneering the discipline
            </KineticText>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            {bltCommitment.paragraphs.map((p, i) => (
              <p key={i} className="mt-6 text-[17px] leading-[1.75] text-white/85">
                {p}
              </p>
            ))}
          </Reveal>

          <Reveal delay={140}>
            <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-8 backdrop-blur">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
                The Programme
              </p>
              <h3 className="mt-2 font-heading text-2xl font-bold text-white [text-wrap:balance]">
                Master’s Degree in Black Liberation Theology
              </h3>
              <dl className="mt-6 space-y-4 border-t border-white/10 pt-6 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-white/55">Level</dt>
                  <dd className="font-semibold text-white">Master’s</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-white/55">Faculty</dt>
                  <dd className="text-right font-semibold text-white">Faculty of Theology</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-white/55">Open to</dt>
                  <dd className="text-right font-semibold text-white">Students from every nation</dd>
                </div>
              </dl>

              <p className="mt-7 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold/70">
                Designed to equip
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {bltAudience.map((a) => (
                  <li
                    key={a}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80"
                  >
                    {a}
                  </li>
                ))}
              </ul>

              <Link
                href="/apply"
                className="mt-8 block rounded-full bg-brand-gold px-6 py-3.5 text-center font-heading text-[15px] font-semibold text-brand-purple shadow-gold transition hover:bg-brand-gold-deep"
              >
                Begin an Application
              </Link>
              <Link
                href="/admissions"
                className="mt-3 block rounded-full border-2 border-white/35 px-6 py-3 text-center font-heading text-sm font-semibold text-white transition hover:border-brand-gold hover:text-brand-gold"
              >
                Admission Requirements
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Five pillars */}
      <Section className="bg-white" chapter="Pillars">
        <SectionHeading eyebrow="How the Programme is Organised">Five theological pillars</SectionHeading>
        <p className="mx-auto -mt-5 mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">
          Each runs through every course, so the degree carries the breadth expected of a master&apos;s
          programme while Black Liberation Theology remains its organising framework rather than one
          subject among many.
        </p>
        <SpotlightGroup className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bltPillars.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <SpotlightCard
                className="h-full overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream p-7 transition duration-500 hover:shadow-lift"
                tone="light"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-1 -top-5 font-heading text-[5.5rem] font-bold leading-none text-brand-gold/15"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="relative">
                  <span aria-hidden="true" className="block h-[3px] w-9 rounded-full bg-brand-gold-deep" />
                  <h3 className="mt-4 font-heading text-lg font-bold leading-snug text-brand-purple [text-wrap:balance]">
                    {p.name}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-brand-muted">{p.body}</p>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </SpotlightGroup>
      </Section>

      {/* Curriculum */}
      <Section chapter="Curriculum">
        <SectionHeading eyebrow="Curriculum">{bltProgramme.award}</SectionHeading>

        <div className="mx-auto -mt-4 mb-12 max-w-3xl">
          {bltProgramme.overview.map((p, i) => (
            <p key={i} className="mt-4 text-[17px] leading-[1.75] text-brand-muted">
              {p}
            </p>
          ))}
          <dl className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-brand-sand bg-brand-sand/60 sm:grid-cols-3">
            {[
              ['Duration', bltProgramme.duration],
              ['Structure', bltProgramme.structure],
              ['Total credits', bltProgramme.credits],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-6 py-5 text-center">
                <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold-ink">
                  {k}
                </dt>
                <dd className="mt-1.5 font-heading text-lg font-bold text-brand-purple">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Modules, semester by semester. <details> so the page stays scannable
            but every topic is still in the HTML for search. */}
        <div className="mx-auto max-w-4xl space-y-8">
          {bltCurriculum.map((sem, si) => (
            <Reveal key={`${sem.year}-${sem.label}`} delay={si * 60}>
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold-ink">
                    {sem.year}
                  </span>
                  <h3 className="font-heading text-xl font-bold text-brand-purple">{sem.label}</h3>
                </div>
                <div className="mt-4 divide-y divide-brand-sand overflow-hidden rounded-2xl border border-brand-sand bg-white">
                  {sem.modules.map((m) => (
                    <details key={m.code} className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-4 transition hover:bg-brand-cream">
                        <span className="w-[4.5rem] shrink-0 font-mono text-xs font-bold text-brand-gold-ink">
                          {m.code}
                        </span>
                        <span className="flex-1 font-heading text-[15px] font-semibold text-brand-purple">
                          {m.title}
                        </span>
                        <span
                          aria-hidden="true"
                          className="relative h-4 w-4 shrink-0 text-brand-gold-ink transition duration-300 group-open:rotate-180"
                        >
                          <span className="absolute left-1/2 top-1/2 h-[1.5px] w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
                          <span className="absolute left-1/2 top-1/2 h-2.5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition duration-300 group-open:scale-y-0" />
                        </span>
                      </summary>
                      <div className="px-6 pb-5 pl-[6.5rem]">
                        {m.note && <p className="mb-2.5 text-sm italic text-brand-muted">{m.note}</p>}
                        {m.topics.length > 0 && (
                          <ul className="flex flex-wrap gap-2">
                            {m.topics.map((t) => (
                              <li
                                key={t}
                                className="rounded-full border border-brand-sand bg-brand-cream px-3 py-1.5 text-[12px] text-brand-purple"
                              >
                                {t}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Electives */}
        <div className="mx-auto mt-14 max-w-4xl">
          <div className="flex items-baseline gap-3">
            <h3 className="font-heading text-xl font-bold text-brand-purple">Elective courses</h3>
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-ink">
              Choose four
            </span>
          </div>
          <ul className="mt-5 flex flex-wrap gap-2">
            {bltElectives.map((e) => (
              <li
                key={e}
                className="rounded-full border border-brand-sand bg-white px-4 py-2 text-sm text-brand-purple transition hover:border-brand-gold hover:bg-brand-cream"
              >
                {e}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Practicals + outcomes */}
      <section className="relative overflow-hidden bg-brand-purple py-20 text-white sm:py-24" data-chapter="Outcomes">
        <Aurora tone="purple" intensity={0.4} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow light>Practical Components</Eyebrow>
            <KineticText className="font-heading text-display font-bold text-white [text-wrap:balance]">
              Theology practised, not only studied
            </KineticText>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            <p className="mt-6 text-white/70">Every student must complete:</p>
            <ul className="mt-4 space-y-2.5">
              {bltPracticals.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[15px] text-white/85">
                  <span
                    aria-hidden="true"
                    className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-purple"
                  >
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={140}>
            <Eyebrow light>Learning Outcomes</Eyebrow>
            <h2 className="font-heading text-display font-bold text-white [text-wrap:balance]">
              What graduates will be able to do
            </h2>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            <ol className="mt-6 space-y-3.5">
              {bltOutcomes.map((o, i) => (
                <li key={o} className="flex gap-4 text-[15px] leading-relaxed text-white/85">
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-heading text-sm font-bold tabular text-brand-gold/70"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {o}
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* Where to go next */}
      <Section>
        <SectionHeading eyebrow="Continue">Related study and research</SectionHeading>
        <SpotlightGroup className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {[
            { t: 'Faculty of Theology', b: 'The faculty within which the discipline is taught and examined.', href: '/faculty' },
            { t: 'Research & Innovation', b: 'Doctoral research, the Dissertation Council and the university’s research centres.', href: '/research' },
            { t: 'Master’s Degrees', b: 'Every postgraduate route open at ICOF Global University.', href: '/degrees/masters-degrees' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 90}>
              <SpotlightCard className="h-full rounded-2xl" tone="light">
                <Link
                  href={c.href}
                  className="group flex h-full flex-col rounded-2xl border border-brand-sand bg-white p-7 shadow-sm transition duration-500 hover:shadow-lift"
                >
                  <span
                    aria-hidden="true"
                    className="mb-5 block h-[3px] w-9 origin-left rounded-full bg-brand-gold transition-transform duration-500 group-hover:scale-x-[2]"
                  />
                  <h3 className="font-heading text-lg font-bold text-brand-purple [text-wrap:balance]">{c.t}</h3>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-brand-muted">{c.b}</p>
                  <span className="mt-5 flex items-center gap-1.5 font-heading text-sm font-semibold text-brand-purple">
                    Explore
                    <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">
                      →
                    </span>
                  </span>
                </Link>
              </SpotlightCard>
            </Reveal>
          ))}
        </SpotlightGroup>
      </Section>
    </>
  );
}
