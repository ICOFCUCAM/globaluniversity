'use client';

// ---------------------------------------------------------------------------
// The programme catalogue. One component, every award level.
//
// It was written for the diploma page and now serves the certificate,
// bachelor's, master's and doctoral pages too. Everything that was
// diploma-specific — the two-sentence introduction, the progression paragraph,
// the careers paragraph, which rung of the ladder is highlighted — is now taken
// from LEVEL_COPY keyed on the `award` prop, because the alternative was a
// doctoral page telling a research candidate their degree articulates into a
// bachelor's.
//
// WHAT IT REPLACED. Three beige boxes of bullet points. An applicant could read
// the whole page and still not know how long a programme runs, what it is
// worth, how it is taught, what it leads to, or where it continues — and there
// was nothing to click. It read as a brochure.
//
// WHY IT IS A CLIENT COMPONENT. The filters. Searching and narrowing by
// faculty, mode and award has to happen without a round trip, or nobody uses
// it. Everything else on the page is static and the data is bundled, so the
// cost is a few kilobytes of state handling, not a data fetch.
//
// WHY THE CREDIT LINE IS SOMETIMES ABSENT. Because the university has not
// published a credit figure for every programme, and a number invented to fill
// a card is a regulatory claim nobody approved. See programmeCatalogue.ts.
// ---------------------------------------------------------------------------

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FACULTIES, PROGRESSION, DIPLOMA_CAREER_SECTORS, LEVEL_COPY,
  programmesByAward, programmesByFaculty, programmeHref,
  type Programme, type AwardLevel,
} from '@/content/programmeCatalogue';

const ALL_MODES = ['Online', 'On campus', 'Blended'];

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-[#3d3350]">{value}</dd>
    </div>
  );
}

