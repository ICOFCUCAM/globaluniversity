import type { Metadata } from 'next';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import Reveal from '@/components/Reveal';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import { site } from '@/content/site';
import { lifecycle, offices, workflows, admissionDecisions } from '@/lib/lifecycle';
import { roleLabels } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'Enterprise Architecture — ICOF Global University',
  description:
    'The blueprint: governance, the student lifecycle, seven offices, the approval chains for grades and graduation, and the AI layer with its governance conditions.',
  alternates: { canonical: '/erp/architecture' },
};

/** The governance chain, top down, exactly as the university sets it. */
const GOVERNANCE = [
  { label: 'Board of Trustees', note: 'Adopts the Statutes. Confers no degrees, admits no students.' },
  { label: 'Chancellor', note: 'Head of the university.' },
  { label: 'Vice Chancellor', note: 'Leads academic administration. Chairs Senate.' },
];

const DIRECTORATES = [
  { label: 'Registrar', note: 'Academic records, admissions, enrolment, transcripts, graduation.' },
  { label: 'Finance Office', note: 'All money. No admissions decisions.' },
  { label: 'Academic Affairs', note: 'Programmes, timetable, teaching allocation, quality.' },
  { label: 'ICT Services', note: 'Accounts, availability, audit, integration. Access is not authority.' },
];

const SYSTEMS = ['Admissions', 'Student ERP', 'Learning LMS', 'Research ERP'];

/**
 * The AI layer. Recorded with the conditions each assistant must meet before it
 * is built, because "AI Registrar — suggests approvals" is one design decision
 * away from an unaccountable admissions decision.
 */
const AI_LAYER = [
  {
    title: 'AI Admissions Officer',
    does: ['Reads applications', 'Flags missing documents', 'Detects duplicates', 'Suggests eligibility'],
    conditions: [
      'Advisory only. It may sort and flag; it may not decide, and the Registrar must be able to act against every suggestion without friction.',
      'Every flag must show why. A recommendation a human cannot audit is a recommendation a human cannot defend at appeal.',
      'It must be tested for disparate impact by nationality, sex and age before it touches a real application.',
    ],
  },
  {
    title: 'AI Finance Officer',
    does: ['Detects incorrect payments', 'Predicts revenue', 'Sends reminders'],
    conditions: [
      'Payment verification stays with a person. Detection is the assistant’s job; confirmation is Finance’s.',
      'Reminders must be rate-limited and stop on dispute — automated chasing of a student who has already paid does real harm.',
    ],
  },
  {
    title: 'AI Registrar',
    does: ['Checks prerequisites', 'Detects incomplete records', 'Suggests approvals', 'Flags anomalies'],
    conditions: [
      'Prerequisite checking is deterministic and needs no model — it belongs in the registration rules, not the AI layer.',
      'Suggesting an approval is the highest-risk item on this page. It should be built last, if at all, and never as a default the Registrar must override.',
    ],
  },
  {
    title: 'AI Academic Adviser',
    does: ['Warns students at risk', 'Recommends courses', 'Monitors GPA', 'Suggests support services'],
    conditions: [
      'A risk flag goes to the human adviser first, not to the student. Being told by software that you are failing is not pastoral care.',
      'Retention models encode past bias readily. If a cohort was underserved historically, the model learns to predict that they will fail again.',
    ],
  },
  {
    title: 'AI Research Assistant',
    does: ['Literature search', 'Citation formatting', 'Research planning', 'Proposal review'],
    conditions: [
      'The university has no published position on generative AI in assessed work. That policy has to exist before the university offers students a tool to do it with.',
      'Citation formatting and literature search are low-risk and could ship first.',
    ],
  },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 font-heading text-sm font-semibold text-white backdrop-blur">
      {children}
    </span>
  );
}

