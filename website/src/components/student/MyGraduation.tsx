'use client';

// ---------------------------------------------------------------------------
// GRADUATION — the checks the University already makes, shown to the person
// they are about.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "Progress toward graduation. 120 required credits, 96 completed, 24
// remaining. Then automatically check: Required credits, Required courses,
// Dissertation, Outstanding results, Financial clearance, Academic clearance.
// And eventually: You are eligible for graduation. Then: Graduation
// application, Graduation status, Ceremony information, Certificate."
//
// ---------------------------------------------------------------------------
// THE CHECKS ARE NOT RE-IMPLEMENTED HERE
// ---------------------------------------------------------------------------
//
// 069 built `graduation_candidate` for the Registry's own Graduation screen,
// and it computes every one of these already. Writing a student version of the
// same arithmetic would give the University two answers to "has this person
// finished", and the first time they differed a student would be told they
// were eligible on their screen and the Registry would be told they were not.
//
// 074's `my_graduation` is that same row, for one student, with the checks
// turned into the ticks the University drew.
//
// ---------------------------------------------------------------------------
// A TICK THIS SYSTEM CANNOT EARN IS NOT DRAWN
// ---------------------------------------------------------------------------
//
// FINANCIAL CLEARANCE IS UNKNOWN, ALWAYS, and it is shown as unknown rather
// than left off the list. Nothing in this database records what a student is
// charged, so nothing can say whether they have paid it. 069 established that
// and this keeps it.
//
// A green tick beside "Financial clearance" that nobody computed is the single
// most damaging mark this screen could make. A student would read it, believe
// they were cleared, and find out otherwise at the congregation — with their
// family already there.
//
// So the three states are kept apart everywhere: MET, NOT MET, and CANNOT BE
// ESTABLISHED. The last one sends a student to an office; the second sends
// them to their studies; and a system that collapsed them would send both to
// the wrong place.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { readMineOne } from '@/lib/studentReads';
import { useJourney } from '@/contexts/JourneyContext';
import { meaningOf } from '@/lib/studentJourney';
import {
  Award, BadgeCheck, CircleHelp, GraduationCap, X as XIcon, Minus,
} from 'lucide-react';
import type { ViewType } from '@/lib/types';

// eslint-disable-next-line max-len
const COLUMNS = 'student_id, full_name, programme_code, programme_name, credits_required, credits_earned, credits_against_award, courses_outstanding, courses_failed, cgpa, min_cgpa, award_title, graduation_id, senate_approved_on, conferred_on, convocation_on, classification, graduation_number, credits_met, courses_met, nothing_failed, cgpa_met, finance_cleared, already_conferred, eligible';

export interface GraduationRow {
  full_name: string;
  programme_name: string | null;
  credits_required: number | null;
  credits_earned: number;
  credits_against_award: number | null;
  courses_outstanding: number;
  courses_failed: number;
  cgpa: number | null;
  min_cgpa: number | null;
  award_title: string | null;
  graduation_id: string | null;
  senate_approved_on: string | null;
  conferred_on: string | null;
  convocation_on: string | null;
  classification: string | null;
  graduation_number: string | null;
  credits_met: boolean | null;
  courses_met: boolean | null;
  nothing_failed: boolean | null;
  cgpa_met: boolean | null;
  finance_cleared: boolean | null;
  already_conferred: boolean;
  eligible: boolean | null;
}

type Check = { label: string; state: boolean | null; says: string };

/**
 * The University's list, with each check in one of THREE states.
 *
 * `null` is not "false with a nicer face". It means the University cannot
 * establish this, and the student has to be told which office can.
 */
