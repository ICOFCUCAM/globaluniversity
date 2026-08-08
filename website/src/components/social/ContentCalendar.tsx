'use client';

// ---------------------------------------------------------------------------
// THE CONTENT CALENDAR.
//
// What the University has said, and what it is about to say, on one month.
//
// ---------------------------------------------------------------------------
// A CALENDAR IS A QUERY, NOT A TABLE
// ---------------------------------------------------------------------------
//
// There is no `calendar_entries` table and there should not be. A post already
// carries the only two dates that matter — `scheduled_for` for what is planned
// and `published_at` for what went out — and a second table describing those
// posts would immediately be able to disagree with them. The usual symptom is a
// calendar showing an announcement that was cancelled a week ago.
//
// ---------------------------------------------------------------------------
// WHY THE PAST AND THE FUTURE SHARE A GRID
// ---------------------------------------------------------------------------
//
// Because the question a communications office actually asks is "have we said
// too much this week, and is anything clashing" — and that cannot be answered
// by a list of what is scheduled with the published history on another screen.
// Three announcements on a Tuesday is a problem whether they are behind or
// ahead.
//
// Awaiting approval is shown in the same grid rather than only in the queue,
// for the same reason: a post that nobody has approved by the morning of the
// day it is due is the thing most worth seeing on a calendar.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { runQuery } from '@/lib/runQuery';
import { statusFromTargets, type TargetState, type ApprovalState } from '@/lib/social';
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';

interface Entry {
  id: string;
  body: string;
  when: Date;
  /** Has it happened, or is it planned? */
  past: boolean;
  approvalState: ApprovalState;
  status: string;
  targets: TargetState[];
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ContentCalendar({ onOpen }: { onOpen?: (id: string) => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  // The month being viewed, as the first of that month at local midnight.
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const load = useCallback(async () => {
    // A generous window either side of the month on screen, so paging back and
    // forward does not re-query for every click.
    const from = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1).toISOString();
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 1).toISOString();

    const { data, error } = await runQuery(supabase
      .from('social_posts')
      .select('id, body, status, approval_state, scheduled_for, published_at, created_at, social_post_targets(status)')
      .or(`scheduled_for.gte.${from},published_at.gte.${from}`)
      .lte('created_at', to)
      .limit(400));

    if (error) {
      setNotReady(
        error.message.includes('approval_state')
          ? 'Run docs/migrations/014_social_approval_and_retry.sql.'
          : error.message,
      );
      setEntries([]);
      return;
    }
    setNotReady(null);

    const now = Date.now();
    setEntries((data ?? []).map((p: Record<string, any>) => {
      // PUBLISHED BEATS SCHEDULED. A post scheduled for Tuesday and published
      // on Wednesday belongs on Wednesday — that is when the University spoke.
      const stamp = p.published_at ?? p.scheduled_for ?? p.created_at;
      return {
        id: String(p.id),
        body: p.body ?? '',
        when: new Date(stamp),
        past: Date.parse(stamp) <= now,
        approvalState: (p.approval_state ?? 'draft') as ApprovalState,
        status: p.status,
        targets: (p.social_post_targets ?? []).map((t: any) => t.status as TargetState),
      };
    }));
  }, [cursor]);

  useEffect(() => { void load(); }, [load]);

  /**
   * The grid, as whole weeks starting on Monday.
   *
   * WHOLE WEEKS, NOT A RAGGED MONTH. A month view that begins on the 1st
   * wherever it happens to fall makes "how much did we post that week" require
   * looking at two grids, and the week is the unit a communications office
   * plans in.
   */
  const weeks = useMemo(() => {
    const first = new Date(cursor);
    // getDay() is 0 for Sunday; shift so Monday is 0.
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - lead);

    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    // Drop a trailing week that belongs entirely to the next month.
    const trimmed = cells.slice(0, cells[35].getMonth() === cursor.getMonth() ? 42 : 35);

    const out: Date[][] = [];
    for (let i = 0; i < trimmed.length; i += 7) out.push(trimmed.slice(i, i + 7));
    return out;
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries ?? []) {
      const key = e.when.toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [entries]);

