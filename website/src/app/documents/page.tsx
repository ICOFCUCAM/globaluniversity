import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Reveal from '@/components/Reveal';
import Cta from '@/components/Cta';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import {
  institutionalDocuments,
  availableCount,
  partialCount,
  awaitingCount,
  type DocumentStatus,
} from '@/content/institutionalDocuments';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Institutional Documents — ICOF Global University',
  description:
    'The register of ICOF Global University’s institutional documents: the Academic Catalog, handbooks, quality assurance, statutes and strategic plan, with the status of each.',
  alternates: { canonical: '/documents' },
};

const STATUS: Record<DocumentStatus, { label: string; chip: string; note: string }> = {
  published: {
    label: 'Published',
    chip: 'bg-brand-purple text-white',
    note: 'Available to read in full.',
  },
  partial: {
    label: 'In preparation',
    chip: 'bg-brand-gold text-brand-purple',
    note: 'Exists, and names inside it the sections still to be adopted.',
  },
  awaiting: {
    label: 'Not yet written',
    chip: 'bg-white text-brand-muted ring-1 ring-brand-sand',
    note: 'Requires decisions or adoption by the university before it can be written.',
  },
};

export default function DocumentsPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Institutional Documents',
    url: `${site.url}/documents`,
    isPartOf: { '@id': `${site.url}/#organization` },
    hasPart: institutionalDocuments
      .filter((d) => d.href)
      .map((d) => ({ '@type': 'DigitalDocument', name: d.title, url: `${site.url}${d.href}` })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="Institutional Documents"
        subtitle="The documentation an established university is expected to hold — and an honest account of how far ICOF Global University has come in producing it."
        image="/images/hall.jpg"
        eyebrow="Academic Standards"
      />

      <div className="border-b border-brand-sand bg-white">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-px bg-brand-sand/60 lg:grid-cols-4">
          {[
            [String(institutionalDocuments.length), 'Documents in the register'],
            [String(availableCount), 'Readable now'],
            [String(partialCount), 'In preparation'],
            [String(awaitingCount), 'Not yet written'],
          ].map(([v, k]) => (
            <div key={k} className="bg-white px-6 py-6 text-center">
              <dd className="font-heading text-3xl font-bold tabular text-brand-purple">{v}</dd>
              <dt className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-gold-ink">
                {k}
              </dt>
            </div>
          ))}
        </dl>
      </div>

      {/* Why the register says what it says */}
      <section className="relative overflow-hidden bg-brand-purple-dark py-16 text-white" data-chapter="Why">
        <Aurora tone="dual" intensity={0.4} fields={2} />
        <Grain />
        <Seam />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <Eyebrow light>On this register</Eyebrow>
          <h2 className="mt-2 font-heading text-display-sm font-bold text-white [text-wrap:balance]">
            Why this page shows what is missing
          </h2>
          <div className="mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-deep" />
          <p className="mt-7 text-[17px] leading-[1.75] text-white/85">
            An accreditation body, a partner university and a prospective student are all better
            served by a register that states plainly what exists and what does not, than by a shelf
            of impressive-looking documents whose contents were never adopted.
          </p>
          <p className="mt-5 text-[17px] leading-[1.75] text-white/85">
            Statutes, degree classifications, examination regulations and quality assurance
            procedures are instruments of governance. They take effect when a Senate, an Academic
            Board or a Board of Trustees adopts them — not when they are written well. Each is
            listed here with the body that must adopt it, and with the specific decisions required,
            so the work of producing it is a short list rather than a blank page.
          </p>
        </div>
      </section>

      {/* The register */}
      <Section chapter="Register">
        <SectionHeading eyebrow="The Register">
          The register, in the order the university set
        </SectionHeading>
        <ol className="mx-auto max-w-4xl space-y-6">
          {institutionalDocuments.map((d, i) => {
            const s = STATUS[d.status];
            return (
              <Reveal key={d.title} delay={Math.min(i * 45, 400)}>
                <li className="overflow-hidden rounded-2xl border border-brand-sand bg-white shadow-sm">
                  <div className="flex flex-wrap items-start gap-4 border-b border-brand-sand/70 bg-brand-cream px-6 py-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-purple font-heading text-base font-bold text-brand-gold">
                      {d.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-lg font-bold leading-snug text-brand-purple [text-wrap:balance]">
                        {d.href ? (
                          <Link href={d.href} className="underline decoration-brand-gold underline-offset-4">
                            {d.title}
                          </Link>
                        ) : (
                          d.title
                        )}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{d.purpose}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] ${s.chip}`}
                    >
                      {s.label}
                    </span>
                  </div>

                  <div className="grid gap-6 px-6 py-5 sm:grid-cols-2">
                    <div>
                      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">
                        Contents
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {d.contains.map((c) => (
                          <li key={c} className="flex gap-2.5 text-[13px] leading-relaxed text-brand-muted">
                            <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-sand" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {d.needs && (
                      <div>
                        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold-ink">
                          Required from the university
                        </p>
                        <ul className="mt-3 space-y-1.5">
                          {d.needs.map((n) => (
                            <li key={n} className="flex gap-2.5 text-[13px] leading-relaxed text-brand-muted">
                              <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-gold" />
                              <span>{n}</span>
                            </li>
                          ))}
                        </ul>
                        {d.adoptedBy && (
                          <p className="mt-4 rounded-lg bg-brand-cream px-3.5 py-2.5 text-[12px] leading-relaxed text-brand-muted">
                            <span className="font-semibold text-brand-purple">Adopted by:</span>{' '}
                            {d.adoptedBy}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </Section>

      <Cta />
    </>
  );
}
