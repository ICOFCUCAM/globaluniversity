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
import { IconCampus } from '@/components/Icons';

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
      <p className="mt-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-gold-deep">
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
        image="/images/hall.jpg"
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
        <SpotlightGroup className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {faculties.items.map((f, i) => (
            <Reveal key={f} delay={i * 70}>
              <SpotlightCard
                className="flex h-full items-center gap-4 rounded-xl border border-brand-sand bg-brand-cream p-5 transition duration-500 hover:shadow-lift"
                tone="light"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-purple ring-1 ring-brand-sand">
                  <IconCampus className="h-5 w-5" />
                </span>
                <span className="font-heading text-sm font-semibold leading-snug text-brand-purple">{f}</span>
              </SpotlightCard>
            </Reveal>
          ))}
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
      <Section>
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