export function checksFor(g: GraduationRow): Check[] {
  const short = g.credits_against_award !== null && g.credits_against_award < 0
    ? Math.abs(g.credits_against_award) : 0;
  return [
    {
      label: 'Required credits',
      state: g.credits_met,
      says: g.credits_required === null
        ? 'Your programme records no credit total, so this cannot be checked.'
        : g.credits_met
          ? `${g.credits_earned} of ${g.credits_required} earned.`
          : `${g.credits_earned} of ${g.credits_required} earned — ${short} still to earn.`,
    },
    {
      label: 'Required courses',
      state: g.courses_met,
      says: g.courses_met
        ? 'Every course in your curriculum has been taken.'
        : `${g.courses_outstanding} course${g.courses_outstanding === 1 ? '' : 's'} of your `
          + 'curriculum still to take.',
    },
    {
      label: 'Outstanding results',
      state: g.nothing_failed,
      says: g.nothing_failed
        ? 'Nothing you have taken is unpassed.'
        : `${g.courses_failed} course${g.courses_failed === 1 ? '' : 's'} not passed, `
          + 'to be repeated.',
    },
    {
      label: 'Academic standing',
      state: g.cgpa_met,
      says: g.min_cgpa === null
        ? 'Your award sets no minimum grade point average.'
        : g.cgpa === null
          ? 'No approved results yet, so there is no cumulative GPA to check.'
          : g.cgpa_met
            ? `Cumulative GPA ${Number(g.cgpa).toFixed(2)}, against a minimum of ${g.min_cgpa}.`
            : `Cumulative GPA ${Number(g.cgpa).toFixed(2)}, below the minimum of ${g.min_cgpa}.`,
    },
    {
      // ALWAYS UNKNOWN. See the header — this is the one that must never
      // silently become a tick.
      label: 'Financial clearance',
      state: null,
      says: 'This system does not record what a student is charged, so it cannot tell you '
        + 'whether you are cleared. The Finance Office holds that, and only they can confirm it.',
    },
  ];
}

