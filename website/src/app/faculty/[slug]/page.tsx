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
import { administration, lecturers, programs, site } from '@/content/site';
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
    f.degrees?.length ? [String(f.degrees.length), 'Degree routes'] : null,
  ].filter(Boolean) as [string, string][];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner title={f.name} subtitle={f.standsFor} image={f.image} eyebrow={f.campus} />

      {/* Live counts — nothing hand-typed; every figure is derived */}
      {stats.length > 0 && (
        <div className="border-b border-brand-sand bg-white">
          <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-px bg-brand-sand/60 lg:grid-cols-4">
            {stats.map(([v, k]) => (
              <div key={k} className="bg-white px-6 py-6 text-center">
                <dd className="font-heading text-3xl font-bold tabular text-brand-purple">{v}</dd>
                <dt className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold-deep">
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

      {/* About the faculty, with its director alongside */}
      <Section chapter="About">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:gap-16">
          <Reveal>
            <Eyebrow>About the Faculty</Eyebrow>
            <KineticText className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
              {`${f.shortName} at ICOF Global University`}
            </KineticText>
            <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
            {f.description.map((p, i) => (
              <p key={i} className="mt-5 text-[17px] leading-[1.75] text-brand-muted">{p}</p>
            ))}
          </Reveal>

          {lead && (
            <Reveal delay={140}>
              <div className="rounded-2xl border border-brand-sand bg-brand-cream p-7 text-center">
                <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold-deep">
                  Faculty Leadership
                </p>
                {lead.image && (
                  <div className="relative mx-auto mt-5 h-32 w-32 overflow-hidden rounded-full shadow-lift ring-2 ring-brand-gold/40">
                    <Image src={lead.image} alt={lead.name} fill className="object-cover object-top" sizes="128px" />
                  </div>
                )}
                <p className="mt-4 font-heading text-lg font-bold leading-snug text-brand-purple">{lead.name}</p>
                <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-gold-deep">
                  {lead.role}
                </p>
                {lead.bio && <p className="mt-3 text-xs leading-relaxed text-brand-muted">{lead.bio}</p>}
                <Link
                  href="/faculty#administration"
                  className="mt-5 inline-block rounded-full border-2 border-brand-purple px-5 py-2 font-heading text-xs font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
                >
                  Full administration
                </Link>
              </div>
            </Reveal>
          )}
        </div>
      </Section>

      {/* Degrees offered by this faculty */}
      {f.degrees && f.degrees.length > 0 && (
        <section className="relative overflow-hidden bg-brand-purple-dark py-16 text-white" data-chapter="Degrees">
          <Aurora tone="purple" intensity={0.4} fields={2} />
          <Grain />
          <Seam />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
            <Eyebrow light>Degrees</Eyebrow>
            <h2 className="font-heading text-display-sm font-bold text-white">Study in this faculty</h2>
            <div className="mt-4 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />
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

      {/* Programmes, pulled live */}
      {facultyPrograms.length > 0 && (
        <Section className="bg-white" chapter="Programmes">
          <SectionHeading eyebrow="Programmes">
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

      {/* Courses, pulled live */}
      {facultyCourses.length > 0 && (
        <Section chapter="Courses">
          <SectionHeading eyebrow="Course Catalogue">
            {`${facultyCourses.length} courses in this faculty`}
          </SectionHeading>
          <div className="mx-auto max-w-4xl divide-y divide-brand-sand overflow-hidden rounded-2xl border border-brand-sand bg-white">
            {facultyCourses.map((c) => (
              <div key={c.code} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-4">
                <span className="w-24 shrink-0 font-mono text-xs font-bold text-brand-gold-deep">{c.code}</span>
                <span className="flex-1 font-heading text-[15px] font-semibold text-brand-purple">{c.title}</span>
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
                  {c.level}
                </span>
                {c.online && (
                  <span className="rounded-full bg-brand-cream px-2.5 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gold-deep">
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

      {/* Other faculties */}
      <Section className="bg-white">
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
                    <h3 className="font-heading text-[15px] font-bold leading-snug text-white [text-wrap:balance]">{o.shortName}</h3>
                    <p className="mt-1 font-sans text-[10px] uppercase tracking-[0.14em] text-white/60">{o.campus}</p>
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
