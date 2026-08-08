import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import { Aurora, Grain, LightShaft, Seam } from '@/components/Atmosphere';
import {
  bmin,
  bminAim,
  bminAllCourses,
  bminAssessmentFramework,
  bminAssessmentPrinciple,
  bminCapstoneRequirements,
  bminCapstoneTopics,
  bminComponents,
  bminComponentTotal,
  bminCourseCount,
  bminDistinctive,
  bminEntry,
  bminEntryNote,
  bminEthics,
  bminFiveFold,
  bminFiveFoldPrinciple,
  bminFormationPortfolio,
  bminGraduateProfile,
  bminIdentity,
  bminIntegration,
  bminIntegrity,
  bminIntegrityNote,
  bminLadder,
  bminMastersSpecialisations,
  bminMission,
  bminObjectives,
  bminPhilosophy,
  bminPracticum,
  bminProgression,
  bminRpl,
  bminSafeguarding,
  bminSemesters,
  bminSupportPrinciple,
  bminSupportSpecialisations,
  bminTerminology,
  bminTheologicalStatement,
  bminTotalEcts,
  bminTrackCourseCount,
  bminTracks,
  bminVision,
  semesterEcts,
  BMIN_OPEN_QUESTIONS,
} from '@/content/bachelorOfMinistry';
import { site } from '@/content/site';
import { inWordsCapped } from '@/content/institutionalFacts';
import { CREDIT_QUESTIONS } from '@/content/creditFramework';

// ---------------------------------------------------------------------------
// THE BACHELOR OF MINISTRY HANDBOOK.
//
// The second full programme handbook on this site, after the Bachelor of
// Theology, and the first to publish a prerequisite chain — which is why the
// semester tables here carry a "Requires" column that the B.Th. tables do not.
//
// ===========================================================================
// WHY THE OPEN QUESTIONS ARE ON THE PAGE
// ===========================================================================
//
// Four things in the framework do not reconcile: two prerequisites name a
// course taught in their own semester, the fourteen specialization tracks have
// no elective slot to be taken in, COM is used for two different subjects, and
// the track courses are numbered above the programme's own ceiling.
//
// The instinct is to keep those in a planning document and publish a clean
// prospectus. That instinct is wrong here, and for a reason specific to this
// institution: this is a framework going to APPROVAL. Every one of the four is
// the kind of thing an approval panel raises in its first hour, and a school
// that has already written them down, with a recommended resolution, is a
// school that has done the work. One that publishes a tidy version and gets
// asked about FIN 201 in the room has not.
//
// They are set apart from the curriculum, on the university's own sand, headed
// as decisions the university has still to take — not as errata, and not mixed
// in with the courses where a prospective student would read them as instability.
//
// ===========================================================================
// EVERY NUMBER ON THIS PAGE IS COUNTED
// ===========================================================================
//
// 180 ECTS, thirty-four courses, the per-semester loads, the component total,
// fourteen tracks, fifty-six track courses. None of them is typed. They come
// from src/content/bachelorOfMinistry.ts and are proved by
// bachelorOfMinistry.test.mjs, which runs in `npm test`. A curriculum is
// arithmetic, and the arithmetic is the first thing a credential evaluator
// checks.
// ---------------------------------------------------------------------------

const BANNER = '/images/graduation-2024/grad-2024-platform-party.jpg';

export const metadata: Metadata = {
  title: 'Bachelor of Ministry (B.Min.)',
  description:
    'A three-year, 180-ECTS undergraduate degree in the School of Ministry: biblical studies, theology, spiritual formation, supervised ministry practicum, leadership, mission and digital ministry. On campus, online, blended and distance learning.',
  alternates: { canonical: '/bachelor-of-ministry' },
  openGraph: {
    title: 'Bachelor of Ministry · ICOF Global University',
    description: bmin.principle,
    images: [BANNER],
  },
};

