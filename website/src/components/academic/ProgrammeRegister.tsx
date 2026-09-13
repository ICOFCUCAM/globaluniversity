'use client';

// ---------------------------------------------------------------------------
// THE PROGRAMME REGISTER — what the University offers, and how far each one is
// from being ready to offer.
//
// ---------------------------------------------------------------------------
// WHY THIS SCREEN EXISTS
// ---------------------------------------------------------------------------
//
// The University's own words: the Academic section "is currently organized
// around isolated utilities — Courses, Course Registration, Timetable, LMS —
// rather than around the University's actual academic structure."
//
// It read that way because there was nothing to organise around. Until 057 the
// five faculties and forty-one programmes were TypeScript constants compiled
// into the website; nobody could create one, edit one or version one, and no
// screen could list them because there was no list.
//
// This is the first screen in the portal that reads the academic structure as
// DATA. Everything on it is counted from the register: how many courses a
// curriculum has, what it adds up to, and how far that is from what the
// programme claims.
//
// ---------------------------------------------------------------------------
// THE COLUMN THAT MATTERS IS THE GAP
// ---------------------------------------------------------------------------
//
// A programme claiming 180 credits whose curriculum adds to 174 is a programme
// nobody can graduate from, and today that would be discovered by a student in
// their final year. `curriculum_progress` computes it; this prints it; and the
// number is red until it is zero.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, EmptyState, PageHeader, SkeletonRows, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { GraduationCap, Search, ArrowRight, AlertTriangle } from 'lucide-react';

// A SINGLE STRING LITERAL — see the note in every other file that reads through
// supabase-js. Concatenation collapses the inferred row type silently.
// eslint-disable-next-line max-len
const PROGRESS = 'version_id, programme_id, code, award_level, version_label, status, duration_years, semesters_per_year, total_credits, courses_in_curriculum, credits_in_curriculum, credits_against_claim, terms_with_courses, terms_expected';

export interface ProgrammeProgress {
  version_id: string;
  programme_id: string;
  code: string;
  award_level: string;
  version_label: string;
  status: string;
  duration_years: number;
  semesters_per_year: number;
  total_credits: number | null;
  courses_in_curriculum: number;
  credits_in_curriculum: number;
  credits_against_claim: number;
  terms_with_courses: number;
  terms_expected: number;
}

/**
 * A read that answers, or says it could not.
 *
 * ---------------------------------------------------------------------------
 * WHY A TIMEOUT, AND WHY IT IS NOT A SANDBOX WORKAROUND
 * ---------------------------------------------------------------------------
 *
 * This screen was rendered against a database it could not reach and drew its
 * loading skeleton indefinitely. The first fix caught errors — and changed
 * nothing, because the request was not FAILING. It was hanging: supabase-js
 * reports an error when the server answers badly and simply never settles when
 * nothing answers at all.
 *
 * That is not peculiar to a sandbox. A Supabase project that is paused, a
 * network that drops, a DNS failure — every one of them ends here, and every
 * one of them currently renders as "still loading" forever, which is the one
 * outcome that tells the reader nothing and offers them nothing.
 *
 * So a read has a deadline. Fifteen seconds is far longer than any healthy
 * query and far shorter than a person's patience.
 * ---------------------------------------------------------------------------
 */
export async function within<T>(work: PromiseLike<T>, seconds = 15): Promise<T> {
  return Promise.race([
    work as Promise<T>,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(
          `The database did not answer within ${seconds} seconds`,
        )),
        seconds * 1000,
      );
    }),
  ]);
}

