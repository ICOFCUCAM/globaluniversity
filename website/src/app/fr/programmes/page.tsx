import Link from 'next/link';
import type { Metadata } from 'next';
import PageBanner from '@/components/PageBanner';
import { Section, SectionHeading } from '@/components/Section';
import { fr } from '@/content/fr';

export const metadata: Metadata = {
  title: 'Diplômes et programmes — Université Mondiale ICOF',
  description: fr.programs.intro,
  alternates: { canonical: '/fr/programmes', languages: { en: '/programs', fr: '/fr/programmes' } },
};

export default function FrPrograms() {
  return (
    <>
      <PageBanner title={fr.programs.title} subtitle={fr.programs.subtitle} image="/images/graduation.jpg" />
      <Section>
        <p className="mx-auto mb-12 max-w-3xl text-center leading-relaxed text-brand-muted">
          {fr.programs.intro}
        </p>
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {fr.programs.faculties.map((f) => (
            <div key={f.name} className="rounded-2xl border border-brand-sand bg-white p-7 shadow-sm">
              <h2 className="font-heading text-lg font-bold text-brand-purple">{f.name}</h2>
              <ul className="mt-4 space-y-2">
                {f.items.map((it) => (
                  <li key={it} className="flex gap-3 text-sm text-brand-muted">
                    <span aria-hidden="true" className="text-brand-gold-deep">◆</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
      <Section className="bg-white">
        <SectionHeading eyebrow="Enseignement à distance">{fr.programs.onlineHeading}</SectionHeading>
        <p className="mx-auto max-w-3xl text-center leading-relaxed text-brand-muted">{fr.programs.online}</p>
        <div className="mt-10 text-center">
          <Link
            href="/apply"
            className="inline-block rounded-full bg-brand-gold px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
          >
            🎓 {fr.common.applyNow}
          </Link>
        </div>
      </Section>
    </>
  );
}