export default function ArchitecturePage() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    name: 'ICOF Global University enterprise architecture',
    url: `${site.url}/erp/architecture`,
    publisher: { '@id': `${site.url}/#organization` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="Enterprise Architecture"
        subtitle="Every office connected through workflows rather than operating independently — the blueprint developers build from."
        image="/images/graduation.jpg"
        eyebrow="For developers and for the Board"
      />

      {/* Governance */}
      <section className="relative overflow-hidden bg-brand-purple-dark py-16 text-white">
        <Aurora tone="dual" intensity={0.4} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
          <Eyebrow light>Governance</Eyebrow>
          <h2 className="mt-2 font-heading text-display-sm font-bold text-white [text-wrap:balance]">
            Authority runs down. Data runs through one system.
          </h2>
          <div className="mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-deep" />
          <ol className="mt-9 space-y-3">
            {GOVERNANCE.map((g, i) => (
              <li key={g.label} className="flex items-start gap-4">
                <span className="mt-1 font-mono text-xs text-brand-gold">{i + 1}</span>
                <div>
                  <p className="font-heading text-lg font-bold text-white">{g.label}</p>
                  <p className="mt-0.5 text-[15px] text-white/70">{g.note}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {DIRECTORATES.map((d) => (
              <div key={d.label} className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur">
                <p className="font-heading text-[16px] font-bold text-brand-gold">{d.label}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">{d.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold">
            University Management System
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {SYSTEMS.map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </div>
      </section>

      {/* Lifecycle */}
      <Section chapter="Lifecycle">
        <SectionHeading eyebrow="One record, thirteen stages">The student lifecycle</SectionHeading>
        <div className="mx-auto max-w-4xl">
          <p className="rounded-2xl border-l-2 border-brand-gold bg-brand-cream p-6 text-[17px] leading-[1.75] text-brand-purple">
            <strong>Every step updates the same student record. Nothing is duplicated.</strong> That
            sentence is the architecture. It also stops being true in most university systems the
            same way each time: an office finds the master record has no field for something it
            needs, keeps a spreadsheet, and six months later two systems disagree about who is
            enrolled. The defence is not discipline — it is that every stage below names the one
            record it writes to, and there is nowhere else to write.
          </p>
          <ol className="mt-10">
            {lifecycle.map((l, i) => (
              <Reveal key={l.key} delay={Math.min(i * 35, 350)}>
                <li className="relative flex gap-5 pb-8 last:pb-0">
                  {i < lifecycle.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[19px] top-11 bottom-0 w-px bg-gradient-to-b from-brand-gold/60 to-brand-sand" />
                  )}
                  <span
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold ring-4 ring-brand-cream ${
                      l.outsideEnrolment ? 'bg-brand-sand text-brand-purple' : 'bg-brand-purple text-brand-gold'
                    }`}
                  >
                    {l.n}
                  </span>
                  <div className="flex-1 pt-1">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <h3 className="font-heading text-[17px] font-bold text-brand-purple">{l.label}</h3>
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-gold-ink">
                        {l.owner}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-brand-muted">{l.writes}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </Section>

      {/* Admission decisions */}
      <Section className="bg-white" chapter="Decisions">
        <SectionHeading eyebrow="The Registrar's four outcomes">Including conditional admission</SectionHeading>
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
          {admissionDecisions.map((d) => (
            <div key={d.key} className="rounded-2xl border border-brand-sand bg-brand-cream p-6">
              <div className="flex items-center gap-3">
                <h3 className="font-heading text-[17px] font-bold text-brand-purple">{d.label}</h3>
                <span
                  className={`rounded-full px-2.5 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.1em] ${
                    d.createsAccount ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {d.createsAccount ? 'Creates account' : 'No account'}
                </span>
              </div>
              <p className="mt-2.5 text-[15px] leading-relaxed text-brand-muted">{d.description}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-4xl rounded-2xl border border-dashed border-brand-gold/60 bg-brand-cream/70 p-6 text-[15px] leading-relaxed text-brand-muted">
          <span className="font-semibold text-brand-purple">Conditional admission is built and live. </span>
          Conditions are stored against the master record with a due date each, not written into a
          note — so &ldquo;students with outstanding conditions&rdquo; is a query rather than a
          reading exercise, and the welcome email states the conditions and their deadlines. The
          status is distinct from Approved for the same reason.
        </p>
      </Section>

      {/* Offices */}
      <Section chapter="Offices">
        <SectionHeading eyebrow="Seven offices">What each controls, and what it may not</SectionHeading>
        <div className="mx-auto max-w-4xl space-y-5">
          {offices.map((o, i) => (
            <Reveal key={o.n} delay={Math.min(i * 40, 300)}>
              <div className="overflow-hidden rounded-2xl border border-brand-sand bg-white shadow-sm">
                <div className="flex flex-wrap items-start gap-4 border-b border-brand-sand/70 bg-brand-cream px-6 py-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple font-heading text-sm font-bold text-brand-gold">
                    {o.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-lg font-bold text-brand-purple">{o.name}</h3>
                    <p className="mt-1 text-sm text-brand-muted">{o.controls}</p>
                    <p className="mt-1.5 font-sans text-[10px] uppercase tracking-[0.12em] text-brand-gold">
                      {o.roles.map((r) => roleLabels[r]).join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="grid gap-6 px-6 py-5 sm:grid-cols-3">
                  <div>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">Responsibilities</p>
                    <ul className="mt-3 space-y-1.5">
                      {o.responsibilities.map((r) => (
                        <li key={r} className="text-[13px] leading-relaxed text-brand-muted">{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">Dashboard</p>
                    <ul className="mt-3 space-y-1.5">
                      {o.dashboard.map((d) => (
                        <li key={d} className="text-[13px] leading-relaxed text-brand-muted">{d}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-red-700">Cannot</p>
                    <ul className="mt-3 space-y-1.5">
                      {o.cannot.map((c) => (
                        <li key={c} className="text-[13px] leading-relaxed text-brand-muted">{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Workflows */}
      <Section className="bg-white" chapter="Workflows">
        <SectionHeading eyebrow="Approval chains">Three workflows, declared</SectionHeading>
        <div className="mx-auto max-w-4xl space-y-10">
          {workflows.map((w) => (
            <div key={w.key} className="rounded-2xl border border-brand-sand bg-brand-cream p-6 sm:p-8">
              <h3 className="font-heading text-xl font-bold text-brand-purple">{w.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-brand-muted">{w.purpose}</p>
              <ol className="mt-6 space-y-3">
                {w.steps.map((st) => (
                  <li key={st.n} className="flex gap-4 rounded-xl bg-white p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-purple font-mono text-[11px] font-bold text-brand-gold">
                      {st.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-[15px] font-bold text-brand-purple">
                        {st.actor}
                        {st.mandatory && (
                          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-red-700 ring-1 ring-red-200">
                            Cannot be skipped
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed text-brand-muted">{st.action}</p>
                      {st.requires && (
                        <p className="mt-1.5 text-[12px] italic text-brand-muted">
                          Requires: {st.requires.join('; ')}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-5 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">
                Writes
              </p>
              <p className="mt-1.5 text-[14px] text-brand-muted">{w.writes.join(' · ')}</p>
              {w.notes && (
                <ul className="mt-4 space-y-2">
                  {w.notes.map((n) => (
                    <li key={n} className="flex gap-3 text-[14px] leading-relaxed text-brand-muted">
                      <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand-gold" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* AI layer */}
      <Section chapter="AI layer">
        <SectionHeading eyebrow="Proposed, with conditions">The AI layer</SectionHeading>
        <div className="mx-auto max-w-4xl">
          <p className="text-[17px] leading-[1.75] text-brand-muted">
            None of this is built. Each assistant is recorded with the conditions it must meet
            first, because the distance between &ldquo;suggests approvals&rdquo; and an
            unaccountable admissions decision is one default setting. The general rule for all five:
            <strong className="text-brand-purple"> the model may sort, flag and draft; a person
            decides, and the person must be able to disagree without friction.</strong>
          </p>
          <div className="mt-9 space-y-5">
            {AI_LAYER.map((a, i) => (
              <Reveal key={a.title} delay={Math.min(i * 45, 300)}>
                <div className="rounded-2xl border border-brand-sand bg-white p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-heading text-[17px] font-bold text-brand-purple">{a.title}</h3>
                    <span className="rounded-full bg-white px-2.5 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-brand-muted ring-1 ring-brand-sand">
                      Not built
                    </span>
                  </div>
                  <p className="mt-2.5 text-[14px] text-brand-muted">{a.does.join(' · ')}</p>
                  <p className="mt-4 font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-red-700">
                    Conditions before building
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {a.conditions.map((c) => (
                      <li key={c} className="flex gap-3 text-[14px] leading-relaxed text-brand-muted">
                        <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-red-400" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading eyebrow="Related">The rest of the blueprint</SectionHeading>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              ['ERP modules', '/erp'],
              ['Institutional documents', '/documents'],
              ['Admissions Portal', '/admissions-portal'],
              ['Academic Regulations', '/academic-regulations'],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-full border-2 border-brand-purple px-6 py-3 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