function ProgrammeCard({ p }: { p: Programme }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-[#e6ddcb] bg-white p-5 transition hover:border-brand-gold hover:shadow-md">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">{p.icon}</span>
        <h4 className="font-heading text-lg font-bold leading-snug text-brand-purple">
          <Link href={programmeHref(p.slug)} className="hover:underline">{p.title}</Link>
        </h4>
      </div>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-[#5b5168]">{p.summary}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#efe8db] pt-4">
        <Meta label="Duration" value={p.duration ?? 'One to two years'} />
        {/* Omitted, not guessed, where unpublished. */}
        {p.credits !== undefined && <Meta label="Credits" value={`${p.credits} ECTS`} />}
        <Meta label="Award" value={p.award} />
        <Meta label="Study mode" value={p.modes.join(' · ')} />
      </dl>

      {p.pathway && (
        <p className="mt-4 rounded-lg bg-[#faf7f0] px-3 py-2 text-xs text-[#6b6076]">
          <span className="font-semibold text-brand-purple">Continues to</span> {p.pathway}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={programmeHref(p.slug)}
          className="rounded-full border border-brand-purple px-4 py-1.5 font-sans text-xs font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
        >
          Learn more
        </Link>
        <Link
          href="/apply"
          className="rounded-full bg-brand-gold px-4 py-1.5 font-sans text-xs font-semibold text-brand-purple-dark transition hover:brightness-105"
        >
          Apply now
        </Link>
      </div>
    </article>
  );
}

export default function ProgrammeCatalogue({
  award = 'Diploma',
  intro,
}: {
  award?: AwardLevel;
  /** Two sentences at the head. Falls back to LEVEL_COPY for this award. */
  intro?: { lead: string; body: string };
} = {}) {
  const CATALOGUE = programmesByAward(award);
  const copy = LEVEL_COPY[award];
  const [q, setQ] = useState('');
  const [faculty, setFaculty] = useState('all');
  const [mode, setMode] = useState('all');

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOGUE.filter((p) => {
      if (faculty !== 'all' && p.facultyId !== faculty) return false;
      if (mode !== 'all' && !p.modes.includes(mode)) return false;
      if (!needle) return true;
      // Search the summary and the careers too — an applicant types the job
      // they want ("accountant") far more often than the award's exact title.
      return (
        p.title.toLowerCase().includes(needle) ||
        p.summary.toLowerCase().includes(needle) ||
        p.careers.some((c) => c.toLowerCase().includes(needle))
      );
    });
  }, [q, faculty, mode, CATALOGUE]);

  const shownFaculties = FACULTIES.filter((f) => matches.some((p) => p.facultyId === f.id));
  const filtering = q.trim() !== '' || faculty !== 'all' || mode !== 'all';

  return (
    <div className="space-y-16">
      {/* ---- What a diploma is, before anything is listed ---------------- */}
      <section className="mx-auto max-w-3xl text-center">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
          {intro?.lead ?? copy.lead}
        </p>
        <p className="mt-4 text-lg leading-relaxed text-[#4a4058]">
          {intro?.body ?? copy.body}
        </p>
      </section>

      {/* ---- Filters ------------------------------------------------------ */}
      <section aria-label="Find a programme" className="rounded-2xl border border-[#e6ddcb] bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="lg:col-span-2">
            <span className="sr-only">Search programmes</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search programmes, or the job you want…"
              className="w-full rounded-lg border border-[#ded6c8] px-4 py-2.5 text-sm outline-none focus:border-brand-purple"
            />
          </label>
          <label>
            <span className="sr-only">Faculty</span>
            <select
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              className="w-full rounded-lg border border-[#ded6c8] bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-purple"
            >
              <option value="all">All faculties</option>
              {FACULTIES.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Study mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full rounded-lg border border-[#ded6c8] bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-purple"
            >
              <option value="all">Any study mode</option>
              {ALL_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 font-sans text-xs text-[#6b6076]" role="status">
          {matches.length} of {CATALOGUE.length} programmes
          {filtering && (
            <button
              type="button"
              onClick={() => { setQ(''); setFaculty('all'); setMode('all'); }}
              className="ml-3 font-semibold text-brand-purple underline"
            >
              Clear filters
            </button>
          )}
        </p>
      </section>

      {/* ---- The faculties, each with its own programmes ------------------ */}
      {shownFaculties.map((f) => {
        const list = matches.filter((p) => p.facultyId === f.id);
        const all = programmesByFaculty(f.id, award);
        return (
          <section key={f.id} aria-labelledby={`f-${f.id}`}>
            <div className="border-l-4 border-brand-gold pl-5">
              <h3 id={`f-${f.id}`} className="font-heading text-2xl font-bold text-brand-purple">
                {f.name}
              </h3>
              <p className="mt-1.5 max-w-3xl text-[15px] italic leading-relaxed text-[#5b5168]">
                {f.mission}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#6b6076]">{f.blurb}</p>
              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
                <Meta label="Programmes" value={String(all.length)} />
                <Meta label="Study modes" value={Array.from(new Set(all.flatMap((p) => p.modes))).join(' · ')} />
                <Meta label="Award" value={award} />
              </dl>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => <ProgrammeCard key={p.slug} p={p} />)}
            </div>
          </section>
        );
      })}

      {matches.length === 0 && (
        <p className="rounded-xl border border-[#e6ddcb] bg-white p-8 text-center text-sm text-[#6b6076]">
          No programme matches that. Try a broader search, or clear the filters.
        </p>
      )}

      {/* ---- Where a diploma goes ----------------------------------------- */}
      <section aria-labelledby="progression" className="rounded-2xl border border-[#e6ddcb] bg-[#faf7f0] p-6 sm:p-8">
        <h3 id="progression" className="font-heading text-2xl font-bold text-brand-purple">
          Where this leads
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#5b5168]">{copy.progression}</p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRESSION.map((step, i) => (
            <li
              key={step.award}
              className={`rounded-lg border p-4 ${
                step.award === award
                  ? 'border-brand-gold bg-white shadow-sm'
                  : 'border-[#e6ddcb] bg-white/60'
              }`}
            >
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
                Step {i + 1}
              </p>
              <p className="mt-1 font-heading text-base font-bold text-brand-purple">{step.award}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#6b6076]">{step.note}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Careers ------------------------------------------------------ */}
      <section aria-labelledby="careers">
        <h3 id="careers" className="font-heading text-2xl font-bold text-brand-purple">
          After graduation
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#5b5168]">{copy.careers}</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {DIPLOMA_CAREER_SECTORS.map((s) => (
            <li key={s} className="rounded-full border border-[#e6ddcb] bg-white px-4 py-1.5 font-sans text-xs text-[#4a4058]">
              {s}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
