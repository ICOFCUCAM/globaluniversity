import Link from 'next/link';
import type { Metadata } from 'next';
import PageBanner from '@/components/PageBanner';
import { Section, SectionHeading } from '@/components/Section';
import { fr } from '@/content/fr';

export const metadata: Metadata = {
  title: 'Admission — Université Mondiale ICOF',
  description: fr.admission.intro,
  alternates: { canonical: '/fr/admission', languages: { en: '/admissions', fr: '/fr/admission' } },
};

export default function FrAdmission() {
  return (
    <>
      <PageBanner
        title={fr.admission.title}
        subtitle={fr.admission.subtitle}
        image="/images/admission-banner.jpg"
      />
      <Section>
        <p className="mx-auto mb-12 max-w-3xl text-center leading-relaxed text-brand-muted">
          {fr.admission.intro}
        </p>
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {fr.admission.levels.map((l) => (
            <div key={l.title} className="rounded-2xl border border-brand-sand bg-white p-7 shadow-sm">
              <h2 className="font-heading text-lg font-bold text-brand-purple">{l.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted">{l.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/apply"
            className="inline-block rounded-full bg-brand-gold px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
          >
            {fr.common.applyNow}
          </Link>
        </div>
      </Section>
      <Section className="bg-white">
        <SectionHeading eyebrow="Financement">{fr.admission.tuitionHeading}</SectionHeading>
        <p className="mx-auto max-w-3xl text-center leading-relaxed text-brand-muted">
          {fr.admission.tuition}
        </p>
      </Section>
    </>
  );
}