/** The programme code is the slug the site already uses. This is it, readable. */
export function titleOf(code: string): string {
  return code.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-[#f2eee6] text-[#6b6076] dark:bg-[#2a2333] dark:text-[#9c93ad]',
  department_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  faculty_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  board_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  approved: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  published: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  department_review: 'Department review',
  faculty_review: 'Faculty review',
  board_review: 'With the Vice-Chancellor',
  approved: 'Approved',
  published: 'In force',
  superseded: 'Superseded',
  withdrawn: 'Withdrawn',
};

export default function ProgrammeRegister({
  onOpen,
}: {
  onOpen?: (versionId: string) => void;
}) {
  const [rows, setRows] = useState<ProgrammeProgress[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [award, setAward] = useState('');

  // -------------------------------------------------------------------------
  // A FAILED READ IS NOT AN EMPTY REGISTER, AND IT IS NOT A SKELETON FOREVER.
  //
  // The first version of this set `rows` only on success. Rendered against a
  // database it could not reach, it drew its loading skeleton and kept drawing
  // it — no error, no message, nothing to do. That is the worst of the three
  // possible endings, because a spinner reads as "still working".
  //
  // There are three answers and they need three states: the register is empty,
  // the read failed, or it is still loading. This distinguishes them.
  // -------------------------------------------------------------------------
  const load = useCallback(async () => {
    try {
      const { data, error } = await within(supabase
        .from('curriculum_progress')
        .select(PROGRESS)
        .order('code'));
      if (error) { setFailed(error.message); return; }
      setFailed(null);
      setRows((data ?? []) as unknown as ProgrammeProgress[]);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The register could not be read.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const awards = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.award_level))).sort(),
    [rows],
  );

  const shown = (rows ?? []).filter((r) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || r.code.toLowerCase().includes(q);
    return matchesQuery && (!award || r.award_level === award);
  });

  // COUNTED, NOT ASSERTED. Every figure in the summary comes from the rows on
  // screen — the portal has shipped invented dashboard numbers before.
  const withCurriculum = (rows ?? []).filter((r) => r.courses_in_curriculum > 0).length;
  const complete = (rows ?? []).filter(
    (r) => r.courses_in_curriculum > 0 && r.credits_against_claim === 0,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programmes"
        subtitle={failed
          ? 'The register could not be read'
          : rows === null
          ? 'Reading the register…'
          : `${rows.length} programme${rows.length === 1 ? '' : 's'} · `
            + `${withCurriculum} with a curriculum · ${complete} adding up to what they claim`}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0] dark:text-[#7b7289]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search programmes…"
              aria-label="Search programmes"
              className="w-full rounded-lg border border-[#ded6c8] bg-gray-50 py-2 pl-9 pr-4 text-sm
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35
                         dark:border-[#3d3349] dark:bg-[#241f2c]"
            />
          </div>
          <select
            value={award}
            onChange={(e) => setAward(e.target.value)}
            aria-label="Filter by award"
            className="rounded-lg border border-[#ded6c8] bg-gray-50 px-3 py-2 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]"
          >
            <option value="">Every award</option>
            {awards.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </Card>

      {failed && (
        <Card>
          <EmptyState
            icon={<AlertTriangle size={20} />}
            title="The register could not be read"
            description={`${failed}. If migration 057 has not been run on this database the table does not exist yet; the Readiness panel in Credentials says which migrations are outstanding.`}
          />
        </Card>
      )}

      {rows === null && !failed && (
        <Card className="overflow-hidden"><SkeletonRows rows={6} cols={5} /></Card>
      )}

      {/* THE REGISTER IS EMPTY UNTIL THE MIGRATIONS RUN, and the difference
          between "no programmes" and "the migration has not been run" is one a
          Superadministrator should not have to guess at. */}
      {rows !== null && !failed && rows.length === 0 && (
        <Card>
          <EmptyState
            icon={<GraduationCap size={20} />}
            title="No programmes in the register"
            description="The academic structure arrives with migration 057 and the University's own programmes with 060. Until those have been run, this register is empty — which is not the same as the University having no programmes."
          />
        </Card>
      )}

      {rows !== null && !failed && rows.length > 0 && (
        <Card className="overflow-hidden">
          <TableShell>
            <THead>
              <tr>
                <Th>Programme</Th>
                <Th>Award</Th>
                <Th>Version</Th>
                <Th>Curriculum</Th>
                <Th>Credits</Th>
                <Th>Terms filled</Th>
                <Th> </Th>
              </tr>
            </THead>
            <TBody>
              {shown.map((r) => (
                <tr key={r.version_id} className="transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
                  <Td>
                    <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                      {titleOf(r.code)}
                    </span>
                    <span className="block text-xs text-[#a49bb0] dark:text-[#7b7289]">
                      {r.duration_years} year{r.duration_years === 1 ? '' : 's'} ·
                      {' '}{r.semesters_per_year} semesters a year
                    </span>
                  </Td>
                  <Td>{r.award_level}</Td>
                  <Td>
                    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                      STATUS_TONE[r.status] ?? 'bg-[#f2eee6] text-[#6b6076]'
                    }`}>
                      {r.version_label} · {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </Td>
                  <Td>
                    {r.courses_in_curriculum === 0
                      ? <span className="text-[#a49bb0] dark:text-[#7b7289]">empty</span>
                      : `${r.courses_in_curriculum} courses`}
                  </Td>
                  {/* ------------------------------------------------------
                      THE GAP, AND IT IS THE POINT OF THE TABLE.

                      A programme claiming 180 credits whose curriculum adds to
                      174 cannot be graduated from, and without this column
                      that is found by a student in their final year.
                      ------------------------------------------------------ */}
                  <Td>
                    {r.total_credits === null ? (
                      <span className="text-[#a49bb0] dark:text-[#7b7289]">not stated</span>
                    ) : r.courses_in_curriculum === 0 ? (
                      <span className="text-[#a49bb0] dark:text-[#7b7289]">
                        0 / {r.total_credits}
                      </span>
                    ) : (
                      <span className={r.credits_against_claim === 0
                        ? 'font-medium text-emerald-700 dark:text-emerald-300'
                        : 'font-medium text-red-600 dark:text-red-400'}>
                        {r.credits_in_curriculum} / {r.total_credits}
                        {r.credits_against_claim !== 0 && (
                          <span className="ml-1 text-xs">
                            ({r.credits_against_claim > 0 ? '+' : ''}{r.credits_against_claim})
                          </span>
                        )}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className={r.terms_with_courses === r.terms_expected
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-[#6b6076] dark:text-[#9c93ad]'}>
                      {r.terms_with_courses} of {r.terms_expected}
                    </span>
                  </Td>
                  <Td>
                    {onOpen && (
                      <button
                        onClick={() => onOpen(r.version_id)}
                        className="flex items-center gap-1 text-xs font-medium text-[#422e59]
                                   hover:underline dark:text-[#c8b6e8]"
                      >
                        Curriculum <ArrowRight size={12} />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </TBody>
          </TableShell>

          {shown.length === 0 && (
            <p className="p-6 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
              No programme matches that.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
