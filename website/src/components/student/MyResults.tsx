'use client';

// ---------------------------------------------------------------------------
// MY RESULTS — and the word "provisional".
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "This needs to be much more sophisticated than simply showing marks.
// 2026/27 — Semester 1. Course / Credits / Grade / Grade Point. Semester GPA:
// 3.73. Then: Cumulative GPA, Credits completed: 15 / 120. And importantly:
// Results are provisional until approved by the University. Once Result
// Approval happens, the student sees: Official Result. That preserves the
// authority chain you are building."
//
// ---------------------------------------------------------------------------
// THE AUTHORITY CHAIN HAS FIVE LINKS, NOT TWO
// ---------------------------------------------------------------------------
//
// draft → submitted → moderated → faculty-approved → approved.
//
// 071 draws the line at 'submitted': a draft is the lecturer's working note
// and is not shown at all, everything above it is shown marked PROVISIONAL,
// and 'approved' is the OFFICIAL RESULT. The reasoning is at the top of that
// migration, where the University can see it and overrule it in one line.
//
// This screen adds one thing to that: it names the desk the mark is sitting
// on. "Provisional" answers "is this final"; it does not answer "until when",
// and a student who can see that their mark is with the Faculty rather than
// with their lecturer knows who to ask.
//
// ---------------------------------------------------------------------------
// A PROVISIONAL MARK IS NOT IN THE GPA, AND THE SCREEN SAYS SO
// ---------------------------------------------------------------------------
//
// The GPA comes from `semester_gpas`, which counts approved results only — the
// same figure the transcript prints. So a student can see a provisional A- and
// a semester GPA that does not yet include it, and the two are not a
// contradiction. Rather than silently letting them disagree, the term header
// says which courses the GPA is computed over.
//
// THE GPA IS NOT RECOMPUTED HERE. A screen averaging the marks itself would be
// a second opinion on the most consulted number in the University, and would
// differ from the transcript the first time a result was amended.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, EmptyState, PageHeader, SkeletonRows, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { within } from '@/components/academic/ProgrammeRegister';
import { useJourney } from '@/contexts/JourneyContext';
import { meaningOf } from '@/lib/studentJourney';
import { AlertTriangle, BadgeCheck, Clock, BarChart3 } from 'lucide-react';

// eslint-disable-next-line max-len
const RESULTS = 'student_id, result_id, course_id, course_code, course_title, credits, academic_year, semester, ca_score, exam_score, total_score, grade, grade_point, quality_points, attempt, status, official, standing, with_whom, approved_at';
// eslint-disable-next-line max-len
const TERMS = 'student_id, academic_year, semester, courses, official_courses, provisional_courses, official_credits, official_quality_points, gpa, cgpa, term_is_official';

export interface ResultRow {
  result_id: string;
  course_code: string;
  course_title: string;
  credits: number | null;
  academic_year: number | null;
  semester: number | null;
  ca_score: number | null;
  exam_score: number | null;
  total_score: number | null;
  grade: string | null;
  grade_point: number | null;
  quality_points: number | null;
  attempt: number;
  status: string;
  official: boolean;
  standing: string;
  with_whom: string;
}

export interface TermRow {
  academic_year: number | null;
  semester: number | null;
  courses: number;
  official_courses: number;
  provisional_courses: number;
  official_credits: number;
  gpa: number | null;
  cgpa: number | null;
  term_is_official: boolean | null;
}

export async function readResults(): Promise<{
  results: ResultRow[]; terms: TermRow[]; failed: string | null;
}> {
  try {
    const [r, t] = await Promise.all([
      within(supabase.from('my_results').select(RESULTS)),
      within(supabase.from('my_result_terms').select(TERMS)),
    ]);
    if (r.error) return { results: [], terms: [], failed: r.error.message };
    if (t.error) return { results: [], terms: [], failed: t.error.message };
    return {
      results: (r.data ?? []) as unknown as ResultRow[],
      terms: (t.data ?? []) as unknown as TermRow[],
      failed: null,
    };
  } catch (e) {
    return {
      results: [], terms: [],
      failed: e instanceof Error ? e.message : 'Your results could not be read.',
    };
  }
}

