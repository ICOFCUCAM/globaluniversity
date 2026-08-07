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
  bth,
  bthAims,
  bthCareers,
  bthDescription,
  bthFinalYear,
  bthOutcomes,
  bthPhilosophy,
  bthProgression,
  bthStructure,
  bthCurriculum,
} from '@/content/bachelorOfTheology';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Bachelor of Theology (B.Th.)',
  description:
    'A three-year, 180-ECTS undergraduate degree in the Faculty of Theology, combining rigorous academic study with spiritual formation and practical ministry. Full-time, part-time, online and distance learning.',
  alternates: { canonical: '/bachelor-of-theology' },
  openGraph: {
    title: 'Bachelor of Theology · ICOF Global University',
    description: bthDescription[0],
    images: ['/images/wp/fac-theology.jpg'],
  },
};

export default function BachelorOfTheologyPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        name: bth.award,
        description: bthDescription[0],
        url: `${site.url}/bachelor-of-theology`,
        educationalLevel: 'Bachelor',
        inLanguage: 'en',
        timeRequired: 'P3Y',
        provider: { '@id': `${site.url}/#organization` },
        occupationalCredentialAwarded: bth.award,
        hasCourseInstance: bthCurriculum.flatMap((s) =>
          s.courses.map((c) => ({
            '@type': 'CourseInstance',
            name: `${c.code} ${c.title}`,
            courseMode: ['onsite', 'online'],
          })),
        ),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
          { '@type': 'ListItem', position: 2, name: 'Academics', item: `${site.url}/programs` },
          { '@type': 'ListItem', position: 3, name: bth.award, item: `${site.url}/bachelor-of-theology` },
        ],
      },
    ],
  };

  const facts = [
    ['Qualification', bth.award],
    ['Faculty', bth.faculty],
    ['Duration', bth.duration],
    ['Credit value', bth.credits],
    ['Study mode', bth.studyMode],
    // Label carries the framework; the value carries the level, so the cell
    // does not read "Level / Level 7 Bachelor's Degree".
    ['NQF equivalent', bth.nqf.replace('NQF Equivalent: ', '')],
  ];

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
            {bth.faculty}
          </p>
          <h1 className="font-heading text-display-lg font-bold text-transparent [text-wrap:balance] [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_78%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text]">
            Bachelor of Theology
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-heading text-xl text-brand-gold/95">
            {bth.duration} · {bth.credits}
          </p>
          <div className="mx-auto mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Magnetic strength={9}>
              <Link href="/apply" className="block rounded-full bg-brand-gold px-8 py-3.5 font-heading text-[15px] font-semibold text-brand-purple shadow-gold transition hover:bg-brand-gold-deep">
                Apply Now
              </Link>
            </Magnetic>
            <Magnetic strength={9}>
              <Link href="#structure" className="block rounded-full border-2 border-white/40 px-8 py-3.5 font-heading text-[15px] font-semibold text-white backdrop-blur-sm transition hover:border-brand-gold hover:text-brand-gold">
                Programme Structure
              </Link>
            </Magnetic>
          </div>
        </div>
      </section>

      {/* Key facts */}
      <div className="border-b border-brand-sand bg-white">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-brand-sand/60 lg:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k} className="bg-white px-6 py-5">
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold-ink">{k}</dt>
              <dd className="mt-1.5 font-heading text-[15px] font-bold leading-snug text-brand-purple">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Description */}
      <Section chapter="Programme">
        <div className="mx-auto max-w-3xl">
          <Eyebrow>Programme Description</Eyebrow>
          <KineticText className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
            Scholarship, formation and ministry together
          </KineticText>
          <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
          {bthDescription.map((p, i) => (
            <p key={i} className="mt-5 text-[17px] leading-[1.75] text-brand-muted">{p}</p>
          ))}
        </div>
      </Section>

      {/* Philosophy */}
      <section className="relative overflow-hidden bg-brand-purple-dark py-20 text-white sm:py-24" data-chapter="Philosophy">
        <Aurora tone="purple" intensity={0.4} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <Eyebrow light>Philosophy of the Programme</Eyebrow>
          <KineticText className="font-heading text-display font-bold text-white [text-wrap:balance]">
            What the degree is founded upon
          </KineticText>
          <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
          {bthPhilosophy.map((p, i) => (
            <p key={i} className="mt-5 text-[17px] leading-[1.75] text-white/85">{p}</p>
          ))}
        </div>
      </section>

      {/* Aims and outcomes */}
      <Section className="bg-white" chapter="Aims & Outcomes">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow>Programme Aims</Eyebrow>
            <h2 className="font-heading text-display-sm font-bold text-brand-purple [text-wrap:balance]">The Bachelor of Theology seeks to</h2>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            <ol className="mt-7 space-y-3.5">
              {bthAims.map((a, i) => (
                <li key={a} className="flex gap-4 text-[15px] leading-relaxed text-brand-muted">
                  <span aria-hidden="true" className="shrink-0 font-heading text-sm font-bold tabular text-brand-gold-ink">{String(i + 1).padStart(2, '0')}</span>
                  {a}
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={120}>
            <Eyebrow>Learning Outcomes</Eyebrow>
            <h2 className="font-heading text-display-sm font-bold text-brand-purple [text-wrap:balance]">Graduates will be able to</h2>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            <ol className="mt-7 space-y-3.5">
              {bthOutcomes.map((o, i) => (
                <li key={o} className="flex gap-4 text-[15px] leading-relaxed text-brand-muted">
                  <span aria-hidden="true" className="shrink-0 font-heading text-sm font-bold tabular text-brand-gold-ink">{String(i + 1).padStart(2, '0')}</span>
                  {o}
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </Section>

      {/* Structure */}
      <Section id="structure" chapter="Structure">
        <SectionHeading eyebrow="Programme Structure">180 ECTS over three years</SectionHeading>
        <p className="mx-auto -mt-5 mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">
          Six semesters of 30 ECTS each. Detailed course listings are published semester by
          semester as each is validated by the Faculty of Theology.
        </p>

        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-brand-sand">
          <table className="w-full">
            <thead>
              <tr className="bg-brand-cream">
                {['Year', 'Semester', 'Courses', 'Credits'].map((h) => (
                  <th key={h} className="px-6 py-4 text-left font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-sand bg-white">
              {bthStructure.map((r) => (
                <tr key={`${r.year}-${r.semester}`}>
                  <td className="px-6 py-4 font-heading text-sm font-bold text-brand-purple">{r.year}</td>
                  <td className="px-6 py-4 text-sm text-brand-muted">{r.semester}</td>
                  <td className="px-6 py-4 font-heading text-sm font-bold tabular text-brand-purple">{r.courses}</td>
                  <td className="px-6 py-4 font-heading text-sm font-bold tabular text-brand-purple">{r.credits}</td>
                </tr>
              ))}
              <tr className="bg-brand-cream">
                <td className="px-6 py-4 font-heading text-sm font-bold text-brand-purple" colSpan={2}>Total</td>
                <td className="px-6 py-4 font-heading text-sm font-bold tabular text-brand-purple">36</td>
                <td className="px-6 py-4 font-heading text-sm font-bold tabular text-brand-purple">180</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Full curriculum — all six semesters */}
      <Section className="bg-white" id="semester-one" chapter="Courses">
        <SectionHeading eyebrow="Course Listing">Thirty-six courses</SectionHeading>
        <p className="mx-auto -mt-5 mb-12 max-w-2xl text-center leading-relaxed text-brand-muted">
          Six courses per semester, 5 ECTS each — 30 ECTS a semester, 180 across the degree.
          Full syllabi — unit-by-unit teaching material,
          assessment strategy and reading lists — are issued to enrolled students through the
          student portal.
        </p>

        <div className="mx-auto max-w-4xl space-y-8">
          {bthCurriculum.map((sem, si) => (
            <Reveal key={`${sem.year}-${sem.label}`} delay={si * 50}>
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold-ink">
                    {sem.year}
                  </span>
                  <h3 className="font-heading text-xl font-bold text-brand-purple">{sem.label}</h3>
                  <span className="ml-auto font-sans text-[11px] font-bold tabular text-brand-muted">
                    {sem.courses.length} courses · 30 ECTS
                  </span>
                </div>
                <div className="mt-4 divide-y divide-brand-sand overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream">
                  {sem.courses.map((c) =>
                    c.units ? (
                      <details key={c.code} className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-4 transition hover:bg-white">
                          <span className="w-20 shrink-0 font-mono text-xs font-bold text-brand-gold-ink">{c.code}</span>
                          <span className="flex-1 font-heading text-[15px] font-semibold text-brand-purple">{c.title}</span>
                          <span className="shrink-0 font-sans text-[11px] font-bold tabular text-brand-muted">5 ECTS</span>
                          <span aria-hidden="true" className="relative h-4 w-4 shrink-0 text-brand-gold-ink transition duration-300 group-open:rotate-180">
                            <span className="absolute left-1/2 top-1/2 h-[1.5px] w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
                            <span className="absolute left-1/2 top-1/2 h-2.5 w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition duration-300 group-open:scale-y-0" />
                          </span>
                        </summary>
                        <div className="px-6 pb-6 pl-[6.5rem]">
                          <p className="mb-3 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">
                            {c.units.length} units
                          </p>
                          <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                            {c.units.map((u, ui) => (
                              <li key={u} className="text-sm text-brand-muted">
                                <span className="font-mono text-xs text-brand-gold-ink">{String(ui + 1).padStart(2, '0')}</span>{' '}
                                {u}
                              </li>
                            ))}
                          </ol>
                        </div>
                      </details>
                    ) : (
                      <div key={c.code} className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <span className="w-20 shrink-0 font-mono text-xs font-bold text-brand-gold-ink">{c.code}</span>
                          <span className="flex-1 font-heading text-[15px] font-semibold text-brand-purple">{c.title}</span>
                          <span className="shrink-0 font-sans text-[11px] font-bold tabular text-brand-muted">5 ECTS</span>
                        </div>
                        {c.contents && (
                          <ul className="mt-2.5 flex flex-wrap gap-1.5 pl-[6.5rem]">
                            {c.contents.map((t) => (
                              <li key={t} className="rounded-full border border-brand-sand bg-white px-2.5 py-1 text-[11px] text-brand-muted">{t}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-4xl rounded-2xl border border-brand-sand bg-brand-cream px-6 py-5 text-sm leading-relaxed text-brand-muted">
          <strong className="font-semibold text-brand-purple">Unit outlines.</strong>{' '}
          BTH101 to BTH104 carry their full unit outlines above — expand any of them to see the
          units. The remaining courses show their indicative content; full unit outlines are
          released as each syllabus is validated by the Faculty of Theology.
        </p>
      </Section>

      {/* Final year, careers, progression */}
      <section className="relative overflow-hidden bg-brand-purple py-20 text-white sm:py-24" data-chapter="After the Degree">
        <Aurora tone="purple" intensity={0.4} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-3 lg:gap-10">
          <Reveal>
            <Eyebrow light>Final Year</Eyebrow>
            <h3 className="font-heading text-xl font-bold text-white">Three requirements</h3>
            <div className="mt-4 h-[3px] w-12 rounded-full bg-brand-gold" />
            <ul className="mt-5 space-y-2.5">
              {bthFinalYear.map((f) => (
                <li key={f} className="text-[15px] text-white/85">{f}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100}>
            <Eyebrow light>Career Opportunities</Eyebrow>
            <h3 className="font-heading text-xl font-bold text-white">Graduates serve as</h3>
            <div className="mt-4 h-[3px] w-12 rounded-full bg-brand-gold" />
            <ul className="mt-5 flex flex-wrap gap-2">
              {bthCareers.map((c) => (
                <li key={c} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">{c}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={180}>
            <Eyebrow light>Progression</Eyebrow>
            <h3 className="font-heading text-xl font-bold text-white">Postgraduate routes</h3>
            <div className="mt-4 h-[3px] w-12 rounded-full bg-brand-gold" />
            <ul className="mt-5 space-y-2">
              {bthProgression.map((p) => (
                <li key={p.label}>
                  <Link href={p.href} className="group flex items-center gap-1.5 text-[15px] text-white/85 hover:text-brand-gold">
                    {p.label}
                    <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <Section>
        <SectionHeading eyebrow="Also in Theology">Related programmes</SectionHeading>
        <SpotlightGroup className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {[
            { t: 'Master of Theology', b: 'African and Black Hebrew theology, contextual theology, ecotheology and disability theology.', href: '/master-of-theology' },
            { t: 'M.A. Black Liberation Theology', b: 'A theology for the liberation of all humanity, pioneered as an academic discipline.', href: '/black-liberation-theology' },
            { t: 'Diploma in Theology', b: 'A condensed foundation for ministry preparation or personal enrichment.', href: '/degrees/diploma-dip' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 90}>
              <SpotlightCard className="h-full rounded-2xl" tone="light">
                <Link href={c.href} className="group flex h-full flex-col rounded-2xl border border-brand-sand bg-white p-7 shadow-sm transition duration-500 hover:shadow-lift">
                  <span aria-hidden="true" className="mb-5 block h-[3px] w-9 origin-left rounded-full bg-brand-gold transition-transform duration-500 group-hover:scale-x-[2]" />
                  <h3 className="font-heading text-lg font-bold text-brand-purple [text-wrap:balance]">{c.t}</h3>
                  <p className="mt-2.5 flex-1 text-sm leading-relaxed text-brand-muted">{c.b}</p>
                  <span className="mt-5 flex items-center gap-1.5 font-heading text-sm font-semibold text-brand-purple">
                    Explore
                    <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
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
