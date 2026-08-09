'use client';

// ---------------------------------------------------------------------------
// THE PUBLIC COURSE CATALOGUE.
//
// ---------------------------------------------------------------------------
// TWO THINGS THE UNIVERSITY ASKED FOR, BOTH VISIBLE ON EVERY CARD
// ---------------------------------------------------------------------------
//
// HOW IT IS TAUGHT. Every card carried a purple ONLINE badge, or nothing.
// Forty-four of the forty-eight courses are taught at a distance, so almost
// every card in the catalogue read ONLINE and only ONLINE — which says "this is
// an online university", the one claim the University has ruled against. The
// badge now says which of the three it is, in the University's own words:
// Campus, Online, Online / Campus.
//
// WHETHER YOU MAY APPLY TO IT. Every card offered "Apply for this course",
// unconditionally, for every course in the catalogue. A catalogue is a record
// of what the University teaches; it is not a list of what it is admitting to
// this year, and treating the two as the same thing is what produced
// applications nobody could approve. The Director of Academic Affairs now ticks
// the programmes authorised to accept applications, and a course that is not
// ticked says so instead of offering a button that leads to a refusal.
//
// ---------------------------------------------------------------------------
// WHAT HAPPENS BEFORE MIGRATION 023 IS RUN
// ---------------------------------------------------------------------------
//
// Every card behaves exactly as it did: the Apply button is there, on all of
// them. The route reports `configured: false` when the table cannot be read,
// and this treats that as "the gate is not in service" rather than as "nothing
// is open".
//
// That is the same rule migration 008 argues for at length and it matters more
// here, not less: a deployment that reaches the browser before the SQL is run
// would otherwise close the University's admissions for as long as the gap
// lasts, silently, with no error anywhere. The gate is a decision somebody
// makes, never a side effect of deploy ordering.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  courses, faculties, levels, isOnline, MODE_LABEL, type Course,
} from '@/content/courses';

/** What the openings route says about programmes. */
interface Gate {
  /** False until migration 023 is run — see the header. */
  configured: boolean;
  /** Programme codes the Director of Academic Affairs has ticked. */
  open: Set<string>;
}

const NOT_IN_SERVICE: Gate = { configured: false, open: new Set() };

export default function CourseCatalogue() {
  const [q, setQ] = useState('');
  const [faculty, setFaculty] = useState('all');
  const [level, setLevel] = useState('all');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [gate, setGate] = useState<Gate>(NOT_IN_SERVICE);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/admissions/openings');
        const json = await res.json();
        if (!live || !json?.configured) return;
        setGate({
          configured: true,
          open: new Set(
            (json.openings ?? [])
              .filter((o: { kind: string; open: boolean }) => o.kind === 'programme' && o.open)
              .map((o: { label: string }) => o.label),
          ),
        });
      } catch {
        // Unreachable is not the same as closed. Leave the gate out of service.
      }
    })();
    return () => { live = false; };
  }, []);

  /** Open unless the University has said otherwise and we could read it. */
  const acceptsApplications = (c: Course) => !gate.configured || gate.open.has(c.code);

  const results = useMemo(
    () =>
      courses.filter((c: Course) => {
        const text = `${c.code} ${c.title} ${c.summary}`.toLowerCase();
        return (
          (q === '' || text.includes(q.toLowerCase())) &&
          (faculty === 'all' || c.faculty === faculty) &&
          (level === 'all' || c.level === level) &&
          (!onlineOnly || isOnline(c)) &&
          (!openOnly || acceptsApplications(c))
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, faculty, level, onlineOnly, openOnly, gate],
  );

  const openCount = courses.filter(acceptsApplications).length;

  const field =
    'rounded-xl border border-brand-sand bg-white px-4 py-2.5 text-sm text-brand-purple focus:border-brand-gold-deep focus:outline-none';

  return (
    <div>
      <div className="mb-10 rounded-2xl border border-brand-sand bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="course-search">
            Search courses
          </label>
          <input
            id="course-search"
            type="search"
            placeholder="Search courses by title, code or keyword…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${field} min-w-[240px] flex-1`}
          />
          <select aria-label="Filter by faculty" value={faculty} onChange={(e) => setFaculty(e.target.value)} className={field}>
            <option value="all">All faculties</option>
            {faculties.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <select aria-label="Filter by level" value={level} onChange={(e) => setLevel(e.target.value)} className={field}>
            <option value="all">All levels</option>
            {levels.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium text-brand-purple">
            <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
            Available online
          </label>
          {gate.configured && (
            <label className="flex items-center gap-2 text-sm font-medium text-brand-purple">
              <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
              Open for application
            </label>
          )}
        </div>
        <p className="mt-3 text-xs text-brand-muted">
          {results.length} of {courses.length} courses
          {gate.configured && ` · ${openCount} open for application`}
        </p>
      </div>

      {/* WHEN NOTHING IS OPEN, SAY SO ONCE AT THE TOP rather than forty-eight
          times down the page. This is the state a freshly-run migration 023
          leaves the University in, and somebody has to be able to tell the
          difference between "we are not admitting" and "the site is broken". */}
      {gate.configured && openCount === 0 && (
        <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>No programme is currently open for application.</strong> The courses below are
          what the University teaches; admission to them opens when the Office of Academic Affairs
          authorises it. To ask about a particular programme,{' '}
          <Link href="/contact" className="underline">contact the Registrar</Link>.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {results.map((c) => {
          const open = acceptsApplications(c);
          return (
            <article
              key={c.code}
              className="flex h-full flex-col rounded-2xl border border-brand-sand bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-xs font-bold tracking-wider text-brand-gold-ink">{c.code}</span>
                {/* Campus · Online · Online / Campus. Always shown: a course
                    with no badge used to mean "on campus", which is a fact
                    communicated by an absence and therefore not communicated. */}
                <span className="rounded-full bg-brand-purple px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-gold">
                  {MODE_LABEL[c.mode]}
                </span>
              </div>
              <h3 className="mt-2 font-heading text-lg font-bold text-brand-purple">{c.title}</h3>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-muted">
                {c.level} · {c.faculty}
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-brand-muted">{c.summary}</p>

              {/* The state, in words as well as in colour. A green dot alone
                  says nothing to a reader who cannot distinguish it from the
                  grey one, and this is the line that decides whether somebody
                  spends half an hour on an application form. */}
              {gate.configured && (
                <p
                  className={`mt-4 inline-flex items-center gap-2 text-xs font-semibold ${
                    open ? 'text-emerald-700' : 'text-brand-muted'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${open ? 'bg-emerald-500' : 'bg-[#c9c2b4]'}`}
                  />
                  {open ? 'Open for application' : 'Not open for application'}
                </p>
              )}

              {open ? (
                <Link
                  href={`/apply?programme=${encodeURIComponent(c.code)}`}
                  className="mt-3 inline-block rounded-full bg-brand-gold px-5 py-2 text-center font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
                >
                  Apply for this course
                </Link>
              ) : (
                // NOT A DISABLED BUTTON. A greyed-out control invites the
                // reader to hunt for the way to enable it; there is none, and
                // the honest thing is to say what would change it.
                <p className="mt-3 rounded-xl border border-dashed border-brand-sand px-4 py-2.5 text-center text-xs text-brand-muted">
                  Admission to this programme is not open at present.
                </p>
              )}
            </article>
          );
        })}
      </div>

      {results.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-brand-sand bg-white p-12 text-center text-brand-muted">
          No courses match your search. Try a different keyword or clear the filters.
        </p>
      )}
    </div>
  );
}
