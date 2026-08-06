// ---------------------------------------------------------------------------
// One page per programme.
//
// WHY THIS ROUTE EXISTS. Every programme was a bullet inside a list on a level
// page. A bullet cannot be linked to, cannot be shared, cannot carry a
// curriculum or an admission requirement, and — the part that costs the
// university most — cannot be found. A search engine indexes pages; there was
// one page for twenty-one diplomas, so there was one result for twenty-one
// programmes. This is how every established university is structured, and the
// reason is not aesthetic.
//
// The route is /programmes/<slug>, deliberately distinct from /programs/<slug>,
// which lists an award LEVEL. One is a catalogue index, the other is a single
// award; giving them the same path would have meant a slug collision the first
// time a programme was named after its level.
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Section } from '@/components/Section';
import Cta from '@/components/Cta';
import {
  DIPLOMA_PROGRAMMES, programmeBySlug, facultyById, programmesByFaculty,
} from '@/content/programmeCatalogue';
import { UNDERGRAD_ENTRY } from '@/content/programmeEntry';

export function generateStaticParams() {
  return DIPLOMA_PROGRAMMES.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = programmeBySlug(params.slug);
  if (!p) return { title: 'Programme' };
  return {
    title: `${p.title} — ICOF Global University`,
    description: p.summary,
    alternates: { canonical: `/programmes/${p.slug}` },
  };
}

export default function ProgrammePage({ params }: { params: { slug: string } }) {
  const p = programmeBySlug(params.slug);
  if (!p) notFound();
  const faculty = facultyById(p.facultyId);
  const siblings = programmesByFaculty(p.facultyId).filter((s) => s.slug !== p.slug).slice(0, 3);

  // Structured data, so the programme is understood as a course rather than as
  // a page that happens to mention one.
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: p.title,
    description: p.summary,
    educationalCredentialAwarded: p.award,
    provider: {
      '@type': 'CollegeOrUniversity',
      name: 'ICOF Global University',
      url: 'https://iguc.net',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <section className="bg-brand-purple py-16 text-white sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            {faculty?.name} · Diploma
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold leading-tight sm:text-4xl [text-wrap:balance]">
            <span aria-hidden="true" className="mr-3">{p.icon}</span>{p.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/85">{p.summary}</p>
        </div>
      </section>

      {/* The particulars, immediately — this is what an applicant came for. */}
      <div className="border-b border-[#e6ddcb] bg-[#faf7f0]">
        <dl className="mx-auto flex max-w-5xl flex-wrap gap-x-12 gap-y-4 px-4 py-6">
          <div>
            <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">Duration</dt>
            <dd className="mt-0.5 text-sm font-semibold text-[#3d3350]">{p.duration}</dd>
          </div>
          {p.credits !== undefined && (
            <div>
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">Credits</dt>
              <dd className="mt-0.5 text-sm font-semibold text-[#3d3350]">{p.credits} ECTS</dd>
            </div>
          )}
          <div>
            <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">Award</dt>
            <dd className="mt-0.5 text-sm font-semibold text-[#3d3350]">Diploma (Dip)</dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">Study mode</dt>
            <dd className="mt-0.5 text-sm font-semibold text-[#3d3350]">{p.modes.join(' · ')}</dd>
          </div>
          {p.pathway && (
            <div>
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">Continues to</dt>
              <dd className="mt-0.5 text-sm font-semibold text-[#3d3350]">{p.pathway}</dd>
            </div>
          )}
        </dl>
      </div>

      <Section>
        <div className="mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-heading text-2xl font-bold text-brand-purple">About this programme</h2>
            {p.description.map((para) => (
              <p key={para.slice(0, 40)} className="mt-4 leading-relaxed text-[#4a4058]">{para}</p>
            ))}

            <h2 className="mt-12 font-heading text-2xl font-bold text-brand-purple">
              What it prepares you for
            </h2>
            <p className="mt-2 text-sm text-[#6b6076]">
              Roles this programme is designed to prepare graduates for. They are not an offer or a
              guarantee of employment.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {p.careers.map((c) => (
                <li key={c} className="flex items-start gap-2 text-[15px] text-[#4a4058]">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" />
                  {c}
                </li>
              ))}
            </ul>

            <h2 className="mt-12 font-heading text-2xl font-bold text-brand-purple">
              Admission requirements
            </h2>
            <ul className="mt-4 space-y-2">
              {UNDERGRAD_ENTRY.map((r) => (
                <li key={r.slice(0, 40)} className="flex items-start gap-2 text-[15px] leading-relaxed text-[#4a4058]">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-xl border border-[#e6ddcb] bg-white p-6">
            <h3 className="font-heading text-lg font-bold text-brand-purple">Apply</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5b5168]">
              Admission is enrolment: you may begin studying from the date of your offer, before
              any fee is settled.
            </p>
            <Link
              href="/apply"
              className="mt-4 block rounded-full bg-brand-gold px-5 py-2.5 text-center font-sans text-sm font-semibold text-brand-purple-dark transition hover:brightness-105"
            >
              Apply now
            </Link>
            <Link
              href="/programs/diploma-dip"
              className="mt-3 block rounded-full border border-brand-purple px-5 py-2.5 text-center font-sans text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
            >
              All diploma programmes
            </Link>

            {siblings.length > 0 && (
              <>
                <h3 className="mt-8 font-heading text-lg font-bold text-brand-purple">
                  Also in this faculty
                </h3>
                <ul className="mt-3 space-y-2">
                  {siblings.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/programmes/${s.slug}`} className="text-sm text-[#4a4058] hover:text-brand-purple hover:underline">
                        <span aria-hidden="true" className="mr-2">{s.icon}</span>{s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      </Section>

      <Cta />
    </>
  );
}