  const today = new Date().toDateString();

  return (
    <div>
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading font-bold text-lg text-[#422e59] dark:text-[#e4dcf0]">
          {cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded-lg border border-[#ece7de] p-1.5 text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}
            className="rounded-lg border border-[#ece7de] px-2.5 py-1.5 text-xs text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded-lg border border-[#ece7de] p-1.5 text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </header>

      {notReady && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">{notReady}</span>
        </div>
      )}

      {entries === null ? (
        <Loader2 size={18} className="mt-6 animate-spin text-[#9c93ad]" />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-[#ece7de] bg-[#ece7de] dark:border-[#2e2637] dark:bg-[#2e2637]">
            {DAY_NAMES.map((d) => (
              <div key={d} className="bg-[#faf8f4] px-2 py-1.5 text-center text-xs font-semibold text-[#9c93ad] dark:bg-[#241f2c]">
                {d}
              </div>
            ))}
            {weeks.flat().map((day) => {
              const key = day.toDateString();
              const items = byDay.get(key) ?? [];
              const otherMonth = day.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={key}
                  className={`min-h-[5.5rem] bg-white p-1.5 dark:bg-[#1f1a27] ${
                    otherMonth ? 'opacity-40' : ''
                  }`}
                >
                  <div className={`text-xs ${
                    key === today
                      ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#241a30] font-semibold text-white dark:bg-[#c5a55a] dark:text-[#241a30]'
                      : 'text-[#9c93ad]'
                  }`}>
                    {day.getDate()}
                  </div>
                  <div className="mt-1 space-y-1">
                    {items.slice(0, 3).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onOpen?.(e.id)}
                        title={e.body}
                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] ${toneFor(e)}`}
                      >
                        {e.body.split('\n')[0] || 'Untitled'}
                      </button>
                    ))}
                    {items.length > 3 && (
                      <p className="px-1 text-[11px] text-[#9c93ad]">+{items.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* THE KEY. Four colours on a grid with no legend is decoration. */}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            <Key className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300">Published</Key>
            <Key className="bg-[#e9c14a]/20 text-[#8a6a10]">Some networks failed</Key>
            <Key className="bg-[#422e59]/12 text-[#422e59] dark:text-[#c5a55a]">Scheduled</Key>
            <Key className="bg-red-600/10 text-red-700 dark:text-red-300">Waiting for approval</Key>
            <Key className="bg-[#ece7de] text-[#6b6076] dark:bg-[#2e2637] dark:text-[#9c93ad]">Draft</Key>
          </ul>

          {(entries?.length ?? 0) === 0 && !notReady && (
            <p className="mt-4 text-sm text-[#6b6076] dark:text-[#9c93ad]">
              Nothing planned or published in this month.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The colour of one entry.
 *
 * APPROVAL OUTRANKS SCHEDULE, deliberately. A post scheduled for Friday that
 * nobody has approved is not "scheduled" in any useful sense — it will not go
 * out — and colouring it as though it will is how a communications office
 * discovers on Friday afternoon that the graduation announcement never left.
 */
function toneFor(e: Entry): string {
  if (e.past || e.status === 'published' || e.status === 'partially_failed') {
    const outcome = statusFromTargets(e.targets);
    if (outcome === 'partially_failed' || outcome === 'failed') {
      return 'bg-[#e9c14a]/20 text-[#8a6a10]';
    }
    if (e.status === 'published') return 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300';
  }
  if (e.approvalState === 'submitted' || e.approvalState === 'rejected') {
    return 'bg-red-600/10 text-red-700 dark:text-red-300';
  }
  if (e.status === 'scheduled') return 'bg-[#422e59]/12 text-[#422e59] dark:text-[#c5a55a]';
  return 'bg-[#ece7de] text-[#6b6076] dark:bg-[#2e2637] dark:text-[#9c93ad]';
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-5 rounded ${className}`} aria-hidden="true" />
      {children}
    </li>
  );
}
