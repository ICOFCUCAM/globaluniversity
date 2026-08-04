import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageBanner from '@/components/PageBanner';
import { Section, SectionHeading } from '@/components/Section';
import Cta from '@/components/Cta';
import { degreeLevels, getDegreeLevel } from '@/content/pages';

export const dynamicParams = false;

export function generateStaticParams() {
  return degreeLevels.map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const level = getDegreeLevel(params.slug);
  return {
    title: level ? `${level.title} — ICOF Global University` : 'ICOF Global University',
    description: level?.subtitle,
  };
}

export default function DegreeLevelPage({ params }: { params: { slug: string } }) {
  const level = getDegreeLevel(params.slug);
  if (!level) notFound();

  return (
    <>
      <PageBanner title={level.headline} subtitle={level.subtitle} image={level.image} />

      <Section>
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-2xl font-bold uppercase text-brand-purple">
            {level.why.heading}
          </h2>
          {level.why.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="mt-4 leading-relaxed text-brand-muted">
              {p}
            </p>
          ))}
        </div>
      </Section>

      <Section className="bg-white">
        <SectionHeading>{level.title} Programs</SectionHeading>
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {level.facultyPrograms.map((fp) => (
            <div key={fp.faculty} className="rounded-xl border border-brand-sand bg-brand-cream p-6">
              <h3 className="font-heading text-lg font-bold text-brand-purple">{fp.faculty}</h3>
              <ul className="mt-4 space-y-2">
                {fp.programs.map((p) => (
                  <li key={p} className="flex gap-3 text-sm text-brand-muted">
                    <span className="text-brand-gold-deep">◆</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {level.duration && (
          <p className="mt-8 text-center font-heading font-semibold uppercase tracking-wide text-brand-purple">
            Duration: {level.duration}
          </p>
        )}
      </Section>

      <Section>
        <SectionHeading>Admission Requirements</SectionHeading>
        <div className="mx-auto max-w-3xl">
          <p className="mb-6 font-medium text-brand-purple">
            To enter a {level.title.replace(/s$/, '')} program you must:
          </p>
          <ul className="space-y-3">
            {level.requirements.map((r) => (
              <li key={r.slice(0, 40)} className="flex gap-3 text-brand-muted">
                <span className="mt-1 text-brand-gold-deep">✓</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-lg bg-brand-cream p-4 text-sm text-brand-muted">
            <strong className="text-brand-purple">For international students:</strong> {level.international}
          </p>
          <div className="mt-8 text-center">
            <Link
              href="/apply"
              className="inline-block rounded-full bg-brand-gold px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
            >
              🎓 Apply Now
            </Link>
          </div>
        </div>
      </Section>

      <Cta />
    </>
  );
}
