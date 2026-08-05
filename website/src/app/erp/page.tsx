import type { Metadata } from 'next';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import Reveal from '@/components/Reveal';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import { site } from '@/content/site';
import { erpModules, erpCounts, type ModuleStatus } from '@/content/erp';
import { allStatuses, statusPath, terminalStatuses } from '@/lib/status';
import { HIERARCHY, roleLabels, capabilitiesOf } from '@/lib/roles';

export const metadata: Metadata = {
  title: 'University ERP — ICOF Global University',
  description:
    'The blueprint for the ICOF Global University enterprise system: seventeen modules from admissions to alumni, the universal status system and the role hierarchy.',
  alternates: { canonical: '/erp' },
};

const STATUS_STYLE: Record<ModuleStatus, { label: string; chip: string }> = {
  built: { label: 'Built', chip: 'bg-emerald-600 text-white' },
  partial: { label: 'Partly built', chip: 'bg-brand-gold text-brand-purple' },
  planned: { label: 'Planned', chip: 'bg-white text-brand-muted ring-1 ring-brand-sand' },
};

const PIPELINE = [
  'Public Website',
  'Admissions Portal',
  'Finance Verification',
  'Registrar Approval',
  'Student ERP',
];

export default function ErpPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    name: 'ICOF Global University ERP blueprint',
    url: `${site.url}/erp`,
    publisher: { '@id': `${site.url}/#organization` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="University ERP"
        subtitle="Seventeen modules from application to alumnus — the blueprint, and an honest account of how much of it stands today."
        image="/images/hall.jpg"
        eyebrow="System architecture"
      />

      <div className="border-b border-brand-sand bg-white">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-px bg-brand-sand/60 lg:grid-cols-4">
          {[
            [String(erpCounts.total), 'Modules'],
            [String(erpCounts.built), 'Built'],
            [String(erpCounts.partial), 'Partly built'],
            [String(erpCounts.planned), 'Planned'],
          ].map(([v, k]) => (
            <div key={k} className="bg-white px-6 py-6 text-center">
              <dd className="font-heading text-3xl font-bold tabular text-brand-purple">{v}</dd>
              <dt className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold-deep">
                {k}
              </dt>
            </div>
          ))}
        </dl>
      </div>

      {/* The spine */}
      <section className="relative overflow-hidden bg-brand-purple-dark py-16 text-white">
        <Aurora tone="dual" intensity={0.4} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
          <Eyebrow light>The spine</Eyebrow>
          <h2 className="mt-2 font-heading text-display-sm font-bold text-white [text-wrap:balance]">
            One path, and one gate on it
          </h2>
          <div className="mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-deep" />
          <ol className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-4">
            {PIPELINE.map((p, i) => (
              <li key={p} className="flex items-center gap-3">
                <span className="rounded-full border border-white/20 bg-white/[0.06] px-5 py-2.5 font-heading text-sm font-semibold text-white backdrop-blur">
                  {p}
                </span>
                {i < PIPELINE.length - 1 && (
                  <span aria-hidden="true" className="text-brand-gold">→</span>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-8 text-[17px] leading-[1.75] text-white/85">
            Everything downstream of Registrar Approval exists because a student record was created
            there. That is why the whole system has exactly one place where a student account comes
            into being, and why no administrator creates one by hand.
          </p>
        </div>
      </section>

      {/* Status system */}
      <Section chapter="Status system">
        <SectionHeading eyebrow="One vocabulary">The universal status system</SectionHeading>
        <div className="mx-auto max-w-4xl">
          <p className="text-[17px] leading-[1.75] text-brand-muted">
            A record moves between Finance, the Registrar and the faculty. It only moves cleanly if
            all three read the same colour the same way, so there is one table and no module defines
            its own. Every chip carries its label as well as its colour — the colour is a shortcut
            for people who already know it, never the only thing carrying the meaning.
          </p>

          <h3 className="mt-10 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
            The forward path
          </h3>
          <ol className="mt-5 space-y-3">
            {statusPath.map((s, i) => (
              <Reveal key={s.key} delay={i * 45}>
                <li className="flex items-start gap-4 rounded-2xl border border-brand-sand bg-white p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center font-mono text-[11px] font-bold text-brand-muted">
                    {i + 1}
                  </span>
                  <span aria-hidden="true" className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ${s.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${s.chip}`}>
                        {s.label}
                      </span>
                      <span className="font-sans text-[11px] uppercase tracking-wide text-brand-muted">{s.colour}</span>
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-brand-muted">{s.meaning}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>

          <h3 className="mt-10 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
            Outcomes
          </h3>
          <ul className="mt-5 space-y-3">
            {terminalStatuses.map((s) => (
              <li key={s.key} className="flex items-start gap-4 rounded-2xl border border-brand-sand bg-brand-cream p-4">
                <span aria-hidden="true" className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ${s.dot}`} />
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${s.chip}`}>
                      {s.label}
                    </span>
                    <span className="font-sans text-[11px] uppercase tracking-wide text-brand-muted">{s.colour}</span>
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed text-brand-muted">{s.meaning}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-brand-muted">
            {allStatuses.length} statuses in total. Dark red and red, and black and grey, are close
            enough that colour alone would not separate them for many readers — which is the reason
            every chip is labelled.
          </p>
        </div>
      </Section>

      {/* Modules */}
      <Section className="bg-white" chapter="Modules">
        <SectionHeading eyebrow="The system">Seventeen modules</SectionHeading>
        <ol className="mx-auto max-w-4xl space-y-5">
          {erpModules.map((m, i) => {
            const s = STATUS_STYLE[m.status];
            return (
              <Reveal key={m.n} delay={Math.min(i * 35, 350)}>
                <li className="overflow-hidden rounded-2xl border border-brand-sand bg-brand-cream shadow-sm">
                  <div className="flex flex-wrap items-start gap-4 border-b border-brand-sand/70 px-6 py-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-purple font-heading text-base font-bold text-brand-gold">
                      {m.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-lg font-bold leading-snug text-brand-purple [text-wrap:balance]">
                        {m.href ? (
                          <Link href={m.href} className="underline decoration-brand-gold underline-offset-4">
                            {m.title}
                          </Link>
                        ) : (
                          m.title
                        )}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{m.purpose}</p>
                      <p className="mt-2 font-sans text-[10px] uppercase tracking-[0.12em] text-brand-muted">
                        {m.roles.map((r) => roleLabels[r]).join(' · ')}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] ${s.chip}`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="grid gap-6 bg-white px-6 py-5 sm:grid-cols-3">
                    <div>
                      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-deep">Specified</p>
                      <ul className="mt-3 space-y-1.5">
                        {m.functions.map((f) => (
                          <li key={f} className="text-[13px] leading-relaxed text-brand-muted">{f}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Working today</p>
                      {m.working ? (
                        <ul className="mt-3 space-y-1.5">
                          {m.working.map((w) => (
                            <li key={w} className="text-[13px] leading-relaxed text-brand-muted">{w}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-[13px] italic leading-relaxed text-brand-muted">Nothing yet.</p>
                      )}
                    </div>
                    <div>
                      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-purple">Next</p>
                      <ul className="mt-3 space-y-1.5">
                        {(m.next ?? ['—']).map((n) => (
                          <li key={n} className="text-[13px] leading-relaxed text-brand-muted">{n}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </Section>

      {/* Hierarchy */}
      <Section chapter="Roles">
        <SectionHeading eyebrow="Who sees what">The role hierarchy</SectionHeading>
        <div className="mx-auto max-w-3xl">
          <p className="text-[17px] leading-[1.75] text-brand-muted">
            Fourteen roles, in the order the university sets them. Seniority governs what a role
            sees; it does not govern what a role may do. The Chancellor and the Vice Chancellor sit
            at the top of this list and neither can admit a student or verify a payment — an
            institution where they could would have no separation of duties left, whatever its
            organisation chart said.
          </p>
          <ol className="mt-9">
            {HIERARCHY.map((role, i) => {
              const caps = capabilitiesOf(role);
              const n = caps === 'all' ? '—' : String(caps.length);
              return (
                <Reveal key={role} delay={Math.min(i * 35, 350)}>
                  <li className="relative flex gap-5 pb-6 last:pb-0">
                    {i < HIERARCHY.length - 1 && (
                      <span aria-hidden="true" className="absolute left-[15px] top-8 bottom-0 w-px bg-brand-sand" />
                    )}
                    <span
                      aria-hidden="true"
                      className="relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-purple font-mono text-[11px] font-bold text-brand-gold"
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-heading text-[16px] font-bold text-brand-purple">{roleLabels[role]}</p>
                      <p className="mt-0.5 font-sans text-[11px] uppercase tracking-wide text-brand-muted">
                        {n} capabilities
                      </p>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ol>
          <p className="mt-8 rounded-2xl border border-dashed border-brand-gold/60 bg-brand-cream/70 p-6 text-[15px] leading-relaxed text-brand-muted">
            <span className="font-semibold text-brand-purple">Where this lives. </span>
            The hierarchy and the capability matrix are held in <code className="font-mono text-[13px]">src/lib/roles.ts</code>,
            and the status table in <code className="font-mono text-[13px]">src/lib/status.ts</code>. Every screen asks those
            files rather than testing a role name inline, so a permission is decided in exactly one
            place and a colour means one thing across the whole system.
          </p>
        </div>
      </Section>

      <Section className="bg-white">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading eyebrow="Related">Where the rest is recorded</SectionHeading>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              ['Institutional documents', '/documents'],
              ['Admissions Portal', '/admissions-portal'],
              ['Student Portal', '/portal'],
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
