'use client';

// ---------------------------------------------------------------------------
// WHAT IS STUCK, WHAT IS NOT SET UP, AND WHOSE PASSWORD THE UNIVERSITY KNOWS.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University, looking at a dashboard of eight counters: "it seams the
// dashboard need upgrade. do you think it need some more features?"
//
// It did, and not more counters. The page said Lecturers 0, Departments 1,
// Courses 77 — a catalogue of seventy-seven courses in one department taught by
// nobody — and reported all three in the same neutral grey as everything else.
// A count answers "how many". It never answers "and should somebody do
// something about that", which is the only question a person opening a
// dashboard in the morning actually has.
//
// The proof that it was needed is how Mabel Holten's admission was found:
// by hand, desk by desk, because it had been approved on 29 August and never
// issued and NOTHING anywhere said so. The dashboard is exactly where that
// should have appeared.
//
// ---------------------------------------------------------------------------
// THREE THINGS, AND WHY EACH IS NOT A COUNTER
// ---------------------------------------------------------------------------
//
// 1. WAITING TOO LONG. Not "2 awaiting Finance" but "this one has been at
//    Finance for eleven days". An office with two applications is fine; an
//    office with one application that arrived last month is not, and the
//    counter reads the same in both cases.
//
// 2. NOT SET UP YET. A zero that means "nothing to do" and a zero that means
//    "this was never configured" are the same grey zero on a tile. They are
//    completely different situations and only one of them is anybody's job.
//
// 3. ACCOUNTS THE UNIVERSITY STILL HOLDS THE PASSWORD TO. Migration 090's
//    view. Nobody would think to go looking for this, which is precisely why
//    it belongs somewhere nobody has to.
//
// ---------------------------------------------------------------------------
// AND IT SAYS NOTHING WHEN THERE IS NOTHING TO SAY
// ---------------------------------------------------------------------------
//
// Every section disappears when it is empty, and the whole panel disappears
// when all three are. A standing "all clear" box is a box people stop reading,
// and then stop seeing when it is no longer all clear.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { whereItStands } from '@/lib/admissionWorkflow';
import { stateFromError } from '@/lib/migrationProbes';
import { Card, Skeleton } from '@/components/ui/portal';
import type { ViewType } from '@/lib/types';
import {
  AlertTriangle, ArrowRight, Clock, KeyRound, Wrench,
} from 'lucide-react';

/**
 * How long a record may sit at one desk before it is worth mentioning.
 *
 * SEVEN DAYS, and it is a judgement rather than a rule the University has
 * given. It is long enough that an ordinary week — somebody on leave, a
 * document being chased — does not fill this panel with noise, and short enough
 * that a month-old application cannot hide in it. If the University wants a
 * different number this is the one line to change.
 */
const STALE_AFTER_DAYS = 7;

/** The admission states that mean somebody at the University owes an action. */
const IN_FLIGHT = [
  'applicant', 'under_review', 'documents_verified', 'fee_pending', 'fee_paid',
  'registrar_approved', 'ready_for_academic_review', 'returned',
  'approved', 'conditional', 'admission_processing', 'admission_processing_failed',
  'admission_issued',
];

interface Waiting {
  id: string;
  first_name: string | null;
  last_name: string | null;
  program: string | null;
  status: string | null;
  created_at: string | null;
}

interface Dormant { full_name: string | null; email: string | null; role: string | null }

interface Gap { text: string; go?: ViewType; cta?: string }

const COLUMNS = 'id, first_name, last_name, program, status, created_at';

const daysSince = (iso: string | null) => (iso
  ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  : 0);

