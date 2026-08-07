import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Reveal from '@/components/Reveal';
import KineticText from '@/components/KineticText';
import Cta from '@/components/Cta';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import { IconCampus } from '@/components/Icons';
import { SpotlightGroup, SpotlightCard } from '@/components/Spotlight';
import { facultyList, getFaculty } from '@/content/faculties';
import { administration, contact, lecturers, programs, site } from '@/content/site';
import { courses } from '@/content/courses';

export function generateStaticParams() {
  return facultyList.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const f = getFaculty(params.slug);
  if (!f) return { title: 'Faculty — ICOF Global University' };
  return {
    title: `${f.name} — ICOF Global University`,
    description: f.standsFor,
    alternates: { canonical: `/faculty/${f.slug}` },
    openGraph: { title: `${f.name} · ICOF Global University`, description: f.standsFor, images: [f.image] },
  };
}

const LEVEL_ORDER = ['Certificate', 'Diploma', 'Bachelor', 'Master', 'Doctorate'] as const;

/**
 * Two titles for the same award rarely match character for character — the
 * faculty writes "Bachelor of Theology (B.Th.)" where the catalogue says
 * "Bachelor of Theology". Comparing on letters alone, with any parenthetical
 * abbreviation removed, is enough to stop the same degree appearing twice.
 */
const awardKey = (s: string) => s.replace(/\([^)]*\)/g, '').replace(/[^a-z]/gi, '').toLowerCase();

/** A row of short labels — used for values, research areas, careers, destinations. */
function Chips({ items, tone = 'light' }: { items: string[]; tone?: 'light' | 'dark' }) {
  return (
    <ul className="flex flex-wrap gap-2.5">
      {items.map((t, i) => (
        <Reveal key={t} delay={Math.min(i * 35, 350)}>
          <li
            className={
              tone === 'dark'
                ? 'rounded-full border border-white/20 bg-white/5 px-4 py-2 font-sans text-sm text-white/90 backdrop-blur'
                : 'rounded-full border border-brand-sand bg-white px-4 py-2 font-sans text-sm text-brand-muted shadow-sm'
            }
          >
            {t}
          </li>
        </Reveal>
      ))}
    </ul>
  );
}

