'use client';

// ---------------------------------------------------------------------------
// ACADEMIC CALENDAR — the University's own, seen from a student's side.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "Academic Calendar 2026/27 — Registration opens, Registration closes,
// Semester begins, Teaching weeks, Examination period, Results publication,
// Semester break, Graduation. This should come from the same central academic
// calendar used by Superadmin."
//
// ---------------------------------------------------------------------------
// "THE SAME CENTRAL CALENDAR" IS THE WHOLE REQUIREMENT
// ---------------------------------------------------------------------------
//
// This screen has no data of its own and cannot have any. It reads
// `my_calendar`, which is 066's `academic_period_calendar` — the identical
// rows the Registry administers on the Academic calendar screen. A date
// corrected there is corrected here in the same instant, because there is only
// one of it.
//
// The alternative — a student calendar the Registry publishes to — was not
// worth building and would have been worse: two copies of a date is two dates,
// and the one a student misses a registration deadline by is always the stale
// one.
//
// ---------------------------------------------------------------------------
// FOUR OF THE UNIVERSITY'S EIGHT ROWS DO NOT EXIST YET, AND ARE NOT INVENTED
// ---------------------------------------------------------------------------
//
// `academic_periods` records four kinds: registration, teaching, examination
// and results. The University's list also names teaching weeks, semester
// break, semester begins and graduation.
//
// Those are not drawn from nothing. A graduation date on a student's calendar
// that no Senate has set is the kind of invented fact that gets somebody's
// family on a plane. The screen says which are not yet recorded, so the
// absence reads as "not set" rather than "nothing is happening".
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { readMine } from '@/lib/studentReads';
import { CalendarDays, CircleDot } from 'lucide-react';

// eslint-disable-next-line max-len
const COLUMNS = 'id, kind, starts_on, ends_on, note, term_id, term_sequence, term_name, year_label, starts_in, in_force, standing, happening_now';

export interface CalendarRow {
  id: string;
  kind: string;
  starts_on: string;
  ends_on: string | null;
  note: string | null;
  term_sequence: number | null;
  term_name: string | null;
  year_label: string | null;
  starts_in: number | null;
  in_force: boolean | null;
  standing: 'upcoming' | 'open' | 'past';
  happening_now: boolean;
}

/** The University's own words for each kind of window. */
export const KIND_LABEL: Record<string, string> = {
  registration: 'Registration',
  teaching: 'Teaching',
  examination: 'Examinations',
  results: 'Results publication',
};

export function label(kind: string): string {
  return KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** "3 September – 20 December 2026", or a single date where there is one. */
export function span(startsOn: string, endsOn: string | null): string {
  const fmt = (iso: string, withYear: boolean) => new Date(`${iso}T00:00:00`)
    .toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}),
    });
  if (!endsOn) return fmt(startsOn, true);
  const sameYear = startsOn.slice(0, 4) === endsOn.slice(0, 4);
  return `${fmt(startsOn, !sameYear)} – ${fmt(endsOn, true)}`;
}

export default function MyCalendar() {
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { rows: r, failed: f } = await readMine<CalendarRow>(
      'my_calendar', COLUMNS, { column: 'starts_on', ascending: true },
    );
    setRows(r); setFailed(f); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Grouped by academic year, the year in force first — that is the one a
  // student opens this for. Past years stay, because "when did last year's
  // examinations run" is a real question.
  const years = useMemo(() => {
    const byYear = new Map<string, CalendarRow[]>();
    for (const r of rows) {
      const key = r.year_label ?? 'Not dated to a year';
      byYear.set(key, [...(byYear.get(key) ?? []), r]);
    }
    // Array.from rather than spreading — see the note in MyFinance.
    return Array.from(byYear.entries())
      .map(([yearLabel, items]) => ({
        yearLabel,
        inForce: items.some((i: CalendarRow) => Boolean(i.in_force)),
        startsIn: items[0]?.starts_in ?? 0,
        items: items.sort((a: CalendarRow, b: CalendarRow) =>
          a.starts_on.localeCompare(b.starts_on)),
      }))
      .sort((a, b) => (b.inForce ? 1 : 0) - (a.inForce ? 1 : 0) || b.startsIn - a.startsIn);
  }, [rows]);

  return (
    <StudentScreen
      title="Academic calendar"
      subtitle={rows.length === 0 ? 'The University’s dates'
        : `${rows.length} dated period${rows.length === 1 ? '' : 's'}`}
      loading={loading}
      failed={failed}
      empty={rows.length === 0}
      icon={<CalendarDays size={20} />}
      emptyTitle="The calendar has no dates in it yet"
      emptyWhy={'The Registry has not recorded any registration, teaching, examination or '
        + 'results period. Nothing is missing from your record — the calendar itself is empty.'}
    >
      <div className="space-y-6">
        {years.map((y) => (
          <section key={y.yearLabel} className="space-y-2">
            <h2 className="flex items-center gap-2 font-heading text-sm font-bold
                           text-[#422e59] dark:text-[#c8b6e8]">
              {y.yearLabel}
              {y.inForce && (
                <span className="rounded-full bg-[#422e59] px-2 py-0.5 text-[10px] font-medium
                                 text-white">
                  This year
                </span>
              )}
            </h2>
            <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
              {y.items.map((r: CalendarRow) => (
                <div key={r.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${
                  r.happening_now ? 'bg-[#faf6ee] dark:bg-[#241f2c]' : ''
                }`}>
                  <CircleDot
                    size={13}
                    className={`shrink-0 ${
                      r.happening_now ? 'text-[#c5a55a]'
                        : r.standing === 'past' ? 'text-[#d5cec0]' : 'text-[#9a86b5]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${
                      r.standing === 'past'
                        ? 'text-[#a49bb0]'
                        : 'font-medium text-[#33234a] dark:text-[#e4dcf0]'
                    }`}>
                      {label(r.kind)}
                      {r.term_name ? ` · ${r.term_name}` : r.term_sequence
                        ? ` · Semester ${r.term_sequence}` : ''}
                    </p>
                    {r.note && <p className="truncate text-[11px] text-[#a49bb0]">{r.note}</p>}
                  </div>
                  <span className={`shrink-0 text-xs tabular-nums ${
                    r.standing === 'past' ? 'text-[#a49bb0]'
                      : 'text-[#6b6076] dark:text-[#9c93ad]'
                  }`}>
                    {span(r.starts_on, r.ends_on)}
                  </span>
                  <span className={`w-20 shrink-0 text-right text-[11px] font-medium ${
                    r.happening_now ? 'text-[#a07c12]'
                      : r.standing === 'past' ? 'text-[#c0b8cb]' : 'text-[#9a86b5]'
                  }`}>
                    {r.happening_now ? 'Now' : r.standing === 'past' ? 'Passed' : 'Upcoming'}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        ))}

        <p className="text-[11px] leading-relaxed text-[#a49bb0] dark:text-[#7b7289]">
          These are the University&apos;s own dates — the same ones the Registry keeps, not a copy.
          Teaching weeks, the semester break and graduation are not yet recorded as dated periods,
          so they do not appear here; nothing has been put in their place.
        </p>
      </div>
    </StudentScreen>
  );
}
