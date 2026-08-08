import type { Metadata } from 'next';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import Reveal from '@/components/Reveal';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import { site } from '@/content/site';
import { allStatuses } from '@/lib/status';

export const metadata: Metadata = {
  title: 'Admissions Portal — ICOF Global University',
  description:
    'Apply to ICOF Global University, upload your documents, pay the application fee and track your application through Finance and the Office of the Registrar.',
  alternates: { canonical: '/admissions-portal' },
};

/**
 * The applicant's view of the pipeline. Deliberately the same stages, in the
 * same order, that Finance and the Registrar work to — an applicant who can
 * see the machine they are inside asks fewer anxious questions, and a status
 * page that describes a different process from the one actually running is
 * worse than none.
 */
const JOURNEY = [
  {
    n: 1,
    title: 'Create an applicant account',
    body: 'Your applicant account is not a student account. It exists so you can save a part-finished application, upload documents and follow your progress.',
    who: 'You',
  },
  {
    n: 2,
    title: 'Complete the application',
    body: 'Faculty, programme, degree, campus, study mode and intake, together with your personal and academic details and your uploaded documents.',
    who: 'You',
  },
  {
    n: 3,
    title: 'Pay the application fee',
    body: 'Your application is submitted and marked Awaiting Payment Verification. Nothing moves until the payment is confirmed.',
    who: 'You',
  },
  {
    n: 4,
    title: 'Finance verifies the payment',
    body: 'The Finance Office checks the amount, the reference and the currency, and that the payment is not a duplicate. Your payment status changes from Pending to Verified.',
    who: 'Finance Office',
  },
  {
    n: 5,
    title: 'The Office of the Registrar examines your application',
    body: 'Your application becomes visible to the Registrar only once Finance has verified the payment. The Registrar checks your qualifications, certificates, identity documents, English requirement and eligibility for the programme.',
    who: 'Office of the Registrar',
  },
  {
    n: 6,
    title: 'Decision',
    body: 'The Registrar approves, asks you for further documents, or rejects the application with an explanation. If you are approved, your student account is created automatically and your student number, username and temporary password are emailed to you.',
    who: 'Office of the Registrar',
  },
];

const CAN = ['Apply', 'Upload documents', 'Pay the application fee', 'Track your application'];
const CANNOT = ['Register for courses', 'View grades', 'Access the learning platform'];

export default function AdmissionsPortalPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Admissions Portal',
    url: `${site.url}/admissions-portal`,
    isPartOf: { '@id': `${site.url}/#organization` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="Admissions Portal"
        subtitle="Apply, upload your documents, pay the application fee and follow your application through to a decision."
        image="/images/graduation-2024/grad-2024-graduate-flowers.jpg"
        eyebrow="For applicants"
      />

      <div className="border-b border-brand-sand bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 py-5 sm:px-6">
          <Link
            href="/apply"
            className="rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark"
          >
            Start an application
          </Link>
          <Link
            href="/admissions"
            className="rounded-full border-2 border-brand-purple px-7 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
          >
            Entry requirements
          </Link>
          <Link
            href="/academic-regulations#fees"
            className="rounded-full border-2 border-brand-sand px-7 py-3 font-heading text-sm font-semibold text-brand-muted transition hover:border-brand-gold hover:text-brand-purple"
          >
            Fees
          </Link>
        </div>
      </div>

      {/* The distinction that causes most confusion, said first */}
      <section className="relative overflow-hidden bg-brand-purple-dark py-16 text-white">
        <Aurora tone="dual" intensity={0.4} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <Eyebrow light>Two different portals</Eyebrow>
          <h2 className="mt-2 font-heading text-display-sm font-bold text-white [text-wrap:balance]">
            This is not the Student Portal
          </h2>
          <div className="mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-deep" />
          <p className="mt-7 text-[17px] leading-[1.75] text-white/85">
            The Admissions Portal is where you apply. The Student Portal is for enrolled students
            only and carries no application forms. You cannot create a student account yourself —
            it is created for you, automatically, at the moment the Registrar approves your
            application.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 backdrop-blur">
              <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-brand-gold">
                As an applicant you can
              </h3>
              <ul className="mt-4 space-y-2">
                {CAN.map((c) => (
                  <li key={c} className="flex gap-3 text-[15px] text-white/85">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-[7px] h-3 w-3 shrink-0 text-brand-gold" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.5 4.5L19 7" />
                    </svg>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 backdrop-blur">
              <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                Not until you are admitted
              </h3>
              <ul className="mt-4 space-y-2">
                {CANNOT.map((c) => (
                  <li key={c} className="flex gap-3 text-[15px] text-white/55">
                    <span aria-hidden="true" className="mt-[10px] h-px w-3 shrink-0 bg-white/40" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* The journey */}
      <Section chapter="How it works">
        <SectionHeading eyebrow="Your application, step by step">
          From application to student number
        </SectionHeading>
        <ol className="mx-auto max-w-4xl">
          {JOURNEY.map((j, i) => (
            <Reveal key={j.n} delay={i * 70}>
              <li className="relative flex gap-6 pb-10 last:pb-0">
                {i < JOURNEY.length - 1 && (
                  <span aria-hidden="true" className="absolute left-[23px] top-14 bottom-0 w-px bg-gradient-to-b from-brand-gold/70 to-brand-sand" />
                )}
                <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-purple font-heading text-base font-bold text-brand-gold ring-4 ring-brand-cream">
                  {j.n}
                </span>
                <div className="flex-1 pt-1">
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
                    {j.who}
                  </p>
                  <h3 className="mt-1 font-heading text-lg font-bold text-brand-purple">{j.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-brand-muted">{j.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* What each status means */}
      <Section className="bg-white" chapter="Statuses">
        <SectionHeading eyebrow="Tracking">What each status means</SectionHeading>
        <div className="mx-auto max-w-3xl space-y-4">
          {allStatuses.map((m) => (
            <div key={m.key} className="flex gap-4 rounded-2xl border border-brand-sand bg-brand-cream p-5">
              <span aria-hidden="true" className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${m.dot}`} />
              <div>
                <p className="font-heading text-[16px] font-bold text-brand-purple">
                  {m.label}{' '}
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                    {m.colour}
                  </span>
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-brand-muted">{m.meaning}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-brand-muted">
          Your application fee is not refundable once the Registrar has begun examining your
          application. Refunds on withdrawal from study are set out in the{' '}
          <Link href="/academic-regulations#withdrawal" className="font-semibold text-brand-purple underline decoration-brand-gold underline-offset-4">
            Academic Regulations
          </Link>
          .
        </p>
      </Section>

      <Section chapter="Start">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading eyebrow="Ready?">Begin your application</SectionHeading>
          <p className="text-[17px] leading-[1.75] text-brand-muted">
            The application is free to submit and can be saved and returned to. If you are unsure
            whether you meet the entry requirements, the admissions team would rather you asked
            than assumed.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/apply" className="rounded-full bg-brand-purple px-8 py-3.5 font-heading text-sm font-semibold text-white shadow-lift transition hover:bg-brand-purple-dark">
              Start an application
            </Link>
            <Link href="/contact" className="rounded-full border-2 border-brand-purple px-8 py-3.5 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white">
              Ask admissions a question
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
