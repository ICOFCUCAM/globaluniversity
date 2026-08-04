import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Cta from '@/components/Cta';
import { getFacultyPage } from '@/lib/data';

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
    <div className="text-center">
      <div className={`relative mx-auto ${dim} overflow-hidden rounded-full bg-brand-purple shadow-lg`}>
        {person.image ? (
          <Image src={person.image} alt={person.name} fill className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-heading text-3xl font-bold text-brand-gold">
            {initials(person.name)}
          </span>
        )}
      </div>
      <h3 className="mt-4 font-heading font-semibold text-brand-purple">{person.name}</h3>
      <p className="text-sm font-medium text-brand-gold-deep">{person.role}</p>
      {person.bio && <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-brand-muted">{person.bio}</p>}
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
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {faculties.items.map((f) => (
            <div
              key={f}
              className="flex items-center gap-3 rounded-xl border border-brand-sand bg-brand-cream p-5"
            >
              <span className="text-2xl">🏛️</span>
              <span className="font-heading text-sm font-semibold text-brand-purple">{f}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Fast facts */}
      <section className="bg-brand-purple py-14 text-white">
        <h2 className="text-center font-heading text-2xl font-bold uppercase text-brand-gold">
          Faculty Fast Facts
        </h2>
        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-8 px-4 text-center sm:grid-cols-3">
          {faculties.fastFacts.map((f) => (
            <div key={f.label}>
              <p className="font-heading text-5xl font-extrabold text-brand-gold">{f.value}</p>
              <p className="mx-auto mt-3 max-w-xs text-sm text-white/85">{f.label}</p>
            </div>
          ))}
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
          {administration.map((person) => (
            <PersonCard key={person.name} person={person} />
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
          {lecturers.map((person) => (
            <PersonCard key={person.name} person={person} />
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
            🎓 Apply Now
          </Link>
        </div>
      </Section>

      <Cta />
    </>
  );
}
