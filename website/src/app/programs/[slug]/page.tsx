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

  return (
    <>
      <section className="relative bg-brand-purple py-24 text-white">
        <Image src={program.image} alt="" fill className="object-cover opacity-20" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-gold">
            {program.school} · {program.level}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold uppercase tracking-wide sm:text-5xl">
            {program.title}
          </h1>
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
                  <span className="mr-2 text-brand-gold-deep">✓</span>
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
      <Cta />
    </>
  );
}
