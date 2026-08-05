import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section } from '@/components/Section';
import Cta from '@/components/Cta';
import { getProgram, getPrograms } from '@/lib/data';

export async function generateStaticParams() {
  const programs = await getPrograms();
  return programs.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const program = await getProgram(params.slug);
  return { title: program ? program.title : 'Program' };
}

export default async function ProgramDetailPage({ params }: { params: { slug: string } }) {
  const program = await getProgram(params.slug);
  if (!program) notFound();
  const related = (await getPrograms()).filter((p) => p.slug !== program.slug && p.school === program.school).slice(0, 3);
  const courseLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: program.title,
    description: program.summary,
    provider: { '@type': 'CollegeOrUniversity', name: 'ICOF Global University', url: 'https://iguc.net' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseLd) }} />
      <section className="relative overflow-hidden bg-brand-purple py-24 text-white sm:py-28">
        <Image src={program.image} alt="" fill className="object-cover opacity-40" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-purple/70 to-brand-purple-dark/90" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            {program.school} · {program.level}
          </p>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl [text-wrap:balance]">
            {program.title}
          </h1>
          <div className="mx-auto mt-5 h-[3px] w-16 rounded bg-brand-gold" />
        </div>
      </section>

      <Section>
        <div className="mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-heading text-2xl font-bold text-brand-purple">Program Overview</h2>
            <p className="mt-4 text-brand-muted">{program.summary}</p>
            <h3 className="mt-8 font-heading text-xl font-semibold text-brand-purple">
              What You Will Learn
            </h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {program.outcomes.map((o) => (
                <li key={o} className="rounded-lg bg-white px-4 py-3 text-sm shadow-sm">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 inline h-3 w-3 text-brand-gold-deep" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                  {o}
                </li>
              ))}
            </ul>
          </div>
          <aside className="rounded-xl bg-brand-purple p-6 text-white shadow-lg">
            <h3 className="font-heading text-lg font-semibold text-brand-gold">Quick Facts</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-white/60">Level</dt>
                <dd className="font-medium">{program.level}</dd>
              </div>
              <div>
                <dt className="text-white/60">School</dt>
                <dd className="font-medium">{program.school}</dd>
              </div>
              <div>
                <dt className="text-white/60">Study Modes</dt>
                <dd className="font-medium">On campus · Online</dd>
              </div>
            </dl>
            <Link
              href="/admissions"
              className="mt-6 block rounded-full bg-brand-gold py-3 text-center font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
            >
              Apply Now
            </Link>
          </aside>
        </div>
      </Section>
      {related.length > 0 && (
        <Section className="bg-white">
          <h2 className="mb-8 text-center font-heading text-2xl font-bold text-brand-purple">
            Related programs in {program.school}
          </h2>
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/programs/${p.slug}`}
                className="group overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-28">
                  <Image src={p.image} alt={p.title} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(min-width:640px) 33vw, 100vw" />
                </div>
                <div className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-gold-deep">{p.level}</p>
                  <p className="mt-0.5 font-heading text-sm font-semibold text-brand-purple">{p.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Cta />
    </>
  );
}