/**
 * "2026/27 — Semester 1", as the University wrote it.
 *
 * `academic_year` is the year the session STARTS in, so 2026 is 2026/27. A
 * screen printing it bare says "2026 Semester 1" and a student reading their
 * own record cannot tell which of two sessions it means.
 */
export function termLabel(year: number | null, semester: number | null): string {
  const session = year === null ? 'Session not recorded'
    : `${year}/${String((year + 1) % 100).padStart(2, '0')}`;
  return semester === null ? session : `${session} — Semester ${semester}`;
}

/** Newest term first: a student opens this to see the term just finished. */
export function newestFirst<T extends { academic_year: number | null; semester: number | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => (b.academic_year ?? 0) - (a.academic_year ?? 0)
    || (b.semester ?? 0) - (a.semester ?? 0));
}

export default function MyResults() {
  const { journey, stage } = useJourney();
  const [results, setResults] = useState<ResultRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { results: r, terms: t, failed: f } = await readResults();
    setResults(r); setTerms(t); setFailed(f); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const byTerm = useMemo(() => newestFirst(terms).map((t) => ({
    term: t,
    rows: results
      .filter((r) => r.academic_year === t.academic_year && r.semester === t.semester)
      .sort((a, b) => a.course_code.localeCompare(b.course_code)),
  })), [terms, results]);

  // A result whose enrolment was deleted has no term. It is still their mark
  // and is still shown — under a heading that says so rather than vanishing.
  const orphaned = useMemo(
    () => results.filter((r) => !terms.some(
      (t) => t.academic_year === r.academic_year && t.semester === r.semester,
    )),
    [results, terms],
  );

  const provisional = results.filter((r) => !r.official).length;

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Your results could not be read"
          description={`${failed}. If migration 071 has not been run on this database, the views `
            + 'this screen reads do not exist yet.'}
        />
      </Card>
    );
  }

  if (loading) return <Card className="overflow-hidden"><SkeletonRows rows={6} cols={4} /></Card>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My results"
        subtitle={results.length === 0 ? 'Your marks, term by term'
          : `${results.length} result${results.length === 1 ? '' : 's'}`
            + (provisional > 0 ? ` · ${provisional} still provisional` : ' · all official')}
      />

      {/* ------------------------------------------------------------------
          THE SENTENCE THE UNIVERSITY ASKED FOR, AT THE TOP.

          It is shown whenever anything on the screen is provisional, and
          hidden when everything is official — a standing disclaimer that is
          always there is one nobody reads.
          ------------------------------------------------------------------ */}
      {provisional > 0 && (
        <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4
                         dark:border-amber-900 dark:bg-amber-950/30">
          <Clock size={16} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            <p className="font-semibold">Results are provisional until approved by the University.</p>
            <p className="mt-1">
              A provisional mark has been submitted by your lecturer and is still going through
              moderation and approval. It can change, and it counts towards no GPA until it is
              approved. Each one below says whose desk it is on.
            </p>
          </div>
        </Card>
      )}

      {results.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={20} />}
            title="No results yet"
            description={stage === 'registering' || stage === 'awaiting-programme'
              ? meaningOf(stage).says
              : 'Nothing has been released to you yet. A mark appears here the moment your '
                + 'lecturer submits it — marked provisional — and becomes official when the '
                + 'Registrar approves it.'}
          />
        </Card>
      ) : (
        <>
          {/* ---- WHERE THE WHOLE DEGREE STANDS ---- */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Summary
              label="Cumulative GPA"
              value={journey?.cgpa === null || journey?.cgpa === undefined
                ? '—' : Number(journey.cgpa).toFixed(2)}
              note={journey?.cgpa === null || journey?.cgpa === undefined
                ? 'Published once results are approved' : 'Approved results only'}
            />
            <Summary
              label="Credits completed"
              value={journey?.credits_required
                ? `${journey.credits_earned} / ${journey.credits_required}`
                : String(journey?.credits_earned ?? 0)}
              note={journey?.credits_required
                ? 'Towards your award' : 'Your programme states no total'}
            />
            <Summary
              label="Courses passed"
              value={String(journey?.courses_passed ?? 0)}
              note={journey?.courses_failed
                ? `${journey.courses_failed} not passed` : undefined}
            />
          </div>

          {byTerm.map(({ term, rows }) => (
            <section key={`${term.academic_year}-${term.semester}`} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
                  {termLabel(term.academic_year, term.semester)}
                </h2>
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px]
                                  font-medium ${
                  term.term_is_official
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                }`}>
                  {term.term_is_official ? <BadgeCheck size={12} /> : <Clock size={12} />}
                  {term.term_is_official
                    ? 'Official result'
                    : `${term.provisional_courses} provisional`}
                </span>
              </div>

              <TableShell>
                <table className="w-full">
                  <THead>
                    <tr>
                      <Th>Course</Th>
                      <Th align="right">Credits</Th>
                      <Th align="right">Grade</Th>
                      <Th align="right">Grade point</Th>
                      <Th>Standing</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {rows.map((r) => (
                      <tr key={r.result_id} className={r.official ? '' : 'bg-amber-50/40 dark:bg-amber-950/10'}>
                        <Td>
                          <span className="font-semibold text-[#422e59] dark:text-[#c8b6e8]">
                            {r.course_code}
                          </span>
                          <span className="ml-2 text-[#6b6076] dark:text-[#9c93ad]">
                            {r.course_title}
                          </span>
                          {r.attempt > 1 && (
                            <span className="ml-2 text-[11px] text-[#a07c12]">
                              attempt {r.attempt}
                            </span>
                          )}
                        </Td>
                        <Td align="right">{r.credits ?? '—'}</Td>
                        <Td align="right">
                          <span className="font-semibold">{r.grade ?? '—'}</span>
                        </Td>
                        <Td align="right">
                          {r.grade_point === null ? '—' : Number(r.grade_point).toFixed(2)}
                        </Td>
                        <Td>
                          {r.official ? (
                            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                              <BadgeCheck size={13} /> Official result
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                              <Clock size={13} />
                              {/* WHOSE DESK. "Provisional" alone does not tell
                                  a student who to ask or how long to wait. */}
                              Provisional · {r.with_whom}
                            </span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </table>
              </TableShell>

              {/* ---- THE TERM'S OWN FIGURES ---- */}
              <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 px-1 text-xs">
                <span className="text-[#6b6076] dark:text-[#9c93ad]">
                  Semester GPA:{' '}
                  <strong className="tabular-nums text-[#33234a] dark:text-[#e4dcf0]">
                    {term.gpa === null ? 'not yet published' : Number(term.gpa).toFixed(2)}
                  </strong>
                </span>
                <span className="text-[#6b6076] dark:text-[#9c93ad]">
                  Cumulative GPA:{' '}
                  <strong className="tabular-nums text-[#33234a] dark:text-[#e4dcf0]">
                    {term.cgpa === null ? '—' : Number(term.cgpa).toFixed(2)}
                  </strong>
                </span>
                <span className="text-[#a49bb0]">
                  {/* WHAT THE GPA IS COMPUTED OVER. Without this the student
                      reads a GPA beside a provisional mark and assumes the
                      mark is in it. */}
                  {term.official_courses === term.courses
                    ? `over all ${term.courses} course${term.courses === 1 ? '' : 's'}`
                    : `over the ${term.official_courses} approved course${term.official_courses === 1 ? '' : 's'} only`}
                </span>
              </div>
            </section>
          ))}

          {orphaned.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
                Not filed against a term
              </h2>
              <p className="text-[11px] text-[#a49bb0]">
                These marks are yours but are not linked to a registration, so the University has
                not recorded which term they were taken in. They are shown rather than hidden.
                Ask the Registry.
              </p>
              <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                {orphaned.map((r) => (
                  <div key={r.result_id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                    <span className="w-20 shrink-0 font-semibold text-[#422e59] dark:text-[#c8b6e8]">
                      {r.course_code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[#33234a] dark:text-[#e4dcf0]">
                      {r.course_title}
                    </span>
                    <span className="shrink-0 font-semibold">{r.grade ?? '—'}</span>
                    <span className="shrink-0 text-xs text-[#a49bb0]">{r.standing}</span>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Summary({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-[#a49bb0]">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-[#422e59] dark:text-[#c8b6e8]">
        {value}
      </p>
      {note && <p className="mt-0.5 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">{note}</p>}
    </Card>
  );
}
