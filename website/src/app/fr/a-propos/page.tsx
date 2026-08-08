import type { Metadata } from 'next';
import PageBanner from '@/components/PageBanner';
import { Section } from '@/components/Section';
import { fr } from '@/content/fr';

export const metadata: Metadata = {
  title: 'À propos — Université Mondiale ICOF',
  description: fr.about.subtitle,
  alternates: { canonical: '/fr/a-propos', languages: { en: '/about', fr: '/fr/a-propos' } },
};

export default function FrAbout() {
  return (
    <>
      <PageBanner title={fr.about.title} subtitle={fr.about.subtitle} image="/images/graduation-2024/grad-2024-academic-procession.jpg" />
      <Section>
        <div className="mx-auto max-w-3xl space-y-10">
          {fr.about.sections.map((s) => (
            <div key={s.heading}>
              <h2 className="font-heading text-2xl font-bold text-brand-purple">{s.heading}</h2>
              <p className="mt-4 leading-relaxed text-brand-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
