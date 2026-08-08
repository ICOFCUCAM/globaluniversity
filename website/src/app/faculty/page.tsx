import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Cta from '@/components/Cta';
import { getFacultyPage } from '@/lib/data';
import Reveal from '@/components/Reveal';
import CountUp from '@/components/CountUp';
import { SpotlightGroup, SpotlightCard } from '@/components/Spotlight';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import { facultyList } from '@/content/faculties';
import { programs } from '@/content/site';
import { courses } from '@/content/courses';

export const metadata = { title: 'Schools & Faculties — ICOF Global University' };

function initials(name: string) {
  return name
    .replace(/^(Prof\.?|Dr|Rev|Bishop|Arch|Pastor)\s+/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function PersonCard({ person, size = 'md' }: { person: { name: string; role: string; image: string; bio: string }; size?: 'lg' | 'md' }) {
  const dim = size === 'lg' ? 'h-56 w-56' : 'h-36 w-36';
  return (
    <div className="group text-center">
      <div
        className={`relative mx-auto ${dim} overflow-hidden rounded-full bg-brand-purple shadow-lift ring-2 ring-transparent transition duration-500 group-hover:-translate-y-1 group-hover:shadow-lift-lg group-hover:ring-brand-gold`}
      >
        {person.image ? (
          <Image
            src={person.image}
            alt={person.name}
            fill
            loading="lazy"
            className="object-cover object-top transition duration-[900ms] ease-out group-hover:scale-105"
            sizes={size === 'lg' ? '224px' : '144px'}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-heading text-3xl font-bold text-brand-gold">
            {initials(person.name)}
          </span>
        )}
      </div>
      <h3 className="mt-4 font-heading font-semibold leading-snug text-brand-purple [text-wrap:balance]">
        {person.name}
      </h3>
      <p className="mt-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-gold-ink">
        {person.role}
      </p>
      {person.bio && <p className="mx-auto mt-2.5 max-w-xs text-xs leading-relaxed text-brand-muted">{person.bio}</p>}
    </div>
  );
}

export default async function FacultyPage() {
  const { faculties, administration, lecturers } = await getFacultyPage();

  return (
    <>
      <PageBanner
        title="Schools & Faculties"
        subtitle="Instructors who practice what they teach!"
        image="/images/graduation-2024/grad-2024-academics-seated.jpg"
      />

      {/* Instructors intro */}
      <Section>
        <SectionHeading>{faculties.instructors.heading}</SectionHeading>
        <div className="mx-auto max-w-3xl space-y-4">
          {faculties.instructors.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="leading-relaxed text-brand-muted">
              {p}
            </p>
          ))}
        </div>
      </Section>

      {/* Schools & Faculties */}
      <Section className="bg-white">
        <SectionHeading>{faculties.heading}</SectionHeading>
        <p className="mx-auto mb-10 max-w-3xl text-center text-brand-muted">{faculties.intro}</p>
        {/* Real tiles, with counts derived from the programme and course data
            rather than typed by hand. */}
        <SpotlightGroup className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {facultyList.map((f, i) => {
            const nProg = f.programSchool ? programs.filter((p) => p.school === f.programSchool).length : 0;
            const nCourse = f.courseFaculty ? courses.filter((c) => c.faculty === f.courseFaculty).length : 0;
            return (
              <Reveal key={f.slug} delay={i * 90} className={i % 2 === 1 ? 'lg:mt-8' : ''}>
                <SpotlightCard className="h-full rounded-2xl" tone="dark">
                  <Link
                    href={`/faculty/${f.slug}`}
                    className="group relative flex h-80 flex-col justify-end overflow-hidden rounded-2xl shadow-lift transition duration-500 hover:-translate-y-2 hover:shadow-lift-lg"
                  >
                    <Image
                      src={f.image}
                      alt=""
                      fill
                      loading="lazy"
                      sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
                      className="object-cover transition duration-[1100ms] ease-out group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-purple-dark via-brand-purple-dark/55 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

                    <span
                      aria-hidden="true"
                      className="absolute right-4 top-4 font-sans text-[10px] font-bold tracking-[0.2em] text-white/35 transition duration-500 group-hover:text-brand-gold"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    <div className="relative p-6">
                      <span
                        aria-hidden="true"
                        className="mb-3.5 block h-[2px] w-9 origin-left rounded-full bg-brand-gold transition-transform duration-500 group-hover:scale-x-[2.6]"
                      />
                      <h3 className="font-heading text-[17px] font-bold leading-snug text-white transition-transform duration-500 group-hover:-translate-y-1 [text-wrap:balance]">
                        {f.name}
                      </h3>
                      <p className="mt-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold/80">
                        {f.campus}
                      </p>
                      <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-white/70">{f.standsFor}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                        {nProg > 0 && <span>{nProg} programmes</span>}
                        {nCourse > 0 && <span>{nCourse} courses</span>}
                        {f.degrees && <span>{f.degrees.length} degree routes</span>}
                      </div>
                      <span className="mt-4 flex translate-y-2 items-center gap-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                        Explore the faculty
                        <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </Link>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </SpotlightGroup>
      </Section>

      {/* Fast facts */}
      <section className="relative overflow-hidden bg-brand-purple py-16 text-white">
        <Aurora tone="gold" intensity={0.4} fields={2} />
        <Grain opacity={0.045} />
        <Seam />
        <div className="relative">
          <p className="text-center font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            Faculty Fast Facts
          </p>
          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-y-10 px-4 text-center sm:grid-cols-3">
            {faculties.fastFacts.map((f, i) => (
              <div key={f.label} className={i > 0 ? 'sm:border-l sm:border-white/12' : ''}>
                <p className="font-heading text-display-lg font-bold text-brand-gold">
                  <CountUp value={f.value} />
                </p>
                <p className="mx-auto mt-3 max-w-xs font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  {f.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Administration */}
      <Section id="administration">
        <SectionHeading>Meet Our Administration</SectionHeading>
        <p className="mx-auto mb-12 max-w-3xl text-center text-brand-muted">
          ICOF Global University provides access to higher education opportunities that enable
          students to develop knowledge and skills necessary to achieve their professional goals.
        </p>
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {administration.map((person, i) => (
            <Reveal key={person.name} delay={(i % 3) * 90}>
              <PersonCard person={person} />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Lecturers */}
      <Section className="bg-white">
        <SectionHeading>Our Lecturers</SectionHeading>
        <p className="mx-auto mb-10 max-w-2xl text-center text-brand-muted">
          Here are a few of our instructors.
        </p>
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {lecturers.map((person, i) => (
            <Reveal key={person.name} delay={(i % 5) * 70}>
              <PersonCard person={person} />
            </Reveal>
          ))}
        </div>
        <div className="mt-12 rounded-xl bg-brand-cream p-8 text-center">
          <h3 className="font-heading text-xl font-bold text-brand-purple">Take the next step</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-brand-muted">
            Classes start soon and our instructors have the knowledge and experience you want. Ready
            to put it to work for you?
          </p>
          <Link
            href="/apply"
            className="mt-6 inline-block rounded-full bg-brand-gold px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
          >
            Apply Now
          </Link>
        </div>
      </Section>

      <Cta />
    </>
  );
}
