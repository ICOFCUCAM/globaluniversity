import Image from 'next/image';
import Reveal from '@/components/Reveal';
import { SpotlightGroup, SpotlightCard } from '@/components/Spotlight';
import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import { getAdmissions } from '@/lib/data';

export const metadata = { title: 'Admissions' };

export default async function AdmissionsPage() {
  const admissions = await getAdmissions();

  return (
    <>
      <PageBanner title="Admissions" image="/images/admission-banner.jpg" />
      <Section>
        <SectionHeading>{admissions.heading}</SectionHeading>
        <p className="mx-auto mb-12 max-w-3xl text-center text-brand-muted">{admissions.intro}</p>

        <SpotlightGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {admissions.steps.map((step) => (
            <SpotlightCard key={step.title} className="h-full overflow-hidden rounded-2xl border border-brand-sand bg-white p-7 transition duration-500 hover:shadow-lift" tone="light">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-brand-gold-deep to-brand-gold transition-transform duration-500 group-hover/sc:scale-x-100" />
              <h3 className="font-heading text-lg font-bold leading-snug text-brand-purple [text-wrap:balance]">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted">{step.body}</p>
            </SpotlightCard>
          ))}
        </SpotlightGroup>

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-2">
          <div className="relative h-72 overflow-hidden rounded-xl shadow-lg">
            <Image src={admissions.image} alt="Admission process" fill className="object-cover" />
          </div>
          <div>
            <h3 className="font-heading text-2xl font-bold text-brand-purple">Ready to Apply?</h3>
            <p className="mt-4 text-brand-muted">
              The online application takes about 20 minutes. Have your identification, academic
              records and references ready. Questions? Write to{' '}
              <a href={`mailto:${admissions.email}`} className="font-semibold text-brand-gold-deep">
                {admissions.email}
              </a>
              .
            </p>
            <a
              href={admissions.applyUrl}
              className="mt-8 inline-block rounded-full bg-brand-purple px-8 py-3 font-heading font-semibold text-white transition hover:bg-brand-purple-dark"
            >
              Start Online Application →
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}