export default function BachelorOfMinistryPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        name: bmin.award,
        description: bmin.principle,
        url: `${site.url}/bachelor-of-ministry`,
        educationalLevel: 'Bachelor',
        inLanguage: 'en',
        timeRequired: 'P3Y',
        provider: { '@id': `${site.url}/#organization` },
        occupationalCredentialAwarded: bmin.award,
        numberOfCredits: bminTotalEcts,
        hasCourseInstance: bminAllCourses.map((c) => ({
          '@type': 'CourseInstance',
          name: `${c.code} ${c.title}`,
          courseMode: ['onsite', 'online', 'blended'],
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
          { '@type': 'ListItem', position: 2, name: 'Academics', item: `${site.url}/programs` },
          { '@type': 'ListItem', position: 3, name: bmin.award, item: `${site.url}/bachelor-of-ministry` },
        ],
      },
    ],
  };

  const facts: [string, string][] = [
    ['Qualification', bmin.award],
    ['School', bmin.school],
    ['Credit value', `${bminTotalEcts} ECTS`],
    ['Duration', bmin.duration],
    ['Study mode', bmin.modes],
    ['Language', bmin.language],
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      {/* ---- BANNER ------------------------------------------------------ */}
      <section className="relative isolate overflow-hidden bg-brand-purple-dark py-24 text-white sm:py-28">
        <Image src={BANNER} alt="" fill priority quality={72} className="object-cover opacity-20" sizes="100vw" style={{ objectPosition: '50% 38%' }} />
        <Aurora tone="dual" intensity={0.5} />
        <LightShaft />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-purple-dark/85 via-brand-purple/55 to-brand-purple-dark/95" />
        <Grain />
        <Seam flip />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold backdrop-blur-sm">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
            {bmin.school}
          </p>
          <h1 className="font-heading text-display-lg font-bold text-transparent [text-wrap:balance] [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_78%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text]">
            Bachelor of Ministry
          </h1>
          <p className="mx-auto mt-4 max-w-2xl font-heading text-xl text-brand-gold/95">
            {bmin.duration} · {bminTotalEcts} ECTS
          </p>
          <div className="mx-auto mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
          <p className="mx-auto mt-8 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-base">
            {bmin.principle}
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link href="/apply" className="rounded-full bg-brand-gold px-8 py-3.5 font-heading text-[15px] font-semibold text-brand-purple shadow-gold transition hover:bg-brand-gold-deep">
              Apply now
            </Link>
            <Link href="#curriculum" className="rounded-full border-2 border-white/40 px-8 py-3.5 font-heading text-[15px] font-semibold text-white backdrop-blur-sm transition hover:border-brand-gold hover:text-brand-gold">
              The curriculum
            </Link>
          </div>
        </div>
      </section>

      {/* ---- THE FACTS --------------------------------------------------- */}
      <Section className="bg-brand-sand py-14 dark:bg-[#1c1428]">
        <dl className="mx-auto grid max-w-6xl gap-x-10 gap-y-7 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="border-l-2 border-brand-gold-deep pl-4 dark:border-brand-gold/40">
              <dt className="font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold-ink dark:text-brand-gold">
                {label}
              </dt>
              <dd className="mt-1.5 font-heading text-[17px] font-bold leading-snug text-brand-purple dark:text-white">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ---- THE SCHOOL, THE PHILOSOPHY --------------------------------- */}
      <Section chapter="The school" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <div>
              <SectionHeading eyebrow="The School of Ministry" align="left">
                Ministers are formed, not only taught.
              </SectionHeading>
              {bminIdentity.map((p) => (
                <p key={p} className="mb-5 text-[15.5px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
                  {p}
                </p>
              ))}
              {bminPhilosophy.map((p) => (
                <p key={p} className="mb-5 text-[15.5px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
                  {p}
                </p>
              ))}
            </div>

            <aside className="space-y-8">
              {/* THE THEOLOGICAL STATEMENT AND THE TERMINOLOGY POLICY.
                  Together, and directly under the School's own account of
                  itself, because the second explains the first. A reader who
                  meets "Yahusha the Messiah" in a course title two screens
                  below and has not been told why is a reader who thinks the
                  site has a typo. */}
              <div className="rounded-2xl border-l-[3px] border-brand-gold-deep bg-brand-purple-dark p-6 text-white dark:border-brand-gold">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold">
                  What the School teaches
                </p>
                <p className="mt-3 font-heading text-[15px] font-bold leading-relaxed">
                  {bminTheologicalStatement}
                </p>
                <p className="mt-5 border-t border-white/20 pt-4 font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold">
                  Terminology
                </p>
                <p className="mt-2.5 text-[13px] leading-relaxed text-white/80">
                  {bminTerminology}
                </p>
              </div>

              <div>
                <Eyebrow>The curriculum integrates</Eyebrow>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {bminIntegration.map((i) => (
                    <li key={i} className="rounded-full border border-brand-purple/15 bg-white px-3.5 py-1.5 font-heading text-[13px] font-bold text-brand-purple dark:border-white/15 dark:bg-white/5 dark:text-white">
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-brand-gold-deep/30 bg-brand-cream p-6 dark:border-brand-gold/25 dark:bg-white/5">
                <Eyebrow>Vision</Eyebrow>
                <p className="text-[14.5px] leading-relaxed text-brand-muted dark:text-white/80">{bminVision}</p>
                <p className="mt-5 font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold-ink dark:text-brand-gold">
                  Mission
                </p>
                <p className="mt-2 text-[14.5px] leading-relaxed text-brand-muted dark:text-white/80">{bminMission}</p>
              </div>
            </aside>
          </div>
        </div>
      </Section>

      {/* ---- AIM AND OBJECTIVES ------------------------------------------ */}
      <Section chapter="Aim" className="bg-brand-cream py-20 dark:bg-[#181121] sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Programme aim" align="left">
            What a graduate will be able to do.
          </SectionHeading>
          <p className="max-w-3xl text-[15.5px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
            {bminAim}
          </p>

          <ol className="mt-12 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-2">
            {bminObjectives.map((o, i) => (
              <li key={o} className="flex gap-4">
                <span aria-hidden="true" className="mt-0.5 font-heading text-[13px] font-bold tabular-nums text-brand-gold-ink dark:text-brand-gold">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[14.5px] leading-relaxed text-brand-muted dark:text-white/80">{o}</span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ---- GRADUATE PROFILE -------------------------------------------- */}
      <Section chapter="Graduate profile" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Graduate profile" align="left">
            Five competences.
          </SectionHeading>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bminGraduateProfile.map((g) => (
              <div key={g.letter} className="rounded-2xl border border-brand-purple/12 bg-white p-6 dark:border-white/12 dark:bg-white/5">
                <p aria-hidden="true" className="font-heading text-[28px] font-bold leading-none text-brand-gold-deep dark:text-brand-gold/70">
                  {g.letter}
                </p>
                <h3 className="mt-3 font-heading text-[17px] font-bold text-brand-purple dark:text-white">
                  {g.dimension}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-brand-muted dark:text-white/75">{g.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ---- THE CURRICULUM ---------------------------------------------- */}
      {/* CREAM, NOT SAND. The alternation across this page is sand / default /
          cream, and this section is 5,700px of it — by some way the longest on
          the site. Sand is a gold-tinted ground and it is right for a short
          band; held for six screens of dense tabular type it stops reading as
          an accent and starts reading as a highlighter. */}
      <Section id="curriculum" chapter="Curriculum" className="bg-brand-cream py-20 dark:bg-[#181121] sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="The curriculum" align="left">
            {`${bminCourseCount} courses. Six semesters. ${bminTotalEcts} ECTS.`}
          </SectionHeading>

          {/* THE COMPONENT TABLE, WITH ITS TOTAL COMPUTED. */}
          <div className="mb-14 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-left">
              <caption className="mb-3 text-left font-sans text-[12.5px] text-brand-muted dark:text-white/65">
                How the {bminComponentTotal} ECTS is distributed across the curriculum’s components.
              </caption>
              <thead>
                <tr className="border-b border-brand-purple/20 dark:border-white/20">
                  <th scope="col" className="py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold-ink dark:text-brand-gold">
                    Component
                  </th>
                  <th scope="col" className="py-2.5 text-right font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold-ink dark:text-brand-gold">
                    ECTS
                  </th>
                </tr>
              </thead>
              <tbody>
                {bminComponents.map((c) => (
                  <tr key={c.component} className="border-b border-brand-purple/10 dark:border-white/10">
                    <td className="py-2.5 text-[14.5px] text-brand-muted dark:text-white/80">{c.component}</td>
                    <td className="py-2.5 text-right font-heading text-[14.5px] font-bold tabular-nums text-brand-purple dark:text-white">
                      {c.ects}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3 font-heading text-[15px] font-bold text-brand-purple dark:text-white">Total</td>
                  <td className="py-3 text-right font-heading text-[15px] font-bold tabular-nums text-brand-purple dark:text-white">
                    {bminComponentTotal}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* THE SEMESTERS. */}
          <div className="space-y-14">
            {bminSemesters.map((s, i) => (
              <div key={s.label}>
                {/* The year heading is printed only when it changes, so three
                    years read as three years rather than as six repetitions. */}
                {(i === 0 || bminSemesters[i - 1].year !== s.year) && (
                  <h3 className="mb-6 border-b border-brand-gold-deep/40 pb-2 font-heading text-[19px] font-bold text-brand-purple dark:border-brand-gold/30 dark:text-white">
                    {s.year}
                  </h3>
                )}
                <div className="mb-4 flex flex-wrap items-baseline gap-x-4">
                  <h4 className="font-heading text-[16px] font-bold text-brand-gold-ink dark:text-brand-gold">
                    {s.label}
                  </h4>
                  <p className="font-sans text-[12.5px] text-brand-muted dark:text-white/60">
                    {s.courses.length} courses · {semesterEcts(s)} ECTS
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-brand-purple/20 dark:border-white/20">
                        <th scope="col" className="w-[7rem] py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold-ink dark:text-brand-gold">Code</th>
                        <th scope="col" className="py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold-ink dark:text-brand-gold">Course</th>
                        <th scope="col" className="w-[4.5rem] py-2.5 text-right font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold-ink dark:text-brand-gold">ECTS</th>
                        <th scope="col" className="w-[11rem] py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold-ink dark:text-brand-gold">Requires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.courses.map((c) => (
                        <tr key={c.code} className="border-b border-brand-purple/10 align-top dark:border-white/10">
                          <td className="py-3 font-heading text-[13.5px] font-bold tabular-nums text-brand-purple dark:text-brand-gold">
                            {c.code}
                          </td>
                          <td className="py-3 pr-6">
                            <p className="font-heading text-[15px] font-bold text-brand-purple dark:text-white">{c.title}</p>
                            {c.description && (
                              <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">{c.description}</p>
                            )}
                            {c.topics && (
                              <p className="mt-1.5 text-[13px] leading-relaxed text-brand-muted dark:text-white/65">
                                <span className="font-semibold">Topics: </span>{c.topics.join(' · ')}
                              </p>
                            )}
                            {c.outcomes && (
                              <ul className="mt-2 space-y-1">
                                {c.outcomes.map((o) => (
                                  <li key={o} className="flex gap-2 text-[13px] leading-relaxed text-brand-muted dark:text-white/70">
                                    <span aria-hidden="true" className="text-brand-gold-deep dark:text-brand-gold/70">·</span>
                                    {o}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {c.practical && (
                              <p className="mt-2 text-[13px] leading-relaxed text-brand-gold-ink dark:text-brand-gold/90">
                                <span className="font-semibold">Practical requirement: </span>{c.practical}
                              </p>
                            )}
                            {c.assessment && (
                              <p className="mt-2 text-[13px] leading-relaxed text-brand-muted dark:text-white/65">
                                <span className="font-semibold">Assessment: </span>
                                {c.assessment.map((a) => `${a.item} ${a.weight}%`).join(' · ')}
                              </p>
                            )}
                          </td>
                          <td className="py-3 text-right font-heading text-[14.5px] font-bold tabular-nums text-brand-purple dark:text-white">
                            {c.ects}
                          </td>
                          <td className="py-3 text-[13px] leading-snug text-brand-muted dark:text-white/70">
                            {c.prerequisite}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ---- FIVE-FOLD MODEL --------------------------------------------- */}
      <Section chapter="Five-fold" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="The five-fold development model" align="left">
            Five functions, taught as one body.
          </SectionHeading>
          <p className="mb-10 max-w-3xl text-[15.5px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
            Rather than creating five isolated programmes, the School teaches students to understand
            the interdependence of the five ministry functions.
          </p>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {bminFiveFold.map((f) => (
              <li key={f.function} className="border-t-2 border-brand-gold-deep pt-4 dark:border-brand-gold/50">
                <p className="font-heading text-[16px] font-bold text-brand-purple dark:text-white">{f.function}</p>
                <p className="mt-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold-ink dark:text-brand-gold">
                  {f.verb}
                </p>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">{f.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-2xl border-l-2 border-brand-gold-deep pl-5 font-heading text-[17px] font-bold leading-snug text-brand-purple dark:border-brand-gold/50 dark:text-white">
            {bminFiveFoldPrinciple}
          </p>
        </div>
      </Section>

      {/* ---- SPECIALIZATION TRACKS --------------------------------------- */}
      <Section chapter="Specializations" className="bg-brand-cream py-20 dark:bg-[#181121] sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Specialization tracks" align="left">
            {`${bminTracks.length} tracks. ${bminTrackCourseCount} courses.`}
          </SectionHeading>
          {/* SAID PLAINLY. These are tracks the School intends to offer, and
              §12 of the framework says so in its own words. A prospectus that
              lists a specialisation a student cannot yet enrol in has made a
              promise; one that says which are planned has made a plan. */}
          <p className="mb-12 max-w-3xl text-[15.5px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
            The framework sets out fourteen ministry specializations the School intends to offer.
            They are published here as the School’s stated academic direction, not as provision
            currently open for enrolment — see the decisions still to be taken, below.
          </p>

          <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {bminTracks.map((t) => (
              <div key={t.letter} className="border-t border-brand-purple/15 pt-5 dark:border-white/15">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold-ink dark:text-brand-gold">
                  Track {t.letter}
                </p>
                <h3 className="mt-1.5 font-heading text-[16.5px] font-bold leading-snug text-brand-purple dark:text-white">
                  {t.name}
                </h3>
                <ul className="mt-3 space-y-1">
                  {t.courses.map((c) => (
                    <li key={c.code} className="text-[13px] leading-snug text-brand-muted dark:text-white/75">
                      <span className="font-heading font-bold tabular-nums text-brand-purple/80 dark:text-white/90">{c.code}</span>
                      {' — '}
                      {c.title}
                    </li>
                  ))}
                </ul>
                {t.prepares && (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-brand-muted dark:text-white/65">
                    <span className="font-semibold">Prepares for: </span>{t.prepares.join(' · ')}
                  </p>
                )}
                {t.note && (
                  <p className="mt-3 border-l-2 border-brand-gold-deep pl-3 text-[12.5px] leading-relaxed text-brand-muted dark:border-brand-gold/50 dark:text-white/70">
                    {t.note}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* SUPPORT SPECIALISATIONS. */}
          <div className="mt-16 border-t border-brand-purple/15 pt-12 dark:border-white/15">
            <h3 className="font-heading text-[22px] font-bold text-brand-purple dark:text-white">
              {bminSupportPrinciple}
            </h3>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-brand-muted dark:text-white/80">
              The School deliberately recognises the ministries the Church needs beyond the five-fold
              functions. Students may specialise in any of these.
            </p>
            <dl className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {bminSupportSpecialisations.map((s) => (
                <div key={s.name}>
                  <dt className="font-heading text-[14.5px] font-bold text-brand-purple dark:text-white">{s.name}</dt>
                  <dd className="mt-0.5 text-[13px] leading-relaxed text-brand-muted dark:text-white/70">{s.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      {/* ---- PRACTICUM AND FORMATION ------------------------------------- */}
      <Section chapter="Practicum" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Practicum and formation" align="left">
            The part that cannot be done in a classroom.
          </SectionHeading>
          <p className="mb-12 max-w-3xl text-[15.5px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
            {bminPracticum.principle}
          </p>

          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-3">
            <div>
              <Eyebrow>Approved settings</Eyebrow>
              <ul className="mt-3 space-y-1.5">
                {bminPracticum.settings.map((s) => (
                  <li key={s} className="text-[13.5px] leading-snug text-brand-muted dark:text-white/75">{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <Eyebrow>Ministry activities</Eyebrow>
              <p className="mt-3 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">
                {bminPracticum.activities.join(' · ')}
              </p>
            </div>
            <div>
              <Eyebrow>What each student submits</Eyebrow>
              <ol className="mt-3 space-y-1.5">
                {bminPracticum.portfolio.map((p, i) => (
                  <li key={p} className="flex gap-3 text-[13.5px] leading-snug text-brand-muted dark:text-white/75">
                    <span aria-hidden="true" className="font-heading text-[12px] font-bold tabular-nums text-brand-gold-ink dark:text-brand-gold">
                      {i + 1}
                    </span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-16 grid gap-x-12 gap-y-10 border-t border-brand-purple/15 pt-12 dark:border-white/15 lg:grid-cols-2">
            <div>
              <h3 className="font-heading text-[19px] font-bold text-brand-purple dark:text-white">
                The Ministry Formation Portfolio
              </h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-brand-muted dark:text-white/80">
                Every student maintains one throughout the programme. It becomes the evidence that the
                student has developed beyond classroom knowledge.
              </p>
              <p className="mt-4 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/70">
                {bminFormationPortfolio.join(' · ')}
              </p>
            </div>
            <div>
              <h3 className="font-heading text-[19px] font-bold text-brand-purple dark:text-white">Assessment</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-brand-muted dark:text-white/80">
                {bminAssessmentPrinciple}
              </p>
              <dl className="mt-5 space-y-2">
                {bminAssessmentFramework.map((a) => (
                  <div key={a.kind} className="flex justify-between gap-6 border-b border-brand-purple/10 pb-1.5 dark:border-white/10">
                    <dt className="text-[13.5px] text-brand-muted dark:text-white/75">{a.kind}</dt>
                    <dd className="shrink-0 font-heading text-[13.5px] font-bold tabular-nums text-brand-purple dark:text-white">{a.range}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </Section>

      {/* ---- CAPSTONE ---------------------------------------------------- */}
      <Section chapter="Capstone" className="bg-brand-sand py-20 dark:bg-[#1c1428] sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Final year capstone" align="left">
            A research project, defended.
          </SectionHeading>
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <div>
              <Eyebrow>What the student must demonstrate</Eyebrow>
              <ol className="mt-3 space-y-2">
                {bminCapstoneRequirements.map((r, i) => (
                  <li key={r} className="flex gap-3 text-[14px] leading-relaxed text-brand-muted dark:text-white/80">
                    <span aria-hidden="true" className="font-heading text-[12px] font-bold tabular-nums text-brand-gold-ink dark:text-brand-gold">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {r}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <Eyebrow>Fields the project may address</Eyebrow>
              <ul className="mt-3 flex flex-wrap gap-2">
                {bminCapstoneTopics.map((t) => (
                  <li key={t} className="rounded-full border border-brand-purple/15 bg-white px-3 py-1.5 text-[12.5px] text-brand-muted dark:border-white/15 dark:bg-white/5 dark:text-white/80">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* ---- ADMISSION, PROGRESSION, CONDUCT ----------------------------- */}
      <Section chapter="Admission" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Admission, progression and conduct" align="left">
            What is required, and what is expected.
          </SectionHeading>

          <div className="grid gap-x-12 gap-y-11 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <h3 className="font-heading text-[16px] font-bold text-brand-purple dark:text-white">Entry requirements</h3>
              <ul className="mt-3 space-y-1.5">
                {bminEntry.map((e) => (
                  <li key={e} className="text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">{e}</li>
                ))}
              </ul>
              <p className="mt-3 text-[12.5px] leading-relaxed text-brand-muted dark:text-white/65">{bminEntryNote}</p>
            </div>

            <div>
              <h3 className="font-heading text-[16px] font-bold text-brand-purple dark:text-white">To graduate, a student must</h3>
              <ul className="mt-3 space-y-1.5">
                {bminProgression.map((p) => (
                  <li key={p} className="text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">{p}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-heading text-[16px] font-bold text-brand-purple dark:text-white">Recognition of prior learning</h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">{bminRpl.intro}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">{bminRpl.items.join(' · ')}</p>
              <p className="mt-3 text-[12.5px] leading-relaxed text-brand-muted dark:text-white/65">{bminRpl.note}</p>
            </div>

            <div>
              <h3 className="font-heading text-[16px] font-bold text-brand-purple dark:text-white">Academic integrity</h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">{bminIntegrity.join(' · ')}</p>
              <p className="mt-3 text-[12.5px] leading-relaxed text-brand-muted dark:text-white/65">{bminIntegrityNote}</p>
            </div>

            <div>
              <h3 className="font-heading text-[16px] font-bold text-brand-purple dark:text-white">Ministerial ethics</h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">{bminEthics.join(' · ')}</p>
            </div>

            <div>
              <h3 className="font-heading text-[16px] font-bold text-brand-purple dark:text-white">Safeguarding</h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">
                All ministry students receive foundational safeguarding education covering{' '}
                {bminSafeguarding.join(' · ').toLowerCase()}.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ---- THE LADDER -------------------------------------------------- */}
      <Section chapter="The ladder" className="bg-brand-cream py-20 dark:bg-[#181121] sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Academic progression" align="left">
            Where the Bachelor sits.
          </SectionHeading>
          {/* PUBLISHED AS INTENT. Some of these awards the university runs
              today and some it has stated it will build. Saying which is which
              is the difference between a plan and a promise. */}
          <p className="mb-10 max-w-3xl text-[15.5px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
            The School’s stated academic ladder. Awards the University does not yet run are published
            here as its academic direction rather than as provision open for application; the
            programmes currently offered are listed on the{' '}
            <Link href="/faculty/school-of-ministry" className="border-b border-brand-gold-deep font-semibold text-brand-gold-ink transition hover:text-brand-purple dark:text-brand-gold dark:hover:text-white">
              School of Ministry
            </Link>{' '}
            page.
          </p>

          <ol className="space-y-0">
            {bminLadder.map((l) => {
              const here = l.award === 'Bachelor of Ministry';
              return (
                <li
                  key={l.award}
                  className={`grid gap-x-8 gap-y-1 border-b border-brand-purple/12 py-4 dark:border-white/12 sm:grid-cols-[minmax(0,15rem)_minmax(0,9rem)_minmax(0,1fr)] ${
                    here ? 'bg-brand-gold/12 dark:bg-brand-gold/10' : ''
                  }`}
                >
                  <p className={`font-heading text-[15.5px] font-bold ${here ? 'text-brand-gold-ink dark:text-brand-gold' : 'text-brand-purple dark:text-white'}`}>
                    {l.award}
                    {here && <span className="ml-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em]">This programme</span>}
                  </p>
                  <p className="font-sans text-[13px] tabular-nums text-brand-muted dark:text-white/70">{l.credits}</p>
                  <p className="text-[13.5px] leading-snug text-brand-muted dark:text-white/75">{l.body}</p>
                </li>
              );
            })}
          </ol>

          {/* THE ONE FIGURE IN THIS TABLE THAT THE SITE CONTRADICTS.
              The ladder above is the framework's, and it puts the Diploma at
              120 ECTS. Every diploma in the programme catalogue publishes 180,
              on an instruction that expressly corrected an earlier 120. Both
              are the university's own word and neither has been changed.
              Printing the framework's ladder without saying so would leave a
              reader with two numbers from one institution and no way to know
              the university is aware of it. */}
          <div className="mt-8 max-w-3xl border-l-2 border-brand-gold-deep pl-5 dark:border-brand-gold/50">
            <p className="font-heading text-[14px] font-bold text-brand-purple dark:text-white">
              {CREDIT_QUESTIONS[0].finding}
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-brand-muted dark:text-white/75">
              {CREDIT_QUESTIONS[0].detail} The ladder above states the framework’s figure; the
              University’s diploma pages state 180. The ruling is pending.
            </p>
          </div>

          <div className="mt-12">
            <Eyebrow>Proposed Master of Ministry specializations</Eyebrow>
            <ul className="mt-3 flex flex-wrap gap-2">
              {bminMastersSpecialisations.map((m) => (
                <li key={m} className="rounded-full border border-brand-purple/15 bg-white px-3 py-1.5 text-[12.5px] text-brand-muted dark:border-white/15 dark:bg-white/5 dark:text-white/80">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ---- DISTINCTIVE IDENTITY ---------------------------------------- */}
      <Section chapter="Identity" className="py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Eyebrow>The distinctive identity of the School</Eyebrow>
          <p className="font-heading text-[clamp(1.6rem,3.6vw,2.5rem)] font-bold leading-[1.15] tracking-[-0.02em] text-brand-purple dark:text-white [text-wrap:balance]">
            {bminDistinctive.statement}
          </p>
          <p className="mx-auto mt-7 max-w-2xl font-heading text-[16px] font-bold leading-relaxed text-brand-gold-ink dark:text-brand-gold">
            {bminDistinctive.formula.join(' + ')}
          </p>
          <p className="mx-auto mt-7 max-w-2xl text-[15px] leading-relaxed text-brand-muted dark:text-white/80">
            This trains not only pastors and preachers, but {bminDistinctive.trains.join(', ')}.
          </p>
        </div>
      </Section>

      {/* ---- THE OPEN QUESTIONS ------------------------------------------ */}
      <Section chapter="Under approval" className="bg-brand-sand py-20 dark:bg-[#1c1428] sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <SectionHeading eyebrow="Framework under approval" align="left">
            {`${inWordsCapped(BMIN_OPEN_QUESTIONS.length)} decisions the University has still to take.`}
          </SectionHeading>
          <p className="mb-10 text-[15.5px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
            This framework is proposed for University approval. Its arithmetic holds — six semesters
            of {semesterEcts(bminSemesters[0])} ECTS, {bminTotalEcts} in total, {bminCourseCount} courses,
            no repeated code, and every prerequisite naming a course that exists. Four points remain
            open, each an academic judgement for the University rather than a correction, and each is
            recorded here with the resolution the School recommends.
          </p>

          <ol className="space-y-8">
            {BMIN_OPEN_QUESTIONS.map((q, i) => (
              <li key={q.id} className="border-l-2 border-brand-gold-deep pl-6 dark:border-brand-gold/50">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-gold-ink dark:text-brand-gold">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-1.5 font-heading text-[17.5px] font-bold leading-snug text-brand-purple dark:text-white">
                  {q.finding}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-brand-muted dark:text-white/80">{q.detail}</p>
                <p className="mt-3 text-[14px] leading-relaxed text-brand-purple dark:text-white/90">
                  <span className="font-heading font-bold">Recommended: </span>{q.recommendation}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ---- APPLY ------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden bg-brand-purple-dark py-20 text-white sm:py-24">
        <Aurora tone="dual" intensity={0.4} />
        <Grain />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-heading text-[clamp(1.9rem,4.4vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] [text-wrap:balance]">
            Begin the Bachelor of Ministry.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[15.5px] leading-relaxed text-white/85">
            Three years, {bminTotalEcts} ECTS, taught on campus, online, blended or by approved
            distance learning. Admission is enrolment: you may begin studying from the date of your offer.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link href="/apply" className="rounded-full bg-brand-gold px-8 py-3.5 font-heading text-[15px] font-semibold text-brand-purple shadow-gold transition hover:bg-brand-gold-deep">
              Begin your application
            </Link>
            <Link href="/faculty/school-of-ministry" className="rounded-full border-2 border-white/40 px-8 py-3.5 font-heading text-[15px] font-semibold text-white transition hover:border-brand-gold hover:text-brand-gold">
              The School of Ministry
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