/** A checked list — used for pillars, mission, why-study, student experience. */
function TickList({ items, columns = 2 }: { items: string[]; columns?: 1 | 2 }) {
  return (
    <ul className={`mt-6 grid gap-x-8 gap-y-3.5 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {items.map((t, i) => (
        <Reveal key={t} delay={Math.min(i * 45, 400)}>
          <li className="flex gap-3 text-[15px] leading-relaxed text-brand-muted">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mt-[7px] h-3 w-3 shrink-0 text-brand-gold-ink"
              fill="none"
              stroke="currentColor"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12.5 4.5 4.5L19 7" />
            </svg>
            <span>{t}</span>
          </li>
        </Reveal>
      ))}
    </ul>
  );
}

export default function FacultyDetailPage({ params }: { params: { slug: string } }) {
  const f = getFaculty(params.slug);
  if (!f) notFound();

  const facultyPrograms = f.programSchool ? programs.filter((p) => p.school === f.programSchool) : [];
  const facultyCourses = f.courseFaculty ? courses.filter((c) => c.faculty === f.courseFaculty) : [];
  // Administration is searched first and wins: several directors also appear in
  // the lecturer roster, where their role reads simply "Lecturer". Matching is
  // prefix-based so a trailing qualification ("… , M.Th") does not break it.
  const norm = (s: string) => s.replace(/[,.]/g, '').trim().toLowerCase();
  const lead =
    f.leadName
      ? [...administration, ...lecturers].find(
          (p) => norm(p.name) === norm(f.leadName!) || norm(p.name).startsWith(norm(f.leadName!)),
        )
      : undefined;
  const onlineCount = facultyCourses.filter((c) => c.online).length;
  const sibling = f.sharesProvisionWith ? getFaculty(f.sharesProvisionWith) : undefined;

  // The study ladder. A faculty teaching at five levels was showing a flat grid
  // of programme cards, so a visitor could not see that one award leads to the
  // next — which is how the Diploma and Certificate rungs went unnoticed as
  // missing. Each rung is the union of what the faculty declares it awards and
  // what the catalogue actually holds, so neither source can silently drop an
  // award the other knows about. A level with nothing at all simply does not
  // appear, and the ladder can never claim provision that does not exist.
  const declared = f.awards ?? [];
  // A catalogue entry is dropped if the faculty already named it — either by
  // the same title, or by pointing an award at the same programme page. The
  // second test matters because several catalogue entries are umbrellas: the
  // "Ministry" master card *is* the M.Div, and the "Theology" doctorate card
  // *is* the Ph.D. and the D.Min. Without it the same degree would appear
  // twice on one rung, once precisely named and once as its umbrella.
  const claimedSlugs = new Set(declared.map((a) => a.slug).filter(Boolean));
  const claimedTitles = new Set(declared.map((a) => awardKey(a.title)));
  const ladder = LEVEL_ORDER.map((level) => {
    const fromFaculty = declared.filter((a) => a.level === level);
    const fromCatalogue = facultyPrograms
      .filter((p) => p.level === level && !claimedTitles.has(awardKey(p.title)) && !claimedSlugs.has(p.slug))
      .map((p) => ({ title: p.title, level, slug: p.slug as string | undefined }));
    return { level, entries: [...fromFaculty, ...fromCatalogue] };
  }).filter((rung) => rung.entries.length > 0);
  const awaitingDetail = ladder.flatMap((r) => r.entries).filter((e) => !e.slug).length;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollegeOrUniversity',
        name: f.name,
        description: f.standsFor,
        url: `${site.url}/faculty/${f.slug}`,
        parentOrganization: { '@id': `${site.url}/#organization` },
        address: { '@type': 'PostalAddress', addressLocality: f.campus.split(',')[0], addressCountry: 'CM' },
        ...(f.researchStrengths ? { knowsAbout: f.researchStrengths } : {}),
        ...(lead
          ? { employee: { '@type': 'Person', name: lead.name, jobTitle: f.leadTitle ?? lead.role } }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
          { '@type': 'ListItem', position: 2, name: 'Schools & Faculties', item: `${site.url}/faculty` },
          { '@type': 'ListItem', position: 3, name: f.name, item: `${site.url}/faculty/${f.slug}` },
        ],
      },
    ],
  };

  const stats = [
    facultyPrograms.length ? [String(facultyPrograms.length), 'Programmes'] : null,
    facultyCourses.length ? [String(facultyCourses.length), 'Courses'] : null,
    onlineCount ? [String(onlineCount), 'Available online'] : null,
    f.researchStrengths?.length ? [String(f.researchStrengths.length), 'Research areas'] : null,
  ].filter(Boolean) as [string, string][];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner title={f.name} subtitle={f.standsFor} image={f.image} eyebrow={f.campus} />

      {/* Faculty action bar. Every route here resolves — there is no prospectus
          PDF yet, so there is no button pretending to download one. */}
      <div className="border-b border-brand-sand bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 py-5 sm:px-6">
          <Link
            href="/apply"
            className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark"
          >
            Apply Now
          </Link>
          <Link
            href="/admissions"
            className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
          >
            Entry Requirements
          </Link>
          <Link
            href={`/faculty/${f.slug}/handbook`}
            className="rounded-full border-2 border-brand-sand px-7 py-3 font-heading text-sm font-semibold text-brand-muted transition hover:border-brand-gold hover:text-brand-purple"
          >
            Faculty Handbook
          </Link>
          <Link
            href="#contact"
            className="rounded-full border-2 border-brand-sand px-7 py-3 font-heading text-sm font-semibold text-brand-muted transition hover:border-brand-gold hover:text-brand-purple"
          >
            Contact the Faculty
          </Link>
        </div>
      </div>

      {/* Live counts — nothing hand-typed; every figure is derived */}
      {stats.length > 0 && (
        <div className="border-b border-brand-sand bg-white">
          <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-px bg-brand-sand/60 lg:grid-cols-4">
            {stats.map(([v, k]) => (
              <div key={k} className="bg-white px-6 py-6 text-center">
                <dd className="font-heading text-3xl font-bold tabular text-brand-purple">{v}</dd>
                <dt className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold-ink">
                  {k}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Shared provision, stated plainly. Two campuses teaching the same
          programmes must say so, or a prospective student cannot tell whether
          the two course lists differ. */}
      {sibling && (
        <div className="border-b border-brand-sand bg-brand-cream">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-6 sm:flex-row sm:items-center sm:px-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-purple ring-1 ring-brand-sand">
              <IconCampus className="h-5 w-5" />
            </span>
            <p className="flex-1 text-sm leading-relaxed text-brand-muted">
              <strong className="font-semibold text-brand-purple">Two campuses, one faculty.</strong>{' '}
              {f.shortName} and {sibling.shortName} share the same programmes, courses and awards.
              A student at either campus studies the same material and receives the same
              qualification; only the location differs.
            </p>
            <Link
              href={`/faculty/${sibling.slug}`}
              className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-brand-purple px-5 py-2.5 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
            >
              {sibling.campus.split(',')[0]} campus
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      )}

      {/* The dean's welcome, in the dean's own words, with the dean beside it */}
      {f.deansMessage && f.deansMessage.length > 0 && (
        <Section chapter="Dean's Welcome">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-16">
            {lead && (
              <Reveal>
                <figure className="lg:sticky lg:top-28">
                  {lead.image && (
                    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-lift ring-1 ring-brand-sand">
                      <Image
                        src={lead.image}
                        alt={lead.name}
                        fill
                        className="object-cover object-top"
                        sizes="(min-width:1024px) 18rem, 100vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark/70 via-transparent to-transparent" />
                    </div>
                  )}
                  <figcaption className="mt-4">
                    <p className="font-heading text-lg font-bold leading-snug text-brand-purple">{lead.name}</p>
                    <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold-ink">
                      {f.leadTitle ?? lead.role} · {f.shortName}
                    </p>
                  </figcaption>
                </figure>
              </Reveal>
            )}
            <Reveal delay={120}>
              <Eyebrow>Dean&rsquo;s Welcome</Eyebrow>
              <KineticText className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
                {`A word from the ${(f.leadTitle ?? 'Dean').toLowerCase()}`}
              </KineticText>
              <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
              <blockquote className="mt-7 border-l-2 border-brand-gold/50 pl-6">
                {f.deansMessage.map((p, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? 'font-heading text-[19px] font-semibold leading-[1.6] text-brand-purple'
                        : 'mt-5 text-[17px] leading-[1.75] text-brand-muted'
                    }
                  >
                    {p}
                  </p>
                ))}
              </blockquote>
              {lead && (
                <Link
                  href="/faculty#administration"
                  className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-brand-purple px-6 py-2.5 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
                >
                  Meet the full academic staff
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </Reveal>
          </div>
        </Section>
      )}

      {/* About the faculty */}
      <Section className="bg-white" chapter="About">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <Eyebrow>About the Faculty</Eyebrow>
            <KineticText className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
              {`${f.shortName} at ICOF Global University`}
            </KineticText>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            {(f.about ?? f.description).map((p, i) => (
              <p key={i} className="mt-5 text-[17px] leading-[1.75] text-brand-muted">{p}</p>
            ))}
          </Reveal>
        </div>
      </Section>

      {/* Vision, mission and values — the faculty's own statement of purpose */}
      {(f.vision || f.mission || f.standsForBody) && (
        <section className="relative overflow-hidden bg-brand-purple-dark py-20 text-white" data-chapter="Purpose">
          <Aurora tone="dual" intensity={0.45} fields={2} />
          <Grain />
          <Seam />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
            <Eyebrow light>What We Stand For</Eyebrow>
            <h2 className="mt-2 font-heading text-display-sm font-bold text-white [text-wrap:balance]">
              Purpose, vision and values
            </h2>
            <div className="mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-deep" />

            {f.standsForBody && (
              <div className="mt-8 max-w-3xl">
                {f.standsForBody.map((p, i) => (
                  <p key={i} className="mt-4 text-[17px] leading-[1.75] text-white/80">{p}</p>
                ))}
              </div>
            )}

            {f.pillars && (
              <div className="mt-12">
                <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                  Founded on five pillars
                </h3>
                <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {f.pillars.map((p, i) => (
                    <Reveal key={p} delay={i * 70}>
                      <li className="h-full rounded-2xl border border-white/12 bg-white/[0.04] p-6 backdrop-blur">
                        <span className="font-heading text-2xl font-bold text-brand-gold">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <p className="mt-3 text-[15px] leading-relaxed text-white/85">{p}</p>
                      </li>
                    </Reveal>
                  ))}
                </ol>
              </div>
            )}

            {(f.vision || f.mission) && (
              <div className="mt-12 grid gap-8 lg:grid-cols-2">
                {f.vision && (
                  <Reveal>
                    <div className="h-full rounded-2xl border border-brand-gold/25 bg-white/[0.04] p-8 backdrop-blur">
                      <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                        Our Vision
                      </h3>
                      <p className="mt-4 font-heading text-[19px] font-medium leading-[1.6] text-white/90">
                        {f.vision}
                      </p>
                    </div>
                  </Reveal>
                )}
                {f.mission && (
                  <Reveal delay={120}>
                    <div className="h-full rounded-2xl border border-white/12 bg-white/[0.04] p-8 backdrop-blur">
                      <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                        Our Mission
                      </h3>
                      <ul className="mt-4 space-y-3">
                        {f.mission.map((m) => (
                          <li key={m} className="flex gap-3 text-[15px] leading-relaxed text-white/85">
                            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-gold" />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                )}
              </div>
            )}

            {f.coreValues && (
              <div className="mt-12">
                <h3 className="mb-5 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                  Core Values
                </h3>
                <Chips items={f.coreValues} tone="dark" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Why study here */}
      {f.whyStudy && f.whyStudy.length > 0 && (
        <Section className="bg-white" chapter="Why Study Here">
          <div className="mx-auto max-w-3xl">
            <SectionHeading eyebrow="Why Study With Us">
              {`Why study ${f.shortName.toLowerCase()} at ICOF?`}
            </SectionHeading>
            <TickList items={f.whyStudy} />
          </div>
        </Section>
      )}

      {/* Programmes offered — the ladder */}
      {ladder.length > 0 && (
        <Section chapter="Programmes">
          <SectionHeading eyebrow="Programmes Offered">
            {ladder.length > 1
              ? `From ${ladder[0].level.toLowerCase()} to ${ladder[ladder.length - 1].level.toLowerCase()}`
              : 'Awards offered by this faculty'}
          </SectionHeading>
          <ol className="mx-auto max-w-4xl">
            {ladder.map((rung, i) => (
              <Reveal key={rung.level} delay={i * 90}>
                <li className="relative flex gap-6 pb-12 last:pb-0">
                  {/* Connector, drawn between rungs rather than after the last.
                      It starts just below the numbered disc and runs to the top
                      of the next one, so short rungs still show a segment. */}
                  {i < ladder.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[27px] top-16 bottom-0 w-px bg-gradient-to-b from-brand-gold/70 to-brand-sand"
                    />
                  )}
                  <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-purple font-heading text-lg font-bold text-brand-gold ring-4 ring-brand-cream">
                    {i + 1}
                  </span>
                  <div className="flex-1 pt-1">
                    <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                      {rung.level}
                    </h3>
                    <ul className="mt-3 flex flex-wrap gap-2.5">
                      {rung.entries.map((a) =>
                        a.slug ? (
                          <li key={a.title}>
                            <Link
                              href={`/programs/${a.slug}`}
                              className="group inline-flex items-center gap-1.5 rounded-full border border-brand-sand bg-white px-4 py-2 font-heading text-sm font-semibold text-brand-purple shadow-sm transition hover:border-brand-gold hover:shadow-lift"
                            >
                              {a.title}
                              <span aria-hidden="true" className="text-brand-gold-ink transition-transform duration-300 group-hover:translate-x-1">→</span>
                            </Link>
                          </li>
                        ) : (
                          // Declared by the faculty, no programme page yet. Say
                          // so rather than link nowhere or quietly omit it.
                          <li
                            key={a.title}
                            className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-sand px-4 py-2 font-heading text-sm font-semibold text-brand-muted"
                          >
                            {a.title}
                            <span className="font-sans text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gold-ink">
                              Details to follow
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
          {awaitingDetail > 0 && (
            <p className="mx-auto mt-4 max-w-4xl text-center text-sm text-brand-muted">
              {awaitingDetail === 1 ? 'One award is' : `${awaitingDetail} awards are`} offered by the
              faculty with full course details still being published.{' '}
              <Link href="/contact" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Contact the faculty
              </Link>{' '}
              for the current structure.
            </p>
          )}
        </Section>
      )}

      {/* Programme cards — the awards that already have a full page behind them */}
      {facultyPrograms.length > 0 && (
        <Section className="bg-white" chapter="Explore">
          <SectionHeading eyebrow="Degree Programmes">
            {sibling ? 'What you can study at either campus' : 'What you can study here'}
          </SectionHeading>
          <SpotlightGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {facultyPrograms.map((p, i) => (
              <Reveal key={p.slug} delay={i * 80}>
                <SpotlightCard className="h-full rounded-2xl" tone="light">
                  <Link
                    href={`/programs/${p.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl bg-brand-cream shadow-lift ring-1 ring-brand-sand/70 transition duration-500 hover:-translate-y-1.5 hover:shadow-lift-lg hover:ring-brand-gold"
                  >
                    <div className="relative h-40 overflow-hidden">
                      <Image
                        src={p.image}
                        alt=""
                        fill
                        loading="lazy"
                        sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                        className="object-cover transition duration-[900ms] ease-out group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark/55 to-transparent" />
                      <span className="absolute left-4 top-4 rounded-full bg-brand-gold px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-purple shadow-sm">
                        {p.level}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-heading text-lg font-bold leading-snug text-brand-purple [text-wrap:balance]">
                        {p.title}
                      </h3>
                      <p className="mt-2.5 flex-1 line-clamp-3 text-sm leading-relaxed text-brand-muted">{p.summary}</p>
                      <span className="mt-5 flex items-center gap-1.5 font-heading text-sm font-semibold text-brand-purple">
                        View programme
                        <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
                      </span>
                    </div>
                  </Link>
                </SpotlightCard>
              </Reveal>
            ))}
          </SpotlightGroup>
        </Section>
      )}

      {/* Degrees offered by this faculty */}
      {f.degrees && f.degrees.length > 0 && (
        <section className="relative overflow-hidden bg-brand-purple-dark py-16 text-white" data-chapter="Degrees">
          <Aurora tone="purple" intensity={0.4} fields={2} />
          <Grain />
          <Seam />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
            <Eyebrow light>Degrees</Eyebrow>
            <h2 className="font-heading text-display-sm font-bold text-white">Study in this faculty</h2>
            <ul className="mt-8 flex flex-wrap gap-3">
              {f.degrees.map((dg) => (
                <li key={dg.href}>
                  <Link
                    href={dg.href}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 font-heading text-sm font-semibold text-white backdrop-blur transition hover:border-brand-gold hover:text-brand-gold"
                  >
                    {dg.label}
                    <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Research strengths */}
      {f.researchStrengths && f.researchStrengths.length > 0 && (
        <Section chapter="Research">
          <SectionHeading eyebrow="Research Strengths">
            {`${f.researchStrengths.length} areas of active research`}
          </SectionHeading>
          <div className="mx-auto max-w-4xl">
            <Chips items={f.researchStrengths} />
            <p className="mt-8 text-center text-sm text-brand-muted">
              Students are encouraged to pursue research that contributes both to academic
              scholarship and to practical service.{' '}
              <Link href="/research" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
                Research &amp; Innovation at ICOF
              </Link>
            </p>
          </div>
        </Section>
      )}

      {/* Course catalogue, pulled live */}
      {facultyCourses.length > 0 && (
        <Section className="bg-white" chapter="Courses">
          <SectionHeading eyebrow="Course Catalogue">
            {`${facultyCourses.length} courses in this faculty`}
          </SectionHeading>
          <div className="mx-auto max-w-4xl divide-y divide-brand-sand overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream">
            {facultyCourses.map((c) => (
              <div key={c.code} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-4">
                <span className="w-24 shrink-0 font-mono text-xs font-bold text-brand-gold-ink">{c.code}</span>
                <span className="flex-1 font-heading text-[15px] font-semibold text-brand-purple">{c.title}</span>
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
                  {c.level}
                </span>
                {c.online && (
                  <span className="rounded-full bg-white px-2.5 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gold-ink">
                    Online
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/courses"
              className="inline-block rounded-full border-2 border-brand-purple px-8 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
            >
              Search the full catalogue
            </Link>
          </div>
        </Section>
      )}

      {/* Student experience and partnerships */}
      {(f.studentExperience || f.partnerships) && (
        <Section chapter="Student Life">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {f.studentExperience && (
              <Reveal>
                <Eyebrow>Student Experience</Eyebrow>
                <h2 className="mt-2 font-heading text-display-sm font-bold text-brand-purple [text-wrap:balance]">
                  Learning beyond the lecture room
                </h2>
                <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
                <TickList items={f.studentExperience} columns={1} />
              </Reveal>
            )}
            {f.partnerships && (
              <Reveal delay={140}>
                <Eyebrow>Partnerships</Eyebrow>
                <h2 className="mt-2 font-heading text-display-sm font-bold text-brand-purple [text-wrap:balance]">
                  Working with churches, universities and agencies
                </h2>
                <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
                <p className="mt-6 text-[17px] leading-[1.75] text-brand-muted">
                  The faculty welcomes collaboration with:
                </p>
                <div className="mt-5">
                  <Chips items={f.partnerships} />
                </div>
                <p className="mt-6 text-[15px] leading-relaxed text-brand-muted">
                  These partnerships provide opportunities for student exchanges, joint research,
                  faculty development and collaborative ministry projects.
                </p>
              </Reveal>
            )}
          </div>
        </Section>
      )}

      {/* Careers and graduate destinations */}
      {(f.careers || f.graduateDestinations) && (
        <section className="relative overflow-hidden bg-brand-purple py-20 text-white" data-chapter="Careers">
          <Aurora tone="gold" intensity={0.35} fields={2} />
          <Grain />
          <Seam flip />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
            <Eyebrow light>Where This Leads</Eyebrow>
            <h2 className="mt-2 font-heading text-display-sm font-bold text-white [text-wrap:balance]">
              Careers and graduate destinations
            </h2>
            <div className="mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-deep" />
            {f.careers && (
              <div className="mt-10">
                <h3 className="mb-5 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                  Career opportunities
                </h3>
                <Chips items={f.careers} tone="dark" />
              </div>
            )}
            {f.graduateDestinations && (
              <div className="mt-10">
                <h3 className="mb-5 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">
                  Graduates of this faculty serve as
                </h3>
                <Chips items={f.graduateDestinations} tone="dark" />
                {f.postgraduateNote && (
                  <p className="mt-7 max-w-3xl text-[15px] leading-relaxed text-white/70">
                    {f.postgraduateNote}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Contact the faculty */}
      <Section className="bg-white" chapter="Contact" id="contact">
        <div className="mx-auto max-w-4xl">
          {/* "Speak to Theology" reads as nonsense and "Speak to GIBMAS" worse.
              The faculty is named in its own card instead of in the heading. */}
          <SectionHeading eyebrow="Contact">Get in touch with the faculty</SectionHeading>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Faculty', f.name],
              ['Campus', f.campus],
              ['Address', contact.address],
              ['Telephone', contact.phone],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-brand-sand bg-brand-cream p-6">
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">{k}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-brand-purple">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={`mailto:${contact.email}?subject=${encodeURIComponent(`Enquiry — ${f.name}`)}`}
              className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark"
            >
              Email the faculty
            </a>
            <Link
              href="/contact"
              className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
            >
              All contact details
            </Link>
          </div>
        </div>
      </Section>

      {/* Other faculties */}
      <Section chapter="Elsewhere">
        <SectionHeading eyebrow="Elsewhere in the University">Other schools and faculties</SectionHeading>
        <SpotlightGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {facultyList.filter((o) => o.slug !== f.slug).map((o, i) => (
            <Reveal key={o.slug} delay={i * 80}>
              <SpotlightCard className="h-full rounded-2xl" tone="dark">
                <Link
                  href={`/faculty/${o.slug}`}
                  className="group relative block h-56 overflow-hidden rounded-2xl shadow-lift transition duration-500 hover:-translate-y-2 hover:shadow-lift-lg"
                >
                  <Image src={o.image} alt="" fill loading="lazy" sizes="25vw" className="object-cover transition duration-[1100ms] group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark via-brand-purple-dark/50 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <span aria-hidden="true" className="mb-3 block h-[2px] w-9 origin-left rounded-full bg-brand-gold transition-transform duration-500 group-hover:scale-x-[2.6]" />
                    <p className="font-heading text-base font-bold leading-snug text-white [text-wrap:balance]">
                      {o.shortName}
                    </p>
                    <p className="mt-1 font-sans text-[11px] text-white/65">{o.campus}</p>
                  </div>
                </Link>
              </SpotlightCard>
            </Reveal>
          ))}
        </SpotlightGroup>
      </Section>

      <Cta />
    </>
  );
}