export default function MyGraduation({ onNavigate }: { onNavigate?: (v: ViewType) => void }) {
  const { stage } = useJourney();
  const [row, setRow] = useState<GraduationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { row: r, failed: f } = await readMineOne<GraduationRow>('my_graduation', COLUMNS);
    setRow(r); setFailed(f); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const checks = row ? checksFor(row) : [];
  const unmet = checks.filter((c) => c.state === false).length;
  const unknown = checks.filter((c) => c.state === null).length;

  return (
    <StudentScreen
      title="Graduation"
      subtitle={row?.award_title ?? 'Where you stand against your award'}
      loading={loading}
      failed={failed}
      empty={!row}
      icon={<GraduationCap size={20} />}
      emptyTitle="There is nothing to assess yet"
      emptyWhy={meaningOf(stage).says}
    >
      {row && (
        <div className="space-y-5">
          {/* ---- ALREADY CONFERRED: the answer, not a checklist ---- */}
          {row.already_conferred ? (
            <Card className="border-emerald-300 p-5 dark:border-emerald-800">
              <div className="flex items-start gap-3">
                <Award size={20} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <div>
                  <h2 className="font-heading text-base font-bold text-emerald-800 dark:text-emerald-300">
                    Your degree has been conferred
                  </h2>
                  <p className="mt-1 text-sm text-[#33234a] dark:text-[#e4dcf0]">
                    {row.award_title}
                    {row.classification ? ` · ${row.classification}` : ''}
                  </p>
                  <dl className="mt-3 grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
                    {row.conferred_on && (
                      <Line label="Conferred" value={readable(row.conferred_on)} />
                    )}
                    {row.senate_approved_on && (
                      <Line label="Senate resolution" value={readable(row.senate_approved_on)} />
                    )}
                    {row.convocation_on && (
                      <Line label="Congregation" value={readable(row.convocation_on)} />
                    )}
                    {row.graduation_number && (
                      <Line label="Graduation number" value={row.graduation_number} />
                    )}
                  </dl>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('my-credentials')}
                      className="mt-4 rounded-lg bg-[#422e59] px-4 py-2 text-xs font-semibold
                                 text-white transition hover:bg-[#33234a]"
                    >
                      Your certificate
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* ---- THE HEADLINE, AND IT IS NEVER "YES" WHILE SOMETHING
                      IS UNKNOWN ---- */}
              <Card className={`p-5 ${
                row.eligible === false ? '' : 'border-[#c5a55a]'
              }`}>
                <h2 className="font-heading text-base font-bold text-[#422e59] dark:text-[#c8b6e8]">
                  {row.eligible === false
                    ? 'Not yet eligible'
                    : 'Everything this system can check is met'}
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed
                              text-[#6b6076] dark:text-[#9c93ad]">
                  {row.eligible === false
                    ? `${unmet} requirement${unmet === 1 ? ' is' : 's are'} still outstanding. `
                      + 'They are listed below, with what is left on each.'
                    : `Your academic requirements are met. ${unknown} check${unknown === 1 ? '' : 's'} `
                      + 'cannot be made by this system at all, so the University — not this '
                      + 'portal — decides whether you graduate.'}
                </p>
              </Card>

              {/* ---- THE CREDITS, AS THE UNIVERSITY WROTE THEM ---- */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Figure label="Required" value={row.credits_required === null
                  ? '—' : String(row.credits_required)} />
                <Figure label="Completed" value={String(row.credits_earned)} />
                <Figure
                  label="Remaining"
                  value={row.credits_required === null ? '—'
                    : String(Math.max(0, row.credits_required - row.credits_earned))}
                  tone={row.credits_met ? 'ok' : 'attention'}
                />
              </div>

              {/* ---- THE CHECKS ---- */}
              <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                {checks.map((c) => (
                  <div key={c.label} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 shrink-0">
                      {c.state === true ? <BadgeCheck size={16} className="text-emerald-600" />
                        : c.state === false ? <XIcon size={16} className="text-red-600" />
                          : <CircleHelp size={16} className="text-[#a07c12]" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                        {c.label}
                        <span className={`ml-2 text-[11px] font-normal ${
                          c.state === true ? 'text-emerald-700 dark:text-emerald-300'
                            : c.state === false ? 'text-red-700 dark:text-red-300'
                              : 'text-[#a07c12]'
                        }`}>
                          {c.state === true ? 'Met'
                            : c.state === false ? 'Not met'
                              : 'Cannot be established here'}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                        {c.says}
                      </p>
                    </div>
                  </div>
                ))}
                {/* THE UNIVERSITY NAMED A DISSERTATION CHECK. Nothing in this
                    system records one, so it is shown as absent rather than
                    silently dropped — a student reading this list should be
                    able to see that it is not being checked. */}
                <div className="flex items-start gap-3 px-4 py-3 opacity-60">
                  <Minus size={16} className="mt-0.5 shrink-0 text-[#a49bb0]" />
                  <div>
                    <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                      Dissertation
                      <span className="ml-2 text-[11px] font-normal text-[#a49bb0]">
                        Not recorded by this system
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      Where your programme requires one, your School holds the record of it. It is
                      not tracked here, so nothing on this page should be read as confirming it.
                    </p>
                  </div>
                </div>
              </Card>

              <p className="text-[11px] leading-relaxed text-[#a49bb0] dark:text-[#7b7289]">
                Graduation is conferred by the Senate. This page shows where you stand against the
                requirements the system can measure; it is not an offer of a place at a
                congregation and it is not a decision.
              </p>
            </>
          )}
        </div>
      )}
    </StudentScreen>
  );
}

function readable(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function Line({ label: l, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-[#a49bb0]">{l}</dt>
      <dd className="font-medium text-[#33234a] dark:text-[#e4dcf0]">{value}</dd>
    </div>
  );
}

function Figure({
  label: l, value, tone = 'plain',
}: { label: string; value: string; tone?: 'plain' | 'ok' | 'attention' }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-[#a49bb0]">{l}</p>
      <p className={`mt-1 font-heading text-2xl font-bold tabular-nums ${
        tone === 'attention' ? 'text-[#a07c12]'
          : tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-[#422e59] dark:text-[#c8b6e8]'
      }`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[#a49bb0]">credits</p>
    </Card>
  );
}