export default function NeedsAttention(
  { onNavigate }: { onNavigate?: (v: ViewType) => void } = {},
) {
  const [waiting, setWaiting] = useState<Waiting[] | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [dormant, setDormant] = useState<Dormant[] | null>(null);
  /** Set when migration 090 has not been run, so the panel can say so. */
  const [needs090, setNeeds090] = useState(false);

  const load = useCallback(async () => {
    const [stuck, lecturers, departments, courses, years, schedules, accounts] = await Promise.all([
      supabase.from('students').select(COLUMNS)
        .in('status', IN_FLIGHT).order('created_at', { ascending: true }).limit(60),
      supabase.from('lecturers').select('id', { count: 'exact', head: true }),
      supabase.from('departments').select('id', { count: 'exact', head: true }),
      supabase.from('courses').select('id', { count: 'exact', head: true }),
      supabase.from('academic_years').select('id', { count: 'exact', head: true }),
      supabase.from('fee_schedules').select('id', { count: 'exact', head: true })
        .not('published_at', 'is', null),
      supabase.from('accounts_on_a_temporary_password').select('full_name, email, role').limit(20),
    ]);

    setWaiting(((stuck.data ?? []) as Waiting[])
      .filter((r) => daysSince(r.created_at) >= STALE_AFTER_DAYS));

    // ---- WHAT HAS NOT BEEN SET UP ----------------------------------------
    //
    // Each of these is a sentence somebody can act on, and each appears only
    // when it is true. A list that always has five items on it is a list
    // nobody finishes.
    const found: Gap[] = [];
    const nLect = lecturers.count ?? 0;
    const nDept = departments.count ?? 0;
    const nCourse = courses.count ?? 0;

    if (nLect === 0 && nCourse > 0) {
      found.push({
        text: `${nCourse} course${nCourse === 1 ? '' : 's'} in the catalogue and nobody on the `
          + 'teaching register. No course can be allocated, so no lecturer can be given one.',
        go: 'lecturers',
        cta: 'Add lecturers',
      });
    }
    // A CATALOGUE WITH ONE DEPARTMENT is the shape of a schools-and-departments
    // structure that was never filled in — the courses were loaded and the
    // faculties were not.
    if (nDept <= 1 && nCourse > 10) {
      found.push({
        text: `${nCourse} courses across ${nDept} department${nDept === 1 ? '' : 's'}. `
          + 'Faculties and departments are what a programme hangs from.',
        go: 'academic-structure',
        cta: 'Schools & departments',
      });
    }
    if ((years.count ?? 0) === 0) {
      found.push({
        text: 'No academic year has been set up, so nothing can be offered in a term, timetabled '
          + 'or registered for.',
        go: 'academic-calendar',
        cta: 'Academic calendar',
      });
    }
    if ((schedules.count ?? 0) === 0) {
      found.push({
        text: 'No fee schedule has been published, so no student can be charged and no '
          + 'financial clearance can be judged against anything.',
        go: 'fees',
        cta: 'Fees',
      });
    }
    setGaps(found);

    // ---- AND THE ACCOUNTS ON A PASSWORD THE UNIVERSITY ISSUED ------------
    //
    // A MISSING VIEW IS NOT AN EMPTY LIST. If 090 has not been run the query
    // fails with "relation does not exist", and reporting that as "nobody" is
    // the readiness panel's oldest mistake: vouching for something never
    // looked at.
    if (accounts.error) {
      setNeeds090(stateFromError(accounts.error) === 'outstanding');
      setDormant([]);
    } else {
      setNeeds090(false);
      setDormant((accounts.data ?? []) as Dormant[]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (waiting === null || dormant === null) {
    return <Card className="p-5"><Skeleton className="h-4 w-48" /><Skeleton className="mt-3 h-16 w-full" /></Card>;
  }

  const nothing = waiting.length === 0 && gaps.length === 0
    && dormant.length === 0 && !needs090;
  // NO STANDING "ALL CLEAR". See the note at the top: a box that is always
  // there is a box that stops being read.
  if (nothing) return null;

  const row = 'flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-[#f0ece4] '
    + 'px-5 py-3 text-sm dark:border-[#2a2333]';
  const link = 'ml-auto flex items-center gap-1 text-xs font-semibold text-[#6b4d96] '
    + 'hover:underline disabled:opacity-40 dark:text-[#c4a3e6]';

  return (
    <Card>
      <div className="border-b border-[#f0ece4] px-5 py-4 dark:border-[#2a2333]">
        <h2 className="flex items-center gap-2 font-heading text-sm font-bold text-[#422e59] dark:text-[#e4dcf0]">
          <AlertTriangle size={15} className="text-[#c5a55a]" />
          Needs attention
        </h2>
        <p className="mt-0.5 text-xs text-[#8a8194]">
          Things waiting on somebody, rather than things there are a number of
        </p>
      </div>

      {/* ---- 1. WAITING TOO LONG ------------------------------------- */}
      {waiting.length > 0 && (
        <>
          <p className="flex items-center gap-2 bg-[#faf6ee] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[#8a8194] dark:bg-[#241f2c]">
            <Clock size={13} /> Waiting more than {STALE_AFTER_DAYS} days
          </p>
          {waiting.slice(0, 6).map((r) => {
            const w = whereItStands(r.status);
            return (
              <div key={r.id} className={row}>
                <span className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                  {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                </span>
                <span className="text-[#8a8194]">{r.program ?? ''}</span>
                <span className="basis-full text-[#6b6076] dark:text-[#9c93ad]">
                  {w.waitingFor}
                  {w.office ? ` · ${w.office}` : ''}
                  {' · '}
                  <strong>{daysSince(r.created_at)} days</strong>
                </span>
              </div>
            );
          })}
          {waiting.length > 6 && (
            <p className="px-5 py-2 text-xs text-[#8a8194]">
              and {waiting.length - 6} more
            </p>
          )}
        </>
      )}

      {/* ---- 2. NOT SET UP YET --------------------------------------- */}
      {gaps.length > 0 && (
        <>
          <p className="flex items-center gap-2 bg-[#faf6ee] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[#8a8194] dark:bg-[#241f2c]">
            <Wrench size={13} /> Not set up yet
          </p>
          {gaps.map((g) => (
            <div key={g.text} className={row}>
              <span className="flex-1 text-[#6b6076] dark:text-[#9c93ad]">{g.text}</span>
              {g.go && (
                <button
                  type="button"
                  className={link}
                  disabled={!onNavigate}
                  onClick={() => onNavigate?.(g.go as ViewType)}
                >
                  {g.cta} <ArrowRight size={12} />
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {/* ---- 3. PASSWORDS THE UNIVERSITY STILL KNOWS ------------------ */}
      {(dormant.length > 0 || needs090) && (
        <>
          <p className="flex items-center gap-2 bg-[#faf6ee] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[#8a8194] dark:bg-[#241f2c]">
            <KeyRound size={13} /> Still on a password the University issued
          </p>
          {needs090 ? (
            <p className={`${row} text-[#6b6076] dark:text-[#9c93ad]`}>
              This cannot be checked until{' '}
              <code className="rounded bg-[#f3efe7] px-1 dark:bg-[#2a2333]">
                090_a_password_the_university_never_knew.sql
              </code>{' '}
              has been run. Until then nobody knows which accounts are still on the temporary
              password that was generated and emailed to them.
            </p>
          ) : (
            <>
              {dormant.slice(0, 6).map((d) => (
                <div key={d.email ?? d.full_name ?? Math.random()} className={row}>
                  <span className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                    {d.full_name ?? d.email ?? '—'}
                  </span>
                  <span className="text-[#8a8194]">{d.role ?? ''}</span>
                </div>
              ))}
              <p className="px-5 py-3 text-xs text-[#8a8194]">
                {dormant.length > 6 ? `and ${dormant.length - 6} more. ` : ''}
                Each of these can still be signed into with the password the system generated,
                which is sitting in an inbox. They are asked to change it the next time they
                sign in.
              </p>
            </>
          )}
        </>
      )}
    </Card>
  );
}
